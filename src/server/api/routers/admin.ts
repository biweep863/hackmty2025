// src/server/api/routers/admin.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "~/server/db";
import { env } from "~/env";

// Fallback pricing if you don't store it in DB:
const PRICE_PER_SEAT_CENTS = Number(3000); // $30 default
const MARGIN_PCT = Number(0.15); // 15% default margin

type TripFinance = {
  tripId: string;
  departureAt: Date;
  fromLabel: string;
  toLabel: string;
  seatsTotal: number;
  seatsTaken: number;
  status: string;
  grossCents: number;
  netCents: number;
};

function computeTripFinance(input: {
  trip: {
    id: string;
    departureAt: Date;
    seatsTotal: number;
    seatsTaken: number;
    status: string;
    routeTemplate: { fromLabel: string; toLabel: string };
  };
  pricePerSeatCents?: number;
  marginPct?: number;
}): TripFinance {
  const price = input.pricePerSeatCents ?? PRICE_PER_SEAT_CENTS;
  const margin = input.marginPct ?? MARGIN_PCT;
  const gross = input.trip.seatsTaken * price;
  const net = Math.round(gross * (1 - margin));
  return {
    tripId: input.trip.id,
    departureAt: input.trip.departureAt,
    fromLabel: input.trip.routeTemplate.fromLabel,
    toLabel: input.trip.routeTemplate.toLabel,
    seatsTotal: input.trip.seatsTotal,
    seatsTaken: input.trip.seatsTaken,
    status: input.trip.status,
    grossCents: gross,
    netCents: net,
  };
}

export const adminRouter = createTRPCRouter({
  // Basic guard: require logged-in user (add role guard if needed)
  summary: protectedProcedure
    .input(
      z
        .object({
          from: z.string().datetime().optional(),
          to: z.string().datetime().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.from || input?.to) {
        where.departureAt = {};
        if (input.from) where.departureAt.gte = new Date(input.from);
        if (input.to) where.departureAt.lte = new Date(input.to);
      }

      const trips = await db.trip.findMany({
        where,
        include: {
          routeTemplate: { select: { fromLabel: true, toLabel: true } },
        },
      });

      const financials = trips.map((t) =>
        computeTripFinance({
          trip: t,
          pricePerSeatCents: PRICE_PER_SEAT_CENTS,
          marginPct: MARGIN_PCT,
        }),
      );

      const tripsCount = trips.length;
      const seatsSold = trips.reduce((acc, t) => acc + t.seatsTaken, 0);
      const seatsCapacity = trips.reduce((acc, t) => acc + t.seatsTotal, 0);
      const grossCents = financials.reduce((acc, f) => acc + f.grossCents, 0);
      const netCents = financials.reduce((acc, f) => acc + f.netCents, 0);
      const occupancy = seatsCapacity > 0 ? seatsSold / seatsCapacity : 0;

      return {
        tripsCount,
        seatsSold,
        seatsCapacity,
        occupancy, // 0..1
        grossCents,
        netCents,
        currency: "USD", // change if needed
      };
    }),

  salesTrend: protectedProcedure
    .input(
      z.object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        // 'day' | 'week' | 'month'
        bucket: z.enum(["day", "week", "month"]).default("day"),
      }),
    )
    .query(async ({ input }) => {
      const where: any = {};
      if (input.from || input.to) {
        where.departureAt = {};
        if (input.from) where.departureAt.gte = new Date(input.from);
        if (input.to) where.departureAt.lte = new Date(input.to);
      }

      const trips = await db.trip.findMany({
        where,
        include: {
          routeTemplate: { select: { fromLabel: true, toLabel: true } },
        },
        orderBy: { departureAt: "asc" },
      });

      const fin = trips.map((t) => computeTripFinance({ trip: t }));
      const buckets = new Map<
        string,
        { gross: number; net: number; count: number }
      >();

      const toKey = (d: Date) => {
        const dt = new Date(d);
        if (input.bucket === "day") {
          return `${dt.getUTCFullYear()}-${dt.getUTCMonth() + 1}-${dt.getUTCDate()}`;
        }
        if (input.bucket === "week") {
          // ISO week approximation
          const firstJan = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
          const day = Math.floor(
            (dt.getTime() - firstJan.getTime()) / 86400000,
          );
          const week = Math.floor((day + firstJan.getUTCDay()) / 7);
          return `${dt.getUTCFullYear()}-W${week}`;
        }
        // month
        return `${dt.getUTCFullYear()}-${dt.getUTCMonth() + 1}`;
      };

      for (const f of fin) {
        const key = toKey(f.departureAt);
        const b = buckets.get(key) ?? { gross: 0, net: 0, count: 0 };
        b.gross += f.grossCents;
        b.net += f.netCents;
        b.count += 1;
        buckets.set(key, b);
      }

      const series = [...buckets.entries()]
        .sort((a, b) => (a[0] > b[0] ? 1 : -1))
        .map(([bucket, v]) => ({
          bucket,
          grossCents: v.gross,
          netCents: v.net,
          trips: v.count,
        }));

      return { series, currency: "USD" };
    }),

  tripRevenues: protectedProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(200).default(50) })
        .optional(),
    )
    .query(async ({ input }) => {
      const trips = await db.trip.findMany({
        include: {
          routeTemplate: { select: { fromLabel: true, toLabel: true } },
        },
        orderBy: { departureAt: "desc" },
        take: input?.limit ?? 50,
      });
      return trips.map((t) => computeTripFinance({ trip: t }));
    }),

  // Very simple anomaly checks; tune as you wish
  securityAnomalies: protectedProcedure
    .input(
      z
        .object({
          occupancyThreshold: z.number().min(0).max(1).default(0.2),
          includeCanceled: z.boolean().default(true),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const trips = await db.trip.findMany({
        include: {
          routeTemplate: { select: { fromLabel: true, toLabel: true } },
          bookings: { select: { status: true } },
        },
        orderBy: { departureAt: "desc" },
        take: 200, // last N
      });

      const anomalies = [];
      for (const t of trips) {
        const occupancy = t.seatsTotal > 0 ? t.seatsTaken / t.seatsTotal : 0;
        const cancels =
          t.bookings.filter(
            (b) =>
              b.status === "CANCELED_BY_RIDER" ||
              b.status === "CANCELED_BY_DRIVER",
          ).length || 0;
        const pending =
          t.bookings.filter((b) => b.status === "PENDING").length || 0;
        const rejected =
          t.bookings.filter((b) => b.status === "REJECTED").length || 0;

        if ((input?.includeCanceled ?? true) && t.status === "CANCELED") {
          anomalies.push({
            tripId: t.id,
            type: "TRIP_CANCELED",
            departureAt: t.departureAt,
            route: `${t.routeTemplate.fromLabel} → ${t.routeTemplate.toLabel}`,
            detail: `Trip canceled; pending: ${pending}, rejected: ${rejected}, cancels: ${cancels}`,
          });
        }
        if (t.seatsTaken === 0) {
          anomalies.push({
            tripId: t.id,
            type: "ZERO_SEATS_TAKEN",
            departureAt: t.departureAt,
            route: `${t.routeTemplate.fromLabel} → ${t.routeTemplate.toLabel}`,
            detail: "Trip ended with zero riders",
          });
        }
        if (occupancy < (input?.occupancyThreshold ?? 0.2)) {
          anomalies.push({
            tripId: t.id,
            type: "LOW_OCCUPANCY",
            departureAt: t.departureAt,
            route: `${t.routeTemplate.fromLabel} → ${t.routeTemplate.toLabel}`,
            detail: `Occupancy ${(occupancy * 100).toFixed(0)}%`,
          });
        }
        if (rejected >= 3) {
          anomalies.push({
            tripId: t.id,
            type: "HIGH_REJECTION",
            departureAt: t.departureAt,
            route: `${t.routeTemplate.fromLabel} → ${t.routeTemplate.toLabel}`,
            detail: `Rejected ${rejected} bookings`,
          });
        }
      }
      return { anomalies };
    }),
});

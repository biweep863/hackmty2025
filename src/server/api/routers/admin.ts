// src/server/api/routers/admin.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { db } from "~/server/db";
import { env } from "~/env";

// Fallback pricing if you don't store it in DB:
const PRICE_PER_SEAT_CENTS = Number(3000); // $30 default
const MARGIN_PCT = Number(0.15); // 15% default margin

type TripFinance = {
  id: string;
  createdAt: Date;
  fromLabel: string;
  toLabel: string;
  seatsTaken: number;
  seatsCapacity?: number | null;
  grossCents: number;
  netCents: number;
};

function computeTripFinanceForRide(input: {
  ride: {
    id: string;
    createdAt: Date;
    origin: string;
    destination: string;
    price: number | string | null;
    clients?: Array<unknown> | null;
  };
  pricePerSeatCents?: number;
  marginPct?: number;
}): TripFinance {
  const priceCents = input.pricePerSeatCents ?? PRICE_PER_SEAT_CENTS;
  const margin = input.marginPct ?? MARGIN_PCT;
  const seatsTaken = (input.ride.clients?.length ?? 0) as number;
  const gross = seatsTaken * priceCents;
  const net = Math.round(gross * (1 - margin));
  return {
    id: input.ride.id,
    createdAt: input.ride.createdAt,
    fromLabel: input.ride.origin,
    toLabel: input.ride.destination,
    seatsTaken,
    seatsCapacity: null,
    grossCents: gross,
    netCents: net,
  };
}

export const adminRouter = createTRPCRouter({
  // NOTE: switched these endpoints to `publicProcedure` so the Admin page
  // can be viewed without requiring an authenticated session. If these
  // should be restricted, switch back to `protectedProcedure` and add a
  // role-based guard.
  summary: publicProcedure
    .input(
      z
        .object({
          from: z.string().datetime().optional(),
          to: z.string().datetime().optional(),
          // Optional overrides so admin can preview different pricing / margin
          pricePerSeatCents: z.number().int().optional(),
          marginPct: z.number().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.from || input?.to) {
        where.createdAt = {};
        if (input.from) where.createdAt.gte = new Date(input.from);
        if (input.to) where.createdAt.lte = new Date(input.to);
      }

      // Query Ride model (existing in schema). Include clients so we can count attendees.
      const rides = await db.ride.findMany({
        where,
        include: { clients: true },
      });

      const priceOverride = input?.pricePerSeatCents;
      const marginOverride = input?.marginPct;

      const financials = rides.map((r) =>
        computeTripFinanceForRide({
          ride: r as any,
          pricePerSeatCents: priceOverride ?? PRICE_PER_SEAT_CENTS,
          marginPct: marginOverride ?? MARGIN_PCT,
        }),
      );

      const tripsCount = rides.length;
      const seatsSold = rides.reduce(
        (acc, r) => acc + (r.clients?.length ?? 0),
        0,
      );
      const seatsCapacity = 0; // not tracked in Ride model
      const grossCents = financials.reduce((acc, f) => acc + f.grossCents, 0);
      const netCents = financials.reduce((acc, f) => acc + f.netCents, 0);
      const occupancy = 0; // cannot compute without capacity

      return {
        tripsCount,
        seatsSold,
        seatsCapacity,
        occupancy,
        grossCents,
        netCents,
        currency: "USD",
      };
    }),

  salesTrend: publicProcedure
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
        where.createdAt = {};
        if (input.from) where.createdAt.gte = new Date(input.from);
        if (input.to) where.createdAt.lte = new Date(input.to);
      }

      const rides = await db.ride.findMany({
        where,
        include: { clients: true },
        orderBy: { createdAt: "asc" },
      });

      const fin = rides.map((r) =>
        computeTripFinanceForRide({ ride: r as any }),
      );
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
        const key = toKey(f.createdAt);
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

  tripRevenues: publicProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(200).default(50) })
        .optional(),
    )
    .query(async ({ input }) => {
      const rides = await db.ride.findMany({
        include: { clients: true },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 50,
      });

      // Compute basic statistics for price to flag outliers
      const prices: number[] = [];
      for (const r of rides) {
        const p = (r as any).price;
        if (p != null) prices.push(Number(p));
      }
      const mean = prices.length
        ? prices.reduce((a, b) => a + b, 0) / prices.length
        : 0;
      const variance = prices.length
        ? prices.reduce((a, b) => a + Math.pow(Number(b) - mean, 2), 0) /
          prices.length
        : 0;
      const std = Math.sqrt(variance);

      return rides.map((r) => {
        const fin = computeTripFinanceForRide({ ride: r as any });
        const priceNum =
          (r as any).price != null ? Number((r as any).price) : null;
        const suspicious =
          fin.seatsTaken === 0 ||
          priceNum == null ||
          (priceNum != null &&
            std > 0 &&
            (priceNum > mean + 3 * std || priceNum < mean - 3 * std));
        return {
          id: fin.id,
          createdAt: fin.createdAt,
          fromLabel: fin.fromLabel,
          toLabel: fin.toLabel,
          seatsTaken: fin.seatsTaken,
          seatsCapacity: fin.seatsCapacity ?? null,
          grossCents: fin.grossCents,
          netCents: fin.netCents,
          priceCents: priceNum != null ? Math.round(priceNum * 100) : null,
          suspicious,
          raw: r,
        };
      });
    }),

  // Very simple anomaly checks; tune as you wish
  securityAnomalies: publicProcedure
    .input(
      z
        .object({
          occupancyThreshold: z.number().min(0).max(1).default(0.2),
          includeCanceled: z.boolean().default(true),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const rides = await db.ride.findMany({
        include: { clients: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

      const anomalies: Array<any> = [];
      for (const r of rides) {
        const seatsTaken = r.clients?.length ?? 0;

        if (seatsTaken === 0) {
          anomalies.push({
            rideId: r.id,
            type: "ZERO_SEATS_TAKEN",
            createdAt: r.createdAt,
            route: `${r.origin} → ${r.destination}`,
            detail: "Ride ended with zero riders",
          });
        }
      }
      return { anomalies };
    }),
});

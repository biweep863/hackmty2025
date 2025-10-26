import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { z } from "zod";
import { db } from "~/server/db";

const routeInput = z.object({
  fromLabel: z.string().min(1),
  fromLat: z.number().optional(),
  fromLng: z.number().optional(),
  fromSiteId: z.string().optional(),
  toLabel: z.string().min(1),
  toLat: z.number().optional(),
  toLng: z.number().optional(),
  toSiteId: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const routesRouter = createTRPCRouter({
  listMine: publicProcedure.query(({ ctx }) => {
    // tolerate possibly-undefined session at runtime; cast for TS until protectedProcedure is used in callers
    const userId = (ctx.session as any)?.user?.id;
    return db.routeTemplate.findMany({
      where: { carpooler: { userId } },
      orderBy: { createdAt: "desc" },
    });
  }),
  create: publicProcedure.input(routeInput).mutation(async ({ ctx, input }) => {
    const userId = (ctx.session as any)?.user?.id;
    const profile = await db.carpoolerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new Error("CARPOOLER_PROFILE_REQUIRED");
    return db.routeTemplate.create({
      data: { carpoolerId: profile.id, ...input },
    });
  }),
  update: publicProcedure
    .input(routeInput.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // opcional: verificar propiedad
      return db.routeTemplate.update({
        where: { id: input.id },
        data: { ...input, id: undefined },
      });
    }),
  // Return pickup points near the straight line between A (fromLat,fromLng)
  // and B (toLat,toLng). This uses a simple bounding-box + geometric filter
  // (point-to-segment distance) so it doesn't require an external routing API.
  pickupPointsAlongRoute: publicProcedure
    .input(
      z.object({
        fromLat: z.number(),
        fromLng: z.number(),
        toLat: z.number(),
        toLng: z.number(),
        bufferMeters: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { fromLat, fromLng, toLat, toLng } = input;
      const bufferMeters = input.bufferMeters ?? 1500; // default 1500m (more permissive)

      // Simple degree buffer approximation (1 deg lat ~ 111.32 km)
      const degPerMeterLat = 1 / 111320; // ~ degrees per meter for latitude
      const meanLat = (fromLat + toLat) / 2;
      const meanLatRad = (meanLat * Math.PI) / 180;
      // avoid using `||` which could mask zero; compute directly
      const degPerMeterLng = 1 / (111320 * Math.cos(meanLatRad));

      const latBuffer = bufferMeters * degPerMeterLat;
      const lngBuffer = bufferMeters * degPerMeterLng;

      const minLat = Math.min(fromLat, toLat) - latBuffer;
      const maxLat = Math.max(fromLat, toLat) + latBuffer;
      const minLng = Math.min(fromLng, toLng) - lngBuffer;
      const maxLng = Math.max(fromLng, toLng) + lngBuffer;

      const candidates = await db.pickupPoint.findMany({
        where: {
          isActive: true,
          lat: { gte: minLat, lte: maxLat },
          lng: { gte: minLng, lte: maxLng },
        },
        include: { site: true },
      });

      // Debug: log bbox and candidate count to help diagnose missing points
      try {
        console.log("pickupPointsAlongRoute bbox", {
          minLat,
          maxLat,
          minLng,
          maxLng,
          bufferMeters,
        });
        console.log(
          "pickupPointsAlongRoute candidates before filter:",
          candidates.length,
        );
      } catch (e) {
        // ignore logging errors
      }

      // Helpers to compute distance (meters) from point to segment AB
      const metersPerDegLat = 111320;
      const metersPerDegLng = (lat: number) =>
        111320 * Math.cos((lat * Math.PI) / 180);

      function pointToSegmentDistanceMeters(
        px: number,
        py: number,
        ax: number,
        ay: number,
        bx: number,
        by: number,
      ) {
        // Convert degrees to meters relative to A using mean latitude of segment
        const meanLatSeg = (ay + by) / 2;
        const mLat = metersPerDegLat;
        const mLng = metersPerDegLng(meanLatSeg) || metersPerDegLat;

        const Ax = 0;
        const Ay = 0;
        const Bx = (bx - ax) * mLng;
        const By = (by - ay) * mLat;
        const Px = (px - ax) * mLng;
        const Py = (py - ay) * mLat;

        const ABx = Bx - Ax;
        const ABy = By - Ay;
        const ABlen2 = ABx * ABx + ABy * ABy;
        if (ABlen2 === 0) {
          // A and B are the same point
          return Math.sqrt(Px * Px + Py * Py);
        }
        const t = Math.max(0, Math.min(1, (Px * ABx + Py * ABy) / ABlen2));
        const ClosestX = Ax + ABx * t;
        const ClosestY = Ay + ABy * t;
        const dx = Px - ClosestX;
        const dy = Py - ClosestY;
        return Math.sqrt(dx * dx + dy * dy);
      }

      // compute distances for all candidates and optionally return debug info
      const computed = candidates
        .map((p) => {
          const plat = p.lat != null ? parseFloat(String(p.lat)) : undefined;
          const plng = p.lng != null ? parseFloat(String(p.lng)) : undefined;
          if (plat == null || plng == null) return null;
          const dist = pointToSegmentDistanceMeters(
            plng,
            plat,
            fromLng,
            fromLat,
            toLng,
            toLat,
          );
          return {
            id: p.id,
            label: p.label,
            lat: plat,
            lng: plng,
            site: p.site,
            distanceMeters: Math.round(dist),
            _raw: { dbLat: p.lat, dbLng: p.lng },
          };
        })
        .filter(Boolean) as any[];

      // server-side logs to help trace candidate counts (kept minimal)
      try {
        console.log("pickupPointsAlongRoute bbox", {
          minLat,
          maxLat,
          minLng,
          maxLng,
          bufferMeters,
        });
        console.log(
          "pickupPointsAlongRoute candidates before filter:",
          candidates.length,
        );
      } catch (e) {
        /* ignore logging errors */
      }

      const results = computed
        .filter((r: any) => r.distanceMeters <= bufferMeters)
        .sort((a: any, b: any) => a.distanceMeters - b.distanceMeters);

      return results;
    }),
  // Persist generated stops created on the client for this route
  saveGeneratedStops: publicProcedure
    .input(
      z.array(
        z.object({
          label: z.string().optional(),
          lat: z.number(),
          lng: z.number(),
          routeHash: z.string().optional(),
        }),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const creatorId = (ctx.session as any)?.user?.id ?? null;
      const created = await Promise.all(
        input.map((s) =>
          db.generatedStop.create({
            data: {
              label: s.label,
              lat: s.lat,
              lng: s.lng,
              routeHash: s.routeHash,
              creatorId: creatorId ?? undefined,
            },
          }),
        ),
      );
      return created;
    }),
  // --- Trip management -------------------------------------------------
  createTrip: protectedProcedure
    .input(
      z.object({
        routeTemplateId: z.string(),
        departureAt: z.string(), // ISO datetime string
        seatsTotal: z.number().min(1),
        stops: z
          .array(
            z.object({
              label: z.string().optional(),
              lat: z.number(),
              lng: z.number(),
              ord: z.number().optional(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session as any).user.id;
      // create Trip and its stops (if any)
      const trip = await db.trip.create({
        data: {
          driverId: userId,
          routeTemplateId: input.routeTemplateId,
          departureAt: new Date(input.departureAt),
          seatsTotal: input.seatsTotal,
          seatsTaken: 0,
          status: "OPEN",
          tripStops: input.stops
            ? {
                create: input.stops.map((s) => ({
                  label: s.label,
                  lat: s.lat,
                  lng: s.lng,
                  ord: s.ord ?? 0,
                })),
              }
            : undefined,
        },
        include: { tripStops: true },
      });
      return trip;
    }),

  listMyTrips: protectedProcedure.query(async ({ ctx }) => {
    const userId = (ctx.session as any).user.id;
    return db.trip.findMany({
      where: { driverId: userId },
      orderBy: { departureAt: "desc" },
      include: { tripStops: true, bookings: true },
    });
  }),

  // Search nearby trips by proximity to any TripStop (or pickup points)
  searchNearbyTrips: publicProcedure
    .input(
      z.object({
        lat: z.number(),
        lng: z.number(),
        radiusMeters: z.number().optional(),
        limit: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const radius = input.radiusMeters ?? 1500;
      const limit = input.limit ?? 5;
      const { lat, lng } = input;

      // degree approximation
      const degPerMeterLat = 1 / 111320;
      const degPerMeterLng = 1 / (111320 * Math.cos((lat * Math.PI) / 180));
      const latBuffer = radius * degPerMeterLat;
      const lngBuffer = radius * degPerMeterLng;
      const minLat = lat - latBuffer;
      const maxLat = lat + latBuffer;
      const minLng = lng - lngBuffer;
      const maxLng = lng + lngBuffer;

      // find trip stops in bbox
      const stops = await db.tripStop.findMany({
        where: {
          lat: { gte: minLat, lte: maxLat },
          lng: { gte: minLng, lte: maxLng },
        },
        include: {
          trip: {
            include: { driver: true, routeTemplate: true, bookings: true },
          },
        },
      });

      // compute haversine distance for sorting
      function haversineMeters(
        aLat: number,
        aLng: number,
        bLat: number,
        bLng: number,
      ) {
        const R = 6371000;
        const toRad = (v: number) => (v * Math.PI) / 180;
        const dLat = toRad(bLat - aLat);
        const dLon = toRad(bLng - aLng);
        const lat1 = toRad(aLat);
        const lat2 = toRad(bLat);
        const sinDLat = Math.sin(dLat / 2);
        const sinDLon = Math.sin(dLon / 2);
        const a =
          sinDLat * sinDLat +
          Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      }

      const mapped = stops
        .map((s) => ({
          stopId: s.id,
          label: s.label,
          lat: parseFloat(String(s.lat)),
          lng: parseFloat(String(s.lng)),
          trip: s.trip,
          distanceMeters: Math.round(
            haversineMeters(
              lat,
              lng,
              parseFloat(String(s.lat)),
              parseFloat(String(s.lng)),
            ),
          ),
        }))
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, limit);

      return mapped;
    }),

  // Join a trip (creates Booking and increments seatsTaken atomically)
  joinTrip: protectedProcedure
    .input(z.object({ tripId: z.string(), stopId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session as any).user.id;
      return await db.$transaction(async (tx) => {
        const trip = await tx.trip.findUnique({ where: { id: input.tripId } });
        if (!trip) throw new Error("TRIP_NOT_FOUND");
        if (trip.status !== "OPEN") throw new Error("TRIP_NOT_OPEN");
        if (trip.seatsTaken >= trip.seatsTotal) throw new Error("TRIP_FULL");

        // create booking and increment seatsTaken
        const booking = await tx.booking.create({
          data: {
            tripId: trip.id,
            riderId: userId,
            status: "ACCEPTED",
            pickupPointId: input.stopId ?? undefined,
          },
        });
        await tx.trip.update({
          where: { id: trip.id },
          data: { seatsTaken: { increment: 1 } },
        });
        return booking;
      });
    }),

  leaveTrip: protectedProcedure
    .input(z.object({ tripId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session as any).user.id;
      return await db.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { tripId_riderId: { tripId: input.tripId, riderId: userId } },
        });
        if (!booking) throw new Error("BOOKING_NOT_FOUND");
        if (booking.status === "ACCEPTED") {
          // mark canceled and decrement seats
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: "CANCELED_BY_RIDER" },
          });
          await tx.trip.update({
            where: { id: input.tripId },
            data: { seatsTaken: { decrement: 1 } },
          });
          return { ok: true };
        }
        // otherwise just mark canceled
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: "CANCELED_BY_RIDER" },
        });
        return { ok: true };
      });
    }),
});

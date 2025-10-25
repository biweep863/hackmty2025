import { createTRPCRouter, publicProcedure } from "../trpc";
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

      const results = candidates
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
          };
        })
        .filter(Boolean)
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
});

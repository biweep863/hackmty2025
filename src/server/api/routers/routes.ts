import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { z } from "zod";
import { db } from "~/server/db";
import { env } from "~/env";

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
      let stops: any[] = [];
      try {
        // guard: some deployments may not have the tripStop model/schema
        if (!((db as any)?.tripStop || (db as any)?.trip)) {
          console.warn(
            "Prisma models tripStop/trip not available; returning empty results.",
          );
          return [];
        }
        stops = await (db as any).tripStop.findMany({
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
      } catch (e) {
        console.error("searchNearbyTrips DB query failed:", e);
        return [];
      }
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

  // Match client origin/destination (A/B) against carpoolers' routes.
  // For each routeTemplate we compute:
  //   dA = distance(clientA, route.from)
  //   dB = distance(clientB, route.to)
  //   total = dA + dB
  // and return the best matches sorted by total ascending.
  matchCarpoolersForClient: publicProcedure
    .input(
      z.object({
        clientFromLat: z.number(),
        clientFromLng: z.number(),
        clientToLat: z.number(),
        clientToLng: z.number(),
        limit: z.number().optional(),
        useGemini: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { clientFromLat, clientFromLng, clientToLat, clientToLng } = input;
      const limit = input.limit ?? 10;
      const useGemini = input.useGemini ?? false;

      console.log("matchCarpoolersForClient called with:", {
        clientFromLat,
        clientFromLng,
        clientToLat,
        clientToLng,
        limit,
        useGemini,
      });

      // gather route templates safely
      const anyDb = db as any;
      let routeTemplates: any[] = [];
      try {
        if (anyDb && anyDb.routeTemplate) {
          routeTemplates = await anyDb.routeTemplate.findMany({
            select: {
              id: true,
              fromLat: true,
              fromLng: true,
              toLat: true,
              toLng: true,
              fromLabel: true,
              toLabel: true,
              carpoolerId: true,
            },
          });
        } else {
          routeTemplates = [];
        }
      } catch (e) {
        console.error("matchCarpoolersForClient DB error:", e);
        routeTemplates = [];
      }

      // If no route templates exist (common in dev where schema is commented or DB empty),
      // provide a small in-memory mock dataset so the UI can be exercised.
      if (!routeTemplates || routeTemplates.length === 0) {
        console.warn(
          "No routeTemplates found in DB — using mock data for testing",
        );
        // A richer set of mock routes across Monterrey for testing
        routeTemplates = [
          {
            id: "mock-1",
            fromLat: 25.688,
            fromLng: -100.316,
            toLat: 25.6765,
            toLng: -100.3098,
            fromLabel: "Centro Norte",
            toLabel: "Centro Sur",
            carpoolerId: "mock-c1",
          },
          {
            id: "mock-2",
            fromLat: 25.693,
            fromLng: -100.32,
            toLat: 25.673,
            toLng: -100.305,
            fromLabel: "Mitras",
            toLabel: "Fundadores",
            carpoolerId: "mock-c2",
          },
          {
            id: "mock-3",
            fromLat: 25.7,
            fromLng: -100.31,
            toLat: 25.665,
            toLng: -100.3,
            fromLabel: "Obispado",
            toLabel: "San Bernabé",
            carpoolerId: "mock-c3",
          },
          {
            id: "mock-4",
            fromLat: 25.68,
            fromLng: -100.33,
            toLat: 25.67,
            toLng: -100.32,
            fromLabel: "Valle Oriente",
            toLabel: "Cumbres",
            carpoolerId: "mock-c4",
          },
          {
            id: "mock-5",
            fromLat: 25.6955,
            fromLng: -100.325,
            toLat: 25.68,
            toLng: -100.315,
            fromLabel: "Loma Larga",
            toLabel: "Parque",
            carpoolerId: "mock-c5",
          },
          {
            id: "mock-6",
            fromLat: 25.685,
            fromLng: -100.3,
            toLat: 25.66,
            toLng: -100.295,
            fromLabel: "Universidad",
            toLabel: "Centro Histórico",
            carpoolerId: "mock-c6",
          },
          {
            id: "mock-7",
            fromLat: 25.699,
            fromLng: -100.322,
            toLat: 25.678,
            toLng: -100.31,
            fromLabel: "San Jerónimo",
            toLabel: "Obras Públicas",
            carpoolerId: "mock-c7",
          },
          {
            id: "mock-8",
            fromLat: 25.6905,
            fromLng: -100.3055,
            toLat: 25.671,
            toLng: -100.302,
            fromLabel: "Zona Industrial",
            toLabel: "La Campana",
            carpoolerId: "mock-c8",
          },
          {
            id: "mock-9",
            fromLat: 25.682,
            fromLng: -100.318,
            toLat: 25.672,
            toLng: -100.308,
            fromLabel: "Col. Independencia",
            toLabel: "Centro",
            carpoolerId: "mock-c9",
          },
          {
            id: "mock-10",
            fromLat: 25.6888,
            fromLng: -100.3088,
            toLat: 25.6688,
            toLng: -100.2988,
            fromLabel: "Norte 10",
            toLabel: "Sur 10",
            carpoolerId: "mock-c10",
          },
        ];
      }

      // haversine
      const toRad = (v: number) => (v * Math.PI) / 180;
      const haversine = (
        aLat: number,
        aLng: number,
        bLat: number,
        bLng: number,
      ) => {
        const R = 6371000;
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
      };

      const computed = routeTemplates
        .map((r) => {
          const rfLat = r.fromLat != null ? Number(r.fromLat) : undefined;
          const rfLng = r.fromLng != null ? Number(r.fromLng) : undefined;
          const rtLat = r.toLat != null ? Number(r.toLat) : undefined;
          const rtLng = r.toLng != null ? Number(r.toLng) : undefined;
          if (rfLat == null || rfLng == null || rtLat == null || rtLng == null)
            return null;
          const dA = haversine(clientFromLat, clientFromLng, rfLat, rfLng);
          const dB = haversine(clientToLat, clientToLng, rtLat, rtLng);
          return {
            id: r.id,
            carpoolerId: r.carpoolerId,
            fromLabel: r.fromLabel,
            toLabel: r.toLabel,
            fromLat: rfLat,
            fromLng: rfLng,
            toLat: rtLat,
            toLng: rtLng,
            distanceToFromMeters: Math.round(dA),
            distanceToToMeters: Math.round(dB),
            totalMeters: Math.round(dA + dB),
          };
        })
        .filter(Boolean) as any[];

      const sorted = computed
        .sort((a, b) => a.totalMeters - b.totalMeters)
        .slice(0, limit);

      // optionally ask Gemini to pick the best route (only considering route start/end points)
      let usedGemini = false;
      let geminiRaw: any = null;
      let geminiChoice: number | null = null;
      if (useGemini && env.GEMINI_API_KEY && sorted.length > 0) {
        usedGemini = true;
        try {
          const lines: string[] = [];
          lines.push(`Target A: ${clientFromLat}, ${clientFromLng}`);
          lines.push(`Target B: ${clientToLat}, ${clientToLng}`);
          lines.push(`Routes:`);
          for (let i = 0; i < sorted.length; i++) {
            const r = sorted[i];
            lines.push(
              `${i + 1}) from ${r.fromLat}, ${r.fromLng} -> to ${r.toLat}, ${r.toLng}`,
            );
          }
          lines.push(
            `\nReturn ONLY a JSON object like {"index": N} where index is the 1-based number of the best route that minimizes total distance from A->route.from plus route.to->B.`,
          );
          const promptText = lines.join("\n");
          const url = `https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generate`;
          const body = {
            prompt: { text: promptText },
            temperature: 0,
            max_output_tokens: 200,
          };
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${env.GEMINI_API_KEY}`,
            },
            body: JSON.stringify(body),
          });
          geminiRaw = await res.json().catch(() => null);
          // extract text
          let textOut: string | undefined;
          if (geminiRaw) {
            if (Array.isArray(geminiRaw.outputs) && geminiRaw.outputs[0]) {
              const out = geminiRaw.outputs[0];
              if (
                Array.isArray(out.content) &&
                out.content[0] &&
                typeof out.content[0].text === "string"
              ) {
                textOut = out.content[0].text;
              } else if (typeof out.text === "string") textOut = out.text;
            }
            if (
              !textOut &&
              Array.isArray(geminiRaw.candidates) &&
              geminiRaw.candidates[0]
            ) {
              const c = geminiRaw.candidates[0];
              if (typeof c.content === "string") textOut = c.content;
              if (
                !textOut &&
                Array.isArray(c.content) &&
                c.content[0] &&
                typeof c.content[0].text === "string"
              )
                textOut = c.content[0].text;
            }
            if (!textOut && typeof geminiRaw.output === "string")
              textOut = geminiRaw.output;
          }
          if (textOut) {
            const m = textOut.match(/\{[\s\S]*\}/);
            if (m) {
              try {
                const parsed = JSON.parse(m[0]);
                if (typeof parsed.index === "number")
                  geminiChoice = parsed.index - 1;
              } catch (e) {
                // ignore
              }
            }
            if (geminiChoice == null) {
              const intMatch = textOut.match(/\b(\d+)\b/);
              if (intMatch && intMatch[1])
                geminiChoice = parseInt(intMatch[1], 10) - 1;
            }
          }
        } catch (e) {
          geminiRaw = { error: String(e) };
          usedGemini = false;
        }
      }

      const chosenIndex =
        geminiChoice != null &&
        geminiChoice >= 0 &&
        geminiChoice < sorted.length
          ? geminiChoice
          : 0;
      const localBestIndex = sorted.length ? 0 : -1;

      try {
        console.log(
          "matchCarpoolersForClient result: count=",
          sorted.length,
          "chosenIndex=",
          chosenIndex,
          "chosen=",
          sorted[chosenIndex] ?? null,
          "localBestIndex=",
          localBestIndex,
        );
        if (usedGemini)
          console.log("matchCarpoolersForClient geminiRaw:", geminiRaw);
      } catch (e) {
        /* ignore logging errors */
      }

      return {
        matches: sorted,
        chosenIndex,
        chosen: sorted[chosenIndex] ?? null,
        localBestIndex,
        localBest: sorted[localBestIndex] ?? null,
        usedGemini,
        geminiRaw,
      };
    }),

  // Aggregate all known route-related points and find the nearest point to a
  // given lat/lng. Optionally ask Gemini (if GEMINI_API_KEY is provided) to
  // choose the nearest; otherwise fall back to a local haversine calculation.
  nearestPointGemini: publicProcedure
    .input(
      z.object({
        lat: z.number(),
        lng: z.number(),
        useGemini: z.boolean().optional(),
        candidateLimit: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { lat, lng } = input;
      const useGemini = input.useGemini ?? false;
      const candidateLimit = input.candidateLimit ?? 5000;

      // collect points from various tables (guard against missing models)
      let routeTemplates: any[] = [];
      let tripStops: any[] = [];
      let generatedStops: any[] = [];
      let pickupPoints: any[] = [];
      try {
        const anyDb = db as any;
        if (!anyDb) throw new Error("db client missing");
        // only call findMany if the model exists on the client
        const promises: Promise<any>[] = [];
        if (anyDb.routeTemplate) {
          promises.push(
            anyDb.routeTemplate.findMany({
              select: {
                id: true,
                fromLat: true,
                fromLng: true,
                toLat: true,
                toLng: true,
                fromLabel: true,
                toLabel: true,
              },
            }),
          );
        } else {
          promises.push(Promise.resolve([]));
        }
        if (anyDb.tripStop) {
          promises.push(
            anyDb.tripStop.findMany({
              select: { id: true, label: true, lat: true, lng: true },
            }),
          );
        } else {
          promises.push(Promise.resolve([]));
        }
        if (anyDb.generatedStop) {
          promises.push(
            anyDb.generatedStop.findMany({
              select: {
                id: true,
                label: true,
                lat: true,
                lng: true,
                routeHash: true,
              },
            }),
          );
        } else {
          promises.push(Promise.resolve([]));
        }
        if (anyDb.pickupPoint) {
          promises.push(
            anyDb.pickupPoint.findMany({
              where: { isActive: true },
              select: { id: true, label: true, lat: true, lng: true },
            }),
          );
        } else {
          promises.push(Promise.resolve([]));
        }

        const res = await Promise.all(promises);
        routeTemplates = res[0] ?? [];
        tripStops = res[1] ?? [];
        generatedStops = res[2] ?? [];
        pickupPoints = res[3] ?? [];
      } catch (e) {
        console.error("nearestPointGemini DB gather failed:", e);
        return {
          points: [],
          nearestIndex: -1,
          nearestPoint: null,
          usedGemini: false,
          geminiRaw: { error: String(e) },
          localNearest: { index: -1, distanceMeters: -1 },
        };
      }

      const points: Array<{
        id: string;
        lat: number;
        lng: number;
        source: string;
        label?: string | null;
        meta?: any;
      }> = [];

      for (const rt of routeTemplates) {
        if (rt.fromLat != null && rt.fromLng != null) {
          points.push({
            id: `${rt.id}-from`,
            lat: Number(rt.fromLat),
            lng: Number(rt.fromLng),
            source: "routeTemplate",
            label: rt.fromLabel ?? null,
          });
        }
        if (rt.toLat != null && rt.toLng != null) {
          points.push({
            id: `${rt.id}-to`,
            lat: Number(rt.toLat),
            lng: Number(rt.toLng),
            source: "routeTemplate",
            label: rt.toLabel ?? null,
          });
        }
      }

      for (const s of tripStops) {
        if (s.lat != null && s.lng != null) {
          points.push({
            id: s.id,
            lat: Number(s.lat),
            lng: Number(s.lng),
            source: "tripStop",
            label: s.label ?? null,
          });
        }
      }

      for (const s of generatedStops) {
        if (s.lat != null && s.lng != null) {
          points.push({
            id: s.id,
            lat: Number(s.lat),
            lng: Number(s.lng),
            source: "generatedStop",
            label: s.label ?? null,
            meta: { routeHash: s.routeHash },
          });
        }
      }

      for (const p of pickupPoints) {
        if (p.lat != null && p.lng != null) {
          points.push({
            id: p.id,
            lat: Number(p.lat),
            lng: Number(p.lng),
            source: "pickupPoint",
            label: p.label ?? null,
          });
        }
      }

      // limit candidate set to avoid huge prompts
      const limited = points.slice(0, candidateLimit);

      // helper: haversine meters
      const haversineMeters = (
        aLat: number,
        aLng: number,
        bLat: number,
        bLng: number,
      ) => {
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
      };

      // local nearest by default
      let localNearestIndex = -1;
      let localNearestDist = Infinity;
      for (let i = 0; i < limited.length; i++) {
        const p = limited[i];
        const d = haversineMeters(lat, lng, p.lat, p.lng);
        if (d < localNearestDist) {
          localNearestDist = d;
          localNearestIndex = i;
        }
      }

      let usedGemini = false;
      let geminiRaw: any = null;
      let geminiIndex: number | null = null;

      if (useGemini && env.GEMINI_API_KEY) {
        usedGemini = true;
        try {
          // Build a compact prompt listing points numbered 1..N
          const lines: string[] = [];
          lines.push(`Target: ${lat}, ${lng}`);
          lines.push(`Points:`);
          for (let i = 0; i < limited.length; i++) {
            const p = limited[i];
            const label = p.label ? ` - ${String(p.label)}` : "";
            lines.push(`${i + 1}) ${p.lat}, ${p.lng}${label}`);
          }
          lines.push(
            `\nReturn ONLY a JSON object like {"index": N, "lat": X, "lng": Y} where index is the 1-based number of the closest point.`,
          );

          const promptText = lines.join("\n");

          // Try to call Google Generative Language endpoint (Gemini-like) if available
          const url = `https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generate`;
          const body = {
            prompt: { text: promptText },
            temperature: 0,
            max_output_tokens: 200,
          };

          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${env.GEMINI_API_KEY}`,
            },
            body: JSON.stringify(body),
          });

          geminiRaw = await res.json().catch(() => null);

          // try to extract text
          let textOut: string | undefined;
          if (geminiRaw) {
            // different API shapes: outputs[0].content[0].text or candidates[0].content
            if (Array.isArray(geminiRaw.outputs) && geminiRaw.outputs[0]) {
              const out = geminiRaw.outputs[0];
              if (
                Array.isArray(out.content) &&
                out.content[0] &&
                typeof out.content[0].text === "string"
              ) {
                textOut = out.content[0].text;
              } else if (typeof out.text === "string") {
                textOut = out.text;
              }
            }
            if (
              !textOut &&
              Array.isArray(geminiRaw.candidates) &&
              geminiRaw.candidates[0]
            ) {
              const c = geminiRaw.candidates[0];
              if (typeof c.content === "string") textOut = c.content;
              if (
                !textOut &&
                Array.isArray(c.content) &&
                c.content[0] &&
                typeof c.content[0].text === "string"
              )
                textOut = c.content[0].text;
            }
            if (!textOut && typeof geminiRaw.output === "string")
              textOut = geminiRaw.output;
          }

          if (textOut) {
            // attempt to locate a JSON object in the response
            const m = textOut.match(/\{[\s\S]*\}/);
            if (m) {
              try {
                const parsed = JSON.parse(m[0]);
                if (typeof parsed.index === "number") {
                  geminiIndex = parsed.index - 1; // convert to 0-based
                }
              } catch (e) {
                // ignore parse errors
              }
            }
            // fallback: try to parse first integer in text
            if (geminiIndex == null) {
              const intMatch = textOut.match(/\b(\d+)\b/);
              if (intMatch) geminiIndex = parseInt(intMatch[1], 10) - 1;
            }
          }
        } catch (e) {
          // ignore errors and fallback to local
          geminiRaw = { error: String(e) };
        }
      }

      const finalIndex =
        geminiIndex != null && geminiIndex >= 0 && geminiIndex < limited.length
          ? geminiIndex
          : localNearestIndex;

      return {
        points: limited,
        nearestIndex: finalIndex,
        nearestPoint: limited[finalIndex] ?? null,
        usedGemini,
        geminiRaw,
        localNearest: {
          index: localNearestIndex,
          distanceMeters: Math.round(localNearestDist),
        },
      };
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

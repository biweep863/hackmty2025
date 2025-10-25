import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "~/server/db";
import { TripStatus } from "@prisma/client";

export const tripsRouter = createTRPCRouter({
  // listado "descubrir": filtra por fecha y status
  getTrips: publicProcedure
    .query(() => {
      return db.ride.findMany();
    }),
  discover: publicProcedure
    .input(
      z.object({
        fromDate: z.string().datetime().optional(),
        toDate: z.string().datetime().optional(),
        status: z.enum(["OPEN", "LOCKED"]).default("OPEN"),
        // opcional: hint de site/pickup cercano (sin cálculo)
        siteId: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      return db.trip.findMany({
        where: {
          status: input.status as TripStatus,
          departureAt: {
            gte: input.fromDate ? new Date(input.fromDate) : new Date(),
            lte: input.toDate ? new Date(input.toDate) : undefined,
          },
        },
        include: {
          routeTemplate: true,
          pickupPoint: true,
        },
        orderBy: { departureAt: "asc" },
        take: 100,
      });
    }),

  // crear instancia por parte del conductor
  create: publicProcedure
    .input(
      z.object({
        routeTemplateId: z.string(),
        departureAt: z.string().datetime(),
        seatsTotal: z.number().int().min(1).max(6),
        pickupPointId: z.string().optional(),
        pickupCustomLabel: z.string().optional(),
        pickupLat: z.number().optional(),
        pickupLng: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user.id;

      return db.$transaction(async (tx) => {
        // opcional: validar propiedad del template
        const tpl = await tx.routeTemplate.findUnique({
          where: { id: input.routeTemplateId },
          include: { carpooler: { include: { user: true } } },
        });
        if (!tpl) throw new Error("TEMPLATE_NOT_FOUND");

        return tx.trip.create({
          data: {
            driverId: userId,
            routeTemplateId: input.routeTemplateId,
            departureAt: new Date(input.departureAt),
            seatsTotal: input.seatsTotal,
            pickupPointId: input.pickupPointId,
            pickupCustomLabel: input.pickupCustomLabel,
            pickupLat: input.pickupLat,
            pickupLng: input.pickupLng,
          },
        });
      });
    }),

  lock: publicProcedure
    .input(z.object({ tripId: z.string(), lock: z.boolean() }))
    .mutation(({ input }) =>
      db.trip.update({
        where: { id: input.tripId },
        data: { status: input.lock ? TripStatus.LOCKED : TripStatus.OPEN },
      }),
    ),

  cancel: publicProcedure
    .input(z.object({ tripId: z.string() }))
    .mutation(({ input }) =>
      db.trip.update({
        where: { id: input.tripId },
        data: { status: TripStatus.CANCELED },
      }),
    ),
});

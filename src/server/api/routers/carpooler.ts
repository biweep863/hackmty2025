import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { z } from "zod";
import { db } from "~/server/db";

export const carpoolerRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const userId = (ctx.session as any).user.id;
    return db.carpoolerProfile.findUnique({
      where: { userId },
    });
  }),

  upsertProfile: protectedProcedure
    .input(
      z.object({
        vehicleMake: z.string().optional(),
        vehicleModel: z.string().optional(),
        vehicleColor: z.string().optional(),
        plateLast4: z.string().optional(),
        seatsDefault: z.number().int().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session as any).user.id;
      return db.carpoolerProfile.upsert({
        where: { userId },
        create: {
          userId,
          ...input,
        },
        update: input,
      });
    }),

  pushRide: publicProcedure
    .input(
      z.object({
        origin: z.string().max(200),
        destination: z.string().max(200),
        latStart: z.number().min(-90).max(90),
        lngStart: z.number().min(-180).max(180),
        latEnd: z.number().min(-90).max(90),
        lngEnd: z.number().min(-180).max(180),
        distanceKm: z.number().min(0),
        price: z.number().min(10),
        durationMin: z.number().min(0).optional(),
        driverEmail: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // const userId = ctx.session!.user.id;
      const driver = await db.user
        .findUnique({
          where: { email: input.driverEmail },
        })
      return db.ride.create({
        data: {
          origin: input.origin,
          destination: input.destination,
          latStart: input.latStart,
          lngStart: input.lngStart,
          latEnd: input.latEnd,
          lngEnd: input.lngEnd,
          distanceKm: input.distanceKm,
          durationMin: input.durationMin,
          price: input.price,
          driver: {
            connect: { id: driver?.id },
          }
        },
      });
    }),
});

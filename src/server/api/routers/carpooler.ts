import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { z } from "zod";
import { db } from "~/server/db";

export const carpoolerRouter = createTRPCRouter({
  upsertProfile: publicProcedure
    .input(
      z.object({
        vehicleMake: z.string().optional(),
        vehicleModel: z.string().optional(),
        vehicleColor: z.string().optional(),
        plateLast4: z.string().max(4).optional(),
        seatsDefault: z.number().int().min(1).max(6).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user.id;
      return db.carpoolerProfile.upsert({
        where: { userId },
        create: { userId, ...input },
        update: { ...input },
      });
    }),
  getProfile: publicProcedure.query(({ ctx }) => {
    const userId = ctx.session!.user.id;
    return db.carpoolerProfile.findUnique({ where: { userId } });
  }),
  pushRide: publicProcedure
    .input(
      z.object({
        latStart: z.number().min(-90).max(90),
        lngStart: z.number().min(-180).max(180),
        latEnd: z.number().min(-90).max(90),
        lngEnd: z.number().min(-180).max(180),
        distanceKm: z.number().min(0),
        durationMin: z.number().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // const userId = ctx.session!.user.id;
      return db.ride.create({
        data: {
          ...input,
        },
      });
    }),
});

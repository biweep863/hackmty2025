import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { z } from "zod";
import { db } from "~/server/db";

export const carpoolerRouter = createTRPCRouter({
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
        price: z.number().min(20),
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

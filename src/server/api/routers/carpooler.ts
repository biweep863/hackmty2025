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
        price: z.number().min(10),
        durationMin: z.number().min(0).optional(),
        driverEmail: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // const userId = ctx.session!.user.id;
      const driver = await db.user.findUnique({
        where: { email: input.driverEmail },
      });
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
          },
        },
      });
    }),
});

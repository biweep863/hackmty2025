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
  saveTrips: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        userEmail: z.string()
      })
    )
    .mutation(async ({ input }) => {
      const { id } = input;
      return db.ride.update({
        where: { id },
        data: { status },
      });
    }),
});

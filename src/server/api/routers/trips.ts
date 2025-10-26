import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "~/server/db";
import { TripStatus } from "@prisma/client";

export const tripsRouter = createTRPCRouter({
  // listado "descubrir": filtra por fecha y status
  getTrips: publicProcedure.query(() => {
  return db.ride.findMany({
    include: {
      driver: true, 
    },
  });
}),
  saveTrip: publicProcedure
    .input(
      z.object({
        id: z.string(),
        userEmail: z.string()
      })
    )
    .mutation(async ({ input }) => {
      const user = await db.user.findUnique({
        where: { email: input.userEmail },
      });
      if (!user) throw new Error("User not found");
      return db.ride.update({
        where: { id: input.id },
        data: {
          clients: {
            connect: { id: user.id },
          },
        }
      });
    }),
  removeTrip: publicProcedure
    .input(
      z.object({
        id: z.string(),
        userEmail: z.string()
      })
    )
    .mutation(async ({ input }) => {
      const user = await db.user.findUnique({
        where: { email: input.userEmail },
      });
      if (!user) throw new Error("User not found");
      return db.ride.update({
        where: { id: input.id },
        data: {
          clients: {
            disconnect: { id: user.id },
          },
        }
      });
    }),
  getMyTrips: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      const user = await db.user.findUnique({
        where: { email: input },
      });
      if (!user) throw new Error("User not found");
      return db.ride.findMany({
        where: {
          clients: {
            some: {
              id: user.id,
            },
          },
        },
      });
    }),
  getDriver: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      const driver = await db.user.findUnique({
        where: { id: input },
      });
      if (!driver) throw new Error("Driver not found");
      return driver;
    }),
});
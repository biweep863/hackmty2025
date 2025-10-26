import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "~/server/db";
import { BookingStatus } from "@prisma/client";

export const bookingsRouter = createTRPCRouter({
  myBookings: protectedProcedure.query(async ({ ctx }) => {
    const userId = (ctx.session as any).user.id;
    return db.booking.findMany({
      where: { riderId: userId },
      include: {
        trip: {
          include: {
            driver: true,
            routeTemplate: true,
            tripStops: true,
          },
        },
        pickupPoint: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  requestSeat: protectedProcedure
    .input(
      z.object({
        tripId: z.string(),
        pickupPointId: z.string().optional(),
        pickupNote: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session as any).user.id;
      return db.booking.create({
        data: {
          tripId: input.tripId,
          riderId: userId,
          pickupPointId: input.pickupPointId,
          pickupNote: input.pickupNote,
          status: BookingStatus.PENDING,
        },
      });
    }),

  decide: protectedProcedure
    .input(
      z.object({
        bookingId: z.string(),
        accept: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      return db.booking.update({
        where: { id: input.bookingId },
        data: {
          status: input.accept
            ? BookingStatus.ACCEPTED
            : BookingStatus.REJECTED,
        },
      });
    }),

  cancelByRider: protectedProcedure
    .input(z.object({ bookingId: z.string() }))
    .mutation(async ({ input }) => {
      return db.booking.update({
        where: { id: input.bookingId },
        data: { status: BookingStatus.CANCELED_BY_RIDER },
      });
    }),
});

import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "~/server/db";

import { BookingStatus } from "@prisma/client";

export const bookingsRouter = createTRPCRouter({
  myBookings: publicProcedure.query(({ ctx }) => {
    const riderId = ctx.session!.user.id;
    return db.booking.findMany({
      where: { riderId },
      include: {
        trip: { include: { routeTemplate: true, pickupPoint: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  requestSeat: publicProcedure
    .input(
      z.object({
        tripId: z.string(),
        pickupPointId: z.string().optional(),
        pickupNote: z.string().max(140).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const riderId = ctx.session!.user.id;

      return db.$transaction(async (tx) => {
        const trip = await tx.trip.findUnique({ where: { id: input.tripId } });
        if (!trip) throw new Error("TRIP_NOT_FOUND");
        if (trip.status !== "OPEN" && trip.status !== "LOCKED")
          throw new Error("TRIP_CLOSED");

        const existing = await tx.booking
          .findUnique({
            where: { tripId_riderId: { tripId: input.tripId, riderId } },
          })
          .catch(() => null);

        if (existing) throw new Error("ALREADY_REQUESTED");

        const pending = await tx.booking.create({
          data: {
            tripId: input.tripId,
            riderId,
            status: BookingStatus.PENDING,
            pickupPointId: input.pickupPointId,
            pickupNote: input.pickupNote,
          },
        });
        return pending;
      });
    }),

  // Acepta/rechaza (por el conductor)
  decide: publicProcedure
    .input(
      z.object({
        bookingId: z.string(),
        accept: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // opcional: validar que el ctx user sea driver del trip
      return db.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: input.bookingId },
          include: { trip: true },
        });
        if (!booking) throw new Error("BOOKING_NOT_FOUND");

        if (input.accept) {
          if (booking.trip.status === "CANCELED")
            throw new Error("TRIP_CANCELED");
          const updatedTrip = await tx.trip.update({
            where: { id: booking.tripId },
            data: {
              seatsTaken: { increment: 1 },
              status:
                booking.trip.seatsTaken + 1 >= booking.trip.seatsTotal
                  ? "LOCKED"
                  : booking.trip.status,
            },
          });
          return tx.booking.update({
            where: { id: input.bookingId },
            data: { status: BookingStatus.ACCEPTED },
          });
        } else {
          return tx.booking.update({
            where: { id: input.bookingId },
            data: { status: BookingStatus.REJECTED },
          });
        }
      });
    }),

  cancelByRider: publicProcedure
    .input(z.object({ bookingId: z.string() }))
    .mutation(async ({ input }) => {
      return db.$transaction(async (tx) => {
        const b = await tx.booking.findUnique({
          where: { id: input.bookingId },
        });
        if (!b) throw new Error("BOOKING_NOT_FOUND");
        const updated = await tx.booking.update({
          where: { id: input.bookingId },
          data: { status: BookingStatus.CANCELED_BY_RIDER },
        });
        // si estaba aceptada, libera asiento
        if (b.status === "ACCEPTED") {
          await tx.trip.update({
            where: { id: b.tripId },
            data: { seatsTaken: { decrement: 1 }, status: "OPEN" },
          });
        }
        return updated;
      });
    }),
});

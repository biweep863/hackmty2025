import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { db } from "~/server/db";
import { AvailabilityType } from "@prisma/client";

export const availabilityRouter = createTRPCRouter({
  listMine: protectedProcedure.query(async ({ ctx }) => {
    const userId = (ctx.session as any).user.id;
    const profile = await db.carpoolerProfile.findUnique({
      where: { userId },
    });
    if (!profile) return [];
    return db.availability.findMany({
      where: { carpoolerId: profile.id },
      include: { routeTemplate: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  createOneOff: protectedProcedure
    .input(
      z.object({
        routeTemplateId: z.string(),
        type: z.literal("ONE_OFF"),
        startAt: z.string().datetime(),
        endAt: z.string().datetime(),
        seats: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session as any).user.id;
      const profile = await db.carpoolerProfile.findUnique({
        where: { userId },
      });
      if (!profile) throw new Error("CARPOOLER_PROFILE_REQUIRED");

      return db.availability.create({
        data: {
          carpoolerId: profile.id,
          routeTemplateId: input.routeTemplateId,
          type: AvailabilityType.ONE_OFF,
          startAt: new Date(input.startAt),
          endAt: new Date(input.endAt),
          seats: input.seats,
          weekdayMask: [],
        },
      });
    }),

  createRecurring: protectedProcedure
    .input(
      z.object({
        routeTemplateId: z.string(),
        type: z.literal("RECURRING"),
        weekdayMask: z.array(z.number().int().min(0).max(6)),
        timeWindowStart: z.string(),
        timeWindowEnd: z.string(),
        seats: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session as any).user.id;
      const profile = await db.carpoolerProfile.findUnique({
        where: { userId },
      });
      if (!profile) throw new Error("CARPOOLER_PROFILE_REQUIRED");

      return db.availability.create({
        data: {
          carpoolerId: profile.id,
          routeTemplateId: input.routeTemplateId,
          type: AvailabilityType.RECURRING,
          weekdayMask: input.weekdayMask,
          timeWindowStart: input.timeWindowStart,
          timeWindowEnd: input.timeWindowEnd,
          seats: input.seats,
        },
      });
    }),

  toggleActive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const avail = await db.availability.findUnique({
        where: { id: input.id },
      });
      if (!avail) throw new Error("NOT_FOUND");
      return db.availability.update({
        where: { id: input.id },
        data: { isActive: !avail.isActive },
      });
    }),
});

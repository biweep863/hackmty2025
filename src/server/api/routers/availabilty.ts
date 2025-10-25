import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "~/server/db";

import { AvailabilityType } from "@prisma/client";

const oneOffSchema = z.object({
  routeTemplateId: z.string(),
  type: z.literal("ONE_OFF"),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  seats: z.number().int().min(1).max(6).default(3),
});

const recurringSchema = z.object({
  routeTemplateId: z.string(),
  type: z.literal("RECURRING"),
  weekdayMask: z.array(z.number().int().min(0).max(6)).min(1),
  timeWindowStart: z.string().regex(/^\d{2}:\d{2}$/), // "08:00"
  timeWindowEnd: z.string().regex(/^\d{2}:\d{2}$/),
  seats: z.number().int().min(1).max(6).default(3),
});

export const availabilityRouter = createTRPCRouter({
  listMine: publicProcedure.query(({ ctx }) => {
    const userId = ctx.session!.userId;
    return db.availability.findMany({
      where: { carpooler: { userId } },
      orderBy: { createdAt: "desc" },
    });
  }),
  createOneOff: publicProcedure
    .input(oneOffSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.userId;
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
        },
      });
    }),
  createRecurring: publicProcedure
    .input(recurringSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.userId;
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
  toggleActive: publicProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(({ input }) =>
      db.availability.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      }),
    ),
});

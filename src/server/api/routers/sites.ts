import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "~/server/db";

export const sitesRouter = createTRPCRouter({
  list: publicProcedure.query(() =>
    db.site.findMany({
      where: {},
      include: { pickupPoints: { where: { isActive: true } } },
      orderBy: { name: "asc" },
    }),
  ),
  create: publicProcedure
    .input(
      z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        address: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      }),
    )
    .mutation(({ input }) =>
      db.site.create({
        data: {
          code: input.code,
          name: input.name,
          address: input.address,
          lat: input.lat,
          lng: input.lng,
        },
      }),
    ),
  addPickupPoint: publicProcedure
    .input(
      z.object({
        siteId: z.string(),
        label: z.string().min(1),
        lat: z.number().optional(),
        lng: z.number().optional(),
      }),
    )
    .mutation(({ input }) =>
      db.pickupPoint.create({
        data: {
          siteId: input.siteId,
          label: input.label,
          lat: input.lat,
          lng: input.lng,
        },
      }),
    ),
  // Diagnostic: return all pickup points (with site) so the dev can inspect coordinates
  allPickupPoints: publicProcedure.query(() =>
    db.pickupPoint.findMany({
      take: 1000,
      include: { site: true },
      orderBy: { createdAt: "desc" },
    }),
  ),
});

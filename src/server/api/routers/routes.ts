import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "~/server/db";

const routeInput = z.object({
  fromLabel: z.string().min(1),
  fromLat: z.number().optional(),
  fromLng: z.number().optional(),
  fromSiteId: z.string().optional(),
  toLabel: z.string().min(1),
  toLat: z.number().optional(),
  toLng: z.number().optional(),
  toSiteId: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const routesRouter = createTRPCRouter({
  listMine: publicProcedure.query(({ ctx }) => {
    const userId = ctx.session!.user.id;
    return db.routeTemplate.findMany({
      where: { carpooler: { userId } },
      orderBy: { createdAt: "desc" },
    });
  }),
  create: publicProcedure.input(routeInput).mutation(async ({ ctx, input }) => {
    const userId = ctx.session!.user.id;
    const profile = await db.carpoolerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new Error("CARPOOLER_PROFILE_REQUIRED");
    return db.routeTemplate.create({
      data: { carpoolerId: profile.id, ...input },
    });
  }),
  update: publicProcedure
    .input(routeInput.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // opcional: verificar propiedad
      return db.routeTemplate.update({
        where: { id: input.id },
        data: { ...input, id: undefined },
      });
    }),
});

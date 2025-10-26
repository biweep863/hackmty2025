import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { carpoolerRouter } from "./routers/carpooler";
import { tripsRouter } from "./routers/trips";
import { adminRouter } from "./routers/admin";
import { registerRouter } from "./routers/register";
import { routesRouter } from "./routers/routes";
import { sitesRouter } from "./routers/sites";
import { availabilityRouter } from "./routers/availability";
import { bookingsRouter } from "./routers/bookings";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  carpooler: carpoolerRouter,
  trips: tripsRouter,
  admin: adminRouter,
  register: registerRouter,
  routes: routesRouter,
  sites: sitesRouter,
  availability: availabilityRouter,
  bookings: bookingsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);

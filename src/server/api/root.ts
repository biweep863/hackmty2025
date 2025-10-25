import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { availabilityRouter } from "./routers/availabilty";
import { carpoolerRouter } from "./routers/carpooler";
import { routesRouter } from "./routers/routes";
import { sitesRouter } from "./routers/sites";
import { tripsRouter } from "./routers/trips";
import { bookingsRouter } from "./routers/bookings";
import { adminRouter } from "./routers/admin";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  availability: availabilityRouter,
  carpooler: carpoolerRouter,
  routes: routesRouter,
  sites: sitesRouter,
  trips: tripsRouter,
  bookings: bookingsRouter,
  admin: adminRouter,
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

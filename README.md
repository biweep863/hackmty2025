# CoRide — Safe, connected and sustainable mobility

- Project for Smart Cities HackMTY (Banorte challenge)
- Team: Mapaches Deploy
- Organization: Grupo Financiero Banorte

CoRide is a working prototype that connects verified bank users for secure carpooling. It combines mobility and digital banking to make shared rides safer, traceable and easier to pay.

## Summary

- Target: verified Banorte users who want a trusted way to share rides and settle payments automatically.
- Main benefits: trust (verified profiles), automatic Banorte payments, route and occupancy insights, environmental impact tracking.

## What the prototype does

- Let drivers register a verified profile and publish routes and availabilities.
- Let riders discover trips, view driver profiles and reserve seats.
- Automatically settle payments using Banorte accounts (no manual transfers).
- Provide an admin dashboard with basic analytics (trips, occupancy, revenue, emissions).

## High-level architecture

- Frontend: Next.js (App Router) + Tailwind (+ Leaflet for maps)
- Backend: tRPC + Prisma + PostgreSQL (API layer via Next.js API routes)
- Auth: NextAuth with Banorte / OAuth placeholder
- Infra: deployable to Vercel, DB on a hosted PostgreSQL (script included to run locally)

## Key technologies

- Next.js (frontend), Tailwind CSS, Leaflet (maps)
- tRPC (typed APIs), Prisma (ORM), PostgreSQL (data)
- NextAuth (session and auth)

## Main features (by role)

- Drivers: create verified profile, define route templates (A→B), set one-off or recurring availability, publish concrete trips (date, seats, pickup point).
- Riders: search trips by date or nearby pickup points, view verified driver profiles, request seats and pay automatically via Banorte.
- Admin (Banorte): see totals, occupancy, revenue, emissions estimates, and security/anomaly alerts.

## Data model (short)

- User: identity, contact, offered/reserved rides.
- Ride/Trip: concrete departure with origin/destination, coordinates, price, driver and passengers.
- GeneratedStop / PickupPoint: suggested or predefined pickup locations.
- Availability, Booking, VerificationToken, enums for status (availability/booking/trip).

## Security & trust

- Only verified Banorte users can participate.
- Payments are automated through bank settlement (no manual P2P transfer required).
- Travel tokens and analytics help detect anomalies; sensitive data is stored securely.

## Impact

- Citizens: cost savings, lower emissions, safer rides.
- Employers/City: less congestion, better utilization of vehicles.
- Banorte: extended financial ecosystem and sustainability positioning.

# Quick start

1. Install:

```bash
npm install
```

2. Add `.env` with `DATABASE_URL`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/carpool"
```

3. Run DB (optional) and migrate:

```bash
./start-database.sh
npx prisma migrate dev --name init
npx prisma generate
```

4. Run app:

```bash
npm run dev
```

### Where to look in the code

- Frontend pages & components: `src/app/` and `src/app/_components/`
- API mounts: `src/app/api/auth/...` and `src/app/api/trpc/[trpc]/route.ts`
- Server logic & routers: `src/server/api/routers/*.ts`
- Prisma client: `src/server/db.ts` and `prisma/schema.prisma`

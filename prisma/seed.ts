import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Upsert usuarios de prueba
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { name: "Admin" },
    create: {
      id: "u_admin",
      email: "admin@example.com",
      name: "Admin",
    },
  });

  const guestUser = await prisma.user.upsert({
    where: { email: "guest@example.com" },
    update: { name: "Guest" },
    create: {
      id: "u_guest",
      email: "guest@example.com",
      name: "Guest",
    },
  });

  // CarpoolerProfile (ajusta campos según tu schema)
  let carpooler = await prisma.carpoolerProfile.findUnique({
    where: { userId: adminUser.id },
  });

  if (!carpooler) {
    carpooler = await prisma.carpoolerProfile.create({
      data: {
        userId: adminUser.id,
        vehicleMake: "Toyota",
        vehicleModel: "Corolla",
        vehicleColor: "Red",
        plateLast4: "1234",
        seatsDefault: 4,
        isVerified: true,
      },
    });
  }

  // RouteTemplate
  const routeTemplate = await prisma.routeTemplate.create({
    data: {
      carpoolerId: carpooler.id,
      fromLabel: "Home",
      toLabel: "Office",
      isActive: true,
    },
  });

  // Trips
  const tripsData = Array.from({ length: 8 }).map((_, i) => ({
    // si tu Trip.id es cuid() por defecto, no pases id
    driverId: adminUser.id,
    routeTemplateId: routeTemplate.id,
    departureAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
    seatsTotal: 4,
    seatsTaken: Math.floor(Math.random() * 4),
    status: i % 3 === 0 ? "COMPLETED" : i % 3 === 1 ? "OPEN" : "CANCELED",
  }));

  const createdTrips = [];
  for (const t of tripsData) {
    const created = await prisma.trip.create({ data: t as any });
    createdTrips.push(created);
  }

  // Bookings (guest como rider)
  for (const trip of createdTrips) {
    const ridersToCreate = Math.min(
      Math.max(1, Math.floor(Math.random() * 3)),
      trip.seatsTotal ?? 1,
    );
    for (let r = 0; r < ridersToCreate; r++) {
      try {
        await prisma.booking.create({
          data: {
            tripId: trip.id,
            riderId: guestUser.id,
            status: "ACCEPTED",
          },
        });
      } catch (_) {
        // ignore duplicates
      }
    }
  }

  console.log("Seeding finished");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

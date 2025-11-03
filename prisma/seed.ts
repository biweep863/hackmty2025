import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	console.log("Seeding database...");

	// Create users (upsert so it's safe to re-run)
	const alice = await prisma.user.upsert({
		where: { email: "alice@example.com" },
		update: {},
		create: {
			email: "alice@example.com",
			name: "Alice Driver",
			password: "password1",
		},
	});

	const bob = await prisma.user.upsert({
		where: { email: "bob@example.com" },
		update: {},
		create: {
			email: "bob@example.com",
			name: "Bob Rider",
			password: "password2",
		},
	});

	const carla = await prisma.user.upsert({
		where: { email: "carla@example.com" },
		update: {},
		create: {
			email: "carla@example.com",
			name: "Carla Driver",
			password: "password3",
		},
	});

	// Clear existing rides & generated stops so seed is idempotent for these tables
	await prisma.ride.deleteMany({});
	await prisma.generatedStop.deleteMany({});

	// Create example rides (Monterrey-ish coordinates)
	const ridesData = [
		{
			id: undefined,
			driverId: alice.id,
			origin: "Centro Monterrey",
			destination: "San Pedro Garza Garcia",
			latStart: new Prisma.Decimal("25.660000"),
			lngStart: new Prisma.Decimal("-100.310000"),
			latEnd: new Prisma.Decimal("25.669000"),
			lngEnd: new Prisma.Decimal("-100.345000"),
			distanceKm: new Prisma.Decimal("8.50"),
			price: new Prisma.Decimal("120.00"),
			durationMin: 20,
		},
		{
			id: undefined,
			driverId: carla.id,
			origin: "UANL - Facultad",
			destination: "Estadio BBVA",
			latStart: new Prisma.Decimal("25.720000"),
			lngStart: new Prisma.Decimal("-100.310000"),
			latEnd: new Prisma.Decimal("25.710000"),
			lngEnd: new Prisma.Decimal("-100.520000"),
			distanceKm: new Prisma.Decimal("25.40"),
			price: new Prisma.Decimal("280.00"),
			durationMin: 40,
		},
	];

	for (const r of ridesData) {
		// prisma requires explicit create, driver relation uses driverId field
		await prisma.ride.create({
			data: {
				driverId: r.driverId,
				origin: r.origin,
				destination: r.destination,
				latStart: r.latStart,
				lngStart: r.lngStart,
				latEnd: r.latEnd,
				lngEnd: r.lngEnd,
				distanceKm: r.distanceKm,
				price: r.price,
				durationMin: r.durationMin,
			},
		});
	}

	// Example generated stops
	await prisma.generatedStop.createMany({
		data: [
			{
				label: "Parada A - Centro",
				lat: new Prisma.Decimal("25.660500") as any,
				lng: new Prisma.Decimal("-100.315000") as any,
				routeHash: "route-1",
				creatorId: alice.id,
			},
			{
				label: "Parada B - San Pedro",
				lat: new Prisma.Decimal("25.668500") as any,
				lng: new Prisma.Decimal("-100.342000") as any,
				routeHash: "route-1",
				creatorId: alice.id,
			},
		],
		skipDuplicates: true,
	});

	console.log("Seeding finished.");
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});


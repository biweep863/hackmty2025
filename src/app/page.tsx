export default function Home() {
  const links = [
    { href: "/sites", label: "Sites & PickupPoints" },
    { href: "/carpooler", label: "Carpooler Profile" },
    { href: "/routes", label: "Route Templates (A→B)" },
    { href: "/availability", label: "Availability (OneOff / Recurring)" },
    { href: "/trips", label: "Trips (Create / Discover)" },
    { href: "/bookings", label: "Bookings (My / Decide)" },
    { href: "/inicio", label: "Login / Registro (frontend demo)" },
    { href: "/driver", label: "Driver Page (Map Component)" },
  ];

  return (
    <main style={{ padding: 20 }}>
      <h1>Carpool Test Console</h1>
      <ul>
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href}>{l.label}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}

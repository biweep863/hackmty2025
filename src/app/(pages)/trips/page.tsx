"use client";

import { FormEvent, useState } from "react";
import { trpc } from "~/utils/trpc";

export default function TripsPage() {
  const discover = trpc.trips.discover.useQuery({ status: "OPEN" });
  const createTrip = trpc.trips.create.useMutation();
  const lockTrip = trpc.trips.lock.useMutation();
  const cancelTrip = trpc.trips.cancel.useMutation();

  const [form, setForm] = useState({
    routeTemplateId: "",
    departureAt: "",
    seatsTotal: "3",
    pickupPointId: "",
    pickupCustomLabel: "",
    pickupLat: "",
    pickupLng: "",
  });

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await createTrip.mutateAsync({
      routeTemplateId: form.routeTemplateId,
      departureAt: new Date(form.departureAt).toISOString(),
      seatsTotal: Number(form.seatsTotal),
      pickupPointId: form.pickupPointId || undefined,
      pickupCustomLabel: form.pickupCustomLabel || undefined,
      pickupLat: form.pickupLat ? Number(form.pickupLat) : undefined,
      pickupLng: form.pickupLng ? Number(form.pickupLng) : undefined,
    });
    discover.refetch();
  }

  async function onLock(id: string, lock: boolean) {
    await lockTrip.mutateAsync({ tripId: id, lock });
    discover.refetch();
  }
  async function onCancel(id: string) {
    await cancelTrip.mutateAsync({ tripId: id });
    discover.refetch();
  }

  return (
    <main style={{ padding: 20 }}>
      <h2>Trips</h2>

      <form onSubmit={onCreate}>
        <input
          placeholder="routeTemplateId"
          value={form.routeTemplateId}
          onChange={(e) =>
            setForm({ ...form, routeTemplateId: e.target.value })
          }
        />
        <input
          type="datetime-local"
          value={form.departureAt}
          onChange={(e) => setForm({ ...form, departureAt: e.target.value })}
        />
        <input
          placeholder="seatsTotal"
          value={form.seatsTotal}
          onChange={(e) => setForm({ ...form, seatsTotal: e.target.value })}
        />
        <input
          placeholder="pickupPointId (opt)"
          value={form.pickupPointId}
          onChange={(e) => setForm({ ...form, pickupPointId: e.target.value })}
        />
        <input
          placeholder="pickupCustomLabel (opt)"
          value={form.pickupCustomLabel}
          onChange={(e) =>
            setForm({ ...form, pickupCustomLabel: e.target.value })
          }
        />
        <input
          placeholder="pickupLat (opt)"
          value={form.pickupLat}
          onChange={(e) => setForm({ ...form, pickupLat: e.target.value })}
        />
        <input
          placeholder="pickupLng (opt)"
          value={form.pickupLng}
          onChange={(e) => setForm({ ...form, pickupLng: e.target.value })}
        />
        <button type="submit">Create Trip</button>
      </form>

      <h3>Discover (OPEN)</h3>
      {discover.data?.map((t) => (
        <div
          key={t.id}
          style={{ border: "1px solid #ddd", padding: 8, marginBottom: 8 }}
        >
          <div>
            <strong>{t.routeTemplate.fromLabel}</strong> →{" "}
            <strong>{t.routeTemplate.toLabel}</strong>
          </div>
          <div>Departure: {new Date(t.departureAt).toLocaleString()}</div>
          <div>
            Seats: {t.seatsTaken}/{t.seatsTotal}
          </div>
          <div>Status: {t.status}</div>
          <button onClick={() => onLock(t.id, t.status !== "LOCKED")}>
            {t.status === "LOCKED" ? "Unlock" : "Lock"}
          </button>
          <button onClick={() => onCancel(t.id)}>Cancel</button>
          <pre>
            {JSON.stringify(
              t.pickupPoint || { pickupCustomLabel: t.pickupCustomLabel },
              null,
              2,
            )}
          </pre>
        </div>
      ))}
    </main>
  );
}

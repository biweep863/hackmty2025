"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { trpc } from "~/utils/trpc";

export default function BookingsPage() {
  const my = trpc.bookings.myBookings.useQuery();
  const discover = trpc.trips.discover.useQuery({ status: "OPEN" });
  const requestSeat = trpc.bookings.requestSeat.useMutation();
  const decide = trpc.bookings.decide.useMutation();
  const cancelByRider = trpc.bookings.cancelByRider.useMutation();

  const [req, setReq] = useState({
    tripId: "",
    pickupPointId: "",
    pickupNote: "",
  });

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    await requestSeat.mutateAsync({
      tripId: req.tripId,
      pickupPointId: req.pickupPointId || undefined,
      pickupNote: req.pickupNote || undefined,
    });
    my.refetch();
  }

  async function onDecide(id: string, accept: boolean) {
    await decide.mutateAsync({ bookingId: id, accept });
    my.refetch();
  }

  async function onCancel(bookingId: string) {
    await cancelByRider.mutateAsync({ bookingId });
    my.refetch();
  }

  return (
    <main style={{ padding: 20 }}>
      <h2>Bookings</h2>

      <section style={{ marginBottom: 20 }}>
        <h3>Request Seat</h3>
        <form onSubmit={onRequest}>
          <input
            placeholder="tripId"
            value={req.tripId}
            onChange={(e) => setReq({ ...req, tripId: e.target.value })}
          />
          <input
            placeholder="pickupPointId (opt)"
            value={req.pickupPointId}
            onChange={(e) => setReq({ ...req, pickupPointId: e.target.value })}
          />
          <input
            placeholder="pickupNote (opt)"
            value={req.pickupNote}
            onChange={(e) => setReq({ ...req, pickupNote: e.target.value })}
          />
          <button type="submit">Request</button>
        </form>

        <details>
          <summary>Discover (copy tripId)</summary>
          {discover.data?.map((t) => (
            <div
              key={t.id}
              style={{ border: "1px dashed #ccc", padding: 6, margin: 6 }}
            >
              <div>{t.id}</div>
              <div>
                {t.routeTemplate.fromLabel} → {t.routeTemplate.toLabel}
              </div>
              <div>{new Date(t.departureAt).toLocaleString()}</div>
            </div>
          ))}
        </details>
      </section>

      <section>
        <h3>My Bookings</h3>
        {my.data?.map((b) => (
          <div
            key={b.id}
            style={{ border: "1px solid #ddd", padding: 8, marginBottom: 8 }}
          >
            <div>
              <strong>Booking:</strong> {b.id} — <strong>Status:</strong>{" "}
              {b.status}
            </div>
            <div>
              Trip: {b.trip.routeTemplate.fromLabel} →{" "}
              {b.trip.routeTemplate.toLabel}
            </div>
            <div>
              Departure: {new Date(b.trip.departureAt).toLocaleString()}
            </div>
            <div>
              Pickup:{" "}
              {b.pickupPoint?.label || b.pickupNote || "N/A"}
            </div>

            <div style={{ marginTop: 8 }}>
              <button onClick={() => onCancel(b.id)}>Cancel by Rider</button>
            </div>

            <details style={{ marginTop: 8 }}>
              <summary>Driver Actions (Decide)</summary>
              <button onClick={() => onDecide(b.id, true)}>Accept</button>
              <button onClick={() => onDecide(b.id, false)}>Reject</button>
            </details>
          </div>
        ))}
      </section>
    </main>
  );
}

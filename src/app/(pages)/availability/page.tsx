"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { trpc } from "~/utils/trpc";

export default function AvailabilityPage() {
  const list = trpc.availability.listMine.useQuery();
  const createOneOff = trpc.availability.createOneOff.useMutation();
  const createRecurring = trpc.availability.createRecurring.useMutation();
  const toggleActive = trpc.availability.toggleActive.useMutation();

  const [oneOff, setOneOff] = useState({
    routeTemplateId: "",
    startAt: "",
    endAt: "",
    seats: "3",
  });

  const [rec, setRec] = useState({
    routeTemplateId: "",
    weekdayMaskCsv: "1,2,3,4,5",
    timeWindowStart: "08:00",
    timeWindowEnd: "09:00",
    seats: "3",
  });

  async function onOneOff(e: FormEvent) {
    e.preventDefault();
    await createOneOff.mutateAsync({
      routeTemplateId: oneOff.routeTemplateId,
      type: "ONE_OFF",
      startAt: new Date(oneOff.startAt).toISOString(),
      endAt: new Date(oneOff.endAt).toISOString(),
      seats: Number(oneOff.seats),
    });
    list.refetch();
  }

  async function onRec(e: FormEvent) {
    e.preventDefault();
    const weekdayMask = rec.weekdayMaskCsv
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));
    await createRecurring.mutateAsync({
      routeTemplateId: rec.routeTemplateId,
      type: "RECURRING",
      weekdayMask,
      timeWindowStart: rec.timeWindowStart,
      timeWindowEnd: rec.timeWindowEnd,
      seats: Number(rec.seats),
    });
    list.refetch();
  }

  async function onToggle(id: string) {
    await toggleActive.mutateAsync({ id });
    list.refetch();
  }

  return (
    <main style={{ padding: 20 }}>
      <h2>Availability</h2>

      <section>
        <h3>Create ONE_OFF</h3>
        <form onSubmit={onOneOff}>
          <input
            placeholder="routeTemplateId"
            value={oneOff.routeTemplateId}
            onChange={(e) =>
              setOneOff({ ...oneOff, routeTemplateId: e.target.value })
            }
          />
          <input
            type="datetime-local"
            value={oneOff.startAt}
            onChange={(e) => setOneOff({ ...oneOff, startAt: e.target.value })}
          />
          <input
            type="datetime-local"
            value={oneOff.endAt}
            onChange={(e) => setOneOff({ ...oneOff, endAt: e.target.value })}
          />
          <input
            placeholder="seats"
            value={oneOff.seats}
            onChange={(e) => setOneOff({ ...oneOff, seats: e.target.value })}
          />
          <button type="submit">Create ONE_OFF</button>
        </form>
      </section>

      <section>
        <h3>Create RECURRING</h3>
        <form onSubmit={onRec}>
          <input
            placeholder="routeTemplateId"
            value={rec.routeTemplateId}
            onChange={(e) =>
              setRec({ ...rec, routeTemplateId: e.target.value })
            }
          />
          <input
            placeholder="weekdayMask CSV (e.g. 1,2,3,4,5)"
            value={rec.weekdayMaskCsv}
            onChange={(e) => setRec({ ...rec, weekdayMaskCsv: e.target.value })}
          />
          <input
            placeholder="timeWindowStart (HH:MM)"
            value={rec.timeWindowStart}
            onChange={(e) =>
              setRec({ ...rec, timeWindowStart: e.target.value })
            }
          />
          <input
            placeholder="timeWindowEnd (HH:MM)"
            value={rec.timeWindowEnd}
            onChange={(e) => setRec({ ...rec, timeWindowEnd: e.target.value })}
          />
          <input
            placeholder="seats"
            value={rec.seats}
            onChange={(e) => setRec({ ...rec, seats: e.target.value })}
          />
          <button type="submit">Create RECURRING</button>
        </form>
      </section>

      <h3>My Availability</h3>
      {list.data?.map((a) => (
        <div
          key={a.id}
          style={{ border: "1px solid #ddd", padding: 8, marginBottom: 8 }}
        >
          <div>ID: {a.id}</div>
          <div>Type: {a.type}</div>
          <div>Active: {String(a.isActive)}</div>
          <button onClick={() => onToggle(a.id)}>
            {a.isActive ? "Deactivate" : "Activate"}
          </button>
          <pre>{JSON.stringify(a, null, 2)}</pre>
        </div>
      ))}
    </main>
  );
}

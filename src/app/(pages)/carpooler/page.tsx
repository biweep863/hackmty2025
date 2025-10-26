"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { trpc } from "~/utils/trpc";

export default function CarpoolerPage() {
  const profile = trpc.carpooler.getProfile.useQuery();
  const upsert = trpc.carpooler.upsertProfile.useMutation();

  const [form, setForm] = useState({
    vehicleMake: "",
    vehicleModel: "",
    vehicleColor: "",
    plateLast4: "",
    seatsDefault: "3",
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await upsert.mutateAsync({
      vehicleMake: form.vehicleMake || undefined,
      vehicleModel: form.vehicleModel || undefined,
      vehicleColor: form.vehicleColor || undefined,
      plateLast4: form.plateLast4 || undefined,
      seatsDefault: form.seatsDefault ? Number(form.seatsDefault) : undefined,
    });
    profile.refetch();
  }

  return (
    <main style={{ padding: 20 }}>
      <h2>Carpooler Profile</h2>
      <form onSubmit={onSubmit}>
        <input
          placeholder="vehicleMake"
          value={form.vehicleMake}
          onChange={(e) => setForm({ ...form, vehicleMake: e.target.value })}
        />
        <input
          placeholder="vehicleModel"
          value={form.vehicleModel}
          onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })}
        />
        <input
          placeholder="vehicleColor"
          value={form.vehicleColor}
          onChange={(e) => setForm({ ...form, vehicleColor: e.target.value })}
        />
        <input
          placeholder="plateLast4"
          value={form.plateLast4}
          onChange={(e) => setForm({ ...form, plateLast4: e.target.value })}
        />
        <input
          placeholder="seatsDefault"
          value={form.seatsDefault}
          onChange={(e) => setForm({ ...form, seatsDefault: e.target.value })}
        />
        <button type="submit">Save</button>
      </form>

      <h3>Current</h3>
      <pre>{JSON.stringify(profile.data, null, 2)}</pre>
    </main>
  );
}

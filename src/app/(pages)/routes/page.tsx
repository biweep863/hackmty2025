"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { trpc } from "~/utils/trpc";

export default function RoutesPage() {
  const list = trpc.routes.listMine.useQuery();
  const create = trpc.routes.create.useMutation();

  const [form, setForm] = useState({
    fromLabel: "",
    fromLat: "",
    fromLng: "",
    fromSiteId: "",
    toLabel: "",
    toLat: "",
    toLng: "",
    toSiteId: "",
  });

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      fromLabel: form.fromLabel,
      fromLat: form.fromLat ? Number(form.fromLat) : undefined,
      fromLng: form.fromLng ? Number(form.fromLng) : undefined,
      fromSiteId: form.fromSiteId || undefined,
      toLabel: form.toLabel,
      toLat: form.toLat ? Number(form.toLat) : undefined,
      toLng: form.toLng ? Number(form.toLng) : undefined,
      toSiteId: form.toSiteId || undefined,
      isActive: true,
    });
    list.refetch();
    setForm({
      fromLabel: "",
      fromLat: "",
      fromLng: "",
      fromSiteId: "",
      toLabel: "",
      toLat: "",
      toLng: "",
      toSiteId: "",
    });
  }

  return (
    <main style={{ padding: 20 }}>
      <h2>Route Templates</h2>
      <form onSubmit={onCreate}>
        <input
          placeholder="fromLabel"
          value={form.fromLabel}
          onChange={(e) => setForm({ ...form, fromLabel: e.target.value })}
        />
        <input
          placeholder="fromLat"
          value={form.fromLat}
          onChange={(e) => setForm({ ...form, fromLat: e.target.value })}
        />
        <input
          placeholder="fromLng"
          value={form.fromLng}
          onChange={(e) => setForm({ ...form, fromLng: e.target.value })}
        />
        <input
          placeholder="fromSiteId (optional)"
          value={form.fromSiteId}
          onChange={(e) => setForm({ ...form, fromSiteId: e.target.value })}
        />
        <input
          placeholder="toLabel"
          value={form.toLabel}
          onChange={(e) => setForm({ ...form, toLabel: e.target.value })}
        />
        <input
          placeholder="toLat"
          value={form.toLat}
          onChange={(e) => setForm({ ...form, toLat: e.target.value })}
        />
        <input
          placeholder="toLng"
          value={form.toLng}
          onChange={(e) => setForm({ ...form, toLng: e.target.value })}
        />
        <input
          placeholder="toSiteId (optional)"
          value={form.toSiteId}
          onChange={(e) => setForm({ ...form, toSiteId: e.target.value })}
        />
        <button type="submit">Create</button>
      </form>

      <h3>Mine</h3>
      <pre>{JSON.stringify(list.data, null, 2)}</pre>
    </main>
  );
}

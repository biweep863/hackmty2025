"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { trpc } from "~/utils/trpc";

export default function SitesPage() {
  const sites = trpc.sites.list.useQuery();
  const createSite = trpc.sites.create.useMutation();
  const addPickup = trpc.sites.addPickupPoint.useMutation();

  const [siteForm, setSiteForm] = useState({
    code: "",
    name: "",
    address: "",
    lat: "",
    lng: "",
  });
  const [pickupForm, setPickupForm] = useState({
    siteId: "",
    label: "",
    lat: "",
    lng: "",
  });

  const refresh = () => sites.refetch();

  async function onCreateSite(e: FormEvent) {
    e.preventDefault();
    await createSite.mutateAsync({
      code: siteForm.code,
      name: siteForm.name,
      address: siteForm.address || undefined,
      lat: siteForm.lat ? Number(siteForm.lat) : undefined,
      lng: siteForm.lng ? Number(siteForm.lng) : undefined,
    });
    setSiteForm({ code: "", name: "", address: "", lat: "", lng: "" });
    refresh();
  }

  async function onAddPickup(e: FormEvent) {
    e.preventDefault();
    await addPickup.mutateAsync({
      siteId: pickupForm.siteId,
      label: pickupForm.label,
      lat: pickupForm.lat ? Number(pickupForm.lat) : undefined,
      lng: pickupForm.lng ? Number(pickupForm.lng) : undefined,
    });
    setPickupForm({ siteId: "", label: "", lat: "", lng: "" });
    refresh();
  }

  return (
    <main style={{ padding: 20 }}>
      <h2>Sites</h2>

      <form onSubmit={onCreateSite} style={{ marginBottom: 20 }}>
        <h3>Create Site</h3>
        <input
          placeholder="code"
          value={siteForm.code}
          onChange={(e) => setSiteForm({ ...siteForm, code: e.target.value })}
        />
        <input
          placeholder="name"
          value={siteForm.name}
          onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
        />
        <input
          placeholder="address"
          value={siteForm.address}
          onChange={(e) =>
            setSiteForm({ ...siteForm, address: e.target.value })
          }
        />
        <input
          placeholder="lat"
          value={siteForm.lat}
          onChange={(e) => setSiteForm({ ...siteForm, lat: e.target.value })}
        />
        <input
          placeholder="lng"
          value={siteForm.lng}
          onChange={(e) => setSiteForm({ ...siteForm, lng: e.target.value })}
        />
        <button type="submit">Create</button>
      </form>

      <form onSubmit={onAddPickup} style={{ marginBottom: 20 }}>
        <h3>Add Pickup Point</h3>
        <input
          placeholder="siteId"
          value={pickupForm.siteId}
          onChange={(e) =>
            setPickupForm({ ...pickupForm, siteId: e.target.value })
          }
        />
        <input
          placeholder="label"
          value={pickupForm.label}
          onChange={(e) =>
            setPickupForm({ ...pickupForm, label: e.target.value })
          }
        />
        <input
          placeholder="lat"
          value={pickupForm.lat}
          onChange={(e) =>
            setPickupForm({ ...pickupForm, lat: e.target.value })
          }
        />
        <input
          placeholder="lng"
          value={pickupForm.lng}
          onChange={(e) =>
            setPickupForm({ ...pickupForm, lng: e.target.value })
          }
        />
        <button type="submit">Add</button>
      </form>

      <h3>List</h3>
      {sites.data?.map((s) => (
        <div
          key={s.id}
          style={{ border: "1px solid #ddd", padding: 8, marginBottom: 8 }}
        >
          <strong>{s.name}</strong> ({s.code})<br />
          {s.pickupPoints.length} pickup points
          <pre>{JSON.stringify(s.pickupPoints, null, 2)}</pre>
        </div>
      ))}
    </main>
  );
}

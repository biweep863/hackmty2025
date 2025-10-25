"use client";

import { useEffect, useState, useRef } from "react";
import { TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Map from "~/app/_components/map";
import { api } from "~/trpc/react";
import { toast } from "react-hot-toast";

export default function RiderPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [pinMode, setPinMode] = useState<"none" | "searchPin">("none");
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(
    null,
  );
  const [searchInput, setSearchInput] = useState<{
    lat: number;
    lng: number;
    radiusMeters?: number;
    limit?: number;
  } | null>(null);
  const searchNearby = api.routes.searchNearbyTrips.useQuery(
    searchInput ?? { lat: 0, lng: 0, radiusMeters: 1500, limit: 5 },
    { enabled: !!searchInput },
  );
  const joinTrip = api.routes.joinTrip.useMutation();

  const handleSearchNearby = async (lat?: number, lng?: number) => {
    const qlat = lat ?? selectedCoords?.[0] ?? 25.6866;
    const qlng = lng ?? selectedCoords?.[1] ?? -100.3161;
    try {
      setSearchInput({ lat: qlat, lng: qlng, radiusMeters: 2000, limit: 5 });
      // wait for query to populate
      // useEffect not necessary; we can read searchNearby.data after the hook updates
      // but for immediate UX, we'll await a short delay and then read
      await new Promise((r) => setTimeout(r, 200));
      setResults(searchNearby.data ?? null);
      toast.success(`Encontrados ${searchNearby.data?.length ?? 0} puntos`);
    } catch (err) {
      console.error(err);
      toast.error("Error buscando rutas cercanas");
    }
  };

  const handleJoin = async (tripId: string, stopId?: string) => {
    try {
      await joinTrip.mutateAsync({ tripId, stopId });
      toast.success("Solicitud de asiento enviada");
    } catch (err) {
      console.error(err);
      toast.error("Error al unirse");
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6 rounded-md">
        <h1 className="text-2xl font-bold">Buscar viajes</h1>
        <p className="text-sm text-gray-600">
          Busca viajes cercanos y únete a un pickup
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <div className="mb-2 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar dirección"
              className="flex-1 rounded border p-2"
            />
            <button
              className="rounded border px-3"
              onClick={() => void handleSearchNearby()}
            >
              Buscar cerca
            </button>
            <button
              className={`rounded border px-3 ${pinMode === "searchPin" ? "bg-red-600 text-white" : ""}`}
              onClick={() =>
                setPinMode(pinMode === "searchPin" ? "none" : "searchPin")
              }
            >
              Pin
            </button>
          </div>
          <div className="h-[70vh]">
            <Map
              onMapClick={(lat, lng) => {
                if (pinMode === "searchPin") {
                  setSelectedCoords([lat, lng]);
                  setPinMode("none");
                  void handleSearchNearby(lat, lng);
                }
              }}
            />
          </div>
        </div>
        <aside>
          <div className="rounded border bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Resultados</h2>
            {!results && (
              <div className="text-sm text-gray-500">No hay resultados</div>
            )}
            {results && results.length === 0 && (
              <div className="text-sm text-gray-500">No hay rutas cercanas</div>
            )}
            {results && results.length > 0 && (
              <ul className="mt-2 space-y-2">
                {results.map((r: any) => (
                  <li key={r.stopId} className="rounded border p-2">
                    <div className="text-sm font-medium">
                      {r.trip.routeTemplate?.fromLabel} →{" "}
                      {r.trip.routeTemplate?.toLabel}
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.distanceMeters} m · Asientos: {r.trip.seatsTaken}/
                      {r.trip.seatsTotal}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded bg-green-600 px-3 py-1 text-sm text-white"
                        onClick={() => void handleJoin(r.trip.id, r.stopId)}
                      >
                        Unirse
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import Map from "./map";
import Loading from "./Loading";
import { api } from "~/trpc/react";

interface TripsListProps {
  trips?: any[];
  myTrips?: any[];
  userEmail?: string;
}

type OSRMRoute = {
  distance: number;
  geometry: {
    coordinates: [number, number][];
  };
};

type OSRMResponse = {
  routes?: OSRMRoute[];
};


export default function TripsList({ trips, myTrips, userEmail }: TripsListProps) {
  const trpcCtx = api.useContext();
  const [mapData, setMapData] = useState<{
    coords?: { start: [number, number]; end: [number, number] };
    route?: [number, number][];
    origin?: string;
    destination?: string;
  }>();
  const [showMap, setShowMap] = useState(false);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [reservedAmount, setReservedAmount] = useState<number | null>(null);
  const [loadingAction, setLoadingAction] = useState<
    { id: string; action: "reserve" | "unreserve" } | null
  >(null);
  const [confirmUnreserve, setConfirmUnreserve] = useState<{
    id: string;
    price: number | null;
  } | null>(null);

  const reserveTrip = api.trips.saveTrip.useMutation({
    onSuccess: () => {
      void trpcCtx.trips.getMyTrips.invalidate();
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 4000);
      setLoadingAction(null);
    },
    onError: () => setLoadingAction(null),
  });

  const isReserved = (tripId: string) => myTrips?.some((trip) => trip.id === tripId);

  const sortedTrips = trips
    ? [...trips].sort((a, b) => (isReserved(a.id) ? 0 : 1) - (isReserved(b.id) ? 0 : 1))
    : [];

  if (!trips || !myTrips) return <Loading />;

  const getRoute = async (coords: { start: [number, number]; end: [number, number] }) => {
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords.start[1]},${coords.start[0]};${coords.end[1]},${coords.end[0]}?overview=full&geometries=geojson`
      );
      if (!res.ok) return;
      const data = (await res.json()) as OSRMResponse;
      const routeData = data.routes?.[0];
      if (!routeData) return;
      setRoute(routeData.geometry.coordinates.map(([lon, lat]) => [lat, lon]));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {sortedTrips.length === 0 ? (
        <div className="p-8 text-center text-gray-600 rounded-md border border-gray-200">
          No hay viajes disponibles.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedTrips.map((t) => {
            const reserved = isReserved(t.id);

            return (
              <article
                key={t.id}
                onClick={() => {
                  const coords =
                    t.latStart != null &&
                    t.latEnd != null &&
                    t.lngStart != null &&
                    t.lngEnd != null
                      ? {
                          start: [Number(t.latStart), Number(t.lngStart)] as [number, number],
                          end: [Number(t.latEnd), Number(t.lngEnd)] as [number, number],
                        }
                      : undefined;

                  setMapData({
                    coords,
                    origin: t.origin,
                    destination: t.destination,
                  });

                  if (coords) getRoute(coords);
                  setShowMap(true);
                }}
                className="p-4 rounded-xl shadow-sm hover:shadow-lg transition-shadow bg-white card-hover"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-lg font-semibold text-gray-800">
                      {t.origin} <span className="text-gray-400">→</span> {t.destination}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Conductor:{" "}
                      <span className="font-medium text-gray-800">{t.driver?.name ?? "N/A"}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Email del conductor:{" "}
                      <span className="font-medium text-gray-800">{t.driver?.email ?? "N/A"}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Distancia</div>
                    <div className="font-semibold text-gray-800">
                      {t.distanceKm ? `${t.distanceKm} km` : "—"}
                    </div>
                  </div>
                </div>

                {userEmail && (
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-sm text-gray-700">
                      Duración: <span className="font-medium">{t.durationMin ?? "—"} min</span>
                    </div>
                    <button
                      disabled={loadingAction?.id === t.id}
                      className={`px-4 py-2 rounded-md text-white font-medium shadow transition-colors ${
                        reserved ? "bg-gray-400 hover:bg-gray-500" : "bg-[#e60012] hover:bg-[#c30010]"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (reserved) {
                          setConfirmUnreserve({ id: t.id, price: t.price ?? null });
                          return;
                        }
                        setReservedAmount(t.price ?? null);
                        setLoadingAction({ id: t.id, action: "reserve" });
                        reserveTrip.mutate({ id: t.id, userEmail: userEmail ?? "" });
                      }}
                    >
                      {loadingAction?.id === t.id
                        ? loadingAction && loadingAction.action === "reserve"
                          ? "Reservando..."
                          : "Cancelando..."
                        : reserved
                        ? "Reservado"
                        : "Reservar"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Modal del mapa con origen y destino */}
      {showMap && mapData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMap(false)} />
          <div className="relative z-10 w-full max-w-4xl h-[75vh] bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-3 flex items-center justify-between border-b">
              <div>
                <div className="font-semibold text-lg text-gray-800">Vista del viaje</div>
                <div className="text-sm text-gray-600">
                  {mapData.origin} <span className="text-gray-400">→</span> {mapData.destination}
                </div>
              </div>
              <button
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                onClick={() => setShowMap(false)}
              >
                Cerrar
              </button>
            </div>
            <div className="h-[calc(100%-56px)]">
              <Map coords={mapData.coords} route={route || []} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

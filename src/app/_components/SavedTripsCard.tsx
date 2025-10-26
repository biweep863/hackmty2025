"use client";

import React, { useState } from "react";
import Map from "./map";
import Loading from "./Loading";
import { api } from "~/trpc/react";

interface Trip {
  id: string;
  origin: string;
  destination: string;
  driver?: { name?: string; email?: string };
  distanceKm?: number;
  durationMin?: number;
  latStart?: number;
  lngStart?: number;
  latEnd?: number;
  lngEnd?: number;
  price?: number | null;
}

interface TripsListProps {
  trips?: Trip[];
  myTrips?: Trip[];
  userEmail?: string;
}

export default function TripsList({ trips, myTrips, userEmail }: TripsListProps) {
  const trpcCtx = api.useContext();
  const [mapData, setMapData] = useState<{
    coords?: { start: [number, number]; end: [number, number] };
    origin?: string;
    destination?: string;
  }>();
  const [showMap, setShowMap] = useState(false);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [reservedAmount, setReservedAmount] = useState<number | null>(null);
  const [loadingAction, setLoadingAction] = useState<{ id: string; action: "reserve" | "unreserve" } | null>(null);
  const [confirmUnreserve, setConfirmUnreserve] = useState<{ id: string; price: number | null } | null>(null);

  const reserveTrip = api.trips.saveTrip.useMutation({
    onSuccess: () => {
      void trpcCtx.trips.getMyTrips.invalidate();
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 4000);
      setLoadingAction(null);
    },
    onError: () => setLoadingAction(null),
  });

  const unreserveTrip = api.trips.removeTrip.useMutation({
    onSuccess: () => {
      void trpcCtx.trips.getMyTrips.invalidate();
      setLoadingAction(null);
    },
    onError: () => setLoadingAction(null),
  });

  const isReserved = (tripId: string) => myTrips?.some((trip) => trip.id === tripId);
  const sortedTrips = trips ? [...trips].sort((a, b) => (isReserved(a.id) ? 0 : 1) - (isReserved(b.id) ? 0 : 1)) : [];

  if (!trips || !myTrips) return <Loading />;

  const formatPrice = (p: number | null | undefined) => {
    if (p == null) return "—";
    try {
      return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(p);
    } catch (e) {
      return `$${p}`;
    }
  };

  const getRoute = async (coords: { start: [number, number]; end: [number, number] }) => {
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords.start[1]},${coords.start[0]};${coords.end[1]},${coords.end[0]}?overview=full&geometries=geojson`
      );
      if (!res.ok) return;
      const data = await res.json();
      const routeData = data.routes?.[0];
      if (!routeData) return;
      setRoute(routeData.geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon]));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto min-h-screen bg-gradient-to-br from-gray-100 to-gray-50 font-inter">

      {sortedTrips.length === 0 ? (
        <div className="p-8 text-center text-gray-600 rounded-md border border-gray-200">No hay viajes disponibles.</div>
      ) : (
        <div className="space-y-5">
          {sortedTrips.map((t) => {
            const reserved = isReserved(t.id);
            return (
              <div
                key={t.id}
                onClick={() => {
                  if (t.latStart && t.latEnd && t.lngStart && t.lngEnd) {
                    const coords = {
                      start: [t.latStart, t.lngStart] as [number, number],
                      end: [t.latEnd, t.lngEnd] as [number, number],
                    };
                    setMapData({ coords, origin: t.origin, destination: t.destination });
                    void getRoute(coords);
                  }
                  setShowMap(true);
                }}
                className="bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition-shadow transform hover:scale-[1.02] border-l-4 border-red-500 cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-lg font-semibold text-red-600">
                      {t.origin} → {t.destination}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Conductor: {t.driver?.name ?? "N/A"}</div>
                    <div className="text-sm text-gray-600">Email: {t.driver?.email ?? "N/A"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Distancia</div>
                    <div className="font-semibold text-gray-800">{t.distanceKm ? `${t.distanceKm} km` : "—"}</div>
                    <div className="text-sm text-gray-500 mt-2">Precio</div>
                    <div className="font-semibold text-gray-800">{formatPrice(t.price ?? null)}</div>
                  </div>
                </div>

                {userEmail && (
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-gray-700">Duración: <span className="font-medium">{t.durationMin ?? "—"} min</span></div>
                    <button
                      disabled={loadingAction?.id === t.id}
                      className={`px-4 py-2 rounded-lg font-medium shadow text-white transition-transform transform hover:scale-105 ${
                        reserved
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (reserved) {
                          setConfirmUnreserve({ id: t.id, price: t.price ?? null });
                          return;
                        }
                        setReservedAmount(t.price ?? null);
                        setLoadingAction({ id: t.id, action: "reserve" });
                        reserveTrip.mutate({ id: t.id, userEmail });
                      }}
                    >
                      {loadingAction?.id === t.id
                        ? loadingAction.action === "reserve"
                          ? "Reservando..."
                          : "Cancelando..."
                        : reserved
                        ? "Reservado"
                        : "Reservar"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Mapa */}
      {showMap && mapData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMap(false)} />
          <div className="relative z-10 w-full max-w-4xl h-[75vh] bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 scale-95">
            <div className="p-3 flex justify-between border-b">
              <div>
                <div className="font-semibold text-lg">{mapData.origin} → {mapData.destination}</div>
              </div>
              <button className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300" onClick={() => setShowMap(false)}>Cerrar</button>
            </div>
            <div className="h-[calc(100%-56px)]">
              <Map coords={mapData.coords} route={route ?? []} />
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Cancelar */}
      {confirmUnreserve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmUnreserve(null)} />
          <div className="relative z-10 w-full max-w-sm bg-white rounded-xl shadow-xl p-6 flex flex-col items-center text-center">
            <h3 className="text-lg font-semibold text-gray-800">¿Cancelar reserva?</h3>
            <p className="text-sm text-gray-600 mt-2">Se quitará la reserva de este viaje.</p>
            <div className="mt-4 font-medium">{confirmUnreserve.price !== null ? `Monto retenido: ${formatPrice(confirmUnreserve.price)}` : "Monto: —"}</div>
            <div className="mt-6 flex gap-3">
              <button
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  onClick={() => {
                  setLoadingAction({ id: confirmUnreserve.id, action: "unreserve" });
                  unreserveTrip.mutate({ id: confirmUnreserve.id, userEmail: userEmail! });
                  setConfirmUnreserve(null);
                }}
              >
                Sí, cancelar
              </button>
              <button className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300" onClick={() => setConfirmUnreserve(null)}>No, mantener</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pago Exitoso */}
      {showSuccessModal && reservedAmount != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSuccessModal(false)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-xl p-6 flex flex-col items-center text-center">
            <div className="bg-green-100 rounded-full p-4 mb-4">
              <svg className="w-10 h-10 text-green-600" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800">Pago exitoso</h3>
            <p className="text-sm text-gray-600 mt-2">Se ha realizado una retención a tu cuenta</p>
            <div className="mt-4 font-medium">{`Monto: ${formatPrice(reservedAmount ?? null)}`}</div>
            <button className="mt-6 px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300" onClick={() => setShowSuccessModal(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

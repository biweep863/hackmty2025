"use client";

import React, { useState } from "react";
import Map from "./map";
import Loading from "./Loading";
import { api } from "~/trpc/react";
import type { Decimal } from "@prisma/client/runtime/library";

type Price = number | Decimal | null;

interface Trip {
  id: string;
  origin: string;
  destination: string;
  driver?: { name?: string; email?: string };
  distanceKm?: number | Decimal;
  durationMin?: number | Decimal | null;
  latStart?: number | Decimal;
  lngStart?: number | Decimal;
  latEnd?: number | Decimal;
  lngEnd?: number | Decimal;
  price?: Price;
}

interface TripsListProps {
  trips: Trip[];
  myTrips: Trip[];
  userEmail?: string;
}

export default function TripsList({
  trips,
  myTrips,
  userEmail,
}: TripsListProps) {
  const trpcCtx = api.useContext();
  const [mapData, setMapData] = useState<{
    coords?: { start: [number, number]; end: [number, number] };
    origin?: string;
    destination?: string;
  }>();
  const [showMap, setShowMap] = useState(false);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [reservedAmount, setReservedAmount] = useState<Price>(null);
  const [loadingAction, setLoadingAction] = useState<{
    id: string;
    action: "reserve" | "unreserve";
  } | null>(null);
  const [confirmUnreserve, setConfirmUnreserve] = useState<{
    id: string;
    price: Price | null;
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

  const unreserveTrip = api.trips.removeTrip.useMutation({
    onSuccess: () => {
      void trpcCtx.trips.getMyTrips.invalidate();
      setLoadingAction(null);
    },
    onError: () => setLoadingAction(null),
  });

  const isReserved = (tripId: string) =>
    myTrips?.some((trip) => trip.id === tripId);
  const sortedTrips = trips
    ? [...trips].sort(
        (a, b) => (isReserved(a.id) ? 0 : 1) - (isReserved(b.id) ? 0 : 1),
      )
    : [];

  if (!trips || !myTrips) return <Loading />;

  const formatPrice = (p: Price) => {
    if (p == null) return "—";
    try {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
      }).format(Number(p));
    } catch (e) {
      return `$${p}`;
    }
  };

  const getRoute = async (coords: {
    start: [number, number];
    end: [number, number];
  }) => {
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords.start[1]},${coords.start[0]};${coords.end[1]},${coords.end[0]}?overview=full&geometries=geojson`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const routeData = data.routes?.[0];
      if (!routeData) return;
      setRoute(
        routeData.geometry.coordinates.map(([lon, lat]: [number, number]) => [
          lat,
          lon,
        ]),
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="font-inter mx-auto min-h-screen max-w-5xl bg-linear-to-br from-gray-100 to-gray-50 p-6">
      {sortedTrips.length === 0 ? (
        <div className="rounded-md border border-gray-200 p-8 text-center text-gray-600">
          No hay viajes disponibles.
        </div>
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
                    setMapData({
                      coords,
                      origin: t.origin,
                      destination: t.destination,
                    });
                    void getRoute(coords);
                  }
                  setShowMap(true);
                }}
                className="transform cursor-pointer rounded-xl border-l-4 border-red-500 bg-white p-5 shadow-md transition-shadow hover:scale-[1.02] hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold text-red-600">
                      {t.origin} → {t.destination}
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      Conductor: {t.driver?.name ?? "N/A"}
                    </div>
                    <div className="text-sm text-gray-600">
                      Email: {t.driver?.email ?? "N/A"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Distancia</div>
                    <div className="font-semibold text-gray-800">
                      {t.distanceKm ? `${t.distanceKm} km` : "—"}
                    </div>
                    <div className="mt-2 text-sm text-gray-500">Precio</div>
                    <div className="font-semibold text-gray-800">
                      {formatPrice(t.price ?? null)}
                    </div>
                  </div>
                </div>

                {userEmail && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Duración:{" "}
                      <span className="font-medium">
                        {Number(t.durationMin) ?? "—"} min
                      </span>
                    </div>
                    <button
                      disabled={loadingAction?.id === t.id}
                      className={`transform rounded-lg px-4 py-2 font-medium text-white shadow transition-transform hover:scale-105 ${
                        reserved
                          ? "cursor-not-allowed bg-gray-400"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (reserved) {
                          setConfirmUnreserve({
                            id: t.id,
                            price: t.price ?? null,
                          });
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
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowMap(false)}
          />
          <div className="relative z-10 h-[75vh] w-full max-w-4xl scale-95 transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all duration-300">
            <div className="flex justify-between border-b p-3">
              <div>
                <div className="text-lg font-semibold">
                  {mapData.origin} → {mapData.destination}
                </div>
              </div>
              <button
                className="rounded bg-gray-200 px-3 py-1 hover:bg-gray-300"
                onClick={() => setShowMap(false)}
              >
                Cerrar
              </button>
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
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setConfirmUnreserve(null)}
          />
          <div className="relative z-10 flex w-full max-w-sm flex-col items-center rounded-xl bg-white p-6 text-center shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800">
              ¿Cancelar reserva?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Se quitará la reserva de este viaje.
            </p>
            <div className="mt-4 font-medium">
              {confirmUnreserve.price !== null
                ? `Monto retenido: ${formatPrice(confirmUnreserve.price)}`
                : "Monto: —"}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                onClick={() => {
                  setLoadingAction({
                    id: confirmUnreserve.id,
                    action: "unreserve",
                  });
                  unreserveTrip.mutate({
                    id: confirmUnreserve.id,
                    userEmail: userEmail!,
                  });
                  setConfirmUnreserve(null);
                }}
              >
                Sí, cancelar
              </button>
              <button
                className="rounded-md bg-gray-200 px-4 py-2 hover:bg-gray-300"
                onClick={() => setConfirmUnreserve(null)}
              >
                No, mantener
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pago Exitoso */}
      {showSuccessModal && reservedAmount != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSuccessModal(false)}
          />
          <div className="relative z-10 flex w-full max-w-md flex-col items-center rounded-xl bg-white p-6 text-center shadow-xl">
            <div className="mb-4 rounded-full bg-green-100 p-4">
              <svg
                className="h-10 w-10 text-green-600"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="#16a34a"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800">
              Pago exitoso
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Se ha realizado una retención a tu cuenta
            </p>
            <div className="mt-4 font-medium">{`Monto: ${formatPrice(reservedAmount ?? null)}`}</div>
            <button
              className="mt-6 rounded-md bg-gray-200 px-4 py-2 hover:bg-gray-300"
              onClick={() => setShowSuccessModal(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

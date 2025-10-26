"use client";

import React from "react";
import { api } from "~/trpc/react";

interface TripsListProps {
  trips: any[] | undefined;
  myTrips: any[] | undefined;
  userEmail?: string;
}

// Componente de loading
function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-red-600"></div>
    </div>
  );
}

export default function TripsList({ trips, myTrips, userEmail }: TripsListProps) {
  const trpcCtx = api.useContext();
  const reserveTrip = api.trips.saveTrip.useMutation({
    onSuccess: () => {
      // Recargar la consulta de mis viajes al reservar
      trpcCtx.trips.getMyTrips.invalidate();
    },
  });

  const isReserved = (tripId: string) =>
    myTrips && myTrips.some((trip) => trip.id === tripId);

  const sortedTrips = trips
    ? [...trips].sort((a, b) => {
        const aReserved = isReserved(a.id) ? 0 : 1;
        const bReserved = isReserved(b.id) ? 0 : 1;
        return aReserved - bReserved;
      })
    : [];

  if (!trips || !myTrips) {
    return <Loading />;
  }

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
                className="p-4 border rounded-md shadow-sm hover:shadow-lg transition-shadow bg-white"
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

                <div className="flex items-center justify-between mt-3">
                  <div className="text-sm text-gray-700">
                    <div>
                      Duración: <span className="font-medium">{t.durationMin ?? "—"} min</span>
                    </div>
                    <div>
                      Precio: <span className="font-medium">{t.price ? `$${t.price}` : "—"}</span>
                    </div>
                  </div>

                  {userEmail && (
                    <div>
                      <button
                        disabled={reserved || reserveTrip.isLoading}
                        className={`px-4 py-2 rounded-md text-white font-medium shadow transition-colors ${
                          reserved
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-[#e60012] hover:bg-[#c30010]"
                        }`}
                        onClick={() => {
                          if (reserved) return;
                          reserveTrip.mutate({
                            id: t.id,
                            userEmail,
                          });
                        }}
                      >
                        {reserveTrip.isLoading && !reserved ? "Reservando..." : reserved ? "Reservado" : "Reservar"}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

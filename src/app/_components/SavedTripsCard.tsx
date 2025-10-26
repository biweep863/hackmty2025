"use client";

import React, { useState } from "react";
import Map from "./map";
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [reservedAmount, setReservedAmount] = useState<number | null>(null);
  const [loadingAction, setLoadingAction] = useState<
    { id: string; action: "reserve" | "unreserve" } | null
  >(null);
  const [confirmUnreserve, setConfirmUnreserve] = useState<{
    id: string;
    price: number | null;
  } | null>(null);
  const [mapData, setMapData] = useState<{ coords?: { start: [number, number]; end: [number, number] }; route?: [number, number][] } | undefined>(undefined);
  const [showMap, setShowMap] = useState(false);
  const reserveTrip = api.trips.saveTrip.useMutation({
    onSuccess: () => {
      // Recargar la consulta de mis viajes al reservar
      void trpcCtx.trips.getMyTrips.invalidate();
      // Mostrar modal de éxito cuando la reserva se complete
      setShowSuccessModal(true);
      // Cerrar automáticamente después de 4 segundos
      setTimeout(() => setShowSuccessModal(false), 4000);
      // limpiar estado de carga
      setLoadingAction(null);
    },
    onError: () => {
      setLoadingAction(null);
    },
  });
  const unreserveTrip = api.trips.removeTrip.useMutation({
    onSuccess: () => {
      // Recargar la consulta de mis viajes al quitar la reserva
      void trpcCtx.trips.getMyTrips.invalidate();
      setLoadingAction(null);
    },
    onError: () => {
      setLoadingAction(null);
    },
  });

  const isReserved = (tripId: string) => myTrips?.some((trip) => trip.id === tripId);

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
                        disabled={
                          loadingAction !== null && loadingAction.id === t.id
                        }
                        className={`px-4 py-2 rounded-md text-white font-medium shadow transition-colors ${
                          reserved
                            ? "bg-gray-400 hover:bg-gray-500"
                            : "bg-[#e60012] hover:bg-[#c30010]"
                        }`}
                        onClick={() => {
                          // Si ya está reservado, quitar la reserva al volver a pulsar
                          if (reserved) {
                            // abrir modal de confirmación en lugar de ejecutar inmediatamente
                            setConfirmUnreserve({ id: t.id, price: t.price ?? null });
                            return;
                          }

                          // Si no está reservado, reservar
                          setReservedAmount(t.price ?? null);
                          setLoadingAction({ id: t.id, action: "reserve" });
                          reserveTrip.mutate({ id: t.id, userEmail });
                        }}
                      >
                        {loadingAction?.id === t.id &&
                        loadingAction.action === "reserve"
                          ? "Reservando..."
                          : loadingAction?.id === t.id &&
                            loadingAction.action === "unreserve"
                          ? "Cancelando..."
                          : reserved
                          ? "Reservado"
                          : "Reservar"}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal de confirmación para quitar reserva */}
      {confirmUnreserve && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center"
          onKeyDown={(e) => {
            if (e.key === "Escape") setConfirmUnreserve(null);
          }}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setConfirmUnreserve(null)}
          />

          <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-lg shadow-lg p-6 flex flex-col items-center text-center">
            <h3 className="text-lg font-semibold text-gray-800">¿Cancelar reserva?</h3>
            <p className="text-sm text-gray-600 mt-2">Se quitará la reserva de este viaje.</p>

            <div className="mt-4 text-lg font-medium text-gray-800">
              {confirmUnreserve.price !== null ? `Monto retenido: $${confirmUnreserve.price}` : "Monto: —"}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                className="px-4 py-2 bg-[#e60012] text-white rounded-md hover:bg-[#c30010]"
                onClick={() => {
                  // Ejecutar la mutación para quitar la reserva
                  setLoadingAction({ id: confirmUnreserve.id, action: "unreserve" });
                  unreserveTrip.mutate({ id: confirmUnreserve.id, userEmail });
                  setConfirmUnreserve(null);
                }}
              >
                Sí, cancelar
              </button>

              <button
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                onClick={() => setConfirmUnreserve(null)}
              >
                No, mantener
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de pago exitoso */}
      {showSuccessModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center"
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowSuccessModal(false);
          }}
        >
          {/* Fondo semi-transparente */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSuccessModal(false)}
          />

          {/* Tarjeta centrada */}
          <div className="relative z-10 w-full max-w-md mx-4 bg-white/95 rounded-lg shadow-lg p-6 flex flex-col items-center text-center">
            {/* Icono visto verde */}
            <div className="bg-green-100 rounded-full p-4 mb-4">
              <svg className="w-10 h-10 text-green-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17l-5-5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <h3 className="text-xl font-semibold text-gray-800">Pago exitoso</h3>
            <p className="text-sm text-gray-600 mt-2">Se ha realizado una retención a tu cuenta</p>

            <div className="mt-4 text-lg font-medium text-gray-800">
              {reservedAmount !== null ? `Monto: $${reservedAmount}` : "Monto: —"}
            </div>

            <button
              className="mt-6 px-4 py-2 bg-gray-200 rounded-md text-gray-800 hover:bg-gray-300"
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

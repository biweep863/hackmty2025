"use client";

import React from "react";
import { api } from "~/trpc/react";
import UserCard from "~/app/_components/UserCard";

export default function UserPage() {
  const { data: trips, isLoading, error } = api.trips.getTrips.useQuery();

  // Banorte brand red: #e60012
  const primary = "#e60012";
  const primaryDark = "#c30010";

  if (isLoading) return <div className="p-6">Cargando viajes...</div>;
  if (error) return <div className="p-6 text-red-600">Error cargando viajes: {error.message}</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
        <UserCard />
      <header className="rounded-md mb-6 overflow-hidden shadow-md" style={{ background: primary }}>
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white">Viajes disponibles</h1>
          <p className="text-sm text-white/90 mt-1">Encuentra rutas ofrecidas por conductores dentro de tu zona.</p>
        </div>
      </header>

      {(!trips || trips.length === 0) ? (
        <div className="p-8 text-center text-gray-600 rounded-md border border-gray-200">No hay viajes disponibles.</div>
      ) : (
        <div className="space-y-4">
          {trips.map((t: any) => (
            <article key={t.id} className="p-4 border rounded-md shadow-sm hover:shadow-lg transition-shadow bg-white">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-lg font-semibold text-gray-800">{t.origin} <span className="text-gray-400">→</span> {t.destination}</div>
                  <div className="text-sm text-gray-600 mt-1">Conductor: <span className="font-medium text-gray-800">{t.user?.name ?? t.userId ?? t.driverId ?? 'N/A'}</span></div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Distancia</div>
                  <div className="font-semibold text-gray-800">{t.distanceKm ? String(t.distanceKm) + ' km' : '—'}</div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="text-sm text-gray-700">
                  <div>Duración: <span className="font-medium">{t.durationMin ?? '—'} min</span></div>
                  <div>Precio: <span className="font-medium">{t.price ? '$' + String(t.price) : '—'}</span></div>
                </div>

                <div>
                  <button
                    className="px-4 py-2 rounded-md text-white font-medium shadow"
                    style={{ background: primary }}
                    onMouseDown={() => {}}
                    onMouseOver={(e) => (e.currentTarget.style.background = primaryDark)}
                    onMouseOut={(e) => (e.currentTarget.style.background = primary)}
                  >
                    Reservar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

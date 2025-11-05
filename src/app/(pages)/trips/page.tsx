"use client";

import React from "react";
import { api } from "~/trpc/react";
import TripsList from "~/app/_components/SavedTripsCard";
import Loading from "~/app/_components/Loading";

export default function TripsPage() {
  const { data: trips, isLoading, error } = api.trips.getTrips.useQuery();
  const getEmail = api.register.getEmail.useQuery();
  const userEmail = api.register.getUser.useQuery(getEmail.data ?? "");
  const reserveTrip = api.trips.saveTrip.useMutation();
  const {
    data: myTrips,
    isLoading: myTripsLoading,
    error: myTripsError,
  } = api.trips.getMyTrips.useQuery(userEmail.data?.email ?? "");
  const getDriver = api.trips.getDriver;

  // Banorte brand red: #e60012
  const primary = "#e60012";
  const primaryDark = "#c30010";

  if (isLoading)
    return (
      <div className="p-6">
        <Loading />
      </div>
    );
  if (error)
    return (
      <div className="p-6 text-red-600">
        Error cargando viajes: {error.message}
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header
        className="mb-6 overflow-hidden rounded-md shadow-md"
        style={{ background: primary }}
      >
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white">Viajes disponibles</h1>
          <p className="mt-1 text-sm text-white/90">
            Encuentra rutas ofrecidas por conductores dentro de tu zona.
          </p>
        </div>
      </header>
      <TripsList
        trips={trips ?? []}
        myTrips={myTrips ?? []}
        userEmail={userEmail.data?.email}
      />{" "}
    </div>
  );
}

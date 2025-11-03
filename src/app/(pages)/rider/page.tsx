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
  const [pinMode, setPinMode] = useState<
    "none" | "searchPin" | "setA" | "setB"
  >("none");
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(
    null,
  );
  const [clientA, setClientA] = useState<[number, number] | null>(null);
  const [clientB, setClientB] = useState<[number, number] | null>(null);
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
  const [useGemini, setUseGemini] = useState(false);
  const [nearestInput, setNearestInput] = useState<{
    lat: number;
    lng: number;
    useGemini?: boolean;
  } | null>(null);
  const nearestQuery = api.routes.nearestPointGemini.useQuery(
    (nearestInput ?? { lat: 0, lng: 0 }) as any,
    { enabled: !!nearestInput },
  );
  const [routePoints, setRoutePoints] = useState<[number, number][] | null>(
    null,
  );
  const [segments, setSegments] = useState<Array<
    [number, number][] | null
  > | null>(null);
  const [matchInput, setMatchInput] = useState<{
    clientFromLat: number;
    clientFromLng: number;
    clientToLat: number;
    clientToLng: number;
    useGemini?: boolean;
  } | null>(null);
  const matchQuery = (api as any).routes.matchCarpoolersForClient.useQuery(
    (matchInput ?? {
      clientFromLat: 0,
      clientFromLng: 0,
      clientToLat: 0,
      clientToLng: 0,
    }) as any,
    { enabled: !!matchInput },
  );
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);

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

  const handleNearest = async (lat?: number, lng?: number) => {
    const qlat = lat ?? selectedCoords?.[0] ?? 25.6866;
    const qlng = lng ?? selectedCoords?.[1] ?? -100.3161;
    try {
      setNearestInput({ lat: qlat, lng: qlng, useGemini: useGemini });
      // wait briefly for the query to run
      await new Promise((r) => setTimeout(r, 300));
      const data = nearestQuery.data;
      if (!data) {
        toast.error("No se recibió respuesta del servicio");
        return;
      }
      // show points on the map via generatedStops prop and highlight nearest
      toast.success(`Nearest index: ${data.nearestIndex}`);
      // build a route along streets using OSRM (fallback to straight line)
      const np = data.nearestPoint;
      if (np) {
        const startLat = qlat;
        const startLng = qlng;
        try {
          // OSRM expects lon,lat pairs
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${np.lng},${np.lat}?overview=full&geometries=geojson`;
          const r = await fetch(osrmUrl);
          if (r.ok) {
            const jr = await r.json();
            const coords: [number, number][] =
              jr.routes &&
              jr.routes[0] &&
              jr.routes[0].geometry &&
              jr.routes[0].geometry.coordinates
                ? jr.routes[0].geometry.coordinates.map((c: any) => [
                    c[1],
                    c[0],
                  ])
                : [
                    [startLat, startLng],
                    [np.lat, np.lng],
                  ];
            setRoutePoints(coords);
          } else {
            // fallback to straight line
            setRoutePoints([
              [startLat, startLng],
              [np.lat, np.lng],
            ]);
          }
        } catch (e) {
          console.error("OSRM route error:", e);
          setRoutePoints([
            [startLat, startLng],
            [np.lat, np.lng],
          ]);
        }
      }
      // center marker will be handled by Map using coords prop below
    } catch (err) {
      console.error(err);
      toast.error("Error buscando punto más cercano");
    }
  };

  const clearRoute = () => setRoutePoints(null);
  // clear segments as well
  const clearAllRoutes = () => {
    setRoutePoints(null);
    setSegments(null);
    setSelectedMatch(null);
  };

  async function fetchOSRMSegment(
    aLat: number,
    aLng: number,
    bLat: number,
    bLng: number,
  ) {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${aLng},${aLat};${bLng},${bLat}?overview=full&geometries=geojson`;
      const r = await fetch(url);
      if (!r.ok)
        return [
          [aLat, aLng],
          [bLat, bLng],
        ];
      const jr = await r.json();
      if (
        jr.routes &&
        jr.routes[0] &&
        jr.routes[0].geometry &&
        jr.routes[0].geometry.coordinates
      ) {
        const coords = jr.routes[0].geometry.coordinates.map(
          (c: any) => [c[1], c[0]] as [number, number],
        );
        // If OSRM returned only the endpoints (length <= 2), try one retry with alternatives to get a better geometry
        if (coords.length <= 2) {
          try {
            const retryUrl = `https://router.project-osrm.org/route/v1/driving/${aLng},${aLat};${bLng},${bLat}?overview=full&geometries=geojson&alternatives=true`;
            const rr = await fetch(retryUrl);
            if (rr.ok) {
              const jr2 = await rr.json();
              if (
                jr2.routes &&
                jr2.routes[0] &&
                jr2.routes[0].geometry &&
                jr2.routes[0].geometry.coordinates
              ) {
                const coords2 = jr2.routes[0].geometry.coordinates.map(
                  (c: any) => [c[1], c[0]] as [number, number],
                );
                if (coords2.length > 2) return coords2;
              }
            }
          } catch (e) {
            // ignore retry errors
          }
        }
        return coords;
      }
      return [
        [aLat, aLng],
        [bLat, bLng],
      ];
    } catch (e) {
      console.error("OSRM segment error", e);
      return [
        [aLat, aLng],
        [bLat, bLng],
      ];
    }
  }

  const drawMatchRoutes = async (m: any) => {
    console.log("drawMatchRoutes called for match:", m?.id ?? m, m);
    if (!clientA || !clientB)
      return toast.error("Define Origen (A) y Destino (B) primero");
    // segments: clientA -> carpooler.from, carpooler.from -> carpooler.to, carpooler.to -> clientB
    const seg1 = await fetchOSRMSegment(
      clientA[0],
      clientA[1],
      m.fromLat,
      m.fromLng,
    );
    const seg2 = await fetchOSRMSegment(m.fromLat, m.fromLng, m.toLat, m.toLng);
    const seg3 = await fetchOSRMSegment(
      m.toLat,
      m.toLng,
      clientB[0],
      clientB[1],
    );
    // concatenate avoiding duplicate endpoints
    const concat: [number, number][] = [];
    const pushCoords = (arr: [number, number][]) => {
      for (const c of arr) {
        const last = concat[concat.length - 1];
        if (!last || last[0] !== c[0] || last[1] !== c[1]) concat.push(c);
      }
    };
    pushCoords(seg1);
    pushCoords(seg2);
    pushCoords(seg3);
    setRoutePoints(concat);
    setSegments([seg1, seg2, seg3]);
    setSelectedMatch(m);
  };

  const drawChosenMatch = async () => {
    const chosen = matchQuery.data?.chosen;
    if (!chosen) return toast.error("No hay match elegido");
    console.log(
      "Drawing chosen match:",
      chosen.id,
      matchQuery.data?.chosenIndex,
    );
    await drawMatchRoutes(chosen);
  };

  const handleJoin = async (tripId: string, stopId?: string) => {
    try {
      toast.success("Solicitud de asiento enviada");
    } catch (err) {
      console.error(err);
      toast.error("Error al unirse");
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6 rounded-md bg-linear-to-r from-red-600 to-red-600 p-4 shadow-md">
        <h1 className="text-3xl font-bold text-white">Buscar viajes</h1>
        <p className="text-sm text-red-100">
          Busca viajes cercanos y únete a un pickup
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <div className="mb-4">
            <div className="flex flex-wrap gap-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar dirección"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 p-3 text-sm shadow-sm focus:border-red-500 focus:ring focus:ring-red-200"
              />
              <div className="flex gap-3">
                <button
                  className="transform rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:scale-105 hover:bg-red-600"
                  onClick={() => void handleSearchNearby()}
                >
                  Buscar cerca
                </button>
                <button
                  className="transform rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:scale-105 hover:bg-red-600"
                  onClick={() => void handleNearest()}
                >
                  Buscar punto más cercano
                </button>
                <button
                  className="transform rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 shadow-md transition hover:scale-105 hover:bg-gray-300"
                  onClick={() => clearAllRoutes()}
                >
                  Limpiar ruta
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {/* <label className="flex items-center gap-2 px-2 text-sm">
                <input
                  type="checkbox"
                  checked={useGemini}
                  onChange={(e) => setUseGemini(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-red-500 focus:ring-red-200"
                />
                <span>Usar Gemini</span>
              </label> */}
              <div className="flex gap-3">
                <button
                  className={`rounded-lg px-4 py-2 text-sm font-medium shadow-md transition hover:scale-105 ${pinMode === "searchPin" ? "bg-red-500 text-white" : "border border-red-500 bg-white text-red-500"}`}
                  onClick={() =>
                    setPinMode(pinMode === "searchPin" ? "none" : "searchPin")
                  }
                >
                  Pin
                </button>
                <button
                  className={`rounded-lg px-4 py-2 text-sm font-medium shadow-md transition hover:scale-105 ${pinMode === "setA" ? "bg-red-500 text-white" : "border border-red-500 bg-white text-red-500"}`}
                  onClick={() =>
                    setPinMode(pinMode === "setA" ? "none" : "setA")
                  }
                >
                  Poner Origen A
                </button>
                <button
                  className={`rounded-lg px-4 py-2 text-sm font-medium shadow-md transition hover:scale-105 ${pinMode === "setB" ? "bg-red-500 text-white" : "border border-red-500 bg-white text-red-500"}`}
                  onClick={() =>
                    setPinMode(pinMode === "setB" ? "none" : "setB")
                  }
                >
                  Poner Destino B
                </button>
                <button
                  className="transform rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:scale-105 hover:bg-red-600"
                  onClick={() => {
                    if (!clientA || !clientB) {
                      toast.error("Define Origen (A) y Destino (B) primero");
                      return;
                    }
                    setMatchInput({
                      clientFromLat: clientA[0],
                      clientFromLng: clientA[1],
                      clientToLat: clientB[0],
                      clientToLng: clientB[1],
                      useGemini: useGemini,
                    });
                  }}
                >
                  Buscar coincidencias
                </button>
              </div>
            </div>
          </div>
          <div className="h-[70vh] mx-auto lg:ml-16 rounded-lg border border-gray-300 shadow-lg">
            <Map
              onMapClick={(lat, lng) => {
                if (pinMode === "searchPin") {
                  setSelectedCoords([lat, lng]);
                  setPinMode("none");
                  void handleSearchNearby(lat, lng);
                } else if (pinMode === "setA") {
                  setClientA([lat, lng]);
                  setPinMode("none");
                  toast.success("Origen (A) establecido");
                } else if (pinMode === "setB") {
                  setClientB([lat, lng]);
                  setPinMode("none");
                  toast.success("Destino (B) establecido");
                }
              }}
              generatedStops={
                nearestQuery.data?.points
                  ? nearestQuery.data.points.map((p: any) => ({
                      id: p.id,
                      label: p.label ?? undefined,
                      lat: p.lat,
                      lng: p.lng,
                    }))
                  : null
              }
              highlightPickupId={nearestQuery.data?.nearestPoint?.id ?? null}
              extraRoute={routePoints}
              clientA={clientA}
              clientB={clientB}
              matchPointFrom={
                selectedMatch
                  ? { lat: selectedMatch.fromLat, lng: selectedMatch.fromLng }
                  : matchQuery.data?.chosen
                    ? {
                        lat: matchQuery.data.chosen.fromLat,
                        lng: matchQuery.data.chosen.fromLng,
                      }
                    : null
              }
              matchPointTo={
                selectedMatch
                  ? { lat: selectedMatch.toLat, lng: selectedMatch.toLng }
                  : matchQuery.data?.chosen
                    ? {
                        lat: matchQuery.data.chosen.toLat,
                        lng: matchQuery.data.chosen.toLng,
                      }
                    : null
              }
              segments={segments}
              coords={
                nearestQuery.data?.nearestPoint
                  ? {
                      start: [
                        nearestInput?.lat ?? selectedCoords?.[0] ?? 25.6866,
                        nearestInput?.lng ?? selectedCoords?.[1] ?? -100.3161,
                      ],
                      end: [
                        nearestQuery.data.nearestPoint.lat,
                        nearestQuery.data.nearestPoint.lng,
                      ],
                    }
                  : undefined
              }
            />

            {/* Nearest-by-Gemini / local result preview */}
            {nearestQuery.data && (
              <div className="mt-4 rounded border bg-gray-50 p-3">
                <h3 className="font-medium">Nearest point</h3>
                <div className="text-sm text-gray-700">
                  Índice: {nearestQuery.data.nearestIndex}
                </div>
                <div className="text-sm text-gray-700">
                  ID: {nearestQuery.data.nearestPoint?.id ?? "-"}
                </div>
                <div className="text-sm text-gray-700">
                  Posición:{" "}
                  {nearestQuery.data.nearestPoint
                    ? `${nearestQuery.data.nearestPoint.lat.toFixed(6)}, ${nearestQuery.data.nearestPoint.lng.toFixed(6)}`
                    : "-"}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    className="transform rounded border border-red-600 bg-white px-3 py-1 text-sm text-red-600 transition hover:scale-105 hover:bg-red-600 hover:text-white"
                    onClick={() => {
                      const id = nearestQuery.data?.nearestPoint?.id;
                      if (id)
                        navigator.clipboard
                          ?.writeText(id)
                          .then(() => toast.success("ID copiada"));
                    }}
                  >
                    Copiar ID
                  </button>
                  <button
                    className="transform rounded border border-red-600 bg-white px-3 py-1 text-sm text-red-600 transition hover:scale-105 hover:bg-red-600 hover:text-white"
                    onClick={() => {
                      // zoom/search map around this point by triggering a nearby search
                      const np = nearestQuery.data?.nearestPoint;
                      if (np) {
                        void handleSearchNearby(np.lat, np.lng);
                      }
                    }}
                  >
                    Buscar rutas en este punto
                  </button>
                </div>
              </div>
            )}

            {/* Matches list */}
            {matchQuery.data &&
              matchQuery.data.matches &&
              matchQuery.data.matches.length > 0 && (
                <div className="mt-4 rounded border bg-white p-3">
                  <h3 className="font-medium">Coincidencias</h3>
                  <div className="mb-2 text-xs text-gray-500">
                    {matchQuery.data.usedGemini
                      ? `Gemini used — chosen index: ${matchQuery.data.chosenIndex + 1}`
                      : null}
                  </div>
                  <ul className="mt-2 space-y-2">
                    {matchQuery.data.matches.map((m: any, idx: number) => (
                      <li
                        key={m.id}
                        className={`rounded border p-2 ${matchQuery.data.chosenIndex === idx ? "ring-2 ring-red-300" : ""}`}
                      >
                        <div className="text-sm font-medium">
                          {m.fromLabel ?? "(desde)"} → {m.toLabel ?? "(hacia)"}
                        </div>
                        <div className="text-xs text-gray-500">
                          Distancias: A→origen: {m.distanceToFromMeters} m ·
                          B←destino: {m.distanceToToMeters} m · Total:{" "}
                          {m.totalMeters} m
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button
                            className="transform rounded border border-red-600 bg-white px-3 py-1 text-sm text-red-600 transition hover:scale-105 hover:bg-red-600 hover:text-white"
                            onClick={() => void drawMatchRoutes(m)}
                          >
                            Ver ruta
                          </button>
                          <button
                            className="transform rounded border border-red-600 bg-white px-3 py-1 text-sm text-red-600 transition hover:scale-105 hover:bg-red-600 hover:text-white"
                            onClick={() =>
                              navigator.clipboard
                                ?.writeText(m.id)
                                .then(() => toast.success("ID copiada"))
                            }
                          >
                            Copiar ID
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="transform rounded bg-red-600 px-3 py-1 text-sm text-white shadow transition hover:scale-105 hover:bg-red-700"
                      onClick={() => void drawChosenMatch()}
                    >
                      Dibujar elegido
                    </button>
                    <button
                      className="transform rounded border border-red-600 bg-white px-3 py-1 text-sm text-red-600 transition hover:scale-105 hover:bg-red-600 hover:text-white"
                      onClick={() => {
                        if (!clientA || !clientB) {
                          toast.error(
                            "Define Origen (A) y Destino (B) primero",
                          );
                          return;
                        }
                        // re-run match forcing local scoring
                        setMatchInput({
                          clientFromLat: clientA[0],
                          clientFromLng: clientA[1],
                          clientToLat: clientB[0],
                          clientToLng: clientB[1],
                          useGemini: false,
                        });
                      }}
                    >
                      Forzar local (sin Gemini)
                    </button>
                  </div>
                  {matchQuery.data?.geminiRaw && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium">
                        Gemini raw (debug)
                      </h4>
                      <pre className="max-h-48 overflow-auto rounded bg-gray-100 p-2 text-xs">
                        {JSON.stringify(matchQuery.data?.geminiRaw, null, 2)}
                      </pre>
                    </div>
                  )}
                  {matchQuery.data?.localBest && (
                    <div className="mt-3 rounded border bg-gray-50 p-2">
                      <h4 className="text-sm font-medium">
                        Local best (determinista)
                      </h4>
                      <div className="text-xs text-gray-700">
                        Idx: {matchQuery.data.localBestIndex}
                      </div>
                      <div className="text-xs text-gray-700">
                        {matchQuery.data.localBest.fromLabel} →{" "}
                        {matchQuery.data.localBest.toLabel}
                      </div>
                      <div className="text-xs text-gray-700">
                        A→from: {matchQuery.data.localBest.distanceToFromMeters}{" "}
                        m · to→B: {matchQuery.data.localBest.distanceToToMeters}{" "}
                        m · Total: {matchQuery.data.localBest.totalMeters} m
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          className="transform rounded bg-red-600 px-3 py-1 text-sm text-white shadow transition hover:scale-105 hover:bg-red-700"
                          onClick={() =>
                            void drawMatchRoutes(matchQuery.data.localBest)
                          }
                        >
                          Usar localBest
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

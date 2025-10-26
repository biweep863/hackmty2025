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
  const joinTrip = api.routes.joinTrip.useMutation();
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
      await joinTrip.mutateAsync({ tripId, stopId });
      toast.success("Solicitud de asiento enviada");
    } catch (err) {
      console.error(err);
      toast.error("Error al unirse");
    }
  };

  return (
    <div className="min-h-[60vh] bg-white text-gray-900 animate-fade-up font-sans">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-6">
          <div className="bg-red-600 p-6 rounded-lg shadow-lg transition-transform duration-300 hover:scale-105">
            <h1 className="text-4xl font-bold text-white transition-all duration-300 hover:text-gray-200">
              Buscar viajes
            </h1>
            <p className="text-sm text-gray-200 mt-2 transition-all duration-300 hover:text-gray-100">
              Busca viajes cercanos y únete a un pickup
            </p>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: Search options */}
          <div className="lg:col-span-1 space-y-8">
            <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-md transition-transform duration-300 hover:scale-105 hover:shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span className="text-red-600"></span> Opciones de búsqueda
              </h3>
              <div className="mt-4 flex flex-wrap gap-4">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar dirección"
                  className="flex-1 rounded-lg border border-gray-300 p-3 text-sm shadow-sm focus:ring focus:ring-red-200"
                />
                <div className="flex gap-2">
                  <button
                    className="transform rounded-lg border border-red-600 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-all duration-300 ease-in-out hover:scale-105 hover:bg-red-600 hover:text-white flex items-center justify-center"
                    onClick={() => void handleSearchNearby()}
                  >
                    Buscar cerca
                  </button>
                  <button
                    className="transform rounded-lg border border-red-600 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-all duration-300 ease-in-out hover:scale-105 hover:bg-red-600 hover:text-white flex items-center justify-center"
                    onClick={() => void handleNearest()}
                  >
                    Buscar punto más cercano
                  </button>
                  <button
                    className="transform rounded-lg border border-red-600 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-all duration-300 ease-in-out hover:scale-105 hover:bg-red-600 hover:text-white flex items-center justify-center"
                    onClick={() => clearAllRoutes()}
                  >
                    Limpiar ruta
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-md transition-transform duration-300 hover:scale-105 hover:shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span className="text-red-600"></span> Opciones avanzadas
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <label className="flex items-center gap-2 px-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useGemini}
                    onChange={(e) => setUseGemini(e.target.checked)}
                  />
                  <span>Usar Gemini</span>
                </label>
                <div className="flex gap-2">
                  <button
                    className={`rounded-lg px-4 py-2 text-sm transition-all duration-300 ease-in-out ${pinMode === "searchPin" ? "bg-red-600 text-white" : "border border-red-600 bg-white text-red-600"} transform shadow-sm hover:scale-105`}
                    onClick={() =>
                      setPinMode(pinMode === "searchPin" ? "none" : "searchPin")
                    }
                  >
                    Pin
                  </button>
                  <button
                    className={`rounded-lg px-4 py-2 text-sm transition-all duration-300 ease-in-out ${pinMode === "setA" ? "bg-red-600 text-white" : "border border-red-600 bg-white text-red-600"} transform shadow-sm hover:scale-105`}
                    onClick={() =>
                      setPinMode(pinMode === "setA" ? "none" : "setA")
                    }
                  >
                    Poner Origen A
                  </button>
                  <button
                    className={`rounded-lg px-4 py-2 text-sm transition-all duration-300 ease-in-out ${pinMode === "setB" ? "bg-red-600 text-white" : "border border-red-600 bg-white text-red-600"} transform shadow-sm hover:scale-105`}
                    onClick={() =>
                      setPinMode(pinMode === "setB" ? "none" : "setB")
                    }
                  >
                    Poner Destino B
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Map and results */}
          <div className="lg:col-span-2 space-y-8">
            <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-md transition-transform duration-300 hover:scale-105 hover:shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span className="text-red-600"></span> Mapa
              </h3>
              <div className="mt-4 h-[70vh] rounded-xl overflow-hidden border border-gray-200">
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
              </div>
            </div>

            <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-md transition-transform duration-300 hover:scale-105 hover:shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span className="text-red-600"></span> Resultados
              </h3>
              {results && results.length > 0 && (
                <ul className="mt-4 space-y-4">
                  {results.map((r: any) => (
                    <li key={r.stopId} className="rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                      <div className="text-sm font-medium text-gray-800">
                        {r.trip.routeTemplate?.fromLabel} → {r.trip.routeTemplate?.toLabel}
                      </div>
                      <div className="text-xs text-gray-600">
                        {r.distanceMeters} m · Asientos: {r.trip.seatsTaken}/{r.trip.seatsTotal}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          className="transform rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow transition-all duration-300 ease-in-out hover:scale-105 hover:bg-red-700"
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
          </div>
        </section>
      </div>
    </div>
  );
}

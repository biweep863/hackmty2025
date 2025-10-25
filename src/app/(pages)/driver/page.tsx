"use client";

import { TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "~/trpc/react";
import { toast } from "react-hot-toast";
import Map from "~/app/_components/map";

type NominatimResult = {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: [string, string, string, string];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
};

type OSRMRoute = {
  distance: number;
  geometry: {
    coordinates: [number, number][];
  };
};

type OSRMResponse = {
  routes?: OSRMRoute[];
};

function SuggestionPortal<T extends { display_name: string }>(props: {
  anchorRef: React.RefObject<HTMLElement | null>;
  items: T[];
  onSelect: (item: T) => void;
  visible: boolean;
}) {
  const { anchorRef, items, onSelect, visible } = props;
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!visible) return setPos(null);
    const el = anchorRef.current;
    if (!el) return setPos(null);
    const rect = el.getBoundingClientRect();
    setPos({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
    });

    const handleResize = () => {
      const r = el.getBoundingClientRect();
      setPos({
        top: r.bottom + window.scrollY,
        left: r.left + window.scrollX,
        width: r.width,
      });
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [anchorRef, visible, items]);

  if (!visible || !pos) return null;

  const list = (
    <ul
      className="max-h-48 overflow-y-auto border bg-white shadow-lg"
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: 99999,
      }}
    >
      {items.map((it, i) => (
        <li
          key={i}
          className="cursor-pointer p-2 hover:bg-gray-100"
          onMouseDown={(e) => {
            // prevent input blur before click
            e.preventDefault();
            onSelect(it);
          }}
        >
          {it.display_name}
        </li>
      ))}
    </ul>
  );

  return createPortal(list, document.body);
}

export default function DriverPage() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originResults, setOriginResults] = useState<NominatimResult[]>([]);
  const [destinationResults, setDestinationResults] = useState<
    NominatimResult[]
  >([]);

  const [coords, setCoords] = useState<{
    start: [number, number];
    end: [number, number];
  } | null>(null);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);

  const ride = api.carpooler.pushRide.useMutation();
  const saveStops = api.routes.saveGeneratedStops.useMutation();
  const createTemplate = api.routes.create.useMutation();
  const createTrip = api.routes.createTrip.useMutation();
  const listMyTrips = api.routes.listMyTrips.useQuery(undefined, {
    enabled: true,
  });

  // Banorte brand colors
  const primary = "#e60012";
  const primaryDark = "#c30010";

  const originRef = useRef<HTMLInputElement | null>(null);
  const destRef = useRef<HTMLInputElement | null>(null);

  const [pinMode, setPinMode] = useState<"none" | "origin" | "destination">(
    "none",
  );

  // Viewbox para Nuevo León / Monterrey (LonMin, LatMin, LonMax, LatMax)
  const viewbox = "-100.5,25.5,-99.9,26.5";

  const searchPlace = async (query: string): Promise<NominatimResult[]> => {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&viewbox=${viewbox}&bounded=1`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as NominatimResult[];
    return data;
  };

  const handleOriginSearch = async () => {
    if (!origin) return setOriginResults([]);
    const results = await searchPlace(origin);
    setOriginResults(results);
  };

  const handleDestinationSearch = async () => {
    if (!destination) return setDestinationResults([]);
    const results = await searchPlace(destination);
    setDestinationResults(results);
  };

  const selectOrigin = (lat: string, lon: string, label: string) => {
    const position: [number, number] = [parseFloat(lat), parseFloat(lon)];
    if (coords) setCoords({ ...coords, start: position });
    else setCoords({ start: position, end: position });
    setOriginResults([]);
    setOrigin(label);
  };

  const selectDestination = (lat: string, lon: string, label: string) => {
    const position: [number, number] = [parseFloat(lat), parseFloat(lon)];
    if (coords) setCoords({ ...coords, end: position });
    else setCoords({ start: position, end: position });
    setDestinationResults([]);
    setDestination(label);
  };

  const tileLayerProps: React.ComponentProps<typeof TileLayer> = {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  };

  const sendRide = async () => {
    if (!coords) return;
    const toastId = toast.loading("Enviando ruta...");
    try {
      await ride.mutateAsync({
        origin,
        destination,
        latStart: coords.start[0],
        lngStart: coords.start[1],
        latEnd: coords.end[0],
        lngEnd: coords.end[1],
        distanceKm: distance ?? 0,
        durationMin: duration ?? 0,
        price: price ?? 0,
      });
      toast.success("Ruta enviada con éxito!", { id: toastId });
    } catch (error) {
      console.error("Error sending ride:", error);
      toast.error("Error al enviar la ruta.", { id: toastId });
    }
  };

  // Pickup points query (disabled until user triggers)

  const [bufferMeters, setBufferMeters] = useState<number>(1500);

  // no extra location: route is A -> B
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [departureAtInput, setDepartureAtInput] = useState<string>("");
  const [seatsTotalInput, setSeatsTotalInput] = useState<number>(3);

  const pickupInput = coords
    ? {
        fromLat: coords.start[0],
        fromLng: coords.start[1],
        toLat: coords.end[0],
        toLng: coords.end[1],
        bufferMeters: bufferMeters,
      }
    : { fromLat: 0, fromLng: 0, toLat: 0, toLng: 0, bufferMeters: 600 };

  const pickupQuery = api.routes.pickupPointsAlongRoute.useQuery(pickupInput, {
    enabled: false,
  });

  const handleFindPickupPoints = async () => {
    if (!coords) return toast.error("Selecciona origen y destino primero");
    try {
      await pickupQuery.refetch();
      const count = (pickupQuery.data ?? []).length;
      if (count === 0) {
        toast("No se encontraron puntos cercanos. Prueba aumentar el radio.");
      } else {
        toast.success(`Se encontraron ${count} puntos cercanos`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al buscar puntos de recogida");
    }
  };

  const handleCreateTemplate = async () => {
    if (!coords)
      return toast.error(
        "Selecciona origen y destino antes de guardar plantilla",
      );
    try {
      const res = await createTemplate.mutateAsync({
        fromLabel: origin || "Origen",
        fromLat: coords.start[0],
        fromLng: coords.start[1],
        toLabel: destination || "Destino",
        toLat: coords.end[0],
        toLng: coords.end[1],
      });
      setTemplateId(res.id);
      toast.success("Plantilla guardada");
    } catch (err) {
      console.error(err);
      toast.error("Error guardando plantilla");
    }
  };

  const handleCreateTrip = async () => {
    if (!templateId)
      return toast.error("Crea o selecciona una plantilla primero");
    if (!departureAtInput)
      return toast.error("Selecciona fecha y hora de salida");
    try {
      const res = await createTrip.mutateAsync({
        routeTemplateId: templateId,
        departureAt: new Date(departureAtInput).toISOString(),
        seatsTotal: seatsTotalInput,
        stops: (generatedStops ?? []).map((s, i) => ({
          label: s.label,
          lat: s.lat,
          lng: s.lng,
          ord: i,
        })),
      });
      toast.success("Trip creado");
      // refresh trips
      void listMyTrips.refetch();
    } catch (err) {
      console.error(err);
      toast.error("Error creando Trip");
    }
  };
  const handleMapClick = (lat: number, lng: number) => {
    if (pinMode === "none") return;
    const pos: [number, number] = [lat, lng];
    if (pinMode === "origin") {
      if (coords) setCoords({ ...coords, start: pos });
      else setCoords({ start: pos, end: pos });
      setOrigin(`Pinned ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setOriginResults([]);
    }
    if (pinMode === "destination") {
      if (coords) setCoords({ ...coords, end: pos });
      else setCoords({ start: pos, end: pos });
      setDestination(`Pinned ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setDestinationResults([]);
    }
    // after placing one pin, turn off pin mode
    setPinMode("none");
  };

  // distance from point to segment (meters)
  function pointToSegmentDistanceMeters(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ) {
    // compute projection of P onto AB in lat/lng space, then compute haversine
    const toRad = (v: number) => (v * Math.PI) / 180;
    const latFactor = (lat: number) => Math.cos(toRad(lat));

    // Convert to simple euclidean using degrees scaled by latitude
    const mx = (v: number) => v;
    const my = (v: number) => v * latFactor((ay + by) / 2);

    const pax = mx(px),
      pay = my(py);
    const aax = mx(ax),
      aay = my(ay);
    const bbx = mx(bx),
      bby = my(by);

    const vx = bbx - aax;
    const vy = bby - aay;
    const wx = pax - aax;
    const wy = pay - aay;
    const c1 = vx * wx + vy * wy;
    const c2 = vx * vx + vy * vy;
    let t = c2 === 0 ? 0 : c1 / c2;
    t = Math.max(0, Math.min(1, t));
    const projx = aax + vx * t;
    const projy = aay + vy * t;

    // distance in degrees -> convert to meters using haversine
    // convert proj back to lat/lng: projx (lon) and projy scaled lon; we need approximation: find proj lat by linear interpolation
    // We'll compute distance between P and point linearly approximated on original segment using t
    const projLat = ay + (by - ay) * t;
    const projLng = ax + (bx - ax) * t;

    return haversineMeters(py, px, projLat, projLng);
  }

  // Find nearest pickup (from pickupQuery data and generatedStops) to extraCoords.
  // no extra-route helper; simplified A->B flow

  // Client-side generated stops from the displayed route (no DB required).
  const [generatedStops, setGeneratedStops] = useState<
    | {
        id: string;
        label?: string;
        lat: number;
        lng: number;
      }[]
    | null
  >(null);

  // Haversine distance in meters
  function haversineMeters(
    aLat: number,
    aLng: number,
    bLat: number,
    bLng: number,
  ) {
    const R = 6371000; // meters
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLng - aLng);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const a =
      sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function interpolate(
    aLat: number,
    aLng: number,
    bLat: number,
    bLng: number,
    t: number,
  ) {
    // simple linear interpolation in degrees (good enough for short segments)
    return [aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t] as [
      number,
      number,
    ];
  }

  function sampleRoute(routeCoords: [number, number][], spacingMeters: number) {
    if (!routeCoords || routeCoords.length < 2) return [];
    const stops: { id: string; lat: number; lng: number }[] = [];
    let remaining = spacingMeters; // distance to next sample from current cursor
    let accIndex = 0;
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const a = routeCoords[i]!;
      const b = routeCoords[i + 1]!;
      const [aLat, aLng] = a;
      const [bLat, bLng] = b;
      let segLen = haversineMeters(aLat, aLng, bLat, bLng);
      // move along the segment
      let segPos = 0;
      while (segLen - segPos >= remaining) {
        // fraction along segment where the point lies
        const t = (segPos + remaining) / segLen;
        const [plat, plng] = interpolate(aLat, aLng, bLat, bLng, t);
        stops.push({ id: `gen-${accIndex++}`, lat: plat, lng: plng });
        // after placing, the cursor moves to that point; adjust segPos
        segPos = segPos + remaining;
        remaining = spacingMeters; // reset for the next
      }
      // carry over the remaining distance needed to reach the next sample
      remaining = Math.max(0, remaining - (segLen - segPos));
    }
    return stops;
  }

  const handleGenerateStops = () => {
    if (!route || route.length < 2)
      return toast.error("Primero genera la ruta");
    const spacing = bufferMeters || 1000;
    const stops = sampleRoute(route, spacing);
    if (stops.length === 0) {
      toast("No se generaron paradas en la ruta");
      return;
    }
    (async () => {
      try {
        const created = await saveStops.mutateAsync(
          stops.map((s) => ({ label: "Sugerido", lat: s.lat, lng: s.lng })),
        );
        setGeneratedStops(
          created.map((c: any) => ({
            id: c.id,
            lat: parseFloat(String(c.lat)),
            lng: parseFloat(String(c.lng)),
            label: c.label ?? "Sugerido",
          })),
        );
        toast.success(`Generadas y guardadas ${created.length} paradas`);
      } catch (err) {
        console.error(err);
        setGeneratedStops(stops.map((s) => ({ ...s, label: "Sugerido" })));
        toast.success(`Generadas ${stops.length} paradas (localmente)`);
      }
    })();
  };

  const handleClearStops = () => setGeneratedStops(null);

  const mtyPos = [25.6866, -100.3161];

  useEffect(() => {
    if (!coords?.start || !coords?.end) return;
    const fetchRoute = async () => {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords.start[1]},${coords.start[0]};${coords.end[1]},${coords.end[0]}?overview=full&geometries=geojson`,
      );
      if (!res.ok) {
        setRoute(null);
        setDistance(null);
        return;
      }
      const data = (await res.json()) as OSRMResponse;
      const routeData = data.routes?.[0];
      if (!routeData) {
        setRoute(null);
        setDistance(null);
        return;
      }
      setRoute(routeData.geometry.coordinates.map(([lon, lat]) => [lat, lon]));
      setDistance(routeData.distance / 1000);
      setDuration((routeData.distance / 1000) * 1.5);
      setPrice((routeData.distance / 1000) * 5);
    };
    void fetchRoute();
  }, [coords]);

  // Initialize Leaflet defaults on the client only (avoids SSR `window` errors)
  useEffect(() => {
    void import("leaflet").then((leafletModule) => {
      const Leaflet = (leafletModule as any).default ?? leafletModule;
      Leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      });
    });
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header
        className="mb-6 overflow-hidden rounded-md shadow-md"
        style={{ background: primary }}
      >
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white">Crear ruta</h1>
          <p className="mt-1 text-sm text-white/90">
            Marca inicio y destino en el mapa y comparte tu ruta.
          </p>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <div className="relative flex w-full max-w-full gap-2">
            <div className="relative z-50 flex-1">
              <input
                ref={originRef}
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                onKeyUp={handleOriginSearch}
                placeholder="Origen"
                className="w-full rounded border border-gray-300 p-2 shadow-sm focus:ring-2 focus:ring-red-200"
              />
              <SuggestionPortal
                anchorRef={originRef}
                items={originResults}
                visible={originResults.length > 0}
                onSelect={(it) => selectOrigin(it.lat, it.lon, it.display_name)}
              />
            </div>

            <div className="relative z-20 flex-1">
              <input
                ref={destRef}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onKeyUp={handleDestinationSearch}
                placeholder="Destino"
                className="w-full rounded border border-gray-300 p-2 shadow-sm focus:ring-2 focus:ring-red-200"
              />
              <SuggestionPortal
                anchorRef={destRef}
                items={destinationResults}
                visible={destinationResults.length > 0}
                onSelect={(it) =>
                  selectDestination(it.lat, it.lon, it.display_name)
                }
              />
            </div>

            <div className="mt-2 flex gap-2">
              <button
                className={`rounded px-3 py-1 text-sm ${pinMode === "origin" ? "bg-red-600 text-white" : "border bg-white"}`}
                onClick={() =>
                  setPinMode(pinMode === "origin" ? "none" : "origin")
                }
              >
                Pin Origen
              </button>
              <button
                className={`rounded px-3 py-1 text-sm ${pinMode === "destination" ? "bg-red-600 text-white" : "border bg-white"}`}
                onClick={() =>
                  setPinMode(pinMode === "destination" ? "none" : "destination")
                }
              >
                Pin Destino
              </button>
              <div className="ml-2 self-center text-sm text-gray-600">
                Modo pin: {pinMode}
              </div>
            </div>
          </div>

          <div className="z-0 mt-4 h-[60vh] w-full overflow-hidden rounded-md md:h-[72vh]">
            <Map
              coords={coords ?? undefined}
              route={route ?? undefined}
              distance={distance ?? undefined}
              pickupPoints={
                pickupQuery.data
                  ? (pickupQuery.data.filter(Boolean) as any)
                  : undefined
              }
              generatedStops={generatedStops ?? undefined}
              onMapClick={handleMapClick}
            />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded border bg-white p-4 shadow-sm">
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">Distancia</div>
                <div className="text-lg font-semibold">
                  {distance ? distance.toFixed(2) + " km" : "—"}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Duración</div>
                <div className="text-lg font-semibold">
                  {duration ? duration.toFixed(2) + " min" : "—"}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Precio</div>
                <div className="text-lg font-semibold">
                  {price ? "$" + price.toFixed(2) : "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-2">
              <button
                className="w-full rounded-md bg-red-600 px-4 py-2 font-medium text-white shadow hover:bg-red-700"
                onClick={sendRide}
              >
                Enviar ruta
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  className="rounded-md border border-gray-300 bg-white px-3 py-2"
                  onClick={() => {
                    setOrigin("");
                    setDestination("");
                    setCoords(null);
                    setRoute(null);
                    setDistance(null);
                    setDuration(null);
                    setPrice(null);
                  }}
                >
                  Limpiar
                </button>
                <button
                  className="rounded-md border border-gray-300 bg-white px-3 py-2"
                  onClick={handleFindPickupPoints}
                >
                  Buscar puntos
                </button>
                <button
                  className="rounded-md border border-gray-300 bg-white px-3 py-2"
                  onClick={handleGenerateStops}
                >
                  Generar paradas
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  className="rounded-md border border-gray-300 bg-white px-3 py-2"
                  onClick={() => void handleCreateTemplate()}
                >
                  Guardar plantilla
                </button>
                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={departureAtInput}
                    onChange={(e) => setDepartureAtInput(e.target.value)}
                    className="flex-1 rounded border p-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={seatsTotalInput}
                    onChange={(e) => setSeatsTotalInput(Number(e.target.value))}
                    className="w-20 rounded border p-1"
                    min={1}
                  />
                  <button
                    className="rounded-md border border-gray-300 bg-white px-3 py-2"
                    onClick={() => void handleCreateTrip()}
                  >
                    Crear Trip
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  className="rounded-md border border-gray-300 bg-white px-3 py-2"
                  onClick={() => {
                    handleClearStops();
                  }}
                >
                  Limpiar paradas
                </button>
              </div>
            </div>
          </div>

          <div className="rounded border bg-white p-4 shadow-sm">
            <label className="text-sm text-gray-600">Radio (m)</label>
            <select
              value={bufferMeters}
              onChange={(e) => setBufferMeters(Number(e.target.value))}
              className="mt-2 w-full rounded border-gray-200 p-2"
            >
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={1500}>1500</option>
              <option value={2000}>2000</option>
            </select>
          </div>

          {/* List pickup points if available */}
          {pickupQuery.data && pickupQuery.data.length > 0 && (
            <div className="mt-4 rounded border bg-white p-3 shadow-sm">
              <div className="text-sm text-gray-500">Puntos encontrados</div>
              <ul className="mt-2 max-h-40 overflow-y-auto text-sm">
                {(pickupQuery.data ?? []).filter(Boolean).map((p: any) => (
                  <li key={p.id} className="py-1">
                    <strong>{p.label}</strong>
                    <div className="text-xs text-gray-500">
                      {p.site?.name ?? "-"} · {p.distanceMeters} m
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

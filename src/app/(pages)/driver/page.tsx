"use client";

import { TileLayer} from "react-leaflet";
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
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!visible) return setPos(null);
    const el = anchorRef.current;
    if (!el) return setPos(null);
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });

    const handleResize = () => {
      const r = el.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY, left: r.left + window.scrollX, width: r.width });
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
      className="bg-white border max-h-48 overflow-y-auto shadow-lg"
      style={{ position: "absolute", top: pos.top, left: pos.left, width: pos.width, zIndex: 99999 }}
    >
      {items.map((it, i) => (
        <li
          key={i}
          className="p-2 hover:bg-gray-100 cursor-pointer"
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
  const [destinationResults, setDestinationResults] = useState<NominatimResult[]>([]);
  const [coords, setCoords] = useState<{ start: [number, number]; end: [number, number] } | null>(
    null
  );
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);

  const ride = api.carpooler.pushRide.useMutation();

  // Banorte brand colors
  const primary = "#e60012";
  const primaryDark = "#c30010";

  const originRef = useRef<HTMLInputElement | null>(null);
  const destRef = useRef<HTMLInputElement | null>(null);

  // Viewbox para Nuevo León / Monterrey (LonMin, LatMin, LonMax, LatMax)
  const viewbox = "-100.5,25.5,-99.9,26.5";

  const searchPlace = async (query: string): Promise<NominatimResult[]> => {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&viewbox=${viewbox}&bounded=1`
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

  const mtyPos = [25.6866, -100.3161];

  useEffect(() => {
    if (!coords?.start || !coords?.end) return;
    const fetchRoute = async () => {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords.start[1]},${coords.start[0]};${coords.end[1]},${coords.end[0]}?overview=full&geometries=geojson`
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
      setPrice(routeData.distance / 1000 * 5);
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
        shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      });
    });
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="rounded-md mb-6 overflow-hidden shadow-md" style={{ background: primary }}>
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white">Crear ruta</h1>
          <p className="text-sm text-white/90 mt-1">Marca inicio y destino en el mapa y comparte tu ruta.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="md:col-span-2">
          <div className="flex gap-2 w-full max-w-full relative">
            <div className="flex-1 relative z-50">
              <input
                ref={originRef}
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                onKeyUp={handleOriginSearch}
                placeholder="Origen"
                className="w-full border border-gray-300 rounded p-2 shadow-sm focus:ring-2 focus:ring-red-200"
              />
              <SuggestionPortal
                anchorRef={originRef}
                items={originResults}
                visible={originResults.length > 0}
                onSelect={(it) => selectOrigin(it.lat, it.lon, it.display_name)}
              />
            </div>

            <div className="flex-1 relative z-20">
              <input
                ref={destRef}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onKeyUp={handleDestinationSearch}
                placeholder="Destino"
                className="w-full border border-gray-300 rounded p-2 shadow-sm focus:ring-2 focus:ring-red-200"
              />
              <SuggestionPortal
                anchorRef={destRef}
                items={destinationResults}
                visible={destinationResults.length > 0}
                onSelect={(it) => selectDestination(it.lat, it.lon, it.display_name)}
              />
            </div>
          </div>

      <div className="w-full h-[70vh] z-0 mt-4">
          <Map
            coords={coords ?? undefined}
            route={route ?? undefined}
            distance={distance ?? undefined}
          />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="p-4 bg-white border rounded shadow-sm">
            <div className="text-sm text-gray-500">Distancia</div>
            <div className="text-xl font-semibold">{distance ? distance.toFixed(2) + ' km' : '—'}</div>
          </div>

          <div className="p-4 bg-white border rounded shadow-sm">
            <div className="text-sm text-gray-500">Duración</div>
            <div className="text-xl font-semibold">{duration ? duration.toFixed(2) + ' min' : '—'}</div>
          </div>

          <div className="p-4 bg-white border rounded shadow-sm">
            <div className="text-sm text-gray-500">Precio</div>
            <div className="text-xl font-semibold">{price ? '$' + price.toFixed(2) : '—'}</div>
          </div>

          <div className="p-4 flex gap-2">
            <button
              className="flex-1 px-4 py-2 rounded-md text-white font-medium shadow"
              style={{ background: primary }}
              onMouseOver={(e) => (e.currentTarget.style.background = primaryDark)}
              onMouseOut={(e) => (e.currentTarget.style.background = primary)}
              onClick={sendRide}
            >
              Enviar ruta
            </button>
            <button
              className="px-4 py-2 rounded-md border border-gray-300 bg-white"
              onClick={() => { setOrigin(''); setDestination(''); setCoords(null); setRoute(null); setDistance(null); setDuration(null); setPrice(null); }}
            >
              Limpiar
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
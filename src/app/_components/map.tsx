
"use client";

import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { toast } from "react-hot-toast";

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

export default function Map() {
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

  const ride = api.carpooler.pushRide.useMutation();

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

  const selectOrigin = (lat: string, lon: string) => {
    const position: [number, number] = [parseFloat(lat), parseFloat(lon)];
    if (coords) setCoords({ ...coords, start: position });
    else setCoords({ start: position, end: position });
    setOriginResults([]);
    setOrigin("");
  };

  const selectDestination = (lat: string, lon: string) => {
    const position: [number, number] = [parseFloat(lat), parseFloat(lon)];
    if (coords) setCoords({ ...coords, end: position });
    else setCoords({ start: position, end: position });
    setDestinationResults([]);
    setDestination("");
  };

  const tileLayerProps: React.ComponentProps<typeof TileLayer> = {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  };

  const sendRide = async () => {
    if (!coords) return;
    const toastId = toast.loading("Enviando ruta...");
    try {
      await ride.mutateAsync({
        latStart: coords.start[0],
        lngStart: coords.start[1],
        latEnd: coords.end[0],
        lngEnd: coords.end[1],
        distanceKm: distance ?? 0,
        durationMin: duration ?? 0, 
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
      setDuration(routeData.distance / 1000 * 4)
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
    <div className="flex flex-col items-center gap-4 p-4">
      <h3 className="text-xl font-bold">Distancia: {distance?.toFixed(2)} km</h3>
      <h3 className="text-xl font-bold">Duración: {duration?.toFixed(2)} min</h3>
      <div className="flex gap-2 w-full max-w-lg relative">
        <div className="flex-1 relative z-20">
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            onKeyUp={handleOriginSearch}
            placeholder="Origen"
            className="w-full border rounded p-2"
          />
          {originResults.length > 0 && (
            <ul className="absolute top-full left-0 bg-white border w-full max-h-48 overflow-y-auto shadow-lg">
              {originResults.map((r, i) => (
                <li
                  key={i}
                  className="p-2 hover:bg-gray-200 cursor-pointer"
                  onClick={() => selectOrigin(r.lat, r.lon)}
                >
                  {r.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex-1 relative z-20">
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onKeyUp={handleDestinationSearch}
            placeholder="Destino"
            className="w-full border rounded p-2"
          />
          {destinationResults.length > 0 && (
            <ul className="absolute top-full left-0 bg-white border w-full max-h-48 overflow-y-auto shadow-lg">
              {destinationResults.map((r, i) => (
                <li
                  key={i}
                  className="p-2 hover:bg-gray-200 cursor-pointer"
                  onClick={() => selectDestination(r.lat, r.lon)}
                >
                  {r.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="w-full h-[80vh] z-0">
        <MapContainer
          center={mtyPos as [number, number]} // Monterrey por defecto
          zoom={12}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer {...tileLayerProps} />
          
          {coords?.start && (
            <Marker position={coords.start}>
              <Popup>Inicio</Popup>
            </Marker>
          )}
          {coords?.end && (
            <Marker position={coords.end}>
              <Popup>
                Destino <br />
                {distance?.toFixed(2)} km
              </Popup>
            </Marker>
          )}
          {route?.length ? <Polyline positions={route} pathOptions={{ color: "blue" }} /> : null}
        </MapContainer>
      </div>
      <button
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
        onClick={sendRide}
        
      >Enviar Ruta</button>
    </div>
  );
}

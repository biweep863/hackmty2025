"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  CircleMarker,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function Map({
  coords,
  route,
  distance,
  pickupPoints,
  generatedStops,
  extraRoute,
  highlightPickupId,
}: {
  coords?: { start: [number, number]; end: [number, number] };
  route?: [number, number][];
  distance?: number;
  pickupPoints?:
    | {
        id: string;
        label: string;
        lat: number;
        lng: number;
        distanceMeters?: number;
        site?: any;
      }[]
    | null;
  generatedStops?:
    | {
        id: string;
        label?: string;
        lat: number;
        lng: number;
      }[]
    | null;
  extraRoute?: [number, number][] | null;
  highlightPickupId?: string | null;
}) {
  const mtyPos = [25.6866, -100.3161];

  const tileLayerProps: React.ComponentProps<typeof TileLayer> = {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  };

  // Banorte brand colors
  const primary = "#e60012";
  const primaryDark = "#c30010";

  return (
    <MapContainer
      center={mtyPos as [number, number]} // Monterrey
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
      {route?.length ? (
        <Polyline positions={route} pathOptions={{ color: primary }} />
      ) : null}
      {extraRoute?.length ? (
        <Polyline
          positions={extraRoute}
          pathOptions={{ color: "#00AA00", dashArray: "6 6" }}
        />
      ) : null}
      {pickupPoints?.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]}>
          <Popup>
            {p.label}
            <br />
            {p.distanceMeters != null ? `${p.distanceMeters} m` : null}
          </Popup>
        </Marker>
      ))}
      {generatedStops?.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.lat, s.lng]}
          pathOptions={{
            color: highlightPickupId === s.id ? "#ff6600" : "#0b66ff",
          }}
          radius={highlightPickupId === s.id ? 8 : 6}
        >
          <Popup>{s.label ?? "Parada"}</Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

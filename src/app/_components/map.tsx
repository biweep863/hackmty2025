"use client";

import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function Map(
  { coords, route, distance,
}: {
  coords?: { start: [number, number]; end: [number, number] };
  route?: [number, number][];
  distance?: number;
}
) {
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
    {route?.length ? <Polyline positions={route} pathOptions={{ color: primary }} /> : null}
  </MapContainer>
  );
}
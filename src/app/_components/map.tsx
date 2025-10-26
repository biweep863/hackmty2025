"use client";

import React from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  CircleMarker,
  useMapEvents,
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
  onMapClick,
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
  onMapClick?: (lat: number, lng: number) => void;
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
      {/* Ensure Leaflet default icon URLs are set (fixes missing marker icons in many bundlers) */}
      {/* This runs in the client only */}
      <InitLeafletIcons />
      {/* attach a click handler to the map if parent provided one */}
      {onMapClick ? <MapClickHandler onMapClick={onMapClick} /> : null}
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
        <Polyline positions={route} pathOptions={{ color: primary, weight: 4, opacity: 0.9 }} />
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
      {/* If a route is provided, add start/end markers to indicate direction */}
      {route && route.length > 0 ? (
        <>
          {/* start */}
          <Marker position={route[0] as [number, number]}>
            <Popup>Inicio</Popup>
          </Marker>
          {/* end */}
          {route.length > 1 && (
            <Marker position={route[route.length - 1] as [number, number]}>
              <Popup>Destino</Popup>
            </Marker>
          )}
        </>
      ) : null}
    </MapContainer>
  );
}

function InitLeafletIcons() {
  // initialize once on client
  React.useEffect(() => {
    void import("leaflet").then((leafletModule) => {
      const L = (leafletModule as any).default ?? leafletModule;
      // Use CDN-hosted icons to avoid bundler asset issues
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
    });
  }, []);
  return null;
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      try {
        onMapClick(e.latlng.lat, e.latlng.lng);
      } catch (err) {
        // ignore
      }
    },
  });
  return null;
}

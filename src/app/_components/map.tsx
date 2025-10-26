"use client";

import { useEffect } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  CircleMarker,
  useMapEvents,
} from "react-leaflet";
import { useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon paths so markers render correctly in Next.js.
// Use CDN-hosted marker images so we don't depend on bundler asset handling.
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function Map({
  coords,
  route,
  distance,
  pickupPoints,
  generatedStops,
  extraRoute,
  highlightPickupId,
  onMapClick,
  clientA,
  clientB,
  matchPointFrom,
  matchPointTo,
  segments,
}: {
  clientA?: [number, number] | null;
  clientB?: [number, number] | null;
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
  matchPointFrom?: { lat: number; lng: number } | null;
  matchPointTo?: { lat: number; lng: number } | null;
  segments?: Array<[number, number][] | null> | null;
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
      {/* fit map to extraRoute or segments when provided */}
      {(extraRoute && extraRoute.length) || (segments && segments.length) ? (
        <FitBounds extraRoute={extraRoute} segments={segments} />
      ) : null}
      {/* Ensure Leaflet default icon URLs are set (fixes missing marker icons in many bundlers) */}
      {/* This runs in the client only */}
      {/* <InitLeafletIcons /> */}
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
        <Polyline
          positions={route}
          pathOptions={{ color: primary, weight: 4, opacity: 0.95 }}
          smoothFactor={1}
        />
      ) : null}
      {extraRoute?.length ? (
        <Polyline
          positions={extraRoute}
          pathOptions={{ color: "#00AA00", weight: 5, opacity: 0.95 }}
          smoothFactor={1}
        />
      ) : null}
      {/* render each OSRM segment separately if provided */}
      {segments && segments.length
        ? segments.map((seg: [number, number][] | null, i: number) =>
            seg && seg.length ? (
              <Polyline
                key={`seg-${i}`}
                positions={seg}
                pathOptions={{
                  color: ["#0033cc", "#009900", "#ff6600"][i % 3],
                  weight: 5,
                  opacity: 0.95,
                }}
                smoothFactor={1}
              />
            ) : null,
          )
        : null}
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
      {/* client A/B markers */}
      {clientA ? (
        <Marker position={clientA}>
          <Popup>Cliente A (Origen)</Popup>
        </Marker>
      ) : null}
      {clientB ? (
        <Marker position={clientB}>
          <Popup>Cliente B (Destino)</Popup>
        </Marker>
      ) : null}
      {/* carpooler route endpoints (when viewing a match) */}
      {matchPointFrom ? (
        <Marker position={[matchPointFrom.lat, matchPointFrom.lng]}>
          <Popup>Route start</Popup>
        </Marker>
      ) : null}
      {matchPointTo ? (
        <Marker position={[matchPointTo.lat, matchPointTo.lng]}>
          <Popup>Route end</Popup>
        </Marker>
      ) : null}
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

function FitBounds({
  extraRoute,
  segments,
}: {
  extraRoute?: [number, number][] | null;
  segments?: Array<[number, number][] | null> | null;
}) {
  const map = useMap();
  useEffect(() => {
    try {
      const parts: [number, number][] = [];
      if (extraRoute && extraRoute.length) parts.push(...extraRoute);
      if (segments && segments.length) {
        for (const s of segments) {
          if (s && s.length) parts.push(...s);
        }
      }
      if (parts.length) map.fitBounds(parts as any, { padding: [50, 50] });
    } catch (e) {
      // ignore
    }
  }, [extraRoute, segments, map]);
  return null;
}

function InitLeafletIcons() {
  // initialize once on client
  useEffect(() => {
    void import("leaflet").then((leafletModule) => {
      const L = (leafletModule as any).default ?? leafletModule;
      // Use CDN-hosted icons to avoid bundler asset issues
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
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

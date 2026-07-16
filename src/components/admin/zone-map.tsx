"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type ZoneCircleView = {
  id: string;
  name: string;
  code: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
};

export type AreaMarker = {
  lat: number;
  lng: number;
  label: string;
  color?: string;
};

const INDIA_CENTER: [number, number] = [22.6, 79.0];

function dot(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:12px;height:12px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></span>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function ClickHandler({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitToZones({ zones }: { zones: ZoneCircleView[] }) {
  const map = useMap();
  useEffect(() => {
    if (zones.length === 0) return;
    const bounds = L.latLngBounds(
      zones.map((z) => [z.centerLat, z.centerLng] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
    // Refit only when the set of zone centers changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones.map((z) => `${z.centerLat},${z.centerLng}`).join("|")]);
  return null;
}

export default function ZoneMap({
  zones,
  draft,
  onPick,
  markers = [],
  height = 420,
}: {
  zones: ZoneCircleView[];
  draft?: { lat: number; lng: number; radiusKm: number } | null;
  onPick?: (lat: number, lng: number) => void;
  markers?: AreaMarker[];
  height?: number;
}) {
  return (
    <MapContainer
      center={INDIA_CENTER}
      zoom={5}
      scrollWheelZoom
      style={{ height, width: "100%", borderRadius: 8 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <FitToZones zones={zones} />
      <ClickHandler onPick={onPick} />

      {zones.map((z) => (
        <Circle
          key={z.id}
          center={[z.centerLat, z.centerLng]}
          radius={z.radiusKm * 1000}
          pathOptions={{ color: "#2a78d6", fillColor: "#2a78d6", fillOpacity: 0.1, weight: 2 }}
        >
          <Popup>
            <strong>{z.name}</strong> ({z.code})<br />
            radius {z.radiusKm} km
          </Popup>
        </Circle>
      ))}

      {draft && (
        <Circle
          center={[draft.lat, draft.lng]}
          radius={draft.radiusKm * 1000}
          pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.12, weight: 2, dashArray: "6" }}
        />
      )}
      {draft && <Marker position={[draft.lat, draft.lng]} icon={dot("#16a34a")} />}

      {markers.map((m, i) => (
        <Marker key={i} position={[m.lat, m.lng]} icon={dot(m.color ?? "#eb6834")}>
          <Popup>{m.label}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

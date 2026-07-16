"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const INDIA_CENTER: [number, number] = [22.6, 79.0];

function pin() {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#16a34a;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function ClickToSet({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ point }: { point: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView(point, Math.max(map.getZoom(), 12));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point?.join(",")]);
  return null;
}

/** Click the map to set a single point (the agent's serving location). */
export default function LocationPickerMap({
  value,
  onPick,
  height = 300,
}: {
  value: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
  height?: number;
}) {
  const point: [number, number] | null = value ? [value.lat, value.lng] : null;
  return (
    <MapContainer
      center={point ?? INDIA_CENTER}
      zoom={point ? 12 : 5}
      scrollWheelZoom
      style={{ height, width: "100%", borderRadius: 8 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <ClickToSet onPick={onPick} />
      <Recenter point={point} />
      {point && <Marker position={point} icon={pin()} />}
    </MapContainer>
  );
}

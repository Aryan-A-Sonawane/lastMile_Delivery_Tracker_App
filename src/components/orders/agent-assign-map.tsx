"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { loadColor, type AgentPin } from "./agent-load";

export type { AgentPin };

function pinIcon(color: string, selected: boolean) {
  const size = selected ? 20 : 14;
  const ring = selected ? "box-shadow:0 0 0 3px rgba(37,99,235,.9)" : "box-shadow:0 0 0 1px rgba(0,0,0,.25)";
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid #fff;${ring}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function pickupIcon() {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:16px;height:16px;background:#2563eb;border:2px solid #fff;transform:rotate(45deg);box-shadow:0 0 0 1px rgba(0,0,0,.25)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.map((p) => p.join(",")).join("|")]);
  return null;
}

const INDIA_CENTER: [number, number] = [22.6, 79.0];

export default function AgentAssignMap({
  pickup,
  agents,
  selectedId,
  onSelect,
  height = 380,
}: {
  pickup: { lat: number; lng: number } | null;
  agents: AgentPin[];
  selectedId: string | null;
  onSelect: (agentId: string) => void;
  height?: number;
}) {
  const points: [number, number][] = [
    ...agents.map((a) => [a.lat, a.lng] as [number, number]),
    ...(pickup ? [[pickup.lat, pickup.lng] as [number, number]] : []),
  ];

  return (
    <MapContainer
      center={pickup ? [pickup.lat, pickup.lng] : INDIA_CENTER}
      zoom={pickup ? 11 : 5}
      scrollWheelZoom
      style={{ height, width: "100%", borderRadius: 8 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <FitBounds points={points} />

      {pickup && (
        <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon()}>
          <Popup>Pickup location</Popup>
        </Marker>
      )}

      {agents.map((a) => (
        <Marker
          key={a.agentId}
          position={[a.lat, a.lng]}
          icon={pinIcon(loadColor(a.loadFactor, a.available), a.agentId === selectedId)}
          eventHandlers={{ click: () => onSelect(a.agentId) }}
        >
          <Popup>
            <strong>{a.name}</strong>
            <br />
            {a.activeOrders}/{a.maxActiveOrders} active
            {a.distanceKm != null ? ` · ${a.distanceKm} km` : ""}
            <br />
            {a.available ? "Available" : "Unavailable"}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

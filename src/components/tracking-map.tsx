"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapPoint = { lat: number; lng: number; label: string };

function dotIcon(color: string) {
  return L.divIcon({
    className: "tracking-dot",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/**
 * Leaflet map showing pickup (green), drop (red) and — when known — the current
 * agent (blue). Must be imported via next/dynamic with ssr:false so Leaflet
 * never loads on the server.
 */
export default function TrackingMap({
  pickup,
  drop,
  agent,
}: {
  pickup: MapPoint;
  drop: MapPoint;
  agent?: MapPoint | null;
}) {
  const route: [number, number][] = [
    [pickup.lat, pickup.lng],
    [drop.lat, drop.lng],
  ];
  const all = agent ? [...route, [agent.lat, agent.lng] as [number, number]] : route;
  const bounds = L.latLngBounds(all);

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [28, 28] }}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%", borderRadius: 8 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <Polyline
        positions={route}
        pathOptions={{ color: "#94a3b8", dashArray: "6", weight: 2 }}
      />
      <Marker position={[pickup.lat, pickup.lng]} icon={dotIcon("#16a34a")}>
        <Popup>Pickup — {pickup.label}</Popup>
      </Marker>
      <Marker position={[drop.lat, drop.lng]} icon={dotIcon("#dc2626")}>
        <Popup>Drop — {drop.label}</Popup>
      </Marker>
      {agent && (
        <Marker position={[agent.lat, agent.lng]} icon={dotIcon("#2563eb")}>
          <Popup>Agent — {agent.label}</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}

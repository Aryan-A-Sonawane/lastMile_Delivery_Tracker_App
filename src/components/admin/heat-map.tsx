"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import "leaflet/dist/leaflet.css";

export type HeatPoint = { lat: number; lng: number; value: number };

const INDIA_CENTER: [number, number] = [22.6, 79.0];

const GRADIENT = {
  0.2: "#2a78d6",
  0.45: "#1baf7a",
  0.65: "#eda100",
  0.85: "#eb6834",
  1.0: "#e34948",
};

function HeatLayer({ points, max }: { points: HeatPoint[]; max: number }) {
  const map = useMap();
  useEffect(() => {
    const latlngs: L.HeatLatLngTuple[] = points.map((p) => [p.lat, p.lng, p.value]);
    const layer = L.heatLayer(latlngs, {
      radius: 32,
      blur: 22,
      max: max || 1,
      minOpacity: 0.35,
      gradient: GRADIENT,
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [points, max, map]);
  return null;
}

export default function HeatMap({
  points,
  max,
  height = 520,
}: {
  points: HeatPoint[];
  max: number;
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
      <HeatLayer points={points} max={max} />
    </MapContainer>
  );
}

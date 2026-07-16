// Leaflet-free helpers shared by the assign panel and the (client-only) map.
// Kept separate so importing these never pulls Leaflet into the SSR bundle.

export type AgentPin = {
  agentId: string;
  name: string;
  lat: number;
  lng: number;
  loadFactor: number; // 0..1
  available: boolean;
  activeOrders: number;
  maxActiveOrders: number;
  distanceKm: number | null;
};

/** Load → colour: green (light) · amber (busy) · red (full); grey when offline. */
export function loadColor(loadFactor: number, available: boolean): string {
  if (!available) return "#94a3b8"; // slate — offline / at capacity
  if (loadFactor >= 0.67) return "#dc2626"; // red
  if (loadFactor >= 0.34) return "#d97706"; // amber
  return "#16a34a"; // green
}

"use client";

import dynamic from "next/dynamic";

const TrackingMap = dynamic(() => import("@/components/tracking-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

type Zone = { name: string; centerLat: number | null; centerLng: number | null } | null | undefined;
type Agent =
  | { currentLat: number | null; currentLng: number | null; profile: { name: string } }
  | null
  | undefined;

export function TrackingMapCard({
  pickupZone,
  dropZone,
  currentAgent,
}: {
  pickupZone: Zone;
  dropZone: Zone;
  currentAgent: Agent;
}) {
  if (
    pickupZone?.centerLat == null ||
    pickupZone?.centerLng == null ||
    dropZone?.centerLat == null ||
    dropZone?.centerLng == null
  ) {
    return null;
  }

  const pickup = {
    lat: pickupZone.centerLat,
    lng: pickupZone.centerLng,
    label: pickupZone.name,
  };
  const drop = {
    lat: dropZone.centerLat,
    lng: dropZone.centerLng,
    label: dropZone.name,
  };
  const agent =
    currentAgent?.currentLat != null && currentAgent?.currentLng != null
      ? {
          lat: currentAgent.currentLat,
          lng: currentAgent.currentLng,
          label: currentAgent.profile.name,
        }
      : null;

  return (
    <div className="h-64 w-full overflow-hidden rounded-lg border">
      <TrackingMap pickup={pickup} drop={drop} agent={agent} />
    </div>
  );
}

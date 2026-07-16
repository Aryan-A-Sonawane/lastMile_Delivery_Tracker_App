import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi, badRequest } from "@/lib/api/errors";
import { haversineKm } from "@/lib/domain/zones";

// Reverse geocode a map point to the nearest known pincode using our own
// PincodeRef dataset (no external geocoding service / API key needed). Powers
// the "pick on map" flow in the order form.
export const GET = withApi(async (req: NextRequest) => {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw badRequest("lat and lng are required");
  }

  // Widen the bounding box until we find candidates (keeps the scan small).
  let candidates: { pincode: string; area: string; city: string | null; state: string | null; lat: number; lng: number }[] = [];
  for (const d of [0.35, 1, 3]) {
    candidates = await prisma.pincodeRef.findMany({
      where: {
        lat: { gte: lat - d, lte: lat + d },
        lng: { gte: lng - d, lte: lng + d },
      },
      select: { pincode: true, area: true, city: true, state: true, lat: true, lng: true },
      take: 2000,
    });
    if (candidates.length > 0) break;
  }
  if (candidates.length === 0) return NextResponse.json({ data: null });

  let best = candidates[0];
  let bestKm = haversineKm({ lat, lng }, { lat: best.lat, lng: best.lng });
  for (const c of candidates) {
    const km = haversineKm({ lat, lng }, { lat: c.lat, lng: c.lng });
    if (km < bestKm) {
      best = c;
      bestKm = km;
    }
  }

  const serviceable = await prisma.area.findUnique({
    where: { pincode: best.pincode },
    select: { name: true, city: true, state: true },
  });

  return NextResponse.json({
    data: {
      pincode: best.pincode,
      area: serviceable?.name ?? best.area,
      city: serviceable?.city ?? best.city,
      state: serviceable?.state ?? best.state,
      distanceKm: Math.round(bestKm * 10) / 10,
      serviceable: Boolean(serviceable),
      lat: best.lat,
      lng: best.lng,
    },
  });
});

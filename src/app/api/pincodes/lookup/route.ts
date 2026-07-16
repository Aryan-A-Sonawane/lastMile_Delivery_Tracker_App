import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api/errors";

// Public pincode → locality lookup for the order form. Confirms the location a
// pincode maps to (so a wrong pincode is caught) and whether we service it.
export const GET = withApi(async (req: NextRequest) => {
  const pincode = (req.nextUrl.searchParams.get("pincode") ?? "").trim();
  if (!/^\d{4,10}$/.test(pincode)) {
    return NextResponse.json({ data: null });
  }

  const [ref, area] = await Promise.all([
    prisma.pincodeRef.findUnique({
      where: { pincode },
      select: { pincode: true, area: true, city: true, district: true, state: true },
    }),
    prisma.area.findUnique({
      where: { pincode },
      select: { name: true, city: true, state: true },
    }),
  ]);

  if (!ref && !area) return NextResponse.json({ data: null });

  return NextResponse.json({
    data: {
      pincode,
      area: area?.name ?? ref?.area ?? null,
      city: area?.city ?? ref?.city ?? null,
      district: ref?.district ?? null,
      state: area?.state ?? ref?.state ?? null,
      serviceable: Boolean(area),
    },
  });
});

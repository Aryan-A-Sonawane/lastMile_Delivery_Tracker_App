import { type NextRequest, NextResponse } from "next/server";
import { withApi } from "@/lib/api/errors";
import { quoteRequestSchema } from "@/lib/validation/order";
import { loadQuoteConfig } from "@/lib/orders/pricing-data";
import { resolveQuote } from "@/lib/orders/pricing";

// Public rate estimate. Detects pickup/drop zones, computes volumetric vs actual
// weight, applies the correct rate card + COD surcharge, and returns the full
// breakdown WITHOUT persisting anything. The authenticated order-creation flow
// (Phase 3) recomputes server-side and snapshots the result.
export const POST = withApi(async (req: NextRequest) => {
  const input = quoteRequestSchema.parse(await req.json());
  const config = await loadQuoteConfig([input.pickupPincode, input.dropPincode]);
  const result = resolveQuote(config, input);
  return NextResponse.json({ data: result });
});

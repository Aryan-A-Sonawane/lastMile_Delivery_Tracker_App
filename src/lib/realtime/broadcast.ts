/**
 * Fire-and-forget server-side Supabase Realtime broadcast. Clients subscribed to
 * the channel `order:<trackingNumber>` receive an instant "update" event on any
 * status/assignment change. Uses the Realtime broadcast REST endpoint so no
 * persistent socket is needed from a serverless handler. Never throws — live
 * updates are a nice-to-have layered on top of polling.
 */
export async function broadcastOrderEvent(
  trackingNumber: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [
          { topic: `order:${trackingNumber}`, event: "update", payload },
        ],
      }),
    });
  } catch (e) {
    console.error("realtime broadcast failed:", e);
  }
}

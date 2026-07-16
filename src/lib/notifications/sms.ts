/**
 * SMS delivery via Twilio's REST API (no SDK — a single authenticated fetch).
 * Twilio is the easiest provider to start with: a free trial gives you credit
 * and a sender number, and it works from any host. Set three env vars and SMS
 * goes live; leave them unset and notifications fall back to the mock logger.
 *
 * Env:
 *   TWILIO_ACCOUNT_SID   — from the Twilio console
 *   TWILIO_AUTH_TOKEN    — from the Twilio console
 *   TWILIO_SMS_FROM      — your Twilio number, e.g. +14155550123
 *
 * (For India-only production, MSG91 or Fast2SMS are cheaper but need DLT
 * sender/template registration — swap `sendSms` for their REST call if needed.)
 */
export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_SMS_FROM,
  );
}

export async function sendSms(to: string, body: string): Promise<{ id: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_SMS_FROM!;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    },
  );

  const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!res.ok) throw new Error(json.message ?? `Twilio error ${res.status}`);
  return { id: json.sid ?? "unknown" };
}

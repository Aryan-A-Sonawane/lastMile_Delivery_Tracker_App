/**
 * The public base URL of this deployment, used to build absolute links in
 * emails / notifications. Resolution order:
 *   1. NEXT_PUBLIC_APP_URL   — explicit override (set this on Vercel to your domain)
 *   2. VERCEL_PROJECT_PRODUCTION_URL — the production domain Vercel injects automatically
 *   3. VERCEL_URL            — the current deployment's URL (preview deploys)
 *   4. http://localhost:3000 — local dev
 *
 * With (2), production emails link to the deployed site out of the box — no env
 * setup required — while (1) still lets you pin a custom domain.
 */
export function getAppUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");
  return raw.replace(/\/+$/, "");
}

/**
 * Generates a human-friendly, reasonably unique tracking number, e.g.
 * `LM-LXQF3K-8A2C`. Time-ordered prefix + random suffix. Uniqueness is also
 * guaranteed by a DB unique constraint (the caller retries on collision).
 * `now`/`rand` are injectable for deterministic tests.
 */
export function generateTrackingNumber(
  now: Date = new Date(),
  rand: () => number = Math.random,
): string {
  const ts = now.getTime().toString(36).toUpperCase();
  const suffix = Math.floor(rand() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  return `LM-${ts}-${suffix}`;
}

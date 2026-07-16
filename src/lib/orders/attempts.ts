/**
 * Delivery-attempt policy. A shipment gets at most {@link MAX_DELIVERY_ATTEMPTS}
 * attempts; after the last one fails it is returned to the sender. A customer may
 * reschedule a failed delivery only while attempts remain, to a date/time within
 * {@link RESCHEDULE_WINDOW_DAYS} days.
 */
export const MAX_DELIVERY_ATTEMPTS = 3;
export const RESCHEDULE_WINDOW_DAYS = 3;

/** Whether a failed order (on `attemptNumber`) still has a delivery attempt left. */
export function hasAttemptsRemaining(attemptNumber: number): boolean {
  return attemptNumber < MAX_DELIVERY_ATTEMPTS;
}

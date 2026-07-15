"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to the `order:<trackingNumber>` Realtime channel and invokes
 * `onEvent` on every broadcast (server sends one on status/assignment changes).
 * Complements query polling with instant push updates. The callback is held in
 * a ref so it can change without re-subscribing.
 */
export function useOrderEvents(
  trackingNumber: string | undefined,
  onEvent: () => void,
) {
  const cb = useRef(onEvent);
  useEffect(() => {
    cb.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!trackingNumber) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`order:${trackingNumber}`)
      .on("broadcast", { event: "update" }, () => cb.current())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trackingNumber]);
}

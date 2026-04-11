import { useEffect, useRef, useState } from "react";

/**
 * Drift-free stopwatch hook.
 *
 * `active`  – whether the stopwatch should be ticking right now.
 *
 * Returns whole-seconds elapsed (accumulated across all active sessions).
 *
 * Key design:
 *  • accumulatedTime is updated ONLY when the user goes inactive.
 *  • While active, elapsed = (now – sessionStart) is added live.
 *  • The display refreshes once per second via setInterval.
 *  • Because we always derive from Date.now(), event-loop lag
 *    or slow detection loops cannot cause drift or double-counting.
 */
export function useStopwatch(active: boolean) {
  const [displayTime, setDisplayTime] = useState(0);

  // Refs so the interval callback always sees the latest values
  // without needing to restart the interval.
  const sessionStartRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);

  // ── Handle active/inactive transitions ──────────────────────
  useEffect(() => {
    if (active) {
      // Start a new timing session
      if (sessionStartRef.current === null) {
        sessionStartRef.current = Date.now();
      }
    } else {
      // Stop session — freeze the elapsed delta into accumulated
      if (sessionStartRef.current !== null) {
        const delta = (Date.now() - sessionStartRef.current) / 1000;
        const newAccumulated = accumulatedRef.current + delta;
        accumulatedRef.current = newAccumulated;
        sessionStartRef.current = null;
      }
    }
    // Only depend on `active` — no state in the dep array → no feedback loops
  }, [active]);

  // ── Tick the display once per second ────────────────────────
  useEffect(() => {
    const tick = () => {
      if (sessionStartRef.current !== null) {
        const elapsed = (Date.now() - sessionStartRef.current) / 1000;
        setDisplayTime(accumulatedRef.current + elapsed);
      } else {
        setDisplayTime(accumulatedRef.current);
      }
    };

    // Immediate first tick so there's no 1-second blank
    tick();

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);          // runs once — refs keep it up-to-date

  /** Reset everything back to zero */
  const reset = () => {
    accumulatedRef.current = 0;
    setDisplayTime(0);
    if (sessionStartRef.current !== null) {
      // If currently running, restart the session from now
      sessionStartRef.current = Date.now();
    }
  };

  return { seconds: Math.floor(displayTime), reset };
}

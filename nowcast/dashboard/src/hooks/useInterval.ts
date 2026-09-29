import { useEffect, useRef } from "react";

/** Runs `callback` immediately and then every `delayMs`. If `callback`'s own
 * identity changes (e.g. it's wrapped in `useCallback(..., [someParam])` and
 * `someParam` changed — see useHazards(leadMinutes)), that also triggers an
 * immediate re-run instead of waiting for the next scheduled tick: without
 * this, changing leadMinutes updated the closure `useInterval` would
 * eventually call, but not until up to `delayMs` later, which made the
 * lead-time slider's hazard-position advection (see hazard_india.py) look
 * completely unresponsive for up to 30s after dragging it. Plain re-renders
 * that don't change the callback's identity (the common case) still don't
 * reset the timer. */
export function useInterval(callback: () => void, delayMs: number) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    savedCallback.current();
    const id = setInterval(() => savedCallback.current(), delayMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayMs, callback]);
}

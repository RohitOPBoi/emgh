import { useCallback, useState } from "react";
import { api } from "../api";
import { useInterval } from "./useInterval";
import type { SystemStatus } from "../types";

export type LinkState = "connecting" | "online" | "offline";

/** Polls the backend's provenance endpoint. `link` is what the landing page
 * shows honestly: connecting / online / offline — never a hard-coded "LIVE". */
export function useSystemStatus(pollMs = 45_000) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [link, setLink] = useState<LinkState>("connecting");

  const fetchNow = useCallback(async () => {
    try {
      setStatus(await api.systemStatus());
      setLink("online");
    } catch {
      setLink((prev) => (prev === "online" ? "online" : "offline"));
    }
  }, []);

  useInterval(fetchNow, pollMs);
  return { status, link };
}

import { createContext, useContext } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";

export interface MapContextValue {
  map: MaplibreMap | null;
  ready: boolean;
  tileError: string | null;
  attachContainer: (el: HTMLDivElement | null) => void;
}

export const MapContext = createContext<MapContextValue>({
  map: null,
  ready: false,
  tileError: null,
  attachContainer: () => {},
});

export function useMeghMap() {
  return useContext(MapContext);
}

import { useAgrimMap } from "../MapProvider";
import { useRasterLayer } from "../useRasterLayer";
import type { NowcastFrame } from "../../types";

export function ModelFrameLayer({ frame, visible }: { frame: NowcastFrame | null; visible: boolean }) {
  const { map } = useAgrimMap();
  useRasterLayer(map, "layer-model-frame", frame?.image, frame?.bbox, {
    opacity: 0.55,
    visible: visible && !!frame?.available,
    beforeId: "heat-hail",
  });
  return null;
}

import MapControls from "@/shared/ui/MapControls";
import Button from "@/shared/ui/Button";
import type { Ref, RefObject } from "react";
import { useImperativeHandle, useState } from "react";
import type { MapCanvasHandle } from "./MapCanvas";
export interface ZoomControlsHandle {
  setZoom(zoom: number): void;
}
export default function ZoomControls({
  ref,
  map,
  disabled,
}: {
  ref?: Ref<ZoomControlsHandle>;
  map: RefObject<MapCanvasHandle | null>;
  disabled: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  useImperativeHandle(ref, () => ({ setZoom }), []);
  return (
    <MapControls className="zoom chrome" label="Map view">
      <Button
        id="zoom-out"
        aria-label="Zoom out"
        disabled={disabled}
        onClick={() => map.current?.zoomBy(-0.5)}
      >
        −
      </Button>
      <output id="zoom-label" aria-label="Zoom level">
        {Math.round(zoom * 100)}%
      </output>
      <Button
        id="zoom-in"
        aria-label="Zoom in"
        disabled={disabled}
        onClick={() => map.current?.zoomBy(0.5)}
      >
        +
      </Button>
      <Button id="fit" disabled={disabled} onClick={() => map.current?.fit()}>
        Fit
      </Button>
    </MapControls>
  );
}

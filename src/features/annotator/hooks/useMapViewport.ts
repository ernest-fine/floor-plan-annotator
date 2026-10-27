import { useRef, useState, useLayoutEffect, useEffect } from "react";
import type { Annotation, MapImage, Position } from "../domain/types";
import { clamp } from "@/shared/lib/math";
export interface ViewAnchor {
  x: number;
  y: number;
  screenX?: number;
  screenY?: number;
}
export default function useMapViewport(
  image: MapImage | null,
  onZoom: (value: number) => void,
) {
  const viewport = useRef<HTMLDivElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const anchor = useRef<ViewAnchor | null>(null),
    zoomFrame = useRef<number | null>(null),
    pendingZoom = useRef<number | null>(null);
  const [zoom, setZoom] = useState(1),
    [box, setBox] = useState({ width: 1, height: 1, padding: 24 });
  const fit = image
    ? Math.max(
        100,
        Math.min(
          box.width - box.padding,
          ((box.height - box.padding) * image.width) / image.height,
        ),
      )
    : 1;
  const width = Math.floor(fit * zoom),
    height = image ? (width * image.height) / image.width : 1;
  const marginTop = Math.max(0, (box.height - box.padding - height) / 2);

  function cancelZoom() {
    if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current);
    zoomFrame.current = null;
    pendingZoom.current = null;
    anchor.current = null;
  }
  function requestZoom(value: number, nextAnchor: ViewAnchor) {
    anchor.current = nextAnchor;
    pendingZoom.current = value;
    if (zoomFrame.current === null)
      zoomFrame.current = requestAnimationFrame(() => {
        zoomFrame.current = null;
        if (pendingZoom.current !== null) {
          setZoom(pendingZoom.current);
          pendingZoom.current = null;
        }
      });
  }
  useEffect(() => () => cancelZoom(), []);
  useEffect(() => {
    setZoom(1);
    cancelZoom();
    viewport.current!.scrollTo(0, 0);
  }, [image?.src]);
  useLayoutEffect(() => {
    const element = viewport.current!;
    let frame: number | null = null;
    function resize() {
      // @profile:resize-callbacks
      const rect = element.getBoundingClientRect();
      const next = {
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
        padding: (parseFloat(getComputedStyle(element).paddingLeft) || 0) * 2,
      };
      setBox((previous) =>
        previous.width === next.width &&
        previous.height === next.height &&
        previous.padding === next.padding
          ? previous
          : next,
      );
    }
    const observer = new ResizeObserver(() => {
      if (frame === null)
        frame = requestAnimationFrame(() => {
          frame = null;
          resize();
        });
    });
    observer.observe(element, { box: "border-box" });
    resize();
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    onZoom(zoom);
  }, [zoom, onZoom]);
  useLayoutEffect(() => {
    if (!anchor.current || !stage.current!) return;
    const { x, y } = anchor.current,
      view = viewport.current!,
      map = stage.current!;
    view.scrollTo(
      x * map.clientWidth +
        map.offsetLeft -
        (anchor.current.screenX ?? view.clientWidth / 2),
      y * map.clientHeight +
        map.offsetTop -
        (anchor.current.screenY ?? view.clientHeight / 2),
    );
    anchor.current = null;
  }, [width, height]);
  const controls = {
    zoomBy(delta: number) {
      if (!stage.current!) return;
      const view = viewport.current!,
        map = stage.current!;
      anchor.current = {
        x:
          (view.scrollLeft + view.clientWidth / 2 - map.offsetLeft) /
          map.clientWidth,
        y:
          (view.scrollTop + view.clientHeight / 2 - map.offsetTop) /
          map.clientHeight,
      };
      setZoom((value) => clamp(value + delta, 1, 10));
    },
    fit() {
      anchor.current = null;
      setZoom(1);
      viewport.current!.scrollTo(0, 0);
    },
    reveal(item: Annotation) {
      if (!stage.current!) return;
      const point: Position =
        "points" in item ? item.points[0] : [item.x, item.y];
      viewport.current!.scrollTo({
        left:
          point[0] * stage.current!.clientWidth +
          stage.current!.offsetLeft -
          viewport.current!.clientWidth / 2,
        top:
          point[1] * stage.current!.clientHeight +
          stage.current!.offsetTop -
          viewport.current!.clientHeight / 2,
        behavior: "smooth",
      });
    },
  };

  return {
    viewport,
    stage,
    width,
    height,
    marginTop,
    zoom,
    cancelZoom,
    requestZoom,
    ...controls,
  };
}
export type MapViewport = ReturnType<typeof useMapViewport>;

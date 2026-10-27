import {useRef,useState,useEffect} from "react";
import type {RefObject,PointerEvent as ReactPointerEvent,KeyboardEvent as ReactKeyboardEvent} from "react";
import type {Annotation,DrawingAnnotation,Position} from "../domain/types";
import type {MapCanvasProps} from "../types/map";
import type {MapViewport} from "./useMapViewport";
import {clamp} from "@/shared/lib/math";
import {newId} from "@/shared/lib/id";
import {moveItem} from "../domain/annotationGeometry";
import {createItem} from "../domain/annotations";
type Gesture =
  | {
      kind: "move";
      original: Annotation;
      start: Position;
      screen: Position;
      moved: boolean;
      bounds: DOMRect;
    }
  | { kind: "pan"; screen: Position; scroll: Position }
  | {
      kind: "place";
      start: Position;
      screen: Position;
      tool: "point" | "text";
      bounds: DOMRect;
    }
  | { kind: "draw"; screen: Position; moved: boolean; bounds: DOMRect };
interface Pinch {
  distance: number;
  zoom: number;
  x: number;
  y: number;
}

interface GestureProps extends Omit<MapCanvasProps,"ref"|"onChooseImage"|"onUpload"|"onZoom"> {view:MapViewport;overlay:RefObject<SVGSVGElement|null>}
export default function useAnnotationGestures({project,tool,color,size,busy,onAdd,onMove,onSelect,onInteract,view:viewportState,overlay}:GestureProps){
  const {viewport,stage}=viewportState;const image=project.image;
  const gesture=useRef<Gesture|null>(null),previewRef=useRef<Annotation|null>(null),touches=useRef(new Map<number,Position>()),pinch=useRef<Pinch|null>(null),suppressTouch=useRef(false),previewFrame=useRef<number|null>(null);
  const [preview,setPreview]=useState<Annotation|null>(null);
  function clearPreview() {
    if (previewFrame.current !== null)
      cancelAnimationFrame(previewFrame.current);
    previewFrame.current = null;
    previewRef.current = null;
    setPreview(null);
  }
  function showPreview(item: Annotation | null) {
    if (!item) {
      clearPreview();
      return;
    }
    previewRef.current = item;
    if (previewFrame.current === null)
      previewFrame.current = requestAnimationFrame(() => {
        previewFrame.current = null;
        const next = previewRef.current;
        setPreview(
          next && "points" in next
            ? { ...next, points: next.points.slice() }
            : next,
        );
      });
  }
  function cancelInteraction() {
    gesture.current = null;
    touches.current.clear();
    pinch.current = null;
    suppressTouch.current = false;
    clearPreview();
    viewportState.cancelZoom();
  }
  useEffect(() => {
    const cancel = () => {
      if (document.visibilityState === "hidden") cancelInteraction();
    };
    document.addEventListener("visibilitychange", cancel);
    return () => {
      document.removeEventListener("visibilitychange", cancel);
      if (previewFrame.current !== null)
        cancelAnimationFrame(previewFrame.current);
    };
  }, []);

  useEffect(()=>cancelInteraction(),[image?.src]);
  function position(
    event: { clientX: number; clientY: number },
    rect = overlay.current!.getBoundingClientRect(),
  ): Position {
    return [
      clamp((event.clientX - rect.left) / rect.width),
      clamp((event.clientY - rect.top) / rect.height),
    ];
  }
  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!image || busy || event.button !== 0) return;
    if (event.pointerType === "touch") {
      touches.current.set(event.pointerId, [event.clientX, event.clientY]);
      viewport.current!.setPointerCapture(event.pointerId);
      if (touches.current.size >= 2) {
        event.preventDefault();
        gesture.current = null;
        showPreview(null);
        suppressTouch.current = true;
        const [a, b] = [...touches.current.values()];
        const view = viewport.current!,
          map = stage.current!,
          rect = view.getBoundingClientRect();
        const screenX = (a[0] + b[0]) / 2 - rect.left,
          screenY = (a[1] + b[1]) / 2 - rect.top;
        pinch.current = {
          distance: Math.hypot(b[0] - a[0], b[1] - a[1]),
          zoom: viewportState.zoom,
          x: (view.scrollLeft + screenX - map.offsetLeft) / map.clientWidth,
          y: (view.scrollTop + screenY - map.offsetTop) / map.clientHeight,
        };
        return;
      }
      if (suppressTouch.current) return;
    } else if (!event.isPrimary) return;
    onInteract();
    const bounds = overlay.current!.getBoundingClientRect();
    if (
      tool !== "select" &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom)
    )
      return;
    const point = position(event, bounds),
      target =
        event.target instanceof Element
          ? event.target.closest<SVGGElement>("[data-id]")
          : null;
    const screen: Position = [event.clientX, event.clientY];
    if (target && (tool === "select" || tool === "point")) {
      const item = project.items.find((item) => item.id === target.dataset.id);
      if (!item) return;
      onSelect(item.id, false);
      gesture.current = {
        kind: "move",
        original: item,
        start: point,
        screen,
        moved: false,
        bounds,
      };
    } else if (tool === "select") {
      onSelect(null, false);
      gesture.current = {
        kind: "pan",
        screen,
        scroll: [viewport.current!.scrollLeft, viewport.current!.scrollTop],
      };
    } else if (tool === "point" || tool === "text") {
      gesture.current = { kind: "place", start: point, screen, tool, bounds };
    } else {
      const item: DrawingAnnotation = {
        id: newId(),
        type: tool,
        color,
        size,
        points: tool === "pen" ? [point] : [point, [point[0], point[1]]],
      };
      showPreview(item);
      gesture.current = { kind: "draw", screen, moved: false, bounds };
    }
    viewport.current!.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" && touches.current.has(event.pointerId))
      touches.current.set(event.pointerId, [event.clientX, event.clientY]);
    if (pinch.current && touches.current.size >= 2) {
      const [a, b] = [...touches.current.values()],
        rect = viewport.current!.getBoundingClientRect();
      viewportState.requestZoom(clamp((pinch.current.zoom*Math.hypot(b[0]-a[0],b[1]-a[1]))/Math.max(1,pinch.current.distance),1,10),{x:pinch.current.x,y:pinch.current.y,screenX:(a[0]+b[0])/2-rect.left,screenY:(a[1]+b[1])/2-rect.top});
      event.preventDefault();
      return;
    }
    if (suppressTouch.current) return;
    const current = gesture.current;
    if (!current) return;
    const distance = Math.hypot(
      event.clientX - current.screen[0],
      event.clientY - current.screen[1],
    );
    if (current.kind === "pan") {
      viewport.current!.scrollLeft =
        current.scroll[0] + current.screen[0] - event.clientX;
      viewport.current!.scrollTop =
        current.scroll[1] + current.screen[1] - event.clientY;
      return;
    }
    if (current.kind === "place") return;
    const point = position(event, current.bounds);
    if (current.kind === "move") {
      if (!current.moved && distance < 4) return;
      current.moved = true;
      showPreview(
        moveItem(
          current.original,
          point[0] - current.start[0],
          point[1] - current.start[1],
        ),
      );
    } else if (current.kind === "draw") {
      current.moved ||= distance >= 4;
      const item = previewRef.current;
      if (!item || !("points" in item)) return;
      if (item.type === "arrow")
        showPreview({ ...item, points: [item.points[0], point] });
      else {
        const last = item.points[item.points.length - 1],
          rect = current.bounds;
        if (
          item.points.length < 3000 &&
          Math.hypot(
            (point[0] - last[0]) * rect.width,
            (point[1] - last[1]) * rect.height,
          ) >= 1.5
        ) {
          item.points.push(point);
          showPreview(item);
        }
      }
    }
  }
  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") {
      touches.current.delete(event.pointerId);
      if (suppressTouch.current) {
        pinch.current = null;
        gesture.current = null;
        showPreview(null);
        if (!touches.current.size) suppressTouch.current = false;
        if (viewport.current!.hasPointerCapture(event.pointerId))
          viewport.current!.releasePointerCapture(event.pointerId);
        return;
      }
    }
    const current = gesture.current;
    if (!current) return;
    gesture.current = null;
    if (
      current.kind === "place" &&
      Math.hypot(
        event.clientX - current.screen[0],
        event.clientY - current.screen[1],
      ) < 8
    ) {
      onAdd(
        createItem(
          current.tool,
          current.start,
          color,
          size,
          project.nextNumber,
        ),
      );
    } else if (
      current.kind === "draw" &&
      previewRef.current &&
      (previewRef.current.type === "pen" || current.moved)
    ) {
      onAdd(previewRef.current);
    } else if (current.kind === "move") {
      if (current.moved && previewRef.current) onMove(previewRef.current);
      else onSelect(current.original.id, true);
    }
    showPreview(null);
    if (viewport.current!.hasPointerCapture(event.pointerId))
      viewport.current!.releasePointerCapture(event.pointerId);
  }
  function keyDown(event: ReactKeyboardEvent<SVGSVGElement>) {
    const target =
        event.target instanceof Element
          ? event.target.closest<SVGGElement>("[data-id]")
          : null,
      item = project.items.find((item) => item.id === target?.dataset.id);
    if (!item) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(item.id, true);
      return;
    }
    const directions: Partial<Record<string, Position>> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      event.stopPropagation();
      const step = event.shiftKey ? 0.01 : 0.002;
      onMove(moveItem(item, direction[0] * step, direction[1] * step));
    }
  }

  function pointerCancel(event:ReactPointerEvent<HTMLDivElement>){touches.current.delete(event.pointerId);pinch.current=null;gesture.current=null;showPreview(null);suppressTouch.current=touches.current.size>0;}
  return {preview,cancel:cancelInteraction,isActive:()=>!!gesture.current||!!pinch.current,handlers:{pointerDown,pointerMove,pointerUp,pointerCancel,keyDown}};
}

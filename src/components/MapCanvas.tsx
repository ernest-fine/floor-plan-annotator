import type {
  Ref,
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type {
  Annotation,
  DrawingAnnotation,
  MapImage,
  Position,
  Project,
  Tool,
} from "../types";
export interface MapCanvasHandle {
  zoomBy(delta: number): void;
  fit(): void;
  cancel(): void;
  reveal(item: Annotation): void;
}
export interface MapCanvasProps {
  ref?: Ref<MapCanvasHandle>;
  project: Project;
  selectedId: string | null;
  tool: Tool;
  color: string;
  size: number;
  busy: boolean;
  onAdd(item: Annotation): void;
  onMove(item: Annotation): void;
  onSelect(id: string | null, open: boolean): void;
  onInteract(): void;
  onUpload(file: File | undefined): void;
  onChooseImage(): void;
  onZoom(zoom: number): void;
}
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
interface Anchor {
  x: number;
  y: number;
  screenX?: number;
  screenY?: number;
}
interface Pinch {
  distance: number;
  zoom: number;
  x: number;
  y: number;
}
import {
  memo,
  useMemo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  arrowHead,
  clamp,
  createItem,
  describe,
  geometry,
  measure,
  moveItem,
  newId,
  textLines,
} from "../lib/model";

const AnnotationShape = memo(function AnnotationShape({
  item,
  image,
  scale,
  selected,
  draft,
}: {
  item: Annotation;
  image: MapImage;
  scale: number;
  selected: boolean;
  draft: boolean;
}) {
  const { x, y, points } = useMemo(() => geometry(item, image), [item, image]);
  const polyline = useMemo(
    () => points.map((point) => point.join(",")).join(" "),
    [points],
  );
  const m =
    item.type === "point"
      ? Math.max(
          measure(item, image.width),
          Math.max(12, (16 * item.size) / 2.8) * scale,
        )
      : measure(item, image.width);
  const common = {
    "data-id": item.id,
    role: "button" as const,
    tabIndex: draft ? -1 : 0,
    "aria-label": describe(item),
    "aria-pressed": selected,
  };
  if (item.type === "point")
    return (
      <g {...common}>
        <circle cx={x} cy={y} r={Math.max(22 * scale, m)} fill="transparent" />
        <circle
          className="focus-ring"
          cx={x}
          cy={y}
          r={m + 4 * scale}
          fill="none"
          stroke={selected ? "#127a50" : "transparent"}
          strokeWidth={2 * scale}
        />
        <circle
          cx={x}
          cy={y}
          r={m}
          fill={item.color}
          stroke="#fff"
          strokeWidth={Math.max(1.4 * scale, m * 0.13)}
        />
        <text
          x={x}
          y={y + m * 0.34}
          textAnchor="middle"
          fill="#fff"
          fontSize={m * (String(item.number).length > 2 ? 0.64 : 0.9)}
          fontFamily="system-ui,sans-serif"
          fontWeight="750"
          pointerEvents="none"
        >
          {item.number}
        </text>
      </g>
    );
  if (item.type === "text") {
    const lines = textLines(item.text);
    return (
      <g {...common}>
        <rect
          className="focus-ring"
          x={x - 4 * scale}
          y={y - 4 * scale}
          width={Math.max(
            44 * scale,
            m *
              Math.max(...lines.map((line) => Array.from(line).length), 1) *
              0.68 +
              8 * scale,
          )}
          height={Math.max(44 * scale, m * 1.3 * lines.length + 8 * scale)}
          fill="transparent"
          stroke={selected ? "#127a50" : "transparent"}
          strokeWidth={scale}
          strokeDasharray={`${4 * scale} ${3 * scale}`}
        />
        <text
          fill={item.color}
          fontSize={m}
          fontWeight="650"
          fontFamily="system-ui,sans-serif"
          stroke="#fff"
          strokeWidth={m * 0.16}
          strokeLinejoin="round"
          paintOrder="stroke"
          pointerEvents="none"
        >
          {lines.map((line, index) => (
            <tspan key={index} x={x} y={y + m * (1 + index * 1.3)}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    );
  }
  return (
    <g {...common}>
      <polyline
        points={polyline}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(44 * scale, m + 8 * scale)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {selected && (
        <polyline
          className="focus-ring"
          points={polyline}
          fill="none"
          stroke="#127a50"
          strokeWidth={m + 5 * scale}
          strokeOpacity=".25"
          strokeLinecap="round"
        />
      )}
      <polyline
        points={polyline}
        fill="none"
        stroke={item.color}
        strokeWidth={m}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {item.type === "arrow" && (
        <polygon
          points={arrowHead(points, m)
            .map((point) => point.join(","))
            .join(" ")}
          fill={item.color}
        />
      )}
      {item.type === "pen" && points.length === 1 && (
        <circle
          cx={points[0][0]}
          cy={points[0][1]}
          r={m / 2}
          fill={item.color}
        />
      )}
    </g>
  );
});

export default function MapCanvas({
  ref,
  project,
  selectedId,
  tool,
  color,
  size,
  busy,
  onAdd,
  onMove,
  onSelect,
  onInteract,
  onUpload,
  onChooseImage,
  onZoom,
}: MapCanvasProps) {
  const viewport = useRef<HTMLDivElement>(null),
    stage = useRef<HTMLDivElement>(null),
    overlay = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null),
    previewRef = useRef<Annotation | null>(null),
    anchor = useRef<Anchor | null>(null);
  const touches = useRef(new Map<number, Position>()),
    pinch = useRef<Pinch | null>(null),
    suppressTouch = useRef(false);
  const [preview, setPreview] = useState<Annotation | null>(null),
    [zoom, setZoom] = useState(1),
    [box, setBox] = useState({ width: 1, height: 1, padding: 24 }),
    [dropping, setDropping] = useState(false);
  const previewFrame = useRef<number | null>(null);
  const zoomFrame = useRef<number | null>(null);
  const pendingZoom = useRef<number | null>(null);
  const image = project.image;
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
    if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current);
    zoomFrame.current = null;
    pendingZoom.current = null;
    anchor.current = null;
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
      if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current);
    };
  }, []);
  useLayoutEffect(() => {
    const element = viewport.current!;
    let frame: number | null = null;
    function resize() {
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
    setZoom(1);
    cancelInteraction();
    viewport.current!.scrollTo(0, 0);
  }, [image?.src]);
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
  useImperativeHandle(ref, () => ({
    zoomBy(delta: number) {
      if (!stage.current!) return;
      if (gesture.current || pinch.current) cancelInteraction();
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
      if (gesture.current || pinch.current) cancelInteraction();
      anchor.current = null;
      setZoom(1);
      viewport.current!.scrollTo(0, 0);
    },
    cancel: cancelInteraction,
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
  }));

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
          zoom,
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
      anchor.current = {
        x: pinch.current.x,
        y: pinch.current.y,
        screenX: (a[0] + b[0]) / 2 - rect.left,
        screenY: (a[1] + b[1]) / 2 - rect.top,
      };
      pendingZoom.current = clamp(
        (pinch.current.zoom * Math.hypot(b[0] - a[0], b[1] - a[1])) /
          Math.max(1, pinch.current.distance),
        1,
        10,
      );
      if (zoomFrame.current === null)
        zoomFrame.current = requestAnimationFrame(() => {
          zoomFrame.current = null;
          if (pendingZoom.current !== null) {
            setZoom(pendingZoom.current);
            pendingZoom.current = null;
          }
        });
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
  const items = preview
    ? [...project.items.filter((item) => item.id !== preview.id), preview]
    : project.items;
  const touchAction = "none";
  return (
    <main aria-label="Floor map workspace">
      <div
        id="viewport"
        ref={viewport}
        className={"viewport" + (dropping ? " dropping" : "")}
        style={{ touchAction }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={(event) => {
          touches.current.delete(event.pointerId);
          pinch.current = null;
          gesture.current = null;
          showPreview(null);
          suppressTouch.current = touches.current.size > 0;
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDropping(false);
          onUpload(event.dataTransfer.files[0]);
        }}
      >
        {!image ? (
          <div className="empty">
            <div className="empty-inner">
              <h2>Load floor plan</h2>
              <p className="muted">JPEG / PNG · up to 25 MB, 24 MP</p>
              <button
                id="upload-empty"
                className="primary"
                onClick={onChooseImage}
              >
                Choose an image
              </button>
            </div>
          </div>
        ) : (
          <div
            id="stage"
            ref={stage}
            className="stage"
            data-tool={tool}
            style={{ width, height, marginTop, touchAction }}
          >
            <img
              id="map-image"
              src={image.src}
              alt={"Floor plan: " + image.name}
              draggable={false}
            />
            <svg
              id="overlay"
              ref={overlay}
              viewBox={`0 0 ${image.width} ${image.height}`}
              aria-label="Floor plan annotations"
              tabIndex={0}
              style={{ touchAction }}
              onKeyDown={keyDown}
            >
              {items.map((item) => (
                <AnnotationShape
                  key={item.id}
                  item={item}
                  image={image}
                  scale={image.width / width}
                  selected={item.id === selectedId}
                  draft={
                    item.id === preview?.id &&
                    !project.items.some((saved) => saved.id === item.id)
                  }
                />
              ))}
            </svg>
          </div>
        )}
      </div>
    </main>
  );
}

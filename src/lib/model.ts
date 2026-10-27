import type {
  Annotation,
  AnnotationType,
  DotAnnotation,
  TextAnnotation,
  Project,
  LoadedProject,
  Reading,
  MapImage,
  Position,
  Tool,
  HistoryState,
  HistoryAction,
} from "../types";

export const COLORS: ReadonlyArray<readonly [string, string]> = [
  ["#d8322a", "Red"],
  ["#b87812", "Amber"],
  ["#2f6fd6", "Blue"],
  ["#127a50", "Green"],
  ["#8950b3", "Purple"],
  ["#303c36", "Charcoal"],
];
export const LABELS: Record<AnnotationType, string> = {
  point: "Test point",
  text: "Text annotation",
  arrow: "Arrow",
  pen: "Handwriting",
};
export const SYMBOLS = { text: "T", arrow: "↗", pen: "∿" };
export const TOOL_NAMES: Record<Tool, string> = {
  select: "Select",
  point: "Dot",
  text: "Text",
  arrow: "Arrow",
  pen: "Pen",
};
export const HINTS: Record<Tool, string> = {
  select: "Drag the map to pan. Tap an annotation to edit.",
  point: "Tap the map to place a dot. Tap a dot for readings.",
  text: "Tap to place text.",
  arrow: "Drag from tail to arrowhead.",
  pen: "Draw with a finger, mouse, or stylus.",
};
export const MAX_PIXELS = 24000000;
export const MAX_FILE = 25 * 1024 * 1024;
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const clamp = (v: number, lo = 0, hi = 1) =>
  Math.max(lo, Math.min(hi, v));
export const newId = () =>
  globalThis.crypto?.randomUUID?.() ||
  "a" + Date.now().toString(36) + Math.random().toString(36).slice(2);
export const emptyProject = (): Project => ({
  version: 1,
  title: "",
  image: null,
  items: [],
  nextNumber: 1,
});
export const blankReading = (): Reading => ({ gateway: "", rssi: "", snr: "" });

export function enteredGateways(items: Annotation[]) {
  return [
    ...new Set(
      items
        .filter((item) => item.type === "point")
        .flatMap((item) => item.readings.map((row) => row.gateway.trim()))
        .filter(Boolean),
    ),
  ];
}

export function describe(item: Annotation) {
  return item.type === "point"
    ? `Point ${item.number}: ${item.name || "Unnamed point"}`
    : item.type === "text"
      ? `Text: ${item.text || "Text annotation"}`
      : LABELS[item.type];
}
export function validReading(row: Reading) {
  return (
    !!row.gateway.trim() &&
    row.rssi !== "" &&
    row.snr !== "" &&
    Number.isFinite(Number(row.rssi)) &&
    Number.isFinite(Number(row.snr))
  );
}
export function hasReading(row: Reading) {
  return row.gateway.trim() || row.rssi !== "" || row.snr !== "";
}
export function textLines(text: string) {
  return String(text || "Text annotation")
    .split("\n")
    .flatMap((line) => {
      const chars = Array.from(line);
      if (!chars.length) return [""];
      let lines: string[] = [];
      for (let i = 0; i < chars.length; i += 28)
        lines.push(chars.slice(i, i + 28).join(""));
      return lines;
    });
}
export function arrowHead(points: Position[], width: number): Position[] {
  const [a, b] = points;
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const length = Math.min(
    Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.5,
    width * 5,
  );
  return [
    b,
    [
      b[0] - length * Math.cos(angle - 0.45),
      b[1] - length * Math.sin(angle - 0.45),
    ],
    [
      b[0] - length * Math.cos(angle + 0.45),
      b[1] - length * Math.sin(angle + 0.45),
    ],
  ];
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
export function validateProject(value: unknown): LoadedProject {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.title !== "string" ||
    value.title.length > 160 ||
    !isRecord(value.image) ||
    !Array.isArray(value.items) ||
    value.items.length > 3000
  )
    throw new Error("This is not a supported Floor Plan Annotator project.");
  if (
    typeof value.image.src !== "string" ||
    !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value.image.src) ||
    value.image.src.length > MAX_FILE * 1.5 ||
    typeof value.image.name !== "string"
  )
    throw new Error("The project image is invalid.");
  const ids = new Set<string>(),
    numbers = new Set<number>(),
    coord = (n: unknown): n is number =>
      typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
  const short = (s: unknown, max: number): s is string =>
    typeof s === "string" && s.length <= max;
  const items: unknown[] = value.items;
  for (const item of items) {
    if (
      !isRecord(item) ||
      !short(item.id, 100) ||
      ids.has(item.id) ||
      typeof item.type !== "string" ||
      !Object.hasOwn(LABELS, item.type) ||
      typeof item.color !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(item.color) ||
      typeof item.size !== "number" ||
      !Number.isFinite(item.size) ||
      item.size < 1 ||
      item.size > 6
    )
      throw new Error("The project has an invalid annotation.");
    ids.add(item.id);
    if (item.type === "point" || item.type === "text") {
      if (!coord(item.x) || !coord(item.y))
        throw new Error("The project has an invalid position.");
    } else if (
      !Array.isArray(item.points) ||
      item.points.length < 1 ||
      item.points.length > 3000 ||
      (item.type === "arrow" && item.points.length !== 2) ||
      item.points.some(
        (p) => !Array.isArray(p) || p.length !== 2 || !p.every(coord),
      )
    )
      throw new Error("The project has invalid drawing coordinates.");
    if (item.type === "text" && !short(item.text, 1000))
      throw new Error("Invalid annotation text.");
    if (item.type === "point") {
      if (
        typeof item.number !== "number" ||
        !Number.isInteger(item.number) ||
        item.number < 1 ||
        item.number > 99999 ||
        numbers.has(item.number) ||
        !short(item.name, 120) ||
        !short(item.notes, 2000) ||
        !Array.isArray(item.readings) ||
        item.readings.length > 300
      )
        throw new Error("The project has invalid point details.");
      numbers.add(item.number);
      for (const r of item.readings as unknown[])
        if (
          !isRecord(r) ||
          !short(r.gateway, 160) ||
          !short(r.rssi, 40) ||
          !short(r.snr, 40) ||
          [r.rssi, r.snr].some((v) => v !== "" && !Number.isFinite(Number(v)))
        )
          throw new Error("The project has invalid readings.");
    }
  }
  return {
    version: 1,
    title: value.title,
    image: {
      src: value.image.src,
      name: value.image.name.slice(0, 200),
      width: 1,
      height: 1,
    },
    // The exhaustive checks above establish the annotation union.
    items: clone(items) as Annotation[],
    nextNumber: Math.max(0, ...numbers) + 1,
  };
}
export function measure(item: Annotation, width: number) {
  return item.type === "point"
    ? (width * item.size) / 200
    : item.type === "text"
      ? (width * item.size) / 100
      : (width * item.size) / 600;
}
export function geometry(item: Annotation, image: MapImage) {
  return "points" in item
    ? {
        x: 0,
        y: 0,
        points: item.points.map((p): Position => [
          p[0] * image.width,
          p[1] * image.height,
        ]),
      }
    : {
        x: item.x * image.width,
        y: item.y * image.height,
        points: [] as Position[],
      };
}
export function moveItem<T extends Annotation>(
  item: T,
  dx: number,
  dy: number,
): T {
  if (!("points" in item))
    return { ...item, x: clamp(item.x + dx), y: clamp(item.y + dy) };
  const xs = item.points.map((p) => p[0]),
    ys = item.points.map((p) => p[1]);
  dx = clamp(dx, -Math.min(...xs), 1 - Math.max(...xs));
  dy = clamp(dy, -Math.min(...ys), 1 - Math.max(...ys));
  return {
    ...item,
    points: item.points.map((p): Position => [p[0] + dx, p[1] + dy]),
  };
}
export function createItem(
  type: "point",
  position: Position,
  color: string,
  size: number,
  number: number,
): DotAnnotation;
export function createItem(
  type: "text",
  position: Position,
  color: string,
  size: number,
  number: number,
): TextAnnotation;
export function createItem(
  type: "point" | "text",
  position: Position,
  color: string,
  size: number,
  number: number,
): DotAnnotation | TextAnnotation;
export function createItem(
  type: "point" | "text",
  position: Position,
  color: string,
  size: number,
  number: number,
): DotAnnotation | TextAnnotation {
  const base = { id: newId(), color, size, x: position[0], y: position[1] };
  return type === "point"
    ? { ...base, type, number, name: "", notes: "", readings: [blankReading()] }
    : { ...base, type, text: "Text annotation" };
}
export function historyReducer(
  state: HistoryState,
  action: HistoryAction,
): HistoryState {
  switch (action.type) {
    case "load":
      return { present: action.project, past: [], future: [] };
    case "commit":
      return {
        present: action.project,
        past: [...state.past, state.present].slice(-40),
        future: [],
      };
    case "undo":
      return state.past.length
        ? {
            present: state.past[state.past.length - 1],
            past: state.past.slice(0, -1),
            future: [state.present, ...state.future],
          }
        : state;
    case "redo":
      return state.future.length
        ? {
            present: state.future[0],
            past: [...state.past, state.present].slice(-40),
            future: state.future.slice(1),
          }
        : state;
    default:
      return state;
  }
}

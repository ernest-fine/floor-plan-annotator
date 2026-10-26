export const COLORS = [
  ["#d8322a", "Red"],
  ["#b87812", "Amber"],
  ["#2f6fd6", "Blue"],
  ["#127a50", "Green"],
  ["#8950b3", "Purple"],
  ["#303c36", "Charcoal"],
];
export const LABELS = {
  point: "Test point",
  text: "Text annotation",
  arrow: "Arrow",
  pen: "Handwriting",
};
export const SYMBOLS = { text: "T", arrow: "↗", pen: "∿" };
export const TOOL_NAMES = {
  select: "Select",
  point: "Dot",
  text: "Text",
  arrow: "Arrow",
  pen: "Pen",
};
export const HINTS = {
  select: "Drag the map to pan. Tap an annotation to edit.",
  point: "Tap the map to place a dot. Tap a dot for readings.",
  text: "Tap to place text.",
  arrow: "Drag from tail to arrowhead.",
  pen: "Draw with a finger, mouse, or stylus.",
};
export const MAX_PIXELS = 24000000;
export const MAX_FILE = 25 * 1024 * 1024;
export const clone = (value) => JSON.parse(JSON.stringify(value));
export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const newId = () =>
  globalThis.crypto?.randomUUID?.() ||
  "a" + Date.now().toString(36) + Math.random().toString(36).slice(2);
export const emptyProject = () => ({
  version: 1,
  title: "",
  image: null,
  items: [],
  nextNumber: 1,
});
export const blankReading = () => ({ gateway: "", rssi: "", snr: "" });

export function describe(item) {
  return item.type === "point"
    ? `Point ${item.number}: ${item.name || "Unnamed point"}`
    : item.type === "text"
      ? `Text: ${item.text || "Text annotation"}`
      : LABELS[item.type];
}
export function validReading(row) {
  return (
    !!row.gateway.trim() &&
    row.rssi !== "" &&
    row.snr !== "" &&
    Number.isFinite(Number(row.rssi)) &&
    Number.isFinite(Number(row.snr))
  );
}
export function hasReading(row) {
  return row.gateway.trim() || row.rssi !== "" || row.snr !== "";
}
export function textLines(text) {
  return String(text || "Text annotation")
    .split("\n")
    .flatMap((line) => {
      const chars = Array.from(line);
      if (!chars.length) return [""];
      let lines = [];
      for (let i = 0; i < chars.length; i += 28)
        lines.push(chars.slice(i, i + 28).join(""));
      return lines;
    });
}
export function arrowHead(points, width) {
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
export function validateProject(value) {
  if (
    !value ||
    value.version !== 1 ||
    typeof value.title !== "string" ||
    value.title.length > 160 ||
    !value.image ||
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
  const ids = new Set(),
    numbers = new Set(),
    coord = (n) =>
      typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
  const short = (s, max) => typeof s === "string" && s.length <= max;
  for (const item of value.items) {
    if (
      !item ||
      !short(item.id, 100) ||
      ids.has(item.id) ||
      !Object.hasOwn(LABELS, item.type) ||
      !/^#[0-9a-f]{6}$/i.test(item.color) ||
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
      for (const r of item.readings)
        if (
          !r ||
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
    items: clone(value.items),
    nextNumber: Math.max(0, ...numbers) + 1,
  };
}
export function measure(item, width) {
  return item.type === "point"
    ? (width * item.size) / 200
    : item.type === "text"
      ? (width * item.size) / 100
      : (width * item.size) / 600;
}
export function geometry(item, image) {
  return {
    x: item.x * image.width,
    y: item.y * image.height,
    points: item.points?.map((p) => [p[0] * image.width, p[1] * image.height]),
  };
}
export function moveItem(item, dx, dy) {
  if (!item.points)
    return { ...item, x: clamp(item.x + dx), y: clamp(item.y + dy) };
  const xs = item.points.map((p) => p[0]),
    ys = item.points.map((p) => p[1]);
  dx = clamp(dx, -Math.min(...xs), 1 - Math.max(...xs));
  dy = clamp(dy, -Math.min(...ys), 1 - Math.max(...ys));
  return { ...item, points: item.points.map((p) => [p[0] + dx, p[1] + dy]) };
}
export function createItem(type, position, color, size, number) {
  return {
    id: newId(),
    type,
    color,
    size,
    x: position[0],
    y: position[1],
    ...(type === "point"
      ? { number, name: "", notes: "", readings: [blankReading()] }
      : { text: "Text annotation" }),
  };
}
export function historyReducer(state, action) {
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
            present: state.past.at(-1),
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

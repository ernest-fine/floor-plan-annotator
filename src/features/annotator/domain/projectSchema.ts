import type { Annotation, AnnotationType, DotAnnotation, TextAnnotation, Project, LoadedProject, Reading, MapImage, Position, HistoryState, HistoryAction } from "./types";
import {MAX_PIXELS, MAX_FILE} from "./limits";
const ANNOTATION_TYPES = {point:true,text:true,arrow:true,pen:true};
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

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
      !Object.hasOwn(ANNOTATION_TYPES, item.type) ||
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

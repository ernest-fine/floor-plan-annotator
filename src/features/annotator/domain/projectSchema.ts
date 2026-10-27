import { isSignalDraft } from "./signalReadings";
import type { Annotation, LoadedProject } from "./types";
import { MAX_FILE, MAX_SIGNAL_LENGTH } from "./limits";
const ANNOTATION_TYPES = {
  point: true,
  text: true,
  arrow: true,
  pen: true,
  gateway: true,
};
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validStoredSignal(value: string): boolean {
  // Imports preserve valid numeric representations written by older versions;
  // new entry is restricted to plain decimal drafts by the command/input boundary.
  return (
    isSignalDraft(value) ||
    (value.length <= MAX_SIGNAL_LENGTH &&
      value.trim() !== "" &&
      Number.isFinite(Number(value)))
  );
}
export function validateProject(value: unknown): LoadedProject {
  if (
    !isRecord(value) ||
    (value.version !== 1 && value.version !== 2) ||
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
    gatewayNumbers = new Set<number>(),
    gatewayNames = new Set<string>(),
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
    if (
      item.type === "point" ||
      item.type === "text" ||
      item.type === "gateway"
    ) {
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
    if (item.type === "point" || item.type === "gateway") {
      const serials = item.type === "point" ? numbers : gatewayNumbers;
      if (
        typeof item.number !== "number" ||
        !Number.isInteger(item.number) ||
        item.number < 1 ||
        item.number > 99999 ||
        serials.has(item.number) ||
        !short(item.name, item.type === "gateway" ? 160 : 120) ||
        !short(item.notes, 2000)
      )
        throw new Error("The project has invalid point details.");
      serials.add(item.number);
      if (item.type === "gateway") {
        if (value.version === 1)
          throw new Error("Gateway pins require project version two.");
        const name = item.name.trim().toLowerCase();
        if (name && gatewayNames.has(name))
          throw new Error("Gateway names must be unique.");
        if (name) gatewayNames.add(name);
      } else {
        if (!Array.isArray(item.readings) || item.readings.length > 300)
          throw new Error("The project has invalid readings.");
        for (const reading of item.readings as unknown[]) {
          if (
            !isRecord(reading) ||
            !short(reading.gateway, 160) ||
            !short(reading.rssi, MAX_SIGNAL_LENGTH) ||
            !short(reading.snr, MAX_SIGNAL_LENGTH) ||
            (reading.gatewayId !== undefined &&
              (!short(reading.gatewayId, 100) || !reading.gatewayId))
          )
            throw new Error("The project has invalid readings.");
          if (value.version === 1) {
            if (
              [reading.rssi, reading.snr].some(
                (value) => value !== "" && !Number.isFinite(Number(value)),
              )
            )
              throw new Error("The project has invalid readings.");
          } else if (
            !validStoredSignal(reading.rssi) ||
            !validStoredSignal(reading.snr)
          )
            throw new Error("The project has invalid readings.");
        }
      }
    }
  }
  const annotations = clone(items) as Annotation[];

  return {
    version: 2,
    title: value.title,
    image: {
      src: value.image.src,
      name: value.image.name.slice(0, 200),
      width: 1,
      height: 1,
    },
    // The exhaustive checks above establish the annotation union.
    items: annotations,
    nextNumber: Math.max(0, ...numbers) + 1,
  };
}

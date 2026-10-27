import type { GatewayAnnotation } from "./types";
import type {
  Annotation,
  DotAnnotation,
  TextAnnotation,
  Project,
  Position,
} from "./types";
import { newId } from "@/shared/lib/id";
import { blankReading } from "./signalReadings";
export const emptyProject = (): Project => ({
  version: 2,
  title: "",
  image: null,
  items: [],
  nextNumber: 1,
});

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
  type: "gateway",
  position: Position,
  color: string,
  size: number,
  number: number,
): GatewayAnnotation;
export function createItem(
  type: "point" | "text" | "gateway",
  position: Position,
  color: string,
  size: number,
  number: number,
): DotAnnotation | TextAnnotation | GatewayAnnotation;
export function createItem(
  type: "point" | "text" | "gateway",
  position: Position,
  color: string,
  size: number,
  number: number,
): DotAnnotation | TextAnnotation | GatewayAnnotation {
  const base = { id: newId(), color, size, x: position[0], y: position[1] };
  if (type === "point")
    return {
      ...base,
      type,
      number,
      name: "",
      notes: "",
      readings: [blankReading()],
    };
  if (type === "gateway")
    return { ...base, type, number, name: "Gateway " + number, notes: "" };
  return { ...base, type, text: "Text annotation" };
}
export function createPlacedAnnotation(
  project: Project,
  type: "point" | "text" | "gateway",
  position: Position,
  color: string,
  size: number,
): Annotation {
  if (type !== "gateway")
    return createItem(type, position, color, size, project.nextNumber);
  const gateways = project.items.filter(
    (item): item is GatewayAnnotation => item.type === "gateway",
  );
  const number = Math.max(0, ...gateways.map((gateway) => gateway.number)) + 1;
  const annotation = createItem("gateway", position, color, size, number);
  const names = new Set(
    gateways.map((gateway) => gateway.name.trim().toLowerCase()),
  );
  let suffix = 2;
  while (names.has(annotation.name.toLowerCase()))
    annotation.name = "Gateway " + number + " (" + suffix++ + ")";
  return annotation;
}

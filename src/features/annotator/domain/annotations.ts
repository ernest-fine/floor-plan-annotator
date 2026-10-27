import type { Annotation, AnnotationType, DotAnnotation, TextAnnotation, Project, LoadedProject, Reading, MapImage, Position, HistoryState, HistoryAction } from "./types";
import {newId} from "@/shared/lib/id";
import {blankReading} from "./signalReadings";
export const emptyProject = (): Project => ({
  version: 1,
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

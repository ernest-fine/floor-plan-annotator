import type { Annotation, AnnotationType, DotAnnotation, TextAnnotation, Project, LoadedProject, Reading, MapImage, Position, HistoryState, HistoryAction } from "./types";
export function describe(item: Annotation) {
  return item.type === "point"
    ? `Point ${item.number}: ${item.name || "Unnamed point"}`
    : item.type === "text"
      ? `Text: ${item.text || "Text annotation"}`
      : ({arrow:"Arrow",pen:"Handwriting"} as const)[item.type];
}

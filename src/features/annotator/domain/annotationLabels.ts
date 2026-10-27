import type { Annotation } from "./types";
export function describe(item: Annotation) {
  if (item.type === "gateway")
    return `Gateway G${item.number}: ${item.name || "Unnamed gateway"}`;
  return item.type === "point"
    ? `Point ${item.number}: ${item.name || "Unnamed point"}`
    : item.type === "text"
      ? `Text: ${item.text || "Text annotation"}`
      : ({ arrow: "Arrow", pen: "Handwriting" } as const)[item.type];
}

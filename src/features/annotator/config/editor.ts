import type { AnnotationType } from "../domain/types";
import type { Tool } from "../types/editor";
export const COLORS: ReadonlyArray<readonly [string, string]> = [
  ["#d8322a", "Red"],
  ["#b87812", "Amber"],
  ["#2f6fd6", "Blue"],
  ["#127a50", "Green"],
  ["#8950b3", "Purple"],
  ["#303c36", "Charcoal"],
];

export const LABELS: Record<AnnotationType, string> = {
  gateway: "Gateway",
  point: "Test point",
  text: "Text annotation",
  arrow: "Arrow",
  pen: "Handwriting",
};

export const SYMBOLS = { gateway: "G", text: "T", arrow: "↗", pen: "∿" };

export const TOOL_NAMES: Record<Tool, string> = {
  gateway: "Gateway",
  select: "Select",
  point: "Dot",
  text: "Text",
  arrow: "Arrow",
  pen: "Pen",
};

export const HINTS: Record<Tool, string> = {
  gateway: "Tap to place a gateway pin. Name it before entering readings.",
  select: "Drag the map to pan. Tap an annotation to edit.",
  point: "Tap the map to place a dot. Tap a dot for readings.",
  text: "Tap to place text.",
  arrow: "Drag from tail to arrowhead.",
  pen: "Draw with a finger, mouse, or stylus.",
};

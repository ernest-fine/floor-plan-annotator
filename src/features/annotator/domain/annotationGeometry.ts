import type { Annotation, AnnotationType, DotAnnotation, TextAnnotation, Project, LoadedProject, Reading, MapImage, Position, HistoryState, HistoryAction } from "./types";
import {clamp} from "@/shared/lib/math";
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

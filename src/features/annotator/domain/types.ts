export type Position = [number, number];
export type AnnotationType = "point" | "text" | "arrow" | "pen" | "gateway";
export interface Reading {
  gateway: string;
  gatewayId?: string;
  rssi: string;
  snr: string;
}
export interface MapImage {
  src: string;
  name: string;
  width: number;
  height: number;
}
interface AnnotationBase {
  id: string;
  color: string;
  size: number;
}
export interface DotAnnotation extends AnnotationBase {
  type: "point";
  x: number;
  y: number;
  number: number;
  name: string;
  notes: string;
  readings: Reading[];
}
export interface TextAnnotation extends AnnotationBase {
  type: "text";
  x: number;
  y: number;
  text: string;
}
export interface DrawingAnnotation extends AnnotationBase {
  type: "arrow" | "pen";
  points: Position[];
}
export interface GatewayAnnotation extends AnnotationBase {
  type: "gateway";
  x: number;
  y: number;
  number: number;
  name: string;
  notes: string;
}
export type Annotation =
  DotAnnotation | TextAnnotation | DrawingAnnotation | GatewayAnnotation;
export type ReadingUpdate = Partial<
  Pick<Reading, "gatewayId" | "rssi" | "snr">
>;
export interface AnnotationPatch {
  name?: string;
  notes?: string;
  text?: string;
  color?: string;
  size?: number;
}
export interface Project {
  version: 2;
  title: string;
  image: MapImage | null;
  items: Annotation[];
  nextNumber: number;
}
export type LoadedProject = Project & { image: MapImage };
export interface HistoryState {
  present: Project;
  past: Project[];
  future: Project[];
}
export type HistoryAction =
  { type: "load" | "commit"; project: Project } | { type: "undo" | "redo" };

export type Position = [number, number];
export type AnnotationType = "point" | "text" | "arrow" | "pen";
export interface Reading {
  gateway: string;
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
export type Annotation = DotAnnotation | TextAnnotation | DrawingAnnotation;
export interface AnnotationPatch {
  name?: string;
  notes?: string;
  text?: string;
  color?: string;
  size?: number;
  readings?: Reading[];
}
export interface Project {
  version: 1;
  title: string;
  image: MapImage | null;
  items: Annotation[];
  nextNumber: number;
}
export type LoadedProject = Project & { image: MapImage };
export type ProjectUpdate = Project | ((project: Project) => Project);
export interface HistoryState {
  present: Project;
  past: Project[];
  future: Project[];
}
export type HistoryAction =
  { type: "load" | "commit"; project: Project } | { type: "undo" | "redo" };

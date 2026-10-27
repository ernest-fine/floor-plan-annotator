import type { Ref } from "react";
import type { Annotation, Project } from "../domain/types";
import type { Tool } from "./editor";
export interface MapCanvasHandle {
  zoomBy(delta: number): void;
  fit(): void;
  cancel(): void;
  reveal(item: Annotation): void;
}
export interface MapCanvasProps {
  ref?: Ref<MapCanvasHandle>;
  project: Project;
  selectedId: string | null;
  tool: Tool;
  color: string;
  size: number;
  busy: boolean;
  onAdd(item: Annotation): void;
  onMove(item: Annotation): void;
  onSelect(id: string | null, open: boolean): void;
  onInteract(): void;
  onUpload(file: File | undefined): void;
  onChooseImage(): void;
  onZoom(zoom: number): void;
}

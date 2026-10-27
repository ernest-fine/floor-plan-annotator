import type {Project} from "../domain/types";
export function fileBase(project: Pick<Project, "title" | "image">) {
  return (
    (project.title || project.image?.name || "floor-map")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .slice(0, 100) || "floor-map"
  );
}

import { useRef } from "react";
import type { Notify } from "@/shared/types/notice";
import { download } from "@/shared/lib/download";
import { fileBase } from "../io/projectFileName";
import { projectFromFile, projectFromImage } from "../io/projectFiles";
import type { ProjectDocument } from "./useProjectDocument";
export default function useProjectFiles(
  document: ProjectDocument,
  notify: Notify,
  onImported: () => void,
  onClose: () => void,
  busy: boolean,
) {
  const imageInput = useRef<HTMLInputElement>(null),
    projectInput = useRef<HTMLInputElement>(null),
    requests = useRef(0);
  async function importFile(file: File | undefined, kind: "image" | "project") {
    if (!file || busy) return;
    const request = ++requests.current;
    document.beginImport();
    try {
      const next = await (kind === "project"
        ? projectFromFile(file)
        : projectFromImage(file));
      if (request !== requests.current) return;
      if (
        document.getProject().image &&
        !confirm(
          "Replace the current map and annotations? Save project first if you need a backup.",
        )
      )
        return;
      document.load(next);
      onImported();
      notify(kind === "project" ? "Project loaded." : "Map loaded.");
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), true);
    }
  }
  function save() {
    const project = document.getProject();
    if (!project.image) return;
    download(
      new Blob([JSON.stringify(project)], { type: "application/json" }),
      fileBase(project) + ".floor-map.json",
    );
    notify("Project JSON downloaded.");
    onClose();
  }
  return {
    imageInput,
    projectInput,
    upload: (file: File | undefined) => importFile(file, "image"),
    open: (file: File | undefined) => importFile(file, "project"),
    save,
    chooseImage: () => {
      onClose();
      imageInput.current?.click();
    },
    chooseProject: () => {
      onClose();
      projectInput.current?.click();
    },
  };
}

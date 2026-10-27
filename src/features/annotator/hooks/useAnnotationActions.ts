import type {
  Annotation,
  AnnotationPatch,
  ReadingUpdate,
} from "../domain/types";
import type { Notify } from "@/shared/types/notice";
import type { ProjectDocument } from "./useProjectDocument";
import type useEditorState from "./useEditorState";
export default function useAnnotationActions(
  document: ProjectDocument,
  ui: ReturnType<typeof useEditorState>,
  notify: Notify,
) {
  const item = document.project.items.find((item) => item.id === ui.selectedId);
  function add(annotation: Annotation) {
    if (document.getProject().items.length >= 3000) {
      notify("Annotation limit: 3000.", true);
      return;
    }
    document.execute({ type: "annotation.add", annotation });
    ui.added(annotation);
  }
  function update(patch: AnnotationPatch) {
    if (item)
      try {
        document.execute({ type: "annotation.update", id: item.id, patch });
      } catch (error) {
        notify(error instanceof Error ? error.message : String(error), true);
      }
  }
  function remove() {
    if (!item) return;
    document.execute({ type: "annotation.remove", id: item.id });
    ui.select(null);
  }
  function clear() {
    if (confirm("Clear all annotations and readings? You can undo this.")) {
      document.execute({ type: "annotations.clear" });
      ui.setSelectedId(null);
    }
  }
  function readingAction(
    command: import("../domain/projectCommands").ProjectCommand,
  ) {
    try {
      document.execute(command);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), true);
    }
  }
  const readings = {
    add: (gatewayId: string) => {
      if (item?.type === "point")
        readingAction({ type: "reading.add", pointId: item.id, gatewayId });
    },
    update: (index: number, patch: ReadingUpdate) => {
      if (item?.type === "point")
        readingAction({
          type: "reading.update",
          pointId: item.id,
          index,
          patch,
        });
    },
    remove: (index: number) => {
      if (item?.type === "point")
        readingAction({ type: "reading.remove", pointId: item.id, index });
    },
  };
  return {
    item,
    add,
    update,
    remove,
    clear,
    readings,
    move: (annotation: Annotation) =>
      document.execute({ type: "annotation.move", annotation }),
    title: (title: string) => document.execute({ type: "title.set", title }),
  };
}

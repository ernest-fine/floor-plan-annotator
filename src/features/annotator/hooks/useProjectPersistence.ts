import { useEffect, useState } from "react";
import type { Notify } from "@/shared/types/notice";
import type { ProjectDocument } from "./useProjectDocument";
import { isRecord } from "../domain/projectSchema";
import { restoreProject } from "../io/projectFiles";
import {
  readSavedProject,
  saveProjectLocally,
} from "../persistence/projectRepository";
export default function useProjectPersistence(
  { project, getProject, getRevision, load }: ProjectDocument,
  notify: Notify,
) {
  const [ready, setReady] = useState(false),
    [saveStatus, setSaveStatus] = useState("Local files only"),
    [storageError, setStorageError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await readSavedProject();
        if (isRecord(saved) && saved.image && active && getRevision() === 0) {
          const restored = await restoreProject(saved);
          if (active && getRevision() === 0) {
            load(restored);
            notify("Previous project restored.");
          }
        }
      } catch {
        if (active) {
          setStorageError(true);
          setSaveStatus("Save a project backup");
        }
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [notify, getRevision, load]);
  useEffect(() => {
    if (!ready || !project.image) return;
    let active = true;
    setSaveStatus("Saving on this device…");
    const timer = setTimeout(async () => {
      try {
        await saveProjectLocally(project);
        if (active) {
          setSaveStatus("Saved in this browser");
          setStorageError(false);
        }
      } catch {
        if (active) {
          setStorageError(true);
          setSaveStatus("Autosave failed · save a project backup");
        }
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [ready, project]);
  useEffect(() => {
    const save = () => {
      if (getProject().image) saveProjectLocally(getProject()).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") save();
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [getProject]);
  return { saveStatus, storageError };
}

import type {Project,ProjectUpdate,HistoryState} from "../domain/types";
import type {Notify} from "@/shared/types/notice";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {emptyProject} from "../domain/annotations";
import {historyReducer} from "../domain/documentReducer";
import {isRecord} from "../domain/projectSchema";
import { restoreProject } from "../io/projectFiles";
import { readSavedProject, saveProjectLocally } from "../persistence/projectRepository";

export default function useProject(notify: Notify) {
  const [state, dispatch] = useReducer(
    historyReducer,
    null,
    (): HistoryState => ({
      present: emptyProject(),
      past: [],
      future: [],
    }),
  );
  const current = useRef(state.present),
    revision = useRef(0);
  const [ready, setReady] = useState(false),
    [saveStatus, setSaveStatus] = useState("Local files only"),
    [storageError, setStorageError] = useState(false);
  current.current = state.present;
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await readSavedProject();
        if (
          isRecord(saved) &&
          saved.image &&
          active &&
          revision.current === 0
        ) {
          const restored = await restoreProject(saved);
          if (active && revision.current === 0) {
            current.current = restored;
            dispatch({ type: "load", project: restored });
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
  }, [notify]);
  useEffect(() => {
    if (!ready || !state.present.image) return;
    let active = true;
    setSaveStatus("Saving on this device…");
    const timer = setTimeout(async () => {
      try {
        await saveProjectLocally(state.present);
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
  }, [ready, state.present]);
  useEffect(() => {
    const save = () => {
      if (current.current.image)
        saveProjectLocally(current.current).catch(() => {});
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
  }, []);
  const commit = useCallback((update: ProjectUpdate) => {
    revision.current++;
    const next =
      typeof update === "function" ? update(current.current) : update;
    current.current = next;
    dispatch({ type: "commit", project: next });
  }, []);
  const load = useCallback((project: Project) => {
    revision.current++;
    current.current = project;
    dispatch({ type: "load", project });
  }, []);
  return {
    project: state.present,
    commit,
    load,
    revision,
    saveStatus,
    storageError,
    canUndo: !!state.past.length,
    canRedo: !!state.future.length,
    undo: () => {
      revision.current++;
      dispatch({ type: "undo" });
    },
    redo: () => {
      revision.current++;
      dispatch({ type: "redo" });
    },
  };
}

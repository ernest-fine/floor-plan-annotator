import { useCallback, useReducer, useRef } from "react";
import type { HistoryState, Project } from "../domain/types";
import { emptyProject } from "../domain/annotations";
import { historyReducer } from "../domain/documentReducer";
import {
  applyProjectCommand,
  type ProjectCommand,
} from "../domain/projectCommands";
export default function useProjectDocument() {
  const [state, dispatch] = useReducer(
    historyReducer,
    null,
    (): HistoryState => ({ present: emptyProject(), past: [], future: [] }),
  );
  const current = useRef(state.present),
    revision = useRef(0);
  current.current = state.present;
  const getProject = useCallback(() => current.current, []);
  const getRevision = useCallback(() => revision.current, []);
  const beginImport = useCallback(() => {
    revision.current++;
  }, []);
  const execute = useCallback((command: ProjectCommand) => {
    revision.current++;
    const project = applyProjectCommand(current.current, command);
    current.current = project;
    dispatch({ type: "commit", project });
  }, []);
  const load = useCallback((project: Project) => {
    revision.current++;
    current.current = project;
    dispatch({ type: "load", project });
  }, []);
  const undo = useCallback(() => {
    revision.current++;
    dispatch({ type: "undo" });
  }, []);
  const redo = useCallback(() => {
    revision.current++;
    dispatch({ type: "redo" });
  }, []);
  return {
    project: state.present,
    getProject,
    getRevision,
    beginImport,
    execute,
    load,
    undo,
    redo,
    canUndo: !!state.past.length,
    canRedo: !!state.future.length,
  };
}
export type ProjectDocument = ReturnType<typeof useProjectDocument>;

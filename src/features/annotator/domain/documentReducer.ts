import type { HistoryState, HistoryAction } from "./types";
export function historyReducer(
  state: HistoryState,
  action: HistoryAction,
): HistoryState {
  switch (action.type) {
    case "load":
      return { present: action.project, past: [], future: [] };
    case "commit":
      return {
        present: action.project,
        past: [...state.past, state.present].slice(-40),
        future: [],
      };
    case "undo":
      return state.past.length
        ? {
            present: state.past[state.past.length - 1],
            past: state.past.slice(0, -1),
            future: [state.present, ...state.future],
          }
        : state;
    case "redo":
      return state.future.length
        ? {
            present: state.future[0],
            past: [...state.past, state.present].slice(-40),
            future: state.future.slice(1),
          }
        : state;
    default:
      return state;
  }
}

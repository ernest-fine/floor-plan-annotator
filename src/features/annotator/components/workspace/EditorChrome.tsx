import type {RefObject} from "react";
import type {MapCanvasHandle} from "../../types/map";
import type useEditorState from "../../hooks/useEditorState";
import ZoomControls,{type ZoomControlsHandle} from "../map/ZoomControls";
import {TOOL_NAMES} from "../../config/editor";
interface ChromeProps {ui:ReturnType<typeof useEditorState>;map:RefObject<MapCanvasHandle|null>;zoomControls:RefObject<ZoomControlsHandle|null>;count:number;hasImage:boolean;hasSelection:boolean;busy:boolean;canUndo:boolean;canRedo:boolean;onUndo:()=>void;onRedo:()=>void}
export default function EditorChrome({ui,map,zoomControls,count,hasImage,hasSelection,busy,canUndo,canRedo,onUndo,onRedo}:ChromeProps){
 const {panel,hidden,tool,toggle,close,setHidden}=ui;
 return <>      <div className="top-controls chrome">
        <button
          id="files-toggle"
          aria-expanded={panel === "files"}
          aria-controls="file-actions"
          onClick={() => toggle("files")}
        >
          Files ▾
        </button>
        <button
          id="tools-toggle"
          aria-expanded={panel === "tools"}
          aria-controls="tool-panel"
          onClick={() => toggle("tools")}
        >
          {TOOL_NAMES[tool]} ▾
        </button>
        <button
          id="mobile-list"
          aria-expanded={panel === "list"}
          aria-controls="annotation-list-panel"
          onClick={() => toggle("list")}
        >
          Annotations <span id="mobile-count">{count}</span>
        </button>
      </div>
      <div
        className="history-controls chrome"
        role="group"
        aria-label="Edit history"
      >
        <button
          id="undo"
          aria-label="Undo"
          title="Undo (Ctrl/⌘ Z)"
          disabled={!canUndo || busy}
          onClick={onUndo}
        >
          ↶
        </button>
        <button
          id="redo"
          aria-label="Redo"
          title="Redo (Ctrl/⌘ Shift Z)"
          disabled={!canRedo || busy}
          onClick={onRedo}
        >
          ↷
        </button>
      </div>
      <div className="bottom-left chrome">
        <button
          id="export-toggle"
          aria-expanded={panel === "export"}
          aria-controls="export-panel"
          onClick={() => toggle("export")}
        >
          Export ▴
        </button>
      </div>
      <button
        id="mobile-details"
        className="details-toggle chrome"
        disabled={!hasSelection}
        aria-expanded={panel === "details"}
        aria-controls="details-panel"
        onClick={() => toggle("details")}
      >
        Details
      </button>
      <ZoomControls ref={zoomControls} map={map} disabled={!hasImage} />
      <button
        id="hide-controls"
        className="hide-toggle chrome"
        onClick={() => {
          close();
          setHidden(true);
        }}
      >
        Hide controls
      </button>
      {hidden && (
        <button id="show-controls" onClick={() => setHidden(false)}>
          Show controls
        </button>
      )}
</>;
}

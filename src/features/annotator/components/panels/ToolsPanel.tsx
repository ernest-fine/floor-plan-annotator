import type { CSSProperties } from "react";
import {useEffect,useRef} from "react";
import type {Annotation,AnnotationPatch,Project,Reading,Position} from "../../domain/types";
import type {Tool} from "../../types/editor";
import {blankReading,validReading,hasReading} from "../../domain/signalReadings";
import {COLORS,HINTS,LABELS,SYMBOLS,TOOL_NAMES} from "../../config/editor";
import FloatingPanel from "@/shared/ui/FloatingPanel";
const ICONS: Record<Tool, string> = {
  select: "m5 3 14 10-7 1-3 7-4-18Z",
  point: "M12 2v3m0 14v3M2 12h3m14 0h3",
  text: "M4 6V4h16v2M12 4v16m-4 0h8",
  arrow: "M4 20 20 4M7 4h13v13",
  pen: "m14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Zm0 0-1 1",
};
export function ToolsPanel({
  tool,
  onTool,
  color,
  onColor,
  size,
  onSize,
  onClose,
}: {
  tool: Tool;
  onTool: (tool: Tool) => void;
  color: string;
  onColor: (color: string) => void;
  size: number;
  onSize: (size: number) => void;
  onClose: () => void;
}) {
  return (
    <FloatingPanel
      id="tool-panel"
      className="chrome"
      title="Tools"
      closeLabel="tools"
      onClose={onClose}
    >
      <div className="tools" role="group" aria-label="Annotation tools">
        {(Object.entries(TOOL_NAMES) as [Tool, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              className="tool"
              data-tool={key}
              aria-pressed={tool === key}
              onClick={() => onTool(key)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d={ICONS[key]} />
                {key === "point" && <circle cx="12" cy="12" r="6" />}
              </svg>
              {label}
            </button>
          ),
        )}
      </div>
      <div className="settings">
        <span className="small muted">Color</span>
        <div
          id="colors"
          className="colors"
          role="group"
          aria-label="Annotation color"
        >
          {COLORS.map(([value, label]) => (
            <button
              key={value}
              className="swatch"
              style={{ "--swatch": value } as CSSProperties}
              aria-label={label}
              aria-pressed={value === color}
              onClick={() => onColor(value)}
            />
          ))}
        </div>
        <input
          id="custom-color"
          type="color"
          className="custom-color"
          aria-label="Custom annotation color"
          value={color}
          onChange={(event) => onColor(event.target.value)}
        />
        <label className="size-control">
          Size
          <input
            id="tool-size"
            type="range"
            min="1"
            max="6"
            step=".2"
            value={size}
            onChange={(event) => onSize(Number(event.target.value))}
          />
          <output id="size-label">{size}</output>
        </label>
      </div>
      <div className="map-footer">
        <span id="tool-hint">{HINTS[tool]}</span>
      </div>
      <details className="help">
        <summary>Controls &amp; shortcuts</summary>
        <p>
          Pinch with two fingers to zoom in any tool. Select: drag to pan or
          move annotations. Dot / Text: tap to place. Arrow / Pen: drag to draw.
        </p>
        <p>
          V Select · D Dot · T Text · A Arrow · P Pen · Delete removes selected
          · Ctrl/⌘ Z Undo · Ctrl/⌘ Shift Z Redo. Focus an annotation and use
          arrow keys to move it.
        </p>
        <p>
          Manual readings. Colors have no automatic signal grading. Project JSON
          includes the map and annotations.
        </p>
      </details>
    </FloatingPanel>
  );
}

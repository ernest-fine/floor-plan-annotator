import type { CSSProperties } from "react";
import {useEffect,useRef} from "react";
import type {Annotation,AnnotationPatch,Project,Reading,Position} from "../../domain/types";
import type {Tool} from "../../types/editor";
import {blankReading,validReading,hasReading} from "../../domain/signalReadings";
import {COLORS,HINTS,LABELS,SYMBOLS,TOOL_NAMES} from "../../config/editor";
import FloatingPanel from "@/shared/ui/FloatingPanel";
export function AnnotationList({
  items,
  selectedId,
  onSelect,
  onClear,
  onClose,
}: {
  items: Annotation[];
  selectedId: string | null;
  onSelect: (item: Annotation) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  // @profile:list-renders
  return (
    <FloatingPanel
      id="annotation-list-panel"
      className="list-panel"
      title="Annotations"
      closeLabel="annotation list"
      onClose={onClose}
      actions={
        <span id="list-count" className="count">
          {items.length}
        </span>
      }
    >
      <div id="item-list" className="item-list">
        {!items.length ? (
          <p className="small muted" style={{ padding: 10 }}>
            No annotations.
          </p>
        ) : (
          items.map((item) => {
            const complete =
              item.type === "point"
                ? item.readings.filter(validReading).length
                : 0;
            const partial =
              item.type === "point"
                ? item.readings.filter(
                    (row) => hasReading(row) && !validReading(row),
                  ).length
                : 0;
            return (
              <button
                key={item.id}
                className="item-row"
                aria-pressed={item.id === selectedId}
                onClick={() => onSelect(item)}
              >
                <span className="dot-chip" style={{ background: item.color }}>
                  {item.type === "point" ? item.number : SYMBOLS[item.type]}
                </span>
                <span className="label">
                  <strong>
                    {item.type === "point"
                      ? item.name || "Point " + item.number
                      : item.type === "text"
                        ? item.text || "Text annotation"
                        : LABELS[item.type]}
                  </strong>
                  <small>
                    {item.type === "point"
                      ? `${complete} complete reading${complete === 1 ? "" : "s"}${partial ? " · " + partial + " partial" : ""}`
                      : LABELS[item.type]}
                  </small>
                </span>
              </button>
            );
          })
        )}
      </div>
      <div className="section">
        <button
          id="clear-all"
          className="quiet danger"
          disabled={!items.length}
          onClick={onClear}
        >
          Clear annotations
        </button>
      </div>
    </FloatingPanel>
  );
}

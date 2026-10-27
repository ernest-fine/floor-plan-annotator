import SignalReadings from "./SignalReadings";
import Button from "@/shared/ui/Button";
import Field from "@/shared/ui/Field";
import type { CSSProperties } from "react";
import {useEffect,useRef} from "react";
import type {Annotation,AnnotationPatch,Project,Reading,Position} from "../../domain/types";
import type {Tool} from "../../types/editor";
import {blankReading,validReading,hasReading} from "../../domain/signalReadings";
import {COLORS,HINTS,LABELS,SYMBOLS,TOOL_NAMES} from "../../config/editor";
import FloatingPanel from "@/shared/ui/FloatingPanel";
export function AnnotationDetails({
  item,
  gatewayNames = [],
  open,
  onUpdate,
  onDelete,
  onClose,
}: {
  item: Annotation | undefined;
  gatewayNames?: string[];
  open: boolean;
  onUpdate: (patch: AnnotationPatch) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const text = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (open && item?.type === "text") {
      text.current?.focus();
      text.current?.select();
    }
  }, [item?.id, open]);
  const position: Position = item
    ? "points" in item
      ? item.points[0]
      : [item.x, item.y]
    : [0, 0];
  return (
    <FloatingPanel
      id="details-panel"
      className="editor-panel"
      title="Annotation details"
      closeLabel="annotation details"
      onClose={onClose}
      actions={
        <Button
          id="delete-item"
          className="quiet danger"
          disabled={!item}
          onClick={onDelete}
        >
          Delete
        </Button>
      }
    >
      {!item ? (
        <div className="selection-empty">Select an annotation to edit.</div>
      ) : (
        <div id="editor">
          <div className="section">
            <div className="selection-head">
              <span
                id="selected-chip"
                className="dot-chip"
                style={{ background: item.color }}
              >
                {item.type === "point" ? item.number : SYMBOLS[item.type]}
              </span>
              <div>
                <h3 id="selected-kind">{LABELS[item.type]}</h3>
                <p id="selected-position" className="small muted mono">
                  X {(position[0] * 100).toFixed(1)}% · Y{" "}
                  {(position[1] * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            {item.type === "point" && (
              <Field label="Point name">
<input
                  id="item-name"
                  maxLength={120}
                  value={item.name}
                  placeholder="Loading bay entrance"
                  onChange={(event) => onUpdate({ name: event.target.value })}
                />
              </Field>
            )}
            {item.type === "text" && (
              <Field label="Annotation text">
<textarea
                  id="item-text"
                  ref={text}
                  maxLength={1000}
                  value={item.text}
                  onChange={(event) => onUpdate({ text: event.target.value })}
                />
              </Field>
            )}
            <div className="field-pair">
              <Field label="Color">
<input
                  id="item-color"
                  type="color"
                  value={item.color}
                  onChange={(event) => onUpdate({ color: event.target.value })}
                />
              </Field>
              <Field label="Size">
<input
                  id="item-size"
                  type="range"
                  min="1"
                  max="6"
                  step=".2"
                  value={item.size}
                  onChange={(event) =>
                    onUpdate({ size: Number(event.target.value) })
                  }
                />
              </Field>
            </div>
            {item.type === "point" && (
              <Field label="Notes">
<textarea
                  id="item-notes"
                  maxLength={2000}
                  value={item.notes}
                  placeholder="Location, height, test conditions"
                  onChange={(event) => onUpdate({ notes: event.target.value })}
                />
              </Field>
            )}
          </div>
          {item.type === "point" && <SignalReadings item={item} gatewayNames={gatewayNames} onUpdate={onUpdate}/>}
        </div>
      )}
    </FloatingPanel>
  );
}

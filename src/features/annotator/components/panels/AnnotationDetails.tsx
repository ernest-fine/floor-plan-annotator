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
  const readingsTable = useRef<HTMLTableSectionElement>(null);
  const pendingReadingFocus = useRef<{ index: number; gateway: string } | null>(
    null,
  );
  useEffect(() => {
    if (open && item?.type === "text") {
      text.current?.focus();
      text.current?.select();
    }
  }, [item?.id, open]);
  useEffect(() => {
    if (pendingReadingFocus.current === null) return;
    const { index, gateway } = pendingReadingFocus.current;
    const input = readingsTable.current?.rows[
      index
    ]?.querySelector<HTMLInputElement>(
      gateway ? 'input[type="number"]' : 'input[type="text"]',
    );
    pendingReadingFocus.current = null;
    input?.focus();
  }, [item?.id, item?.type === "point" ? item.readings.length : 0]);
  function addReading(gateway = "") {
    if (item?.type !== "point") return;
    if (item.readings.length >= 300) return;
    pendingReadingFocus.current = { index: item.readings.length, gateway };
    onUpdate({ readings: [...item.readings, { ...blankReading(), gateway }] });
  }
  const updateReading = (index: number, key: keyof Reading, value: string) => {
    if (item?.type !== "point") return;
    onUpdate({
      readings: item.readings.map((row, i) =>
        i === index ? { ...row, [key]: value } : row,
      ),
    });
  };
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
          {item.type === "point" && (
            <div id="signal-section" className="section">
              <h3 style={{ marginBottom: 12 }}>Signal test</h3>
              {!!gatewayNames.length && (
                <div
                  className="gateway-pills"
                  role="group"
                  aria-label="Add gateway reading"
                >
                  {gatewayNames.map((gateway) => (
                    <Button
                      key={gateway}
                      type="button"
                      className="gateway-pill"
                      aria-label={`Add reading for ${gateway}`}
                      disabled={item.readings.length >= 300}
                      onClick={() => addReading(gateway)}
                    >
                      {gateway}
                    </Button>
                  ))}
                </div>
              )}
              <div className="table-wrap">
                <table className="readings">
                  <thead>
                    <tr>
                      <th scope="col">Gateway name</th>
                      <th scope="col">
                        RSSI
                        <br />
                        dBm
                      </th>
                      <th scope="col">
                        SNR
                        <br />
                        dB
                      </th>
                      <th scope="col">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody id="reading-rows" ref={readingsTable}>
                    {item.readings.map((row, index) => (
                      <tr key={index}>
                        {(["gateway", "rssi", "snr"] as const).map((key) => (
                          <td key={key}>
                            <input
                              type={key === "gateway" ? "text" : "number"}
                              inputMode="text"
                              step={key === "gateway" ? undefined : "any"}
                              maxLength={key === "gateway" ? 160 : undefined}
                              aria-label={`${key === "gateway" ? "Gateway name" : key.toUpperCase()} reading ${index + 1}`}
                              value={row[key]}
                              placeholder={
                                key === "gateway"
                                  ? "Gateway name"
                                  : key === "rssi"
                                    ? "-85"
                                    : "7.5"
                              }
                              onChange={(event) =>
                                updateReading(index, key, event.target.value)
                              }
                            />
                          </td>
                        ))}
                        <td>
                          <Button
                            aria-label={`Remove reading ${index + 1}`}
                            onClick={() =>
                              onUpdate({
                                readings: item.readings.filter(
                                  (_, i) => i !== index,
                                ),
                              })
                            }
                          >
                            ×
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                id="add-reading"
                className="add-reading"
                disabled={item.readings.length >= 300}
                onClick={() => addReading()}
              >
                + Add gateway reading
              </Button>
              <p className="small muted" style={{ marginTop: 10 }}>
                RSSI: dBm · SNR: dB. Repeated gateways allowed.
              </p>
            </div>
          )}
        </div>
      )}
    </FloatingPanel>
  );
}

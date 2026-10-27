import type { CSSProperties, ReactNode } from "react";
import type {
  Annotation,
  AnnotationPatch,
  Project,
  Reading,
  Tool,
  Position,
} from "../types";
import { useEffect, useRef } from "react";
import {
  blankReading,
  COLORS,
  HINTS,
  LABELS,
  SYMBOLS,
  TOOL_NAMES,
  validReading,
  hasReading,
} from "../lib/model";

interface PanelProps {
  id: string;
  className: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
}
function Panel({
  id,
  className,
  title,
  closeLabel,
  onClose,
  actions,
  children,
}: PanelProps) {
  return (
    <section
      id={id}
      className={"floating-panel " + className}
      aria-labelledby={id + "-title"}
    >
      <div className="panel-heading">
        <h2 id={id + "-title"}>{title}</h2>
        <div className="row">
          {actions}
          <button
            className="close-panel"
            aria-label={"Close " + closeLabel}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
      {children}
    </section>
  );
}

export function FilesPanel({
  project,
  onClose,
  onImage,
  onOpen,
  onSave,
  saveStatus,
  storageError,
  busy,
}: {
  project: Project;
  onClose: () => void;
  onImage: () => void;
  onOpen: () => void;
  onSave: () => void;
  saveStatus: string;
  storageError: boolean;
  busy: boolean;
}) {
  return (
    <Panel
      id="file-actions"
      className="file-panel chrome"
      title="Map / project"
      closeLabel="files"
      onClose={onClose}
    >
      <div className="section">
        <h3 id="map-title">{project.image?.name || "Floor plan"}</h3>
        <span id="map-dimensions" className="small muted">
          {project.image
            ? `${project.image.width} × ${project.image.height}`
            : "JPEG or PNG"}
        </span>
        <div className="file-buttons">
          <button
            id="upload-top"
            className="primary"
            onClick={onImage}
            disabled={busy}
          >
            Load map
          </button>
          <button id="open-project" onClick={onOpen} disabled={busy}>
            Open project
          </button>
          <button
            id="save-project"
            onClick={onSave}
            disabled={!project.image || busy}
          >
            Save project
          </button>
        </div>
        <p id="save-status" className="small muted">
          {saveStatus}
        </p>
        {storageError && (
          <div id="storage-warning" className="notice">
            Autosave unavailable. Save a project backup.
          </div>
        )}
      </div>
    </Panel>
  );
}

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
    <Panel
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
    </Panel>
  );
}

export function ExportPanel({
  project,
  includeTable,
  onTable,
  onTitle,
  onPng,
  onCsv,
  onClose,
  busy,
}: {
  project: Project;
  includeTable: boolean;
  onTable: (value: boolean) => void;
  onTitle: (title: string) => void;
  onPng: () => void;
  onCsv: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  return (
    <Panel
      id="export-panel"
      className="export-panel chrome"
      title="Export"
      closeLabel="export"
      onClose={onClose}
    >
      <div className="section">
        <label className="field">
          Map / survey title
          <input
            id="survey-title"
            maxLength={160}
            value={project.title}
            placeholder="Hall 1D · signal test"
            onChange={(event) => onTitle(event.target.value)}
          />
        </label>
        <label className="checkbox">
          <input
            id="include-table"
            type="checkbox"
            checked={includeTable}
            onChange={(event) => onTable(event.target.checked)}
          />
          Include signal table in PNG
        </label>
        <div className="actions">
          <button
            id="export-csv"
            onClick={onCsv}
            disabled={!project.image || busy}
          >
            Readings CSV
          </button>
          <button
            id="export-png"
            className="primary"
            onClick={onPng}
            disabled={!project.image || busy}
          >
            PNG ↓
          </button>
        </div>
      </div>
    </Panel>
  );
}

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
  return (
    <Panel
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
    </Panel>
  );
}

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
    <Panel
      id="details-panel"
      className="editor-panel"
      title="Annotation details"
      closeLabel="annotation details"
      onClose={onClose}
      actions={
        <button
          id="delete-item"
          className="quiet danger"
          disabled={!item}
          onClick={onDelete}
        >
          Delete
        </button>
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
              <label className="field">
                Point name
                <input
                  id="item-name"
                  maxLength={120}
                  value={item.name}
                  placeholder="Loading bay entrance"
                  onChange={(event) => onUpdate({ name: event.target.value })}
                />
              </label>
            )}
            {item.type === "text" && (
              <label className="field">
                Annotation text
                <textarea
                  id="item-text"
                  ref={text}
                  maxLength={1000}
                  value={item.text}
                  onChange={(event) => onUpdate({ text: event.target.value })}
                />
              </label>
            )}
            <div className="field-pair">
              <label className="field">
                Color
                <input
                  id="item-color"
                  type="color"
                  value={item.color}
                  onChange={(event) => onUpdate({ color: event.target.value })}
                />
              </label>
              <label className="field">
                Size
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
              </label>
            </div>
            {item.type === "point" && (
              <label className="field">
                Notes
                <textarea
                  id="item-notes"
                  maxLength={2000}
                  value={item.notes}
                  placeholder="Location, height, test conditions"
                  onChange={(event) => onUpdate({ notes: event.target.value })}
                />
              </label>
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
                    <button
                      key={gateway}
                      type="button"
                      className="gateway-pill"
                      aria-label={`Add reading for ${gateway}`}
                      disabled={item.readings.length >= 300}
                      onClick={() => addReading(gateway)}
                    >
                      {gateway}
                    </button>
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
                          <button
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
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                id="add-reading"
                className="add-reading"
                disabled={item.readings.length >= 300}
                onClick={() => addReading()}
              >
                + Add gateway reading
              </button>
              <p className="small muted" style={{ marginTop: 10 }}>
                RSSI: dBm · SNR: dB. Repeated gateways allowed.
              </p>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

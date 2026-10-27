import Button from "@/shared/ui/Button";
import Field from "@/shared/ui/Field";

import type { Project } from "../../domain/types";

import FloatingPanel from "@/shared/ui/FloatingPanel";
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
    <FloatingPanel
      id="export-panel"
      className="export-panel chrome"
      title="Export"
      closeLabel="export"
      onClose={onClose}
    >
      <div className="section">
        <Field label="Map / survey title">
          <input
            id="survey-title"
            maxLength={160}
            value={project.title}
            placeholder="Hall 1D · signal test"
            onChange={(event) => onTitle(event.target.value)}
          />
        </Field>
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
          <Button
            id="export-csv"
            onClick={onCsv}
            disabled={!project.image || busy}
          >
            Readings CSV
          </Button>
          <Button
            id="export-png"
            className="primary"
            onClick={onPng}
            disabled={!project.image || busy}
          >
            PNG ↓
          </Button>
        </div>
      </div>
    </FloatingPanel>
  );
}

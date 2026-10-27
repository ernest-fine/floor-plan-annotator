import { useState } from "react";
import type { Notify } from "@/shared/types/notice";
import type { ProjectDocument } from "./useProjectDocument";
import { exportPng } from "../exports/png";
import { exportCsv } from "../exports/csv";
export default function useProjectExport(
  document: ProjectDocument,
  notify: Notify,
  includeTable: boolean,
) {
  const [busy, setBusy] = useState(false);
  async function png() {
    const project = document.getProject();
    if (!project.image || busy) return;
    setBusy(true);
    notify("Exporting PNG…");
    try {
      await exportPng(project, includeTable);
      notify("PNG downloaded.");
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), true);
    } finally {
      setBusy(false);
    }
  }
  function csv() {
    exportCsv(document.getProject());
    notify("CSV downloaded.");
  }
  return { busy, png, csv };
}

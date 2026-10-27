import type { Project } from "../domain/types";
import { reportRows } from "../domain/signalReadings";
import { fileBase } from "../io/projectFileName";
import { download } from "@/shared/lib/download";
export function exportCsv(project: Project) {
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text) && !/^[-+]?\d+(\.\d+)?$/.test(text))
      text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows = [
    [
      "Point",
      "Location",
      "Color",
      "Gateway",
      "RSSI (dBm)",
      "SNR (dB)",
      "Record",
      "Notes",
    ],
    ...reportRows(project).map((r) => [
      r.number,
      r.name,
      r.color,
      r.gateway,
      r.rssi,
      r.snr,
      r.state,
      r.notes,
    ]),
  ];
  download(
    new Blob(
      ["\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
    fileBase(project) + "-readings.csv",
  );
}

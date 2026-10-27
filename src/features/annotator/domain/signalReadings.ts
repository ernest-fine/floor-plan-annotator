import type { Annotation, AnnotationType, DotAnnotation, TextAnnotation, Project, LoadedProject, Reading, MapImage, Position, HistoryState, HistoryAction } from "./types";

interface ReportRow {
  number: number;
  color: string;
  name: string;
  gateway: string;
  rssi: string;
  snr: string;
  notes: string;
  state: "Complete" | "Partial" | "Not tested";
}

export const blankReading = (): Reading => ({ gateway: "", rssi: "", snr: "" });

export function enteredGateways(items: Annotation[]) {
  return [
    ...new Set(
      items
        .filter((item) => item.type === "point")
        .flatMap((item) => item.readings.map((row) => row.gateway.trim()))
        .filter(Boolean),
    ),
  ];
}

export function validReading(row: Reading) {
  return (
    !!row.gateway.trim() &&
    row.rssi !== "" &&
    row.snr !== "" &&
    Number.isFinite(Number(row.rssi)) &&
    Number.isFinite(Number(row.snr))
  );
}

export function hasReading(row: Reading) {
  return row.gateway.trim() || row.rssi !== "" || row.snr !== "";
}
export function reportRows(project: Project): ReportRow[] {
  const rows: ReportRow[] = [];
  project.items
    .filter((i) => i.type === "point")
    .forEach((item) => {
      const readings = item.readings.filter(hasReading);
      if (!readings.length) readings.push({ gateway: "", rssi: "", snr: "" });
      readings.forEach((r, index) =>
        rows.push({
          number: item.number,
          color: item.color,
          name: item.name || "Point " + item.number,
          gateway: r.gateway,
          rssi: r.rssi,
          snr: r.snr,
          notes: index === 0 ? item.notes : "",
          state: validReading(r)
            ? "Complete"
            : hasReading(r)
              ? "Partial"
              : "Not tested",
        }),
      );
    });
  return rows;
}

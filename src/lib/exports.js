import {
  geometry,
  measure,
  textLines,
  arrowHead,
  validReading,
  hasReading,
} from "./model.js";
import { decodeImage } from "./files.js";

export function fileBase(project) {
  return (
    (project.title || project.image?.name || "floor-map")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .slice(0, 100) || "floor-map"
  );
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function drawItem(ctx, item, image) {
  const { x, y, points } = geometry(item, image),
    m = measure(item, image.width);
  ctx.save();
  ctx.fillStyle = item.color;
  ctx.strokeStyle = item.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (item.type === "point") {
    ctx.beginPath();
    ctx.arc(x, y, m, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = m * 0.13;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `750 ${m * (String(item.number).length > 2 ? 0.64 : 0.9)}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.number, x, y);
  } else if (item.type === "text") {
    ctx.font = `650 ${m}px system-ui,sans-serif`;
    ctx.textBaseline = "alphabetic";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = m * 0.16;
    textLines(item.text).forEach((line, i) => {
      const yy = y + m * (1 + i * 1.3);
      ctx.strokeText(line, x, yy);
      ctx.fillText(line, x, yy);
    });
  } else {
    ctx.lineWidth = m;
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
    ctx.stroke();
    if (item.type === "arrow") {
      const head = arrowHead(points, m);
      ctx.beginPath();
      head.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
      ctx.closePath();
      ctx.fill();
    }
    if (item.type === "pen" && points.length === 1) {
      ctx.beginPath();
      ctx.arc(...points[0], m / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
export function reportRows(project) {
  const rows = [];
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
export function wrapCanvas(ctx, value, maxWidth) {
  const lines = [];
  for (const paragraph of String(value ?? "").split("\n")) {
    let line = "";
    for (const char of paragraph) {
      if (line && ctx.measureText(line + char).width > maxWidth) {
        lines.push(line);
        line = char;
      } else line += char;
    }
    lines.push(line);
  }
  return lines;
}
export function reportLayout(ctx, width, project) {
  const padding = width * 0.035,
    font = Math.max(12, width * 0.013),
    line = font * 1.45;
  ctx.font = `${font}px system-ui,sans-serif`;
  const columns = [0.075, 0.19, 0.2, 0.09, 0.08, 0.11, 0.255],
    usable = width - padding * 2;
  const rows = reportRows(project).map((row) => {
    const values = [
      String(row.number),
      row.name,
      row.gateway || "—",
      row.rssi || "—",
      row.snr || "—",
      row.state,
      row.notes || "—",
    ];
    const cells = values.map((v, i) =>
      wrapCanvas(ctx, v, usable * columns[i] - font),
    );
    return {
      row,
      cells,
      height: Math.max(...cells.map((c) => c.length)) * line + font * 1.4,
    };
  });
  const titleFont = font * 1.7;
  ctx.font = `700 ${titleFont}px system-ui,sans-serif`;
  const titleLines = wrapCanvas(
    ctx,
    project.title || "Signal test",
    width - padding * 2,
  );
  const header = padding + titleLines.length * titleFont * 1.2 + font * 4.5;
  return {
    padding,
    font,
    line,
    columns,
    rows,
    titleFont,
    titleLines,
    header,
    height:
      header + rows.reduce((n, r) => n + r.height, 0) + padding + font * 2,
  };
}
export function drawReport(ctx, width, start, layout) {
  const { padding, font, line, columns, rows, titleFont, titleLines, header } =
    layout;
  ctx.save();
  ctx.translate(0, start);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, layout.height);
  ctx.fillStyle = "#127a50";
  ctx.fillRect(0, 0, width, Math.max(3, width * 0.003));
  ctx.fillStyle = "#1d2420";
  ctx.font = `700 ${titleFont}px system-ui,sans-serif`;
  ctx.textBaseline = "top";
  titleLines.forEach((text, i) =>
    ctx.fillText(text, padding, padding + i * titleFont * 1.2),
  );
  ctx.font = `${font}px system-ui,sans-serif`;
  ctx.fillStyle = "#5d6762";
  ctx.fillText(
    "Manual signal readings · RSSI in dBm · SNR in dB",
    padding,
    padding + titleLines.length * titleFont * 1.2 + font * 0.7,
  );
  const usable = width - padding * 2;
  let y = header - font * 2;
  ctx.fillStyle = "#edf3ee";
  ctx.fillRect(padding, y - font * 0.4, usable, font * 2);
  ctx.fillStyle = "#1d2420";
  ctx.font = `700 ${font}px system-ui,sans-serif`;
  let x = padding;
  ["Point", "Location", "Gateway", "RSSI", "SNR", "Record", "Notes"].forEach(
    (text, i) => {
      ctx.fillText(text, x + font * 0.4, y);
      x += usable * columns[i];
    },
  );
  y = header;
  rows.forEach(({ row, cells, height }, index) => {
    if (index % 2 === 0) {
      ctx.fillStyle = "#f7f8f6";
      ctx.fillRect(padding, y, usable, height);
    }
    ctx.fillStyle = row.color;
    ctx.fillRect(padding, y, Math.max(3, font * 0.25), height);
    x = padding;
    ctx.font = `${font}px system-ui,sans-serif`;
    ctx.fillStyle = "#1d2420";
    cells.forEach((lines, i) => {
      lines.forEach((text, j) =>
        ctx.fillText(text, x + font * 0.4, y + font * 0.6 + j * line),
      );
      x += usable * columns[i];
    });
    y += height;
  });
  ctx.fillStyle = "#5d6762";
  ctx.font = `${font * 0.85}px system-ui,sans-serif`;
  ctx.fillText(
    "Complete: gateway, RSSI and SNR recorded. Colors: manual.",
    padding,
    y + font,
  );
  ctx.restore();
}
export async function exportPng(project, includeTable) {
  if (!project.image) return;
  const image = await decodeImage(project.image.src),
    { width: w, height: h } = project.image;
  const report = includeTable && project.items.some((i) => i.type === "point");
  const canvas = document.createElement("canvas");
  canvas.width = report ? Math.max(1000, w) : w;
  let ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser could not create the image.");
  const mapHeight = Math.round((h * canvas.width) / w),
    layout = report ? reportLayout(ctx, canvas.width, project) : null;
  const exportHeight = mapHeight + (layout ? Math.ceil(layout.height) : 0);
  if (
    canvas.width * exportHeight > 64000000 ||
    canvas.width > 16000 ||
    exportHeight > 30000
  )
    throw new Error(
      "This report is too large for one PNG. Uncheck the signal table and download the readings as CSV.",
    );
  canvas.height = exportHeight;
  ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(canvas.width / w, canvas.width / w);
  ctx.drawImage(image, 0, 0, w, h);
  project.items.forEach((item) => drawItem(ctx, item, project.image));
  ctx.restore();
  if (layout) drawReport(ctx, canvas.width, mapHeight, layout);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob)
    throw new Error("The image could not be exported. Try a smaller map.");
  download(blob, fileBase(project) + "-annotated.png");
  return { hasTable: !!layout };
}
export function exportCsv(project) {
  const cell = (value) => {
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

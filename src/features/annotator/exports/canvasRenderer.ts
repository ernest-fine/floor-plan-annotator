import type { Annotation, MapImage, Project } from "../domain/types";
import {
  geometry,
  measure,
  textLines,
  arrowGeometry,
  gatewayTriangle,
} from "../domain/annotationGeometry";
import { reportRows } from "../domain/signalReadings";
export function drawItem(
  ctx: CanvasRenderingContext2D,
  item: Annotation,
  image: MapImage,
) {
  const { x, y, points } = geometry(item, image),
    m = measure(item, image.width);
  ctx.save();
  ctx.fillStyle = item.color;
  ctx.strokeStyle = item.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (item.type === "point" || item.type === "gateway") {
    ctx.beginPath();
    if (item.type === "gateway") {
      gatewayTriangle(x, y, m).forEach((point, index) =>
        index ? ctx.lineTo(...point) : ctx.moveTo(...point),
      );
      ctx.closePath();
    } else ctx.arc(x, y, m, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = m * 0.13;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `750 ${m * (item.type === "gateway" ? 0.65 : String(item.number).length > 2 ? 0.64 : 0.9)}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      item.type === "gateway" ? "G" + item.number : String(item.number),
      x,
      y,
    );
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
    const arrow = item.type === "arrow" ? arrowGeometry(points, m) : null;
    const shaft = arrow?.shaft ?? points;
    ctx.lineCap = arrow ? "butt" : "round";
    shaft.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
    ctx.stroke();
    if (arrow) {
      const head = arrow.head;
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

export function wrapCanvas(
  ctx: CanvasRenderingContext2D,
  value: unknown,
  maxWidth: number,
) {
  const lines: string[] = [];
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

export function reportLayout(
  ctx: CanvasRenderingContext2D,
  width: number,
  project: Project,
) {
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

export function drawReport(
  ctx: CanvasRenderingContext2D,
  width: number,
  start: number,
  layout: ReturnType<typeof reportLayout>,
) {
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

import type {Project} from "../domain/types";
import {decodeImage} from "../io/projectFiles";
import {fileBase} from "../io/projectFileName";
import {download} from "@/shared/lib/download";
import {reportLayout,drawItem,drawReport} from "./canvasRenderer";
export async function exportPng(project: Project, includeTable: boolean) {
  if (!project.image) return;
  const mapImage = project.image;
  const image = await decodeImage(mapImage.src),
    { width: w, height: h } = mapImage;
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
  if (!ctx) throw new Error("This browser could not create the image.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(canvas.width / w, canvas.width / w);
  ctx.drawImage(image, 0, 0, w, h);
  project.items.forEach((item) => drawItem(ctx!, item, mapImage));
  ctx.restore();
  if (layout) drawReport(ctx, canvas.width, mapHeight, layout);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob)
    throw new Error("The image could not be exported. Try a smaller map.");
  download(blob, fileBase(project) + "-annotated.png");
  return { hasTable: !!layout };
}

import type { LoadedProject } from "../domain/types";
import { MAX_FILE, MAX_PIXELS } from "../domain/limits";
import { validateProject } from "../domain/projectSchema";

export function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Choose a valid JPEG or PNG image."));
    image.src = src;
  });
}

async function hydrateImage(project: LoadedProject): Promise<LoadedProject> {
  const image = await decodeImage(project.image.src);
  if (image.naturalWidth * image.naturalHeight > MAX_PIXELS) {
    throw new Error("Image limit: 24 megapixels.");
  }
  return {
    ...project,
    image: {
      ...project.image,
      width: image.naturalWidth,
      height: image.naturalHeight,
    },
  };
}

export async function projectFromImage(file: File): Promise<LoadedProject> {
  if (file.size > MAX_FILE) throw new Error("Image limit: 25 MB.");
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("File could not be read."));
    reader.onerror = () => reject(new Error("File could not be read."));
    reader.readAsDataURL(file);
  });
  if (!/^data:image\/(png|jpeg);base64,/i.test(src))
    throw new Error("Choose a JPEG or PNG image.");
  return hydrateImage({
    version: 2,
    title: file.name.replace(/\.[^.]+$/, ""),
    image: { src, name: file.name, width: 1, height: 1 },
    items: [],
    nextNumber: 1,
  });
}

export async function projectFromFile(file: File): Promise<LoadedProject> {
  if (file.size > 40 * 1024 * 1024) throw new Error("Project limit: 40 MB.");
  let value: unknown;
  try {
    value = JSON.parse(await file.text());
  } catch {
    throw new Error("Invalid project JSON.");
  }
  return restoreProject(value);
}

export function restoreProject(value: unknown): Promise<LoadedProject> {
  return hydrateImage(validateProject(value));
}

import { MAX_FILE, MAX_PIXELS, validateProject } from "./model.js";

export function decodeImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Choose a valid JPEG or PNG image."));
    image.src = src;
  });
}

async function hydrateImage(project) {
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

export async function projectFromImage(file) {
  if (file.size > MAX_FILE) throw new Error("Image limit: 25 MB.");
  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("File could not be read."));
    reader.readAsDataURL(file);
  });
  if (!/^data:image\/(png|jpeg);base64,/i.test(src))
    throw new Error("Choose a JPEG or PNG image.");
  return hydrateImage({
    version: 1,
    title: file.name.replace(/\.[^.]+$/, ""),
    image: { src, name: file.name },
    items: [],
    nextNumber: 1,
  });
}

export async function projectFromFile(file) {
  if (file.size > 40 * 1024 * 1024) throw new Error("Project limit: 40 MB.");
  let value;
  try {
    value = JSON.parse(await file.text());
  } catch {
    throw new Error("Invalid project JSON.");
  }
  return restoreProject(value);
}

export function restoreProject(value) {
  return hydrateImage(validateProject(value));
}

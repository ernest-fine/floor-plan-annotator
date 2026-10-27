import type { MapImage, Project } from "../types";
import { isRecord, newId } from "./model";

let opening: Promise<IDBDatabase> | undefined;
let writes: Promise<void> = Promise.resolve();
const imageKeys = new WeakMap<MapImage, string>();
let currentImage: { src: string; key: string } | undefined;

function openDatabase() {
  // Keep the existing store/version so an open older tab cannot block an upgrade.
  return (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("floor-map-studio", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("projects");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Browser storage is blocked."));
  }));
}

export async function readSavedProject(): Promise<unknown> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects"),
      store = tx.objectStore("projects"),
      request = store.get("current");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const record: unknown = request.result;
      // Version-one documents remain valid; migrate on the next successful save.
      if (!isRecord(record) || record.storageVersion !== 2) {
        resolve(record);
        return;
      }
      if (
        typeof record.imageKey !== "string" ||
        !record.imageKey.startsWith("image:") ||
        !isRecord(record.document) ||
        !isRecord(record.document.image)
      ) {
        reject(new Error("Saved project metadata is invalid."));
        return;
      }
      const document = record.document,
        image = record.document.image as Record<string, unknown>,
        key = record.imageKey,
        asset = store.get(key);
      asset.onerror = () => reject(asset.error);
      asset.onsuccess = () => {
        const value: unknown = asset.result;
        if (!isRecord(value) || typeof value.src !== "string") {
          reject(new Error("The saved project image is missing."));
          return;
        }
        currentImage = { src: value.src, key };
        resolve({ ...document, image: { ...image, src: value.src } });
      };
    };
  });
}

async function persist(project: Project): Promise<void> {
  if (!project.image) return;
  const image = project.image;
  let key = imageKeys.get(image);
  if (!key) {
    key =
      currentImage?.src === image.src ? currentImage.key : "image:" + newId();
    imageKeys.set(image, key);
  }
  const imageKey = key,
    db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite"),
      store = tx.objectStore("projects");
    let failure: unknown;
    tx.oncomplete = () => {
      currentImage = { src: image.src, key: imageKey };
      resolve();
    };
    tx.onerror = tx.onabort = () =>
      reject(failure || tx.error || new Error("Autosave failed."));
    const existing = store.getKey(imageKey);
    existing.onsuccess = () => {
      try {
        if (existing.result === undefined)
          store.put({ src: image.src }, imageKey);
        const { src: _src, ...metadata } = image;
        store.put(
          {
            storageVersion: 2,
            imageKey,
            document: { ...project, image: metadata },
          },
          "current",
        );
        // Replacing a map must not retain its old image forever. The current
        // document and its image switch atomically in this same transaction.
        const cursor = store.openKeyCursor(
          IDBKeyRange.bound("image:", "image;", false, true),
        );
        cursor.onsuccess = () => {
          const entry = cursor.result;
          if (!entry) return;
          if (entry.key !== imageKey) store.delete(entry.key);
          entry.continue();
        };
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
  });
}

export function saveProjectLocally(project: Project): Promise<void> {
  // Preserve call order even when the first image write is slower than a later edit.
  const result = writes.then(() => persist(project));
  writes = result.catch(() => {});
  return result;
}

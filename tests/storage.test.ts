import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  IDBFactory,
  IDBKeyRange as KeyRange,
  IDBObjectStore as FakeStore,
} from "fake-indexeddb";
import type { Project } from "@/features/annotator/domain/types";
import { createItem } from "@/features/annotator/domain/annotations";

function fixture(src = "data:image/png;base64,AAAA"): Project {
  return {
    version: 2,
    title: "Original",
    image: { src, name: "map.png", width: 1200, height: 800 },
    items: [createItem("point", [0.2, 0.3], "#d8322a", 2.6, 1)],
    nextNumber: 2,
  };
}
async function rawStore() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("floor-map-studio", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("projects");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function seed(project: unknown) {
  const db = await rawStore();
  await new Promise<void>((resolve) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(project, "current");
    tx.oncomplete = () => resolve();
  });
  db.close();
}
async function storedValues() {
  const db = await rawStore();
  const values = await new Promise<unknown[]>((resolve) => {
    const request = db.transaction("projects").objectStore("projects").getAll();
    request.onsuccess = () => resolve(request.result);
  });
  db.close();
  return values;
}
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("IDBKeyRange", KeyRange);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("image-separated autosave", () => {
  it("reads an existing version-one project and preserves it when migrated", async () => {
    const project = fixture();
    const legacy = { ...project, version: 1 };
    await seed(legacy);
    const { readSavedProject, saveProjectLocally } =
      await import("@/features/annotator/persistence/projectRepository");
    expect(await readSavedProject()).toEqual(legacy);
    const edited = { ...project, title: "Edited" };
    await saveProjectLocally(edited);
    expect(await readSavedProject()).toEqual(edited);
  });
  it("writes image bytes once while subsequent edits save only metadata and annotations", async () => {
    const put = vi.spyOn(FakeStore.prototype, "put");
    const { readSavedProject, saveProjectLocally } =
      await import("@/features/annotator/persistence/projectRepository");
    const project = fixture();
    await saveProjectLocally(project);
    await saveProjectLocally({ ...project, title: "Second" });
    await saveProjectLocally({ ...project, title: "Third" });
    const imageWrites = put.mock.calls.filter(
      ([value]) =>
        value?.src === project.image!.src ||
        value?.image?.src === project.image!.src,
    );
    expect(imageWrites).toHaveLength(1);
    expect(await readSavedProject()).toEqual({ ...project, title: "Third" });
  });
  it("atomically replaces the map and releases the previous image", async () => {
    const { readSavedProject, saveProjectLocally } =
      await import("@/features/annotator/persistence/projectRepository");
    const first = fixture(),
      second = fixture("data:image/png;base64,BBBB");
    await saveProjectLocally(first);
    await saveProjectLocally(second);
    expect(await readSavedProject()).toEqual(second);
    expect(JSON.stringify(await storedValues())).not.toContain(
      first.image!.src,
    );
  });
  it("cleans obsolete image keys across the complete prefix range", async () => {
    const db = await rawStore();
    await new Promise<void>((resolve) => {
      const tx = db.transaction("projects", "readwrite");
      const store = tx.objectStore("projects");
      for (const key of ["image:000", "image:aaa", "image:zzz"]) {
        store.put({ src: "obsolete-" + key }, key);
      }
      tx.oncomplete = () => resolve();
    });
    db.close();
    const { saveProjectLocally } =
      await import("@/features/annotator/persistence/projectRepository");
    await saveProjectLocally(fixture());
    expect(JSON.stringify(await storedValues())).not.toContain("obsolete-");
  });
  it("retains the last saved project if a replacement transaction fails", async () => {
    const { readSavedProject, saveProjectLocally } =
      await import("@/features/annotator/persistence/projectRepository");
    const first = fixture();
    await saveProjectLocally(first);
    const native = FakeStore.prototype.put;
    const spy = vi
      .spyOn(FakeStore.prototype, "put")
      .mockImplementation(function (
        this: IDBObjectStore,
        ...args: Parameters<IDBObjectStore["put"]>
      ) {
        if (args[1] === "current")
          throw new DOMException("Storage is full", "QuotaExceededError");
        return native.apply(this, args);
      });
    await expect(
      saveProjectLocally(fixture("data:image/png;base64,CCCC")),
    ).rejects.toThrow("Storage is full");
    spy.mockRestore();
    expect(await readSavedProject()).toEqual(first);
    await saveProjectLocally({ ...first, title: "Recovered" });
    expect(await readSavedProject()).toEqual({ ...first, title: "Recovered" });
  });
  it("preserves save call order and needs no background polling", async () => {
    const { readSavedProject, saveProjectLocally } =
      await import("@/features/annotator/persistence/projectRepository");
    const first = fixture(),
      last = { ...fixture("data:image/png;base64,DDDD"), title: "Last" };
    await Promise.all([
      saveProjectLocally(first),
      saveProjectLocally({ ...first, title: "Middle" }),
      saveProjectLocally(last),
    ]);
    expect(await readSavedProject()).toEqual(last);
  });
});

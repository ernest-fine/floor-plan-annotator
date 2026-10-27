// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import useProjectDocument from "@/features/annotator/hooks/useProjectDocument";
import useProjectPersistence from "@/features/annotator/hooks/useProjectPersistence";
import type { ProjectDocument } from "@/features/annotator/hooks/useProjectDocument";
import { emptyProject } from "@/features/annotator/domain/annotations";
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@/features/annotator/persistence/projectRepository", () => ({
  readSavedProject: mocks.read,
  saveProjectLocally: mocks.save,
}));
vi.mock("@/features/annotator/io/projectFiles", async (original) => ({
  ...(await original<typeof import("@/features/annotator/io/projectFiles")>()),
  restoreProject: mocks.restore,
}));
let root: Root, host: HTMLDivElement, documentState: ProjectDocument;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const saved = () => ({
  ...emptyProject(),
  title: "Saved map",
  image: {
    src: "data:image/png;base64,AAAA",
    name: "map.png",
    width: 10,
    height: 10,
  },
});
function Harness() {
  const doc = useProjectDocument();
  documentState = doc;
  useProjectPersistence(doc, mocks.notify);
  return <output>{doc.project.title}</output>;
}
beforeEach(() => {
  vi.useFakeTimers();
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.save.mockResolvedValue(undefined);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});
describe("document and persistence ownership", () => {
  it("does not let a late startup restore replace an explicitly imported project", async () => {
    const read = deferred<unknown>();
    mocks.read.mockReturnValue(read.promise);
    await act(() => root.render(<Harness />));
    const imported = { ...saved(), title: "Imported map" };
    await act(() => {
      documentState.beginImport();
      documentState.load(imported);
    });
    await act(() => read.resolve(saved()));
    expect(documentState.project.title).toBe("Imported map");
    expect(mocks.restore).not.toHaveBeenCalled();
  });
  it("does not let a late image decode overwrite edits made while restore was running", async () => {
    const restored = deferred<ReturnType<typeof saved>>();
    mocks.read.mockResolvedValue(saved());
    mocks.restore.mockReturnValue(restored.promise);
    await act(() => root.render(<Harness />));
    await act(() =>
      documentState.execute({ type: "title.set", title: "Operator edit" }),
    );
    await act(() => restored.resolve(saved()));
    expect(documentState.project.title).toBe("Operator edit");
  });
  it("keeps undo and redo independent of storage and shares the unchanged image", async () => {
    mocks.read.mockResolvedValue(undefined);
    await act(() => root.render(<Harness />));
    const project = saved();
    await act(() => documentState.load(project));
    await act(() =>
      documentState.execute({ type: "title.set", title: "Edited" }),
    );
    expect(documentState.project.image).toBe(project.image);
    await act(() => documentState.undo());
    expect(documentState.project.title).toBe("Saved map");
    await act(() => documentState.redo());
    expect(documentState.project.title).toBe("Edited");
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
});

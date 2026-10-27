// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import useProjectDocument from "@/features/annotator/hooks/useProjectDocument";
import useProjectFiles from "@/features/annotator/hooks/useProjectFiles";
import { emptyProject } from "@/features/annotator/domain/annotations";
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  notify: vi.fn(),
  imported: vi.fn(),
  close: vi.fn(),
}));
vi.mock("@/features/annotator/io/projectFiles", () => ({
  projectFromFile: mocks.read,
  projectFromImage: mocks.read,
}));
let root: Root,
  host: HTMLDivElement,
  files: ReturnType<typeof useProjectFiles>,
  doc: ReturnType<typeof useProjectDocument>;
function Harness() {
  doc = useProjectDocument();
  files = useProjectFiles(
    doc,
    mocks.notify,
    mocks.imported,
    mocks.close,
    false,
  );
  return null;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const project = (title: string) => ({
  ...emptyProject(),
  title,
  image: {
    src: "data:image/png;base64,AAAA",
    name: "map.png",
    width: 10,
    height: 10,
  },
});
beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("ignores an older file decode that completes after a newer import", async () => {
  const first = deferred<ReturnType<typeof project>>(),
    second = deferred<ReturnType<typeof project>>();
  mocks.read
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  await act(() => root.render(<Harness />));
  let a!: Promise<void>, b!: Promise<void>;
  await act(() => {
    a = files.open(new File(["{}"], "first.json"));
    b = files.open(new File(["{}"], "second.json"));
  });
  await act(async () => {
    second.resolve(project("Newer"));
    await b;
  });
  await act(async () => {
    first.resolve(project("Older"));
    await a;
  });
  expect(doc.project.title).toBe("Newer");
  expect(mocks.imported).toHaveBeenCalledTimes(1);
});
it("keeps the document when the operator cancels replacement", async () => {
  mocks.read.mockResolvedValue(project("Replacement"));
  await act(() => root.render(<Harness />));
  await act(() => doc.load(project("Current")));
  vi.mocked(confirm).mockReturnValue(false);
  await act(() => files.open(new File(["{}"], "replacement.json")));
  expect(doc.project.title).toBe("Current");
  expect(mocks.imported).not.toHaveBeenCalled();
});

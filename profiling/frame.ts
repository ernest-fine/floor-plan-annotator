// Local-only harness. These probes and fixtures are excluded from the production build.
const counts: Record<string, number> = {
  appRenders: 0,
  mapRenders: 0,
  listRenders: 0,
  resizeCallbacks: 0,
  shapeRenders: 0,
};
const puts: {
  store: string;
  imageChars: number;
  syncMs: number;
  transactionMs: number;
}[] = [];
const longTasks: number[] = [];
const profile = {
  counts,
  puts,
  longTasks,
  count(name: string) {
    counts[name] = (counts[name] || 0) + 1;
  },
};
Object.assign(globalThis, { __annotatorProfile: profile });
const nativePut = IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put = function (
  ...args: Parameters<typeof nativePut>
) {
  const value = args[0],
    start = performance.now();
  const request = nativePut.apply(this, args);
  const row = {
    store: this.name,
    imageChars:
      typeof value?.image?.src === "string"
        ? value.image.src.length
        : typeof value?.src === "string"
          ? value.src.length
          : 0,
    syncMs: performance.now() - start,
    transactionMs: 0,
  };
  puts.push(row);
  this.transaction.addEventListener(
    "complete",
    () => {
      row.transactionMs = performance.now() - start;
    },
    { once: true },
  );
  return request;
};
const nativeOpen = indexedDB.open.bind(indexedDB);
const runId =
  new URL(location.href).searchParams.get("run") || String(Date.now());
const database = `annotator-profile-${runId}`;
indexedDB.open = (name, version) =>
  nativeOpen(name === "floor-map-studio" ? database : name, version);
if (
  globalThis.PerformanceObserver &&
  PerformanceObserver.supportedEntryTypes.includes("longtask")
)
  new PerformanceObserver((list) =>
    list.getEntries().forEach((entry) => longTasks.push(entry.duration)),
  ).observe({ type: "longtask" });
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
Element.prototype.hasPointerCapture = () => false;
if (new URL(location.href).searchParams.get("restore") === "1") {
  void import("../src/app/main");
} else
  window.addEventListener(
    "message",
    async (event) => {
      if (
        event.origin !== location.origin ||
        event.data?.type !== "profile-fixture"
      )
        return;
      const project = event.data.project;
      await new Promise<void>((resolve, reject) => {
        const request = nativeOpen(database, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("projects");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("projects", "readwrite");
          tx.objectStore("projects").put(project, "current");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      });
      await import("../src/app/main");
    },
    { once: true },
  );

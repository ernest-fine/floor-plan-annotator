import type { Root } from "react-dom/client";
import type { Annotation } from "@/features/annotator/domain/types";
import type { Tool } from "@/features/annotator/types/editor";
import type { MapCanvasHandle } from "@/features/annotator/components/map/MapCanvas";
// @vitest-environment jsdom
import { act, createRef, Profiler } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import MapCanvas from "@/features/annotator/components/map/MapCanvas";
import { createItem } from "@/features/annotator/domain/annotations";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
let resizeCallback: (() => void) | undefined;
let viewportWidth = 400;
const image = {
  src: "data:image/png;base64,AAAA",
  width: 1200,
  height: 800,
  name: "map.png",
};
function dimensions(element: Element) {
  if (element.id === "viewport")
    return { width: viewportWidth, height: 800, left: 0, top: 0 };
  const stage = document.getElementById("stage");
  return {
    width: parseFloat(stage?.style.width ?? "") || 376,
    height: parseFloat(stage?.style.height ?? "") || 251,
    left: 12,
    top: (parseFloat(stage?.style.marginTop ?? "") || 0) + 12,
  };
}
beforeEach(() => {
  viewportWidth = 400;
  resizeCallback = undefined;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      callback: () => void;
      constructor(callback: () => void) {
        this.callback = callback;
        resizeCallback = callback;
      }
      observe(_element: Element) {
        this.callback();
      }
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return dimensions(this).width;
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return dimensions(this).height;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
    function (this: HTMLElement) {
      return dimensions(this).left;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(
    function (this: HTMLElement) {
      return dimensions(this).top;
    },
  );
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const d = dimensions(this);
      return new DOMRect(d.left, d.top, d.width, d.height);
    },
  );
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollTo = function (
    this: Element,
    x?: number | ScrollToOptions,
    y?: number,
  ) {
    this.scrollLeft = typeof x === "object" ? (x.left ?? 0) : (x ?? 0);
    this.scrollTop = typeof x === "object" ? (x.top ?? 0) : (y ?? 0);
  };
  const style = document.createElement("style");
  style.textContent = ".viewport{padding:12px}";
  document.head.append(style);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  document.head.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function setup(tool: Tool = "select", items: Annotation[] = []) {
  const props = {
    ref: createRef<MapCanvasHandle>(),
    project: { version: 2 as const, title: "", image, items, nextNumber: 1 },
    selectedId: null,
    tool,
    color: "#d8322a",
    size: 3.2,
    busy: false,
    onAdd: vi.fn<(item: Annotation) => void>(),
    onMove: vi.fn(),
    onSelect: vi.fn(),
    onInteract: vi.fn(),
    onUpload: vi.fn(),
    onChooseImage: vi.fn(),
    onZoom: vi.fn(),
  };
  const commits = vi.fn();
  await act(() =>
    root.render(
      <Profiler id="map" onRender={commits}>
        <MapCanvas {...props} />
      </Profiler>,
    ),
  );
  await frame();
  return { ...props, commits };
}
function dispatchPointer(
  type: string,
  pointerId: number,
  x: number,
  y: number,
) {
  document.getElementById("overlay")!.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerType: "touch",
      pointerId,
      isPrimary: pointerId === 1,
      button: 0,
      clientX: x,
      clientY: y,
    }),
  );
}
async function frame() {
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
}
async function pointer(type: string, pointerId: number, x: number, y: number) {
  await act(() => dispatchPointer(type, pointerId, x, y));
  await frame();
}

describe("mobile floor map", () => {
  it("renders initial pins at least 32 CSS pixels across on a narrow map", async () => {
    await setup("select", [createItem("point", [0.2, 0.3], "#d8322a", 3.2, 1)]);
    const mapWidth = parseFloat(document.getElementById("stage")!.style.width);
    const marker = document.querySelector('g[data-id] circle[fill="#d8322a"]');
    expect(
      (Number(marker!.getAttribute("r")) * 2 * mapWidth) / image.width,
    ).toBeGreaterThanOrEqual(32);
  });
  it("pinches the map to 150%, preserving the image point between the fingers", async () => {
    const props = await setup();
    await pointer("pointerdown", 1, 100, 400);
    await pointer("pointerdown", 2, 300, 400);
    await pointer("pointermove", 2, 400, 400);
    expect(props.onZoom).toHaveBeenLastCalledWith(1.5);
    expect(parseFloat(document.getElementById("stage")!.style.width)).toBe(564);
    expect(document.getElementById("viewport")!.scrollLeft).toBeCloseTo(44);
    await pointer("pointerup", 2, 400, 400);
    await pointer("pointerup", 1, 100, 400);
    expect(props.onAdd).not.toHaveBeenCalled();
  });
  it("cancels an unfinished stroke when the second finger starts a pinch", async () => {
    const props = await setup("pen");
    await pointer("pointerdown", 1, 100, 400);
    await pointer("pointermove", 1, 150, 420);
    expect(document.querySelectorAll("g[data-id]")).toHaveLength(1);
    await pointer("pointerdown", 2, 300, 400);
    await pointer("pointermove", 2, 400, 400);
    await pointer("pointerup", 2, 400, 400);
    await pointer("pointerup", 1, 150, 420);
    expect(props.onAdd).not.toHaveBeenCalled();
    expect(document.querySelectorAll("g[data-id]")).toHaveLength(0);
  });
  it("does not place accidental dots during a pinch, and permits the next single tap", async () => {
    const props = await setup("point");
    await pointer("pointerdown", 1, 100, 400);
    await pointer("pointerdown", 2, 300, 400);
    await pointer("pointerup", 2, 300, 400);
    await pointer("pointerup", 1, 100, 400);
    expect(props.onAdd).not.toHaveBeenCalled();
    await pointer("pointerdown", 1, 150, 400);
    await pointer("pointerup", 1, 150, 400);
    expect(props.onAdd).toHaveBeenCalledOnce();
    expect(props.onAdd.mock.calls[0][0].type).toBe("point");
  });
});

describe("rendering work budgets", () => {
  it("does not render for repeated identical resize notifications, but responds to real size changes", async () => {
    const props = await setup();
    const before = props.commits.mock.calls.length;
    await act(() => {
      for (let i = 0; i < 100; i++) resizeCallback?.();
    });
    await frame();
    expect(props.commits.mock.calls.length).toBe(before);
    viewportWidth = 432;
    await act(() => resizeCallback?.());
    await frame();
    expect(parseFloat(document.getElementById("stage")!.style.width)).toBe(408);
  });
  it("batches a burst of pointer events into one preview frame without losing stroke points", async () => {
    const props = await setup("pen");
    await pointer("pointerdown", 1, 100, 400);
    const before = props.commits.mock.calls.length;
    const queued = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      queued.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => queued.delete(id));
    for (let i = 1; i <= 120; i++) {
      await act(() =>
        dispatchPointer(
          "pointermove",
          1,
          100 + i,
          400 + Math.sin(i * 0.1) * 20,
        ),
      );
    }
    expect(queued.size).toBe(1);
    await act(() => {
      const callbacks = [...queued.values()];
      queued.clear();
      callbacks.forEach((callback) => callback(0));
    });
    expect(props.commits.mock.calls.length - before).toBeLessThanOrEqual(2);
    await act(() => dispatchPointer("pointerup", 1, 220, 400));
    const item = props.onAdd.mock.calls[0][0];
    expect(item.type).toBe("pen");
    if (!("points" in item)) throw new Error("Expected a stroke");
    expect(item.points.length).toBeGreaterThan(40);
  });
  it("cancels pending drawing when the document is backgrounded", async () => {
    const props = await setup("pen");
    await pointer("pointerdown", 1, 100, 400);
    await act(() => dispatchPointer("pointermove", 1, 180, 420));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(() => document.dispatchEvent(new Event("visibilitychange")));
    await frame();
    await pointer("pointerup", 1, 180, 420);
    expect(props.onAdd).not.toHaveBeenCalled();
    expect(document.querySelectorAll("g[data-id]")).toHaveLength(0);
  });
});

describe("viewport commands during gestures", () => {
  it("cancels a stroke before zoom changes its coordinate space", async () => {
    const props = await setup("pen");
    await pointer("pointerdown", 1, 100, 400);
    await pointer("pointermove", 1, 180, 420);
    await act(() => props.ref.current!.zoomBy(0.5));
    await frame();
    await pointer("pointerup", 1, 180, 420);
    expect(props.onAdd).not.toHaveBeenCalled();
    expect(props.onZoom).toHaveBeenLastCalledWith(1.5);
  });
});

describe("gateway map pins", () => {
  it("places a named gateway triangle with its own numbering", async () => {
    const props = await setup("gateway");
    await pointer("pointerdown", 1, 150, 400);
    await pointer("pointerup", 1, 150, 400);
    expect(props.onAdd.mock.calls[0][0]).toMatchObject({
      type: "gateway",
      number: 1,
      name: "Gateway 1",
    });
  });
  it("draws a triangle and gateway label instead of a detector circle", async () => {
    const gateway = createItem("gateway", [0.2, 0.3], "#127a50", 2.6, 1);
    await setup("select", [gateway]);
    expect(document.querySelector("g[data-id] polygon")).not.toBeNull();
    expect(document.querySelector("g[data-id] text")?.textContent).toBe("G1");
  });
});

describe("arrow endpoint geometry", () => {
  it("ends the visible shaft behind the arrowhead tip", async () => {
    const arrow: Annotation = {
      id: "arrow-endpoint",
      type: "arrow",
      points: [
        [0.2, 0.3],
        [0.8, 0.7],
      ],
      color: "#2f6fd6",
      size: 2.6,
    };
    await setup("select", [arrow]);
    const group = document.querySelector('g[data-id="arrow-endpoint"]')!;
    const tip = group
      .querySelector("polygon")!
      .getAttribute("points")!
      .split(" ")[0];
    const shaftEnd = group
      .querySelector('polyline[stroke="#2f6fd6"]')!
      .getAttribute("points")!
      .split(" ")
      .at(-1);
    expect(tip).toBe("960,560");
    expect(shaftEnd).not.toBe(tip);
  });
});

it("uses the pointer release location for the arrow tip", async () => {
  const props = await setup("arrow");
  await pointer("pointerdown", 1, 100, 400);
  await pointer("pointermove", 1, 200, 410);
  await pointer("pointerup", 1, 260, 420);
  const arrow = props.onAdd.mock.calls[0][0];
  if (arrow.type !== "arrow") throw new Error("Expected arrow");
  expect(arrow.points[1][0]).toBeCloseTo((260 - 12) / 376);
});

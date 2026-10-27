import type { Root } from "react-dom/client";
import type { Annotation, Tool } from "../src/types";
import type { MapCanvasHandle } from "../src/components/MapCanvas";
// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import MapCanvas from "../src/components/MapCanvas";
import { createItem } from "../src/lib/model";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const image = {
  src: "data:image/png;base64,AAAA",
  width: 1200,
  height: 800,
  name: "map.png",
};
function dimensions(element: Element) {
  if (element.id === "viewport")
    return { width: 400, height: 800, left: 0, top: 0 };
  const stage = document.getElementById("stage");
  return {
    width: parseFloat(stage?.style.width ?? "") || 376,
    height: parseFloat(stage?.style.height ?? "") || 251,
    left: 12,
    top: (parseFloat(stage?.style.marginTop ?? "") || 0) + 12,
  };
}
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      callback: () => void;
      constructor(callback: () => void) {
        this.callback = callback;
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
    project: { version: 1 as const, title: "", image, items, nextNumber: 1 },
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
  await act(() => root.render(<MapCanvas {...props} />));
  return props;
}
async function pointer(type: string, pointerId: number, x: number, y: number) {
  await act(() =>
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
    ),
  );
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

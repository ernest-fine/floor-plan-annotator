// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import type { LoadedProject } from "@/features/annotator/domain/types";
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
}));
vi.mock("@/features/annotator/persistence/projectRepository", () => ({
  readSavedProject: mocks.read,
  saveProjectLocally: mocks.save,
}));
vi.mock("@/features/annotator/io/projectFiles", async (original) => ({
  ...(await original<typeof import("@/features/annotator/io/projectFiles")>()),
  restoreProject: mocks.restore,
}));
import App from "@/app/App";
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  mocks.read.mockReset();
  mocks.save.mockReset();
  mocks.restore.mockReset();
  const project: LoadedProject = {
    version: 2,
    title: "Profile fixture",
    image: {
      src: "data:image/png;base64,AAAA",
      name: "map.png",
      width: 1200,
      height: 800,
    },
    items: Array.from({ length: 80 }, (_, i) => ({
      id: "p" + i,
      type: "point",
      x: 0.1,
      y: 0.2,
      number: i + 1,
      color: "#d8322a",
      size: 2.6,
      name: "Point " + i,
      notes: "",
      readings: [{ gateway: "A", rssi: "-85", snr: "0" }],
    })),
    nextNumber: 81,
  };
  mocks.read.mockResolvedValue(project);
  mocks.restore.mockResolvedValue(project);
  mocks.save.mockResolvedValue(undefined);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollTo = () => {};
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function render() {
  await act(() => root.render(<App />));
  await act(() => vi.advanceTimersByTimeAsync(4000));
}
describe("idle work and closed panels", () => {
  it("retains no closed panel contents and releases a list again after it is closed", async () => {
    await render();
    expect(host.querySelector("#item-list")).toBeNull();
    expect(host.querySelector("#reading-rows")).toBeNull();
    await act(() =>
      host.querySelector<HTMLButtonElement>("#mobile-list")!.click(),
    );
    expect(host.querySelectorAll(".item-row")).toHaveLength(80);
    await act(() =>
      host
        .querySelector<HTMLButtonElement>(
          '[aria-label="Close annotation list"]',
        )!
        .click(),
    );
    expect(host.querySelectorAll(".item-row")).toHaveLength(0);
  });
  it("performs no recurring storage writes during a settled minute of idle time", async () => {
    await render();
    const saved = mocks.save.mock.calls.length;
    expect(saved).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(60000));
    expect(mocks.save).toHaveBeenCalledTimes(saved);
  });
});

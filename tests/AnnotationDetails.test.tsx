import type { Root } from "react-dom/client";
import type { DotAnnotation } from "@/features/annotator/domain/types";
// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AnnotationDetails } from "@/features/annotator/components/panels/AnnotationDetails";
import {createItem} from "@/features/annotator/domain/annotations";
import {enteredGateways} from "@/features/annotator/domain/signalReadings";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
function Harness({ initialItems }: { initialItems: DotAnnotation[] }) {
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState(0);
  const item = items[selected];
  return (
    <>
      <button id="switch-point" onClick={() => setSelected(1)}>
        Next point
      </button>
      <AnnotationDetails
        item={item}
        open
        gatewayNames={enteredGateways(items)}
        onClose={() => {}}
        onDelete={() => {}}
        onUpdate={(patch) =>
          setItems((items) =>
            items.map((saved, index) =>
              index === selected ? { ...saved, ...patch } : saved,
            ),
          )
        }
      />
    </>
  );
}
function fixtures() {
  const first = createItem("point", [0.2, 0.3], "#d8322a", 3.2, 1);
  first.readings = [
    { gateway: "GW North", rssi: "-87", snr: "0" },
    { gateway: " GW North ", rssi: "-85", snr: "1.5" },
  ];
  const second = createItem("point", [0.7, 0.5], "#2f6fd6", 3.2, 2);
  second.readings = [{ gateway: "GW South", rssi: "-99", snr: "-2.5" }];
  return [first, second];
}
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
});
async function render(items = fixtures()) {
  await act(() => root.render(<Harness initialItems={items} />));
}
async function click(element: Element | null) {
  if (!(element instanceof HTMLElement))
    throw new Error("Missing test control");
  await act(() => element.click());
}
const inputs = () =>
  [...host.querySelectorAll("#reading-rows tr")].map((row) =>
    [...row.querySelectorAll<HTMLInputElement>("input")].map(
      (input) => input.value,
    ),
  );

describe("gateway shortcuts", () => {
  it("shows unique gateway names entered across all map points", async () => {
    await render();
    expect(
      [...host.querySelectorAll<HTMLButtonElement>(".gateway-pill")].map(
        (button) => button.textContent,
      ),
    ).toEqual(["GW North", "GW South"]);
    await click(host.querySelector("#switch-point"));
    expect(
      [...host.querySelectorAll<HTMLButtonElement>(".gateway-pill")].map(
        (button) => button.textContent,
      ),
    ).toEqual(["GW North", "GW South"]);
  });
  it("adds another row on every tap, preserving existing readings and focusing RSSI", async () => {
    await render();
    const pill = host.querySelector('[aria-label="Add reading for GW South"]');
    await click(pill);
    expect(inputs()).toEqual([
      ["GW North", "-87", "0"],
      [" GW North ", "-85", "1.5"],
      ["GW South", "", ""],
    ]);
    expect(document.activeElement!.getAttribute("aria-label")).toBe(
      "RSSI reading 3",
    );
    await click(pill);
    expect(inputs().slice(-2)).toEqual([
      ["GW South", "", ""],
      ["GW South", "", ""],
    ]);
    expect(document.activeElement!.getAttribute("aria-label")).toBe(
      "RSSI reading 4",
    );
  });
  it("adds the selected gateway to another point without copying signal values", async () => {
    await render();
    await click(host.querySelector("#switch-point"));
    await click(host.querySelector('[aria-label="Add reading for GW North"]'));
    expect(inputs()).toEqual([
      ["GW South", "-99", "-2.5"],
      ["GW North", "", ""],
    ]);
  });
  it("omits empty names and respects the 300-reading limit", async () => {
    const items = fixtures();
    items[0].readings = Array.from({ length: 300 }, () => ({
      gateway: "  ",
      rssi: "",
      snr: "",
    }));
    await render(items);
    const pills = [
      ...host.querySelectorAll<HTMLButtonElement>(".gateway-pill"),
    ];
    expect(pills.map((button) => button.textContent)).toEqual(["GW South"]);
    expect(pills[0].disabled).toBe(true);
    expect(
      host.querySelector<HTMLButtonElement>("#add-reading")!.disabled,
    ).toBe(true);
    await click(pills[0]);
    expect(inputs()).toHaveLength(300);
  });
});

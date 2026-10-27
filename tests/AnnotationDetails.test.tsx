// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import SignalReadings from "@/features/annotator/components/panels/SignalReadings";
import type {
  DotAnnotation,
  GatewayAnnotation,
  Reading,
  ReadingUpdate,
} from "@/features/annotator/domain/types";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

const gateways: GatewayAnnotation[] = [
  {
    id: "north",
    type: "gateway",
    x: 0.2,
    y: 0.3,
    number: 1,
    name: "GW North",
    notes: "",
    color: "#127a50",
    size: 3,
  },
  {
    id: "south",
    type: "gateway",
    x: 0.7,
    y: 0.5,
    number: 2,
    name: "GW South",
    notes: "",
    color: "#127a50",
    size: 3,
  },
];
const reading = (gatewayId = "north"): Reading => ({
  gatewayId,
  gateway:
    gateways.find((gateway) => gateway.id === gatewayId)?.name ??
    "Saved gateway",
  rssi: "-87",
  snr: "1.5",
});

function Harness({
  initialReadings = [],
  registry = gateways,
}: {
  initialReadings?: Reading[];
  registry?: GatewayAnnotation[];
}) {
  const [readings, setReadings] = useState(initialReadings);
  const item: DotAnnotation = {
    id: "point",
    type: "point",
    x: 0.3,
    y: 0.5,
    number: 1,
    name: "",
    notes: "",
    color: "#d8322a",
    size: 3.2,
    readings,
  };
  function update(index: number, patch: ReadingUpdate) {
    setReadings((saved) =>
      saved.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              ...patch,
              ...(patch.gatewayId
                ? {
                    gateway: registry.find(
                      (gateway) => gateway.id === patch.gatewayId,
                    )!.name,
                  }
                : {}),
            }
          : row,
      ),
    );
  }
  return (
    <>
      <SignalReadings
        item={item}
        gateways={registry}
        actions={{
          add: (gatewayId) =>
            setReadings((saved) => [
              ...saved,
              {
                gatewayId,
                gateway: registry.find((gateway) => gateway.id === gatewayId)!
                  .name,
                rssi: "",
                snr: "",
              },
            ]),
          update,
          remove: (index) =>
            setReadings((saved) =>
              saved.filter((_, rowIndex) => rowIndex !== index),
            ),
        }}
      />
      <output id="saved-readings">{JSON.stringify(readings)}</output>
    </>
  );
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
async function render(initialReadings: Reading[] = [], registry = gateways) {
  await act(() =>
    root.render(
      <Harness initialReadings={initialReadings} registry={registry} />,
    ),
  );
}
async function click(label: string) {
  const button = host.querySelector<HTMLButtonElement>(
    `[aria-label="${label}"]`,
  )!;
  expect(button).not.toBeNull();
  await act(() => button.click());
}
function input(label: string) {
  return host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
}
function select(index: number) {
  return host.querySelector<HTMLSelectElement>(
    `select[aria-label="Gateway name reading ${index}"]`,
  )!;
}
function saved(): Reading[] {
  return JSON.parse(host.querySelector("#saved-readings")!.textContent!);
}
async function enter(label: string, value: string) {
  const field = input(label);
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  await act(() => {
    setter.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("registered gateway signal readings", () => {
  it("gates signal entry until a named gateway has been placed, preserving saved rows and removal", async () => {
    await render([reading()], []);
    expect(host.textContent).toContain(
      "Add a gateway pin to enter signal readings.",
    );
    expect(
      host.querySelector<HTMLButtonElement>("#add-reading")!.disabled,
    ).toBe(true);
    expect(host.querySelector(".gateway-pill")).toBeNull();
    expect(select(1).disabled).toBe(true);
    expect(select(1).selectedOptions[0].textContent).toContain("GW North");
    expect(input("RSSI reading 1").value).toBe("87");
    expect(input("SNR reading 1").value).toBe("1.5");
    expect(input("RSSI reading 1").disabled).toBe(true);
    expect(input("SNR reading 1").disabled).toBe(true);
    await click("Remove reading 1");
    expect(saved()).toEqual([]);
  });

  it("offers only named placed gateways and lets selection reconnect an unresolved row", async () => {
    const registry = [
      ...gateways,
      { ...gateways[0], id: "unnamed", name: "  " },
    ];
    await render(
      [{ gateway: "Old gateway", rssi: "-99", snr: "-2" }],
      registry,
    );
    expect(
      [...host.querySelectorAll(".gateway-pill")].map(
        (pill) => pill.textContent,
      ),
    ).toEqual(["GW North", "GW South"]);
    expect(host.querySelectorAll("input")).toHaveLength(2);
    expect([...select(1).options].map((option) => option.textContent)).toEqual([
      "Old gateway (unlinked)",
      "GW North",
      "GW South",
    ]);
    expect(input("RSSI reading 1").disabled).toBe(true);
    await act(() => {
      select(1).value = "south";
      select(1).dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(saved()).toEqual([
      { gateway: "GW South", gatewayId: "south", rssi: "-99", snr: "-2" },
    ]);
    expect(input("RSSI reading 1").disabled).toBe(false);
    expect(input("SNR reading 1").disabled).toBe(false);
  });

  it("appends a blank row on every gateway pill tap and focuses the new RSSI", async () => {
    await render([reading()]);
    await click("Add reading for GW South");
    await click("Add reading for GW South");
    expect(saved()).toEqual([
      reading(),
      { gatewayId: "south", gateway: "GW South", rssi: "", snr: "" },
      { gatewayId: "south", gateway: "GW South", rssi: "", snr: "" },
    ]);
    expect(document.activeElement).toBe(input("RSSI reading 3"));
  });

  it("manual Add chooses the first available named gateway and focuses RSSI", async () => {
    await render(
      [],
      [{ ...gateways[0], id: "unnamed", name: "" }, gateways[1]],
    );
    await act(() =>
      host.querySelector<HTMLButtonElement>("#add-reading")!.click(),
    );
    expect(saved()).toEqual([
      { gatewayId: "south", gateway: "GW South", rssi: "", snr: "" },
    ]);
    expect(document.activeElement).toBe(input("RSSI reading 1"));
  });

  it("uses a fixed RSSI minus prefix and normalizes magnitudes and signed pastes", async () => {
    await render([reading()]);
    expect(input("RSSI reading 1").value).toBe("87");
    const prefix = host.querySelector(".numeric-input__prefix")!;
    expect(prefix.textContent).toBe("−");
    await enter("RSSI reading 1", "92.5");
    expect(saved()[0].rssi).toBe("-92.5");
    expect(input("RSSI reading 1").value).toBe("92.5");
    await enter("RSSI reading 1", "-81.25");
    expect(saved()[0].rssi).toBe("-81.25");
    expect(input("RSSI reading 1").value).toBe("81.25");
    await enter("RSSI reading 1", "");
    expect(saved()[0].rssi).toBe("");
    expect(prefix.textContent).toBe("−");
  });

  it("rejects nonnumeric signal edits and supports signed SNR decimals and its sign toggle", async () => {
    await render([reading()]);
    for (const invalid of [
      "letters",
      "1e3",
      "NaN",
      "Infinity",
      "1.2.3",
      "--2",
    ]) {
      await enter("RSSI reading 1", invalid);
      await enter("SNR reading 1", invalid);
    }
    expect(saved()).toEqual([reading()]);
    await enter("SNR reading 1", "-.");
    expect(saved()[0].snr).toBe("-.");
    await enter("SNR reading 1", "-2.75");
    expect(saved()[0].snr).toBe("-2.75");
    await click("Toggle sign for SNR reading 1");
    expect(saved()[0].snr).toBe("2.75");
    await click("Toggle sign for SNR reading 1");
    expect(saved()[0].snr).toBe("-2.75");
  });

  it("resolves legacy named rows but preserves unknown rows and invalid explicit links as disabled", async () => {
    const rows: Reading[] = [
      { gateway: "gw north", rssi: "-80", snr: "0" },
      { gateway: "Missing", rssi: "-99", snr: "-4" },
      { gatewayId: "deleted", gateway: "GW North", rssi: "-91", snr: "2" },
    ];
    await render(rows);
    expect(select(1).value).toBe("north");
    expect(input("RSSI reading 1").disabled).toBe(false);
    expect(input("RSSI reading 2").disabled).toBe(true);
    expect(input("RSSI reading 2").value).toBe("99");
    expect(input("SNR reading 2").value).toBe("-4");
    expect(input("RSSI reading 3").disabled).toBe(true);
    expect(saved()).toEqual(rows);
  });

  it("does not treat an unnamed gateway pin as available", async () => {
    await render([], [{ ...gateways[0], name: " " }]);
    expect(host.textContent).toContain(
      "Add a gateway pin to enter signal readings.",
    );
    expect(
      host.querySelector<HTMLButtonElement>("#add-reading")!.disabled,
    ).toBe(true);
    expect(host.querySelector(".gateway-pill")).toBeNull();
  });

  it("disables add controls at 300 rows while allowing removal and subsequent additions", async () => {
    await render(Array.from({ length: 300 }, () => reading()));
    const add = host.querySelector<HTMLButtonElement>("#add-reading")!;
    expect(add.disabled).toBe(true);
    expect(
      [...host.querySelectorAll<HTMLButtonElement>(".gateway-pill")].every(
        (pill) => pill.disabled,
      ),
    ).toBe(true);
    await click("Add reading for GW South");
    expect(saved()).toHaveLength(300);
    await click("Remove reading 300");
    expect(add.disabled).toBe(false);
    await click("Add reading for GW South");
    expect(saved()).toHaveLength(300);
    expect(saved()[299]).toEqual({
      gatewayId: "south",
      gateway: "GW South",
      rssi: "",
      snr: "",
    });
  });
});

import * as gatewaySelectors from "@/features/annotator/domain/gateways";
import { describe, it, expect, vi } from "vitest";
import {
  createItem,
  createPlacedAnnotation,
  emptyProject,
} from "@/features/annotator/domain/annotations";
import { applyProjectCommand } from "@/features/annotator/domain/projectCommands";
import {
  registeredGateways,
  resolveReadingGateway,
} from "@/features/annotator/domain/gateways";
import { validateProject } from "@/features/annotator/domain/projectSchema";
import { reportRows } from "@/features/annotator/domain/signalReadings";
import { gatewayTriangle } from "@/features/annotator/domain/annotationGeometry";
import { drawItem } from "@/features/annotator/exports/canvasRenderer";
import type {
  AnnotationPatch,
  DotAnnotation,
  Project,
} from "@/features/annotator/domain/types";
function fixture() {
  const gateway = createItem("gateway", [0.1, 0.1], "#127a50", 2.6, 1),
    point = createItem("point", [0.5, 0.5], "#d8322a", 2.6, 1);
  return {
    gateway,
    point,
    project: {
      ...emptyProject(),
      image: {
        src: "data:image/png;base64,AAAA",
        name: "plan.png",
        width: 1200,
        height: 800,
      },
      items: [gateway, point],
      nextNumber: 2,
    } satisfies Project,
  };
}
function pointOf(project: Project): DotAnnotation {
  const point = project.items.find((item) => item.type === "point");
  if (!point || point.type !== "point") throw new Error("Expected point");
  return point;
}

describe("placed gateway identity and signal policy", () => {
  it("allocates gateway labels separately from detector numbers", () => {
    const project = emptyProject();
    const gateway = createPlacedAnnotation(
      project,
      "gateway",
      [0.1, 0.2],
      "#127a50",
      2.6,
    );
    expect(gateway).toMatchObject({
      type: "gateway",
      number: 1,
      name: "Gateway 1",
    });
    const next = applyProjectCommand(project, {
      type: "annotation.add",
      annotation: gateway,
    });
    expect(next.nextNumber).toBe(1);
    const point = createPlacedAnnotation(
      next,
      "point",
      [0.5, 0.5],
      "#d8322a",
      2.6,
    );
    expect(point).toMatchObject({ type: "point", number: 1 });
  });
  it("rejects signal creation without a named placed gateway", () => {
    const { project, point } = fixture();
    const without = { ...project, items: [point] };
    expect(() =>
      applyProjectCommand(without, {
        type: "reading.add",
        pointId: point.id,
        gatewayId: "invented",
      }),
    ).toThrow("placed gateway");
    expect(() =>
      applyProjectCommand(without, {
        type: "reading.update",
        pointId: point.id,
        index: 0,
        patch: { rssi: "85" },
      }),
    ).toThrow("placed gateway");
  });
  it("does not register an unnamed triangle and rejects duplicate gateway names", () => {
    const { project, gateway } = fixture();
    const unnamed = applyProjectCommand(project, {
      type: "annotation.update",
      id: gateway.id,
      patch: { name: " " },
    });
    expect(registeredGateways(unnamed.items)).toHaveLength(0);
    const second = createItem("gateway", [0.8, 0.8], "#127a50", 2.6, 2);
    const withSecond = { ...project, items: [...project.items, second] };
    expect(() =>
      applyProjectCommand(withSecond, {
        type: "annotation.update",
        id: second.id,
        patch: { name: " gateway 1 " },
      }),
    ).toThrow("unique");
  });
  it("adds a gateway-linked blank row for every command", () => {
    const { project, gateway, point } = fixture();
    let next: Project = project;
    for (let i = 0; i < 2; i++)
      next = applyProjectCommand(next, {
        type: "reading.add",
        pointId: point.id,
        gatewayId: gateway.id,
      });
    expect(pointOf(next).readings.slice(-2)).toEqual(
      Array.from({ length: 2 }, () => ({
        gatewayId: gateway.id,
        gateway: "Gateway 1",
        rssi: "",
        snr: "",
      })),
    );
  });
  it("canonicalizes RSSI to negative and allows signed decimal SNR including zero", () => {
    const { project, gateway, point } = fixture();
    let next = applyProjectCommand(project, {
      type: "reading.update",
      pointId: point.id,
      index: 0,
      patch: { gatewayId: gateway.id },
    });
    next = applyProjectCommand(next, {
      type: "reading.update",
      pointId: point.id,
      index: 0,
      patch: { rssi: "87.5", snr: "-2.5" },
    });
    expect(pointOf(next).readings[0]).toMatchObject({
      gatewayId: gateway.id,
      rssi: "-87.5",
      snr: "-2.5",
    });
    next = applyProjectCommand(next, {
      type: "reading.update",
      pointId: point.id,
      index: 0,
      patch: { snr: "0" },
    });
    expect(reportRows(next)[0].state).toBe("Complete");
  });
  it.each(["abc", "1e3", "Infinity", "NaN", "--2", "1.2.3"])(
    "rejects non-numeric entry %s in domain commands",
    (invalid) => {
      const { project, gateway, point } = fixture();
      const selected = applyProjectCommand(project, {
        type: "reading.update",
        pointId: point.id,
        index: 0,
        patch: { gatewayId: gateway.id },
      });
      expect(() =>
        applyProjectCommand(selected, {
          type: "reading.update",
          pointId: point.id,
          index: 0,
          patch: { rssi: invalid },
        }),
      ).toThrow("numeric");
      expect(() =>
        applyProjectCommand(selected, {
          type: "reading.update",
          pointId: point.id,
          index: 0,
          patch: { snr: invalid },
        }),
      ).toThrow("numeric");
    },
  );
  it("keeps old readings visible but locks edits after their gateway is removed", () => {
    const { project, gateway, point } = fixture();
    let next = applyProjectCommand(project, {
      type: "reading.update",
      pointId: point.id,
      index: 0,
      patch: { gatewayId: gateway.id },
    });
    next = applyProjectCommand(next, {
      type: "reading.update",
      pointId: point.id,
      index: 0,
      patch: { rssi: "85", snr: "0" },
    });
    next = applyProjectCommand(next, {
      type: "annotation.remove",
      id: gateway.id,
    });
    expect(pointOf(next).readings[0].rssi).toBe("-85");
    expect(reportRows(next)[0].gateway).toBe("Gateway 1");
    expect(() =>
      applyProjectCommand(next, {
        type: "reading.update",
        pointId: point.id,
        index: 0,
        patch: { snr: "1" },
      }),
    ).toThrow("placed gateway");
  });
  it("does not relink a removed explicit id just because a gateway has the same name", () => {
    const { gateway } = fixture();
    expect(
      resolveReadingGateway(
        { gateway: "Gateway 1", gatewayId: "removed", rssi: "-85", snr: "0" },
        [gateway],
      ),
    ).toBeUndefined();
    expect(
      resolveReadingGateway(
        { gateway: "Gateway 1", gatewayId: "", rssi: "-85", snr: "0" },
        [gateway],
      ),
    ).toBeUndefined();
  });
  it("links a matching legacy name without losing its saved values", () => {
    const { project, point, gateway } = fixture();
    point.readings[0] = { gateway: "Gateway 1", rssi: "-87", snr: "0" };
    const next = applyProjectCommand(project, {
      type: "reading.update",
      pointId: point.id,
      index: 0,
      patch: { gatewayId: gateway.id },
    });
    expect(pointOf(next).readings[0]).toEqual({
      gateway: "Gateway 1",
      gatewayId: gateway.id,
      rssi: "-87",
      snr: "0",
    });
  });
  it("clears signal values when a row is assigned to a different gateway", () => {
    const { project, point, gateway } = fixture(),
      second = createItem("gateway", [0.8, 0.8], "#127a50", 2.6, 2);
    point.readings[0] = {
      gatewayId: gateway.id,
      gateway: gateway.name,
      rssi: "-87",
      snr: "0",
    };
    const next = applyProjectCommand(
      { ...project, items: [...project.items, second] },
      {
        type: "reading.update",
        pointId: point.id,
        index: 0,
        patch: { gatewayId: second.id },
      },
    );
    expect(pointOf(next).readings[0]).toMatchObject({
      gatewayId: second.id,
      rssi: "",
      snr: "",
    });
  });
  it("uses the current registered name in reports while retaining the saved fallback", () => {
    const { project, point, gateway } = fixture();
    point.readings[0] = {
      gatewayId: gateway.id,
      gateway: gateway.name,
      rssi: "-87",
      snr: "0",
    };
    const renamed = applyProjectCommand(project, {
      type: "annotation.update",
      id: gateway.id,
      patch: { name: "Roof gateway" },
    });
    expect(reportRows(renamed)[0].gateway).toBe("Roof gateway");
    expect(pointOf(renamed).readings[0].gateway).toBe("Gateway 1");
  });
  it("cannot bypass signal policy through an annotation metadata patch", () => {
    const { project, point } = fixture();
    const patch = {
      readings: [{ gateway: "invented", rssi: "-85", snr: "0" }],
    } as unknown as AnnotationPatch;
    const next = applyProjectCommand(project, {
      type: "annotation.update",
      id: point.id,
      patch,
    });
    expect(pointOf(next).readings).toEqual(point.readings);
  });
  it("round trips gateway pins, associations, and unfinished numeric drafts", () => {
    const { project, gateway, point } = fixture();
    point.readings[0] = {
      gatewayId: gateway.id,
      gateway: gateway.name,
      rssi: "-.",
      snr: "-",
    };
    const restored = validateProject(JSON.parse(JSON.stringify(project)));
    expect(restored.version).toBe(2);
    expect(restored.items).toEqual(project.items);
  });
  it("upgrades version-one records without inventing a gateway location", () => {
    const { project, point } = fixture();
    point.readings[0] = { gateway: "Old GW", rssi: "-87", snr: "0" };
    const restored = validateProject({
      ...project,
      version: 1,
      items: [point],
    });
    expect(restored.version).toBe(2);
    expect(registeredGateways(restored.items)).toHaveLength(0);
    expect(pointOf(restored).readings[0]).toEqual(point.readings[0]);
  });
  it("renders gateway triangles into exported images with their own label", () => {
    const { gateway, project } = fixture();
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
    };
    drawItem(
      ctx as unknown as CanvasRenderingContext2D,
      gateway,
      project.image!,
    );
    const radius = (project.image!.width * gateway.size) / 200,
      vertices = gatewayTriangle(120, 80, radius);
    expect(ctx.moveTo).toHaveBeenCalledWith(...vertices[0]);
    expect(ctx.lineTo).toHaveBeenCalledWith(...vertices[1]);
    expect(ctx.fillText).toHaveBeenCalledWith("G1", 120, 80);
  });
});

describe("gateway data round-trip regressions", () => {
  it.each(["0.0000001", "1e-100", "-1e-7"])(
    "keeps legacy numeric representation %s readable after save and reopen",
    (value) => {
      const { project, point } = fixture();
      point.readings[0] = { gateway: "Legacy GW", rssi: "-87", snr: value };
      const migrated = validateProject({
        ...project,
        version: 1,
        items: [point],
      });
      expect(
        validateProject(JSON.parse(JSON.stringify(migrated))).items,
      ).toEqual(migrated.items);
      expect(pointOf(migrated).readings[0].snr).toBe(value);
    },
  );
  it("rejects a numeric entry that cannot fit in the saved-project schema", () => {
    const { project, point, gateway } = fixture();
    const selected = applyProjectCommand(project, {
      type: "reading.update",
      pointId: point.id,
      index: 0,
      patch: { gatewayId: gateway.id },
    });
    expect(() =>
      applyProjectCommand(selected, {
        type: "reading.update",
        pointId: point.id,
        index: 0,
        patch: { snr: "9".repeat(41) },
      }),
    ).toThrow();
    expect(() =>
      applyProjectCommand(selected, {
        type: "reading.update",
        pointId: point.id,
        index: 0,
        patch: { rssi: "9".repeat(40) },
      }),
    ).toThrow();
  });
});

it("builds the gateway lookup once for a large report", () => {
  const { project, point, gateway } = fixture();
  const many = {
    ...project,
    items: [
      gateway,
      ...Array.from({ length: 100 }, (_, index) => ({
        ...point,
        id: "point-" + index,
        number: index + 1,
        readings: Array.from({ length: 20 }, () => ({
          gatewayId: gateway.id,
          gateway: gateway.name,
          rssi: "-87",
          snr: "0",
        })),
      })),
    ],
  };
  const scan = vi.spyOn(gatewaySelectors, "registeredGateways");
  try {
    expect(reportRows(many)).toHaveLength(2000);
    expect(scan).toHaveBeenCalledTimes(1);
  } finally {
    scan.mockRestore();
  }
});

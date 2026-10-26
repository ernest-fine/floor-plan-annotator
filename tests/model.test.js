import { describe, it, expect } from "vitest";
import {
  emptyProject,
  createItem,
  validateProject,
  validReading,
  moveItem,
  historyReducer,
  arrowHead,
} from "../src/lib/model.js";
import { reportRows, fileBase } from "../src/lib/exports.js";

const point = () => createItem("point", [0.2, 0.3], "#d8322a", 2.8, 1);
const project = () => ({
  ...emptyProject(),
  title: "Bay A",
  image: {
    src: "data:image/png;base64,AAAA",
    name: "map.png",
    width: 1200,
    height: 800,
  },
  items: [point()],
  nextNumber: 2,
});

describe("project compatibility and readings", () => {
  it("accepts original version-one JSON and derives the next point number", () => {
    const value = project();
    value.nextNumber = 99;
    value.items[0].readings = [{ gateway: "GW A", rssi: "-87", snr: "0" }];
    const result = validateProject(JSON.parse(JSON.stringify(value)));
    expect(result.nextNumber).toBe(2);
    expect(result.items[0].readings[0].snr).toBe("0");
  });
  it("treats zero SNR as recorded and blanks as incomplete", () => {
    expect(validReading({ gateway: "A", rssi: "-87", snr: "0" })).toBe(true);
    expect(validReading({ gateway: "A", rssi: "-87", snr: "" })).toBe(false);
  });
  it("retains multiple gateways and untested points in reports", () => {
    const value = project();
    value.items[0].readings = [
      { gateway: "A", rssi: "-87", snr: "0" },
      { gateway: "B", rssi: "-99", snr: "-2.5" },
    ];
    value.items.push({ ...point(), id: "second", number: 2 });
    expect(reportRows(value).map((r) => r.state)).toEqual([
      "Complete",
      "Complete",
      "Not tested",
    ]);
  });
  it("rejects duplicate identifiers and nonfinite coordinates", () => {
    const value = project();
    value.items.push({ ...value.items[0] });
    expect(() => validateProject(value)).toThrow("invalid annotation");
    value.items.pop();
    value.items[0].x = Infinity;
    expect(() => validateProject(value)).toThrow("invalid position");
  });
  it("rejects executable image sources and invalid reading values", () => {
    const value = project();
    value.image.src = "https://example.com/private.png";
    expect(() => validateProject(value)).toThrow("image is invalid");
    const other = project();
    other.items[0].readings[0].snr = "NaN";
    expect(() => validateProject(other)).toThrow("invalid readings");
  });
  it("cleans unsafe filename characters", () =>
    expect(fileBase({ title: "Bay/A:1", image: null })).toBe("Bay-A-1"));
});

describe("annotation geometry and history", () => {
  it("clamps point movement to map edges", () => {
    expect(moveItem(point(), -1, 3)).toMatchObject({ x: 0, y: 1 });
  });
  it("moves all handwriting coordinates together without distorting a stroke", () => {
    const stroke = {
      type: "pen",
      points: [
        [0.2, 0.3],
        [0.8, 0.7],
      ],
    };
    const moved = moveItem(stroke, 1, -1).points;
    expect(moved[0][0]).toBeCloseTo(0.4);
    expect(moved[0][1]).toBe(0);
    expect(moved[1][0]).toBe(1);
    expect(moved[1][1]).toBeCloseTo(0.4);
    expect(stroke.points).toEqual([
      [0.2, 0.3],
      [0.8, 0.7],
    ]);
  });
  it("places an arrowhead at its endpoint", () => {
    expect(
      arrowHead(
        [
          [1, 1],
          [100, 80],
        ],
        3,
      )[0],
    ).toEqual([100, 80]);
  });
  it("undoes and redoes without copying image bytes", () => {
    const original = project();
    let state = { present: original, past: [], future: [] };
    state = historyReducer(state, {
      type: "commit",
      project: { ...original, title: "Changed" },
    });
    expect(state.past[0].image).toBe(state.present.image);
    state = historyReducer(state, { type: "undo" });
    expect(state.present.title).toBe("Bay A");
    state = historyReducer(state, { type: "redo" });
    expect(state.present.title).toBe("Changed");
  });
  it("clears redo after a new edit and caps undo memory", () => {
    let state = { present: project(), past: [], future: [] };
    for (let i = 0; i < 50; i++)
      state = historyReducer(state, {
        type: "commit",
        project: { ...state.present, title: String(i) },
      });
    expect(state.past).toHaveLength(40);
    state = historyReducer(state, { type: "undo" });
    state = historyReducer(state, {
      type: "commit",
      project: { ...state.present, title: "New branch" },
    });
    expect(state.future).toHaveLength(0);
  });
});

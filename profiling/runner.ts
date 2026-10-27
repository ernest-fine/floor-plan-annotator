import type { Annotation, Project, Position } from "../src/features/annotator/domain/types";
type Metrics = {
  counts: Record<string, number>;
  puts: {
    store: string;
    imageChars: number;
    syncMs: number;
    transactionMs: number;
  }[];
  longTasks: number[];
};
const frame = document.getElementById("phone") as HTMLIFrameElement;
const output = document.getElementById("results")!;
const status = document.getElementById("status")!;
let report: Record<string, unknown>;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (n: number) => Math.round(n * 100) / 100;
function snapshot(m: Metrics) {
  return {
    counts: { ...m.counts },
    puts: m.puts.length,
    tasks: m.longTasks.length,
  };
}
function delta(m: Metrics, before: ReturnType<typeof snapshot>) {
  return {
    counts: Object.fromEntries(
      Object.entries(m.counts).map(([k, v]) => [
        k,
        v - (before.counts[k] || 0),
      ]),
    ),
    writes: m.puts.slice(before.puts).map((p) => ({
      ...p,
      syncMs: round(p.syncMs),
      transactionMs: round(p.transactionMs),
    })),
    longTasks: m.longTasks.slice(before.tasks).map(round),
  };
}
function fixture(count: number, large = false): Project {
  const canvas = document.createElement("canvas");
  canvas.width = large ? 4000 : 1179;
  canvas.height = large ? 3000 : 2556;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fafbf9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#46584a";
  ctx.lineWidth = 5;
  for (let y = 80; y < canvas.height - 80; y += 200)
    for (let x = 60; x < canvas.width - 60; x += 180) {
      ctx.strokeRect(x, y, 160, 170);
      ctx.fillStyle = "#45584b";
      ctx.font = "24px sans-serif";
      ctx.fillText("ROOM " + Math.floor(x + y), x + 12, y + 40);
    }
  const src = canvas.toDataURL("image/png");
  const image = {
    src,
    name: large ? "large-plan.png" : "phone-screenshot.png",
    width: canvas.width,
    height: canvas.height,
  };
  canvas.width = canvas.height = 1;
  const items: Annotation[] = Array.from({ length: count }, (_, i) => ({
    id: "p" + i,
    type: "point",
    color: "#d8322a",
    size: 2.6,
    x: 0.08 + (i % 20) / 24,
    y: 0.08 + (Math.floor(i / 20) % 25) / 30,
    number: i + 1,
    name: "Point " + (i + 1),
    notes: "",
    readings: [
      { gateway: "GW North", rssi: "-87", snr: "0" },
      { gateway: "GW South", rssi: "-99", snr: "-2" },
    ],
  }));
  if (large)
    for (let j = 0; j < 40; j++)
      items.push({
        id: "s" + j,
        type: "pen",
        color: "#2f6fd6",
        size: 2.6,
        points: Array.from({ length: 160 }, (_, i): Position => [
          0.1 + i / 220,
          0.15 + j * 0.015 + Math.sin(i * 0.08) * 0.02,
        ]),
      });
  return {
    version: 1,
    title: "Synthetic profile",
    image,
    items,
    nextNumber: count + 1,
  };
}
async function waitFor(test: () => boolean, timeout = 15000) {
  const start = performance.now();
  while (!test()) {
    if (performance.now() - start > timeout)
      throw new Error("Timed out waiting for app");
    await sleep(50);
  }
}
async function load(project: Project) {
  frame.src = `./frame.html?run=${Date.now()}`;
  await new Promise<void>((resolve) => {
    frame.onload = () => {
      frame.contentWindow!.postMessage(
        { type: "profile-fixture", project },
        location.origin,
      );
      resolve();
    };
  });
  const win = frame.contentWindow!,
    doc = frame.contentDocument!;
  await waitFor(
    () =>
      !!doc.querySelector("#map-image") &&
      (doc.querySelector("#map-image") as HTMLImageElement).complete &&
      doc.getElementById("mobile-count")?.textContent ===
        String(project.items.length),
  );
  await sleep(3700);
  return {
    win,
    doc,
    m: (win as unknown as { __annotatorProfile: Metrics }).__annotatorProfile,
  };
}
async function paint(win: Window) {
  await new Promise<void>((resolve) =>
    win.requestAnimationFrame(() => win.setTimeout(resolve, 0)),
  );
}
async function idle(ctx: Awaited<ReturnType<typeof load>>) {
  const before = snapshot(ctx.m),
    start = performance.now(),
    delays: number[] = [];
  let expected = performance.now() + 100;
  const timer = setInterval(() => {
    const now = performance.now();
    delays.push(Math.max(0, now - expected));
    expected = now + 100;
  }, 100);
  await sleep(6000);
  clearInterval(timer);
  return {
    ...delta(ctx.m, before),
    durationMs: round(performance.now() - start),
    maxTimerDelayMs: round(Math.max(...delays)),
    domNodes: ctx.doc.querySelectorAll("*").length,
    hiddenListRows: ctx.doc.querySelectorAll("#item-list .item-row").length,
  };
}
async function zoom(ctx: Awaited<ReturnType<typeof load>>) {
  const before = snapshot(ctx.m),
    durations: number[] = [];
  for (let i = 0; i < 16; i++) {
    const start = performance.now();
    (
      ctx.doc.getElementById(
        i % 2 ? "zoom-out" : "zoom-in",
      ) as HTMLButtonElement
    ).click();
    await paint(ctx.win);
    durations.push(performance.now() - start);
  }
  return {
    ...delta(ctx.m, before),
    steps: durations.length,
    medianPaintMs: round(
      durations.slice().sort((a, b) => a - b)[Math.floor(durations.length / 2)],
    ),
    maxPaintMs: round(Math.max(...durations)),
  };
}
async function draw(ctx: Awaited<ReturnType<typeof load>>) {
  (ctx.doc.getElementById("tools-toggle") as HTMLButtonElement).click();
  await paint(ctx.win);
  (
    ctx.doc.querySelector('[data-tool="pen"].tool') as HTMLButtonElement
  ).click();
  (
    ctx.doc.querySelector('[aria-label="Close tools"]') as HTMLButtonElement
  ).click();
  await paint(ctx.win);
  const el = ctx.doc.getElementById("overlay")!,
    rect = el.getBoundingClientRect();
  function pointer(type: string, x: number, y: number) {
    const E = (ctx.win as unknown as { PointerEvent: typeof PointerEvent })
      .PointerEvent;
    el.dispatchEvent(
      new E(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        clientX: rect.left + x * rect.width,
        clientY: rect.top + y * rect.height,
      }),
    );
  }
  const before = snapshot(ctx.m),
    start = performance.now();
  pointer("pointerdown", 0.15, 0.45);
  for (let i = 0; i < 240; i++) {
    pointer("pointermove", 0.15 + i * 0.002, 0.45 + Math.sin(i * 0.12) * 0.06);
    await sleep(2);
  }
  pointer("pointerup", 0.628, 0.45 + Math.sin(239 * 0.12) * 0.06);
  await paint(ctx.win);
  await sleep(700);
  return {
    ...delta(ctx.m, before),
    pointerMoves: 240,
    durationMs: round(performance.now() - start),
  };
}
async function save(ctx: Awaited<ReturnType<typeof load>>) {
  const before = snapshot(ctx.m);
  (ctx.doc.getElementById("mobile-list") as HTMLButtonElement).click();
  await paint(ctx.win);
  (ctx.doc.querySelector("#item-list .item-row") as HTMLButtonElement).click();
  await paint(ctx.win);
  const pill = ctx.doc.querySelector(".gateway-pill") as HTMLButtonElement;
  pill.click();
  await sleep(900);
  return delta(ctx.m, before);
}
async function verifyReload(project: Project, expectedCount: number) {
  const url = new URL(frame.src);
  url.searchParams.set("restore", "1");
  frame.onload = null;
  frame.src = url.href;
  await waitFor(
    () =>
      frame.contentDocument?.getElementById("mobile-count")?.textContent ===
        String(expectedCount) &&
      !!(
        frame.contentDocument?.getElementById(
          "map-image",
        ) as HTMLImageElement | null
      )?.complete,
  );
  const restoredImage = frame.contentDocument!.getElementById(
    "map-image",
  ) as HTMLImageElement;
  return {
    annotationsRestored: Number(
      frame.contentDocument!.getElementById("mobile-count")!.textContent,
    ),
    imageRestored: restoredImage.getAttribute("src") === project.image!.src,
  };
}
(document.getElementById("run") as HTMLButtonElement).onclick = async () => {
  (document.getElementById("run") as HTMLButtonElement).disabled = true;
  try {
    report = {
      browser: navigator.userAgent,
      visibility: document.visibilityState,
      viewport: "390 × 700 CSS px",
      timestamp: new Date().toISOString(),
      cases: [],
    };
    for (const [name, count, large] of [
      ["phone screenshot / 6 pins", 6, false],
      ["large plan / 500 pins + 40 strokes", 500, true],
    ] as const) {
      status.textContent = "Profiling " + name + "…";
      const project = fixture(count, large),
        ctx = await load(project);
      const result = {
        name,
        imagePixels: project.image!.width * project.image!.height,
        imageChars: project.image!.src.length,
        idle: await idle(ctx),
        zoom: await zoom(ctx),
        drawing: await draw(ctx),
        readingEdit: await save(ctx),
        reload: await verifyReload(project, project.items.length + 1),
      };
      (report.cases as unknown[]).push(result);
      output.textContent = JSON.stringify(report, null, 2);
    }
    status.textContent = "Profile complete";
    (document.getElementById("download") as HTMLButtonElement).disabled = false;
  } catch (error) {
    status.textContent = "ERROR: " + String(error);
  } finally {
    (document.getElementById("run") as HTMLButtonElement).disabled = false;
  }
};
(document.getElementById("download") as HTMLButtonElement).onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
  );
  a.download = "annotator-profile.json";
  a.click();
};

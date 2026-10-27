# Floor Plan Annotator

React + TypeScript application for technicians to annotate floor plans and record manual gateway signal readings.

**Live:** https://ernest-fine.github.io/floor-plan-annotator/

## Development

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Use `npm run typecheck` for strict TypeScript checks, `npm test` for project/geometry/history and touch-gesture tests, `npm run build` for a type-checked production build, and `npm run preview` to inspect the production build.

## Features

- Full-viewport floor plan; collapsible floating panels and Hide controls.
- Phone-readable colored pins with gateway, RSSI (dBm), and SNR (dB) readings.
- Text, arrows, handwriting, move/delete, undo/redo.
- One-finger pan in Select; two-finger pinch zoom in all tools.
- Annotated PNG with optional readings table; CSV; editable `.floor-map.json` projects.
- Browser-local autosave; compatible with project files from the original HTML tool.

Images and readings stay on the device. Input limits: 25 MB / 24 megapixels. Save a project JSON to transfer work between browsers or devices.

## Source

- `src/App.tsx`: application state and commands.
- `src/components/`: map interaction, SVG annotations, and floating panels.
- `src/hooks/useProject.ts`: undo/redo and browser persistence.
- `src/lib/`: project schema, geometry, files, IndexedDB, and image/CSV export.
- `tests/`: project compatibility, signal values, history, pin sizing, and pinch gesture regression tests.

GitHub Actions tests, builds, and publishes `dist/` on pushes to `main`. Vite's base path is `/floor-plan-annotator/`.

## Performance profiling

The map owns its zoom and frame-batched gesture updates. Closed panels are unmounted, and autosave writes the image once plus lightweight document snapshots on later edits. Downloaded project files keep their embedded image and version-one format.

[Measurements, reproduction steps, and investigation limits](docs/performance/README.md). Profiling fixtures/probes are local-only build entries and are excluded from the GitHub Pages production build.

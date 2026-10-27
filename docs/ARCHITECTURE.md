# Annotator architecture

The app follows the dashboard's `app / features / shared` boundaries, scaled to one browser-local editor. All React source and component tests use TSX. Runtime dependencies remain React and React DOM.

## Module ownership

- `src/app`: entry point, global styles, and a thin app shell importing the annotator's public entry.
- `src/features/annotator/pages/AnnotatorPage.tsx`: composes the editor, panels, command hooks, persistence, and exports.
- `components/map`: SVG annotation rendering, the map DOM, and independently updated zoom controls.
- `components/panels`: one module per panel; signal readings and gateway pills are separate components.
- `components/workspace`: floating editor controls and file-picker inputs.
- `hooks/useProjectDocument.ts`: document snapshots, typed commands, revision ownership, undo and redo. It does not perform storage I/O.
- `hooks/useProjectPersistence.ts`: startup restoration, debounced autosave, and lifecycle saves. It cannot mutate a revision ref; it uses the document's semantic API and revision getter to reject stale restores.
- `hooks/useProjectFiles.ts`: file parsing/import ordering and editable project download. Import completion cancels active map interaction even when the image bytes are unchanged.
- `hooks/useProjectExport.ts`: export progress and browser downloads.
- `hooks/useEditorState.ts`: selected annotation, active tool, open panel, colors and the 2.6 initial size.
- `hooks/useMapViewport.ts`: border-box measurement, fitted dimensions, zoom anchors, and frame-batched pinch updates.
- `hooks/useAnnotationGestures.ts`: pointer capture, transient drafts, movement, placement, and cancellation. A completed gesture emits one document command.
- `domain`: data types, schema validation, document/history reducers, commands, reading selectors, gateway identity, and pure geometry. No React, DOM, storage, or export imports.
- `io`, `persistence`, `exports`: browser boundaries. SVG and PNG consume the same triangle/arrow geometry.
- `src/shared`: generic buttons, panels, fields, numeric input, map controls, notices, and common styles/utilities. It cannot import app or feature code.

`tests/architecture.test.ts` enforces these import boundaries and prevents the retired loose source paths and JSX files from returning.

## Gateway and signal contracts

Gateways are triangle annotations with independent `G1`, `G2`, … labels. Their IDs are the canonical identity for new readings. Signal entry requires a named gateway pin on the map and a valid gateway selection for the row. Entry is guarded in both the UI and document commands.

`Reading.gatewayId` links to a placed gateway; `Reading.gateway` retains a saved name as a fallback for legacy or removed gateways. Renaming a gateway updates its displayed/report name through the ID lookup without rewriting all readings. Removing a gateway retains saved evidence but prevents further entry for that missing ID. A removed ID never silently relinks to a replacement with the same name.

RSSI entry has a fixed negative prefix and is stored with a leading minus sign. SNR supports signed decimals, including a sign-toggle button for phone decimal keyboards. Inputs and commands share a 40-character stored-value limit, including the RSSI sign. Draft strings such as `-` and `.` remain incomplete rather than being reported as completed tests. New entry rejects letters, exponent syntax, Infinity, and NaN.

## Persistence and file compatibility

Current editable files use project version two for gateway entities and associations. Version-one files and autosaves remain readable. Legacy numeric representations are preserved exactly; the reader accepts their finite numeric strings while new entry is limited to decimal drafts. Existing readings are not discarded or given invented gateway positions.

The repository retains the existing IndexedDB store and its image-separated, transactional format. Image data is written once, metadata saves stay ordered, failed replacements retain the previous document, and obsolete image assets are removed. Exported `.floor-map.json` files still contain the full embedded image for portability.

## Performance invariants

- Viewport state and preview frames remain below the page state boundary.
- Closed panels are unmounted.
- Pointer samples are retained while publication is limited to one animation frame.
- Identical resize notifications do not commit renders; fitted image widths do not overflow due to rounding.
- Pending input/zoom frames are cancelled on backgrounding, unmount, explicit cancellation, and project replacement.
- History shares unchanged image references.
- Reports build the gateway lookup once rather than scanning all annotations per reading.
- Profiling code is injected only in profile builds. Required probe owners are asserted at build time so a moved module cannot produce misleading zero counters.

The test suite covers boundaries, storage migration/failure/order, stale restores/imports, numeric rules, gateway prerequisites, gesture cancellation and frame budgets. `profiling/` provides the same production-mode phone-sized benchmark used before the refactor. It now includes two placed gateways to exercise the signal workflow. Desktop measurements do not establish that the reported iPhone idle heat is fixed.

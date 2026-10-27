# Performance investigation

## Scope

Reported symptom: iPhone becomes hot while idle with a phone-resolution screenshot and few annotations.

Measurements use synthetic fixtures in a 390 × 700 CSS pixel iframe, a production-mode React build, and local-only probes. This isolates the application from personal projects and keeps profiling code out of the deployed build. Desktop Chromium and desktop Safari are useful controls; neither substitutes for a physical iPhone thermal/energy trace.

Run `npm run build -- --mode profile`, then `npm run preview -- --outDir profile-dist --port 8795`. Open `/floor-plan-annotator/profiling/index.html`, press Run profile, and download the JSON report.

The fixture database is isolated from the normal application database. The harness disables pointer capture only for its synthetic pointer events. Normal production pointer capture is unchanged.

## Baseline

`baseline-chromium.json` records the unoptimized baseline. The small fixture has 6 pins and a 3,013,524-pixel image. Its six-second settled idle sample produced zero React renders, viewport resize callbacks, storage writes, or observed long tasks. The iPhone's idle heat symptom was therefore not reproduced in this control.

The profile does demonstrate offscreen annotation-list work on every zoom update, repeated full-image autosave payloads, and more than 200 map renders for one 240-event pen stroke. The larger fixture retains 540 closed-list rows and 5,444 DOM elements.

## Before / after

The JSON files contain one recorded production-mode run per version on the same desktop Chromium engine. Operation counts and retained DOM are the primary comparison; single-run frame timings are not a phone FPS or battery benchmark. Both runs reported `visibility: visible`.

### phone screenshot / 6 pins

| Metric                                        | Before | After |
| --------------------------------------------- | -----: | ----: |
| Settled idle app renders / writes             |  0 / 0 | 0 / 0 |
| DOM elements, panels closed                   |    184 |    70 |
| Closed annotation-list rows                   |      6 |     0 |
| App renders for 16 zoom steps                 |     16 |     0 |
| List renders for 16 zoom steps                |     16 |     0 |
| Resize measurements for 16 zoom steps         |     16 |     0 |
| Map renders for 240 pen events                |    218 |    71 |
| Image characters rewritten for a reading edit | 253418 |     0 |

### large plan / 500 pins + 40 strokes

| Metric                                        | Before | After |
| --------------------------------------------- | -----: | ----: |
| Settled idle app renders / writes             |  0 / 0 | 0 / 0 |
| DOM elements, panels closed                   |   5444 |  2660 |
| Closed annotation-list rows                   |    540 |     0 |
| App renders for 16 zoom steps                 |     16 |     0 |
| List renders for 16 zoom steps                |     16 |     0 |
| Resize measurements for 16 zoom steps         |     16 |     0 |
| Map renders for 240 pen events                |    185 |    69 |
| Image characters rewritten for a reading edit | 718686 |     0 |

## Changes and safeguards

- Zoom output owns its own small React state instead of invalidating the application tree.
- Closed panels are unmounted; their row lists, fields, and derived gateway names are not built while hidden.
- Drawing and pinch previews publish at most once per animation frame. Pointer samples remain intact, pending frames are cancelled when backgrounded/unmounted, and completed strokes still create one undo step.
- The viewport observes its border box, ignores identical geometry, and rounds fitted image width down to avoid fractional overflow.
- Immutable stroke geometry is memoized across zoom updates.
- Autosave keeps image assets separately in the existing IndexedDB store. Metadata and image switches are transactional; failed writes retain the previous project, obsolete image assets are removed, and save calls stay ordered.
- Existing version-one autosaves are read and migrated on the next successful save. The original optimization retained version-one downloads. The architecture release now writes version two with its embedded image and gateway references; version-one imports remain supported.

Five new resource regression assertions were run against the previous source and failed, then passed with the optimized source. The suite now includes idle quiescence, hidden panels, repeated resize callbacks, frame batching, background cancellation, legacy storage migration, image-write deduplication, atomic failure, and save ordering.

## Architecture and gateway release

`architecture-gateways-chromium.json` records the refactored application with two placed gateway pins added to each fixture. The same production-mode harness now probes the feature page rather than the thin app shell, so moving ownership cannot hide page renders. Profile builds fail if a required probe is missing.

| Metric                                         | Phone screenshot / 6 pins + 2 gateways | Large plan / 500 pins + 40 strokes + 2 gateways |
| ---------------------------------------------- | -------------------------------------: | ----------------------------------------------: |
| Settled idle app renders / writes / long tasks |                              0 / 0 / 0 |                                       0 / 0 / 0 |
| DOM elements, panels closed                    |                                     80 |                                            2670 |
| Closed annotation-list rows                    |                                      0 |                                               0 |
| App / list renders for 16 zoom steps           |                                  0 / 0 |                                           0 / 0 |
| Resize callbacks for 16 zoom steps             |                                      0 |                                               0 |
| Map renders for 240 pen events                 |                                     70 |                                              73 |
| Image characters rewritten for a reading edit  |                                      0 |                                               0 |
| Reload restores image and all annotations      |                                    Yes |                                             Yes |

Each pair of gateway pins adds ten DOM elements. Frame scheduling varies between runs; the retained rendering, storage and idle-work improvements remain intact. Gateway lookups are built once per report instead of rescanning annotations for each reading.

The release passes 94 automated tests, including architecture boundaries, numeric entry, gateway prerequisites, legacy project round trips, arrow endpoint geometry, import/restore races, gesture cancellation and existing resource regression checks. Browser checks at 320px and 390px covered gateway entry, rejected text input, signed readings, reload, project download and the rendered PNG. Both SVG and PNG use the same shortened arrow shaft with its tip at the final pointer position.

## Limits

The reported **iPhone heat while idle was not reproduced** in the visible desktop Chromium control. A desktop Safari attempt ran as a background/hidden window and suffered timer throttling, so its timings are excluded. No physical iPhone energy/GPU trace is available in this environment. This release removes measured work and adds idle-work guards; it does not claim that the reported thermal symptom has been confirmed fixed. Recheck the published app on the affected iPhone after loading the new build.

The profiling entry points and probes are built only with `--mode profile`; the GitHub Pages production build does not include them.

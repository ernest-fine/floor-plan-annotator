import { useCallback, useEffect, useRef, useState } from "react";
import MapCanvas from "./components/MapCanvas.jsx";
import {
  AnnotationDetails,
  AnnotationList,
  ExportPanel,
  FilesPanel,
  ToolsPanel,
} from "./components/Panels.jsx";
import useProject from "./hooks/useProject.js";
import { projectFromFile, projectFromImage } from "./lib/files.js";
import { download, exportCsv, exportPng, fileBase } from "./lib/exports.js";
import { TOOL_NAMES } from "./lib/model.js";

export default function App() {
  const [notice, setNotice] = useState(null);
  const toastTimer = useRef(null);
  const notify = useCallback((message, error = false) => {
    clearTimeout(toastTimer.current);
    setNotice({ message, error });
    toastTimer.current = setTimeout(() => setNotice(null), error ? 8000 : 3000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const {
    project,
    commit,
    load,
    revision,
    saveStatus,
    storageError,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useProject(notify);
  const [panel, setPanel] = useState(null),
    [hidden, setHidden] = useState(false),
    [selectedId, setSelectedId] = useState(null);
  const [tool, setTool] = useState("select"),
    [color, setColor] = useState("#d8322a"),
    [size, setSize] = useState(3.2),
    [zoom, setZoom] = useState(1),
    [includeTable, setIncludeTable] = useState(true),
    [busy, setBusy] = useState(false);
  const map = useRef(null),
    imageInput = useRef(null),
    projectInput = useRef(null),
    imports = useRef(0);
  const item = project.items.find((item) => item.id === selectedId);
  const close = () => setPanel(null);
  const toggle = (name) => setPanel((value) => (value === name ? null : name));
  function chooseTool(value) {
    map.current?.cancel();
    setTool(value);
    if (panel !== "tools") close();
  }
  function historyAction(action) {
    map.current?.cancel();
    action();
    setSelectedId(null);
    close();
  }
  function removeSelected() {
    if (!item) return;
    commit((project) => ({
      ...project,
      items: project.items.filter((saved) => saved.id !== item.id),
    }));
    setSelectedId(null);
    close();
  }
  function updateItem(patch) {
    if (!item) return;
    commit((project) => ({
      ...project,
      items: project.items.map((saved) =>
        saved.id === item.id ? { ...saved, ...patch } : saved,
      ),
    }));
  }
  function addItem(next) {
    if (project.items.length >= 3000) {
      notify("Annotation limit: 3000.", true);
      return;
    }
    commit((project) => ({
      ...project,
      items: [...project.items, next],
      nextNumber:
        next.type === "point" ? project.nextNumber + 1 : project.nextNumber,
    }));
    setSelectedId(next.id);
    setPanel(next.type === "text" ? "details" : null);
  }
  async function importFile(file, isProject) {
    if (!file || busy) return;
    const request = ++imports.current;
    revision.current++;
    try {
      const next = await (isProject
        ? projectFromFile(file)
        : projectFromImage(file));
      if (request !== imports.current) return;
      if (
        project.image &&
        !confirm(
          "Replace the current map and annotations? Save project first if you need a backup.",
        )
      )
        return;
      load(next);
      setSelectedId(null);
      close();
      setTool("select");
      notify(isProject ? "Project loaded." : "Map loaded.");
    } catch (error) {
      notify(error.message, true);
    }
  }
  function saveProject() {
    if (!project.image) return;
    download(
      new Blob([JSON.stringify(project)], { type: "application/json" }),
      fileBase(project) + ".floor-map.json",
    );
    notify("Project JSON downloaded.");
    close();
  }
  async function png() {
    if (!project.image || busy) return;
    setBusy(true);
    notify("Exporting PNG…");
    try {
      await exportPng(project, includeTable);
      notify("PNG downloaded.");
    } catch (error) {
      notify(error.message, true);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    function keyDown(event) {
      if (event.target.closest("input,textarea,select,[contenteditable=true]"))
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        historyAction(event.shiftKey ? redo : undo);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && item) {
        event.preventDefault();
        removeSelected();
        return;
      }
      if (event.key === "Escape") {
        map.current?.cancel();
        close();
        setSelectedId(null);
        setTool("select");
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const next = {
          v: "select",
          d: "point",
          t: "text",
          a: "arrow",
          p: "pen",
        }[event.key.toLowerCase()];
        if (next) chooseTool(next);
      }
    }
    document.addEventListener("keydown", keyDown);
    return () => document.removeEventListener("keydown", keyDown);
  });
  const chooseImage = () => {
    close();
    imageInput.current.click();
  };
  const chooseProject = () => {
    close();
    projectInput.current.click();
  };
  return (
    <div
      className={`workspace ${panel ? panel + "-open" : ""} ${hidden ? "clean-view" : ""}`}
    >
      <h1 className="sr-only">Floor Plan Annotator</h1>
      <MapCanvas
        ref={map}
        project={project}
        selectedId={selectedId}
        tool={tool}
        color={color}
        size={size}
        busy={busy}
        onZoom={setZoom}
        onInteract={close}
        onChooseImage={chooseImage}
        onUpload={(file) => importFile(file, false)}
        onAdd={addItem}
        onMove={(next) =>
          commit((project) => ({
            ...project,
            items: project.items.map((saved) =>
              saved.id === next.id ? next : saved,
            ),
          }))
        }
        onSelect={(id, open) => {
          setSelectedId(id);
          setPanel(open ? "details" : null);
        }}
      />
      <div className="top-controls chrome">
        <button
          id="files-toggle"
          aria-expanded={panel === "files"}
          aria-controls="file-actions"
          onClick={() => toggle("files")}
        >
          Files ▾
        </button>
        <button
          id="tools-toggle"
          aria-expanded={panel === "tools"}
          aria-controls="tool-panel"
          onClick={() => toggle("tools")}
        >
          {TOOL_NAMES[tool]} ▾
        </button>
        <button
          id="mobile-list"
          aria-expanded={panel === "list"}
          aria-controls="annotation-list-panel"
          onClick={() => toggle("list")}
        >
          Annotations <span id="mobile-count">{project.items.length}</span>
        </button>
      </div>
      <FilesPanel
        project={project}
        onClose={close}
        onImage={chooseImage}
        onOpen={chooseProject}
        onSave={saveProject}
        saveStatus={saveStatus}
        storageError={storageError}
        busy={busy}
      />
      <ToolsPanel
        tool={tool}
        onTool={chooseTool}
        color={color}
        onColor={setColor}
        size={size}
        onSize={setSize}
        onClose={close}
      />
      <div
        className="history-controls chrome"
        role="group"
        aria-label="Edit history"
      >
        <button
          id="undo"
          aria-label="Undo"
          title="Undo (Ctrl/⌘ Z)"
          disabled={!canUndo || busy}
          onClick={() => historyAction(undo)}
        >
          ↶
        </button>
        <button
          id="redo"
          aria-label="Redo"
          title="Redo (Ctrl/⌘ Shift Z)"
          disabled={!canRedo || busy}
          onClick={() => historyAction(redo)}
        >
          ↷
        </button>
      </div>
      <div className="bottom-left chrome">
        <button
          id="export-toggle"
          aria-expanded={panel === "export"}
          aria-controls="export-panel"
          onClick={() => toggle("export")}
        >
          Export ▴
        </button>
      </div>
      <button
        id="mobile-details"
        className="details-toggle chrome"
        disabled={!item}
        aria-expanded={panel === "details"}
        aria-controls="details-panel"
        onClick={() => toggle("details")}
      >
        Details
      </button>
      <div className="zoom chrome" role="group" aria-label="Map view">
        <button
          id="zoom-out"
          aria-label="Zoom out"
          disabled={!project.image}
          onClick={() => map.current.zoomBy(-0.5)}
        >
          −
        </button>
        <output id="zoom-label" aria-label="Zoom level">
          {Math.round(zoom * 100)}%
        </output>
        <button
          id="zoom-in"
          aria-label="Zoom in"
          disabled={!project.image}
          onClick={() => map.current.zoomBy(0.5)}
        >
          +
        </button>
        <button
          id="fit"
          disabled={!project.image}
          onClick={() => map.current.fit()}
        >
          Fit
        </button>
      </div>
      <button
        id="hide-controls"
        className="hide-toggle chrome"
        onClick={() => {
          close();
          setHidden(true);
        }}
      >
        Hide controls
      </button>
      {hidden && (
        <button id="show-controls" onClick={() => setHidden(false)}>
          Show controls
        </button>
      )}
      <ExportPanel
        project={project}
        includeTable={includeTable}
        onTable={setIncludeTable}
        onTitle={(title) => commit((project) => ({ ...project, title }))}
        onPng={png}
        onCsv={() => {
          exportCsv(project);
          notify("CSV downloaded.");
        }}
        onClose={close}
        busy={busy}
      />
      <aside className="chrome">
        <AnnotationDetails
          item={item}
          open={panel === "details"}
          onUpdate={updateItem}
          onDelete={removeSelected}
          onClose={close}
        />
        <AnnotationList
          items={project.items}
          selectedId={selectedId}
          onSelect={(item) => {
            setSelectedId(item.id);
            setPanel("details");
            map.current?.reveal(item);
          }}
          onClear={() => {
            if (
              confirm("Clear all annotations and readings? You can undo this.")
            ) {
              commit((project) => ({ ...project, items: [], nextNumber: 1 }));
              setSelectedId(null);
            }
          }}
          onClose={close}
        />
      </aside>
      <div className="bottom chrome">
        <span
          id="status"
          className={notice?.error ? "error" : ""}
          role="status"
          aria-live="polite"
        >
          {notice?.message}
        </span>
      </div>
      <input
        id="image-file"
        ref={imageInput}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        aria-label="Choose floor plan image"
        onChange={(event) => {
          importFile(event.target.files[0], false);
          event.target.value = "";
        }}
      />
      <input
        id="project-file"
        ref={projectInput}
        type="file"
        accept="application/json,.json"
        aria-label="Choose saved project"
        onChange={(event) => {
          importFile(event.target.files[0], true);
          event.target.value = "";
        }}
      />
    </div>
  );
}

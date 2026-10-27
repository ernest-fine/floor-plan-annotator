import Button from "@/shared/ui/Button";

import type { Project } from "../../domain/types";

import FloatingPanel from "@/shared/ui/FloatingPanel";
export function FilesPanel({
  project,
  onClose,
  onImage,
  onOpen,
  onSave,
  saveStatus,
  storageError,
  busy,
}: {
  project: Project;
  onClose: () => void;
  onImage: () => void;
  onOpen: () => void;
  onSave: () => void;
  saveStatus: string;
  storageError: boolean;
  busy: boolean;
}) {
  return (
    <FloatingPanel
      id="file-actions"
      className="file-panel chrome"
      title="Map / project"
      closeLabel="files"
      onClose={onClose}
    >
      <div className="section">
        <h3 id="map-title">{project.image?.name || "Floor plan"}</h3>
        <span id="map-dimensions" className="small muted">
          {project.image
            ? `${project.image.width} × ${project.image.height}`
            : "JPEG or PNG"}
        </span>
        <div className="file-buttons">
          <Button
            id="upload-top"
            className="primary"
            onClick={onImage}
            disabled={busy}
          >
            Load map
          </Button>
          <Button id="open-project" onClick={onOpen} disabled={busy}>
            Open project
          </Button>
          <Button
            id="save-project"
            onClick={onSave}
            disabled={!project.image || busy}
          >
            Save project
          </Button>
        </div>
        <p id="save-status" className="small muted">
          {saveStatus}
        </p>
        {storageError && (
          <div id="storage-warning" className="notice">
            Autosave unavailable. Save a project backup.
          </div>
        )}
      </div>
    </FloatingPanel>
  );
}

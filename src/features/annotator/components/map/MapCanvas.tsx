import { useRef, useState, useImperativeHandle } from "react";
import type { MapCanvasProps } from "../../types/map";
export type { MapCanvasHandle, MapCanvasProps } from "../../types/map";
import AnnotationLayer from "./AnnotationLayer";
import useMapViewport from "../../hooks/useMapViewport";
import useAnnotationGestures from "../../hooks/useAnnotationGestures";
export default function MapCanvas(props: MapCanvasProps) {
  // @profile:map-renders
  const { project, selectedId, tool, onUpload, onChooseImage } = props;
  const overlay = useRef<SVGSVGElement>(null),
    [dropping, setDropping] = useState(false);
  const view = useMapViewport(project.image, props.onZoom);
  const gestures = useAnnotationGestures({ ...props, view, overlay });
  const { viewport, stage, width, height, marginTop } = view,
    image = project.image,
    touchAction = "none";
  useImperativeHandle(props.ref, () => ({
    zoomBy(delta) {
      if (gestures.isActive()) gestures.cancel();
      view.zoomBy(delta);
    },
    fit() {
      if (gestures.isActive()) gestures.cancel();
      view.fit();
    },
    cancel: gestures.cancel,
    reveal: view.reveal,
  }));
  return (
    <main aria-label="Floor map workspace">
      <div
        id="viewport"
        ref={viewport}
        className={"viewport" + (dropping ? " dropping" : "")}
        style={{ touchAction }}
        onPointerDown={gestures.handlers.pointerDown}
        onPointerMove={gestures.handlers.pointerMove}
        onPointerUp={gestures.handlers.pointerUp}
        onPointerCancel={gestures.handlers.pointerCancel}
        onDragOver={(event) => {
          event.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDropping(false);
          onUpload(event.dataTransfer.files[0]);
        }}
      >
        {!image ? (
          <div className="empty">
            <div className="empty-inner">
              <h2>Load floor plan</h2>
              <p className="muted">JPEG / PNG · up to 25 MB, 24 MP</p>
              <button
                id="upload-empty"
                className="primary"
                onClick={onChooseImage}
              >
                Choose an image
              </button>
            </div>
          </div>
        ) : (
          <div
            id="stage"
            ref={stage}
            className="stage"
            data-tool={tool}
            style={{ width, height, marginTop, touchAction }}
          >
            <img
              id="map-image"
              src={image.src}
              alt={"Floor plan: " + image.name}
              draggable={false}
            />
            <svg
              id="overlay"
              ref={overlay}
              viewBox={`0 0 ${image.width} ${image.height}`}
              aria-label="Floor plan annotations"
              tabIndex={0}
              style={{ touchAction }}
              onKeyDown={gestures.handlers.keyDown}
            >
              <AnnotationLayer
                items={project.items}
                preview={gestures.preview}
                image={image}
                selectedId={selectedId}
                width={width}
              />
            </svg>
          </div>
        )}
      </div>
    </main>
  );
}

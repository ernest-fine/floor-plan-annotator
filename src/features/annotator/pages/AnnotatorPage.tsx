import EditorChrome from "../components/workspace/EditorChrome";
import ProjectFileInputs from "../components/workspace/ProjectFileInputs";
import {useRef,useCallback} from "react";
import type {Tool} from "../types/editor";
import useNotice from "@/shared/hooks/useNotice";
import MapCanvas,{type MapCanvasHandle} from "../components/map/MapCanvas";
import ZoomControls,{type ZoomControlsHandle} from "../components/map/ZoomControls";
import {AnnotationDetails} from "../components/panels/AnnotationDetails";
import {AnnotationList} from "../components/panels/AnnotationList";
import {ExportPanel} from "../components/panels/ExportPanel";
import {FilesPanel} from "../components/panels/FilesPanel";
import {ToolsPanel} from "../components/panels/ToolsPanel";
import useProjectDocument from "../hooks/useProjectDocument";
import useProjectPersistence from "../hooks/useProjectPersistence";
import useProjectFiles from "../hooks/useProjectFiles";
import useProjectExport from "../hooks/useProjectExport";
import useEditorState from "../hooks/useEditorState";
import useAnnotationActions from "../hooks/useAnnotationActions";
import useKeyboardShortcuts from "../hooks/useKeyboardShortcuts";
import {enteredGateways} from "../domain/signalReadings";
import {TOOL_NAMES} from "../config/editor";
export default function AnnotatorPage(){
  // @profile:app-renders
  const {notice,notify}=useNotice();
  const document=useProjectDocument(),ui=useEditorState();
  const {project,canUndo,canRedo,undo,redo}=document;
  const {saveStatus,storageError}=useProjectPersistence(document,notify);
  const exports=useProjectExport(document,notify,ui.includeTable),{busy}=exports;
  const files=useProjectFiles(document,notify,ui.imported,ui.close,busy);
  const annotations=useAnnotationActions(document,ui,notify),{item}=annotations;
  const {panel,hidden,selectedId,tool,color,size,includeTable,close,toggle,setHidden,setPanel,setSelectedId,setTool,setColor,setSize,setIncludeTable}=ui;
  const map=useRef<MapCanvasHandle>(null),zoomControls=useRef<ZoomControlsHandle>(null);
  const reportZoom=useCallback((value:number)=>zoomControls.current?.setZoom(value),[]);
  function chooseTool(value:Tool){map.current?.cancel();setTool(value);if(panel!=="tools")close();}
  function historyAction(action:()=>void){map.current?.cancel();action();setSelectedId(null);close();}
  useKeyboardShortcuts({undo:()=>historyAction(undo),redo:()=>historyAction(redo),remove:annotations.remove,escape:()=>{map.current?.cancel();ui.select(null);setTool("select");},chooseTool,canRemove:!!item});
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
        onZoom={reportZoom}
        onInteract={close}
        onChooseImage={files.chooseImage}
        onUpload={files.upload}
        onAdd={annotations.add}
        onMove={annotations.move}
        onSelect={ui.select}
      />
      <EditorChrome ui={ui} map={map} zoomControls={zoomControls} count={project.items.length} hasImage={!!project.image} hasSelection={!!item} busy={busy} canUndo={canUndo} canRedo={canRedo} onUndo={()=>historyAction(undo)} onRedo={()=>historyAction(redo)}/>
      {panel === "files" && (
        <FilesPanel
          project={project}
          onClose={close}
          onImage={files.chooseImage}
          onOpen={files.chooseProject}
          onSave={files.save}
          saveStatus={saveStatus}
          storageError={storageError}
          busy={busy}
        />
      )}
      {panel === "tools" && (
        <ToolsPanel
          tool={tool}
          onTool={chooseTool}
          color={color}
          onColor={setColor}
          size={size}
          onSize={setSize}
          onClose={close}
        />
      )}
      {panel === "export" && (
        <ExportPanel
          project={project}
          includeTable={includeTable}
          onTable={setIncludeTable}
          onTitle={annotations.title}
          onPng={exports.png}
          onCsv={exports.csv}
          onClose={close}
          busy={busy}
        />
      )}
      <aside className="chrome">
        {panel === "details" && (
          <AnnotationDetails
            item={item}
            gatewayNames={enteredGateways(project.items)}
            open={panel === "details"}
            onUpdate={annotations.update}
            onDelete={annotations.remove}
            onClose={close}
          />
        )}
        {panel === "list" && (
          <AnnotationList
            items={project.items}
            selectedId={selectedId}
            onSelect={(item) => {
              setSelectedId(item.id);
              setPanel("details");
              map.current?.reveal(item);
            }}
            onClear={annotations.clear}
            onClose={close}
          />
        )}
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
      <ProjectFileInputs files={files}/>
    </div>
  );
}

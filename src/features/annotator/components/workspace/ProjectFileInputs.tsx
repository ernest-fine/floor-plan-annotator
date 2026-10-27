import type useProjectFiles from "../../hooks/useProjectFiles";
export default function ProjectFileInputs({files}:{files:ReturnType<typeof useProjectFiles>}){return <>      <input
        id="image-file"
        ref={files.imageInput}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        aria-label="Choose floor plan image"
        onChange={(event) => {
          void files.upload(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        id="project-file"
        ref={files.projectInput}
        type="file"
        accept="application/json,.json"
        aria-label="Choose saved project"
        onChange={(event) => {
          void files.open(event.target.files?.[0]);
          event.target.value = "";
        }}
      /></>;}

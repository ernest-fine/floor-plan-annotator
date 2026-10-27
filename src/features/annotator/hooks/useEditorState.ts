import { useCallback, useState } from "react";
import type { Annotation } from "../domain/types";
import type { PanelName, Tool } from "../types/editor";
export default function useEditorState() {
  const [panel, setPanel] = useState<PanelName | null>(null),
    [hidden, setHidden] = useState(false),
    [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select"),
    [color, setColor] = useState("#d8322a"),
    [size, setSize] = useState(2.6),
    [includeTable, setIncludeTable] = useState(true);
  const close = useCallback(() => setPanel(null), []);
  const select = useCallback((id: string | null, open = false) => {
    setSelectedId(id);
    setPanel(open ? "details" : null);
  }, []);
  const added = useCallback((annotation: Annotation) => {
    setSelectedId(annotation.id);
    setPanel(
      annotation.type === "text" || annotation.type === "gateway"
        ? "details"
        : null,
    );
  }, []);
  const imported = useCallback(() => {
    setSelectedId(null);
    setPanel(null);
    setTool("select");
  }, []);
  const toggle = (name: PanelName) =>
    setPanel((current) => (current === name ? null : name));
  return {
    panel,
    hidden,
    selectedId,
    tool,
    color,
    size,
    includeTable,
    close,
    select,
    added,
    imported,
    toggle,
    setPanel,
    setHidden,
    setSelectedId,
    setTool,
    setColor,
    setSize,
    setIncludeTable,
  };
}

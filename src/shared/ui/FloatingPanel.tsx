import Button from "./Button";
import type { ReactNode } from "react";
interface PanelProps {
  id: string;
  className: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
}
export default function FloatingPanel({
  id,
  className,
  title,
  closeLabel,
  onClose,
  actions,
  children,
}: PanelProps) {
  return (
    <section
      id={id}
      className={"floating-panel " + className}
      aria-labelledby={id + "-title"}
    >
      <div className="panel-heading">
        <h2 id={id + "-title"}>{title}</h2>
        <div className="row">
          {actions}
          <Button
            className="close-panel"
            aria-label={"Close " + closeLabel}
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
      {children}
    </section>
  );
}

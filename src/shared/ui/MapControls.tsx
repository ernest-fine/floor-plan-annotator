import type { ReactNode } from "react";
export default function MapControls({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className={className} role="group" aria-label={label}>
      {children}
    </div>
  );
}

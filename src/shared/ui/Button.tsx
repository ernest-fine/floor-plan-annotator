import type { ButtonHTMLAttributes } from "react";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "danger";
}
export default function Button({
  variant = "default",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const classes = [
    variant === "default" ? "" : variant === "danger" ? "danger" : "primary",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button {...props} type={type} className={classes || undefined} />;
}

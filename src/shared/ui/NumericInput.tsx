import type { InputHTMLAttributes } from "react";
import Button from "./Button";
import "./NumericInput.css";

export interface NumericInputProps {
  value: string;
  onValueChange: (value: string) => void;
  allowNegative?: boolean;
  prefix?: string;
  showSignToggle?: boolean;
  "aria-label": string;
  disabled?: boolean;
  placeholder?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
}

// Draft strings stay textual so clearing a field or entering a decimal is possible.
const unsignedDraft = /^\d*(?:\.\d*)?$/;
const signedDraft = /^-?\d*(?:\.\d*)?$/;

export default function NumericInput({
  value,
  onValueChange,
  allowNegative = false,
  prefix,
  showSignToggle = false,
  "aria-label": label,
  disabled = false,
  placeholder,
  inputMode = "decimal",
  maxLength,
}: NumericInputProps) {
  function change(next: string) {
    if (
      !disabled &&
      (maxLength === undefined || next.length <= maxLength) &&
      (allowNegative ? signedDraft : unsignedDraft).test(next)
    )
      onValueChange(next);
  }
  return (
    <span className="numeric-input">
      {prefix && (
        <span className="numeric-input__prefix" aria-hidden="true">
          {prefix}
        </span>
      )}
      <input
        className="numeric-input__control"
        type="text"
        aria-label={label}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => {
          change(event.currentTarget.value);
        }}
      />
      {allowNegative && showSignToggle && (
        <Button
          className="numeric-input__sign"
          aria-label={`Toggle sign for ${label}`}
          aria-pressed={value.startsWith("-")}
          disabled={disabled}
          onClick={() =>
            change(value.startsWith("-") ? value.slice(1) : `-${value}`)
          }
        >
          ±
        </Button>
      )}
    </span>
  );
}

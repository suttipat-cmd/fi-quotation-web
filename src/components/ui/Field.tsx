import type { ReactNode } from "react";

export function Field({
  label,
  children,
  error,
  hint,
  required = false,
  labelHidden = false,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
  labelHidden?: boolean;
}) {
  return (
    <label className={`field${error ? " has-error" : ""}`}>
      <span className={labelHidden ? "sr-only" : ""}>
        {label}{required && <em aria-hidden="true"> *</em>}
      </span>
      {children}
      {error ? <small className="field-error" role="alert">{error}</small> : hint ? <small className="field-help">{hint}</small> : null}
    </label>
  );
}

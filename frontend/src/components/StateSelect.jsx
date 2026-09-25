import { STATES, canonicalState } from "@/lib/gst";

/** State dropdown; keeps an unrecognised old value selectable so nothing is lost */
export default function StateSelect({ value, onChange, name, className = "", disabled }) {
  const v = canonicalState(value);
  const known = STATES.some(([, n]) => n === v);
  return (
    <select
      name={name}
      value={v}
      disabled={disabled}
      onChange={onChange}
      className={`h-10 w-full rounded-md border bg-background px-3 text-sm ${className}`}
    >
      <option value="">-- select state --</option>
      {!known && v && <option value={v}>{v} (unknown)</option>}
      {STATES.map(([c, n]) => (
        <option key={c} value={n}>
          {c} - {n}
        </option>
      ))}
    </select>
  );
}

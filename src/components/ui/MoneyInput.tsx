import { useEffect, useRef, useState } from "react";
import { fromBaht, toBaht } from "../../lib/format";

export function MoneyInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [display, setDisplay] = useState(value ? toBaht(value) : "");
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDisplay(value ? toBaht(value) : "");
  }, [value]);
  const normalize = (input: string) => {
    const cleaned = input.replace(/[^0-9.]/g, "");
    const [whole = "", ...decimals] = cleaned.split(".");
    return decimals.length ? `${whole}.${decimals.join("").slice(0, 2)}` : whole;
  };
  return <input
    type="text"
    inputMode="decimal"
    placeholder="ระบุราคา"
    value={display}
    onFocus={() => { focused.current = true; setDisplay(value ? String(value / 100) : ""); }}
    onChange={(event) => { const next = normalize(event.target.value); setDisplay(next); onChange(fromBaht(next)); }}
    onBlur={() => { focused.current = false; setDisplay(value ? toBaht(value) : ""); }}
  />;
}

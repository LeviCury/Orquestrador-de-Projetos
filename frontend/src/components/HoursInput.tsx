import { useState, useEffect, useRef } from 'react';

function decimalToDisplay(val: number): string {
  if (!val || val <= 0) return '';
  const h = Math.floor(val);
  const m = Math.round((val - h) * 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return '';
}

function parseHoursInput(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  const hmMatch = trimmed.match(/^(\d+)\s*h\s*(?:(\d+)\s*m)?$/);
  if (hmMatch) {
    const h = parseInt(hmMatch[1], 10);
    const m = hmMatch[2] ? parseInt(hmMatch[2], 10) : 0;
    return h + m / 60;
  }

  const mOnly = trimmed.match(/^(\d+)\s*m$/);
  if (mOnly) return parseInt(mOnly[1], 10) / 60;

  const num = parseFloat(trimmed);
  if (!isNaN(num) && num > 0) return num;

  return null;
}

interface Props {
  value: number;
  onChange: (decimal: number) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  compact?: boolean;
}

export default function HoursInput({ value, onChange, className = '', placeholder, required, compact }: Props) {
  const [text, setText] = useState(() => decimalToDisplay(value));
  const [focused, setFocused] = useState(false);
  const prevExternal = useRef(value);

  useEffect(() => {
    if (value !== prevExternal.current) {
      prevExternal.current = value;
      if (!focused) setText(decimalToDisplay(value));
    }
  }, [value, focused]);

  const handleBlur = () => {
    setFocused(false);
    const parsed = parseHoursInput(text);
    if (parsed !== null && parsed > 0) {
      onChange(Math.round(parsed * 100) / 100);
      setText(decimalToDisplay(parsed));
    } else if (!text.trim()) {
      onChange(0);
    }
  };

  const defaultPlaceholder = compact ? '2h 30m' : 'Ex: 4h 30m';

  return (
    <input
      type="text"
      inputMode="text"
      value={text}
      onChange={e => setText(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder ?? defaultPlaceholder}
      required={required}
    />
  );
}

export { parseHoursInput, decimalToDisplay };

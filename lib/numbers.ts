/** Parses "12", "12.5" or "12,5" (Portuguese decimal comma) into a finite non-negative number; null otherwise. */
export function parseDecimalInput(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

/** Text for an input: no trailing zeros, "." as separator. */
export function formatNumberInput(value: number): string {
  return String(value);
}

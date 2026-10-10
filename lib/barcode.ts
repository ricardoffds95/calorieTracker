/** Product barcode formats read by the scanner (names as in the BarcodeDetector API). */
export const PRODUCT_BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;
export type ProductBarcodeFormat = (typeof PRODUCT_BARCODE_FORMATS)[number];

/** GTIN check digit (EAN-8, UPC-A, EAN-13, GTIN-14): weights 3,1,3,… from the right, excluding the check digit. */
export function isValidGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((acc, digit, i) => acc + digit * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Expands an 8-digit UPC-E (number system + 6 digits + check) to its 12-digit UPC-A, or null. */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const ns = code[0];
  const [d1, d2, d3, d4, d5, d6] = code.slice(1, 7);
  const check = code[7];
  let body: string;
  switch (d6) {
    case "0":
    case "1":
    case "2":
      body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
      break;
    case "3":
      body = `${d1}${d2}${d3}00000${d4}${d5}`;
      break;
    case "4":
      body = `${d1}${d2}${d3}${d4}00000${d5}`;
      break;
    default:
      body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  }
  return `${ns}${body}${check}`;
}

/** The code to look up for a raw scan, or null when it is not a valid product barcode (misread). */
export function normalizeScannedBarcode(raw: string, format: string): string | null {
  const code = raw.trim();
  switch (format) {
    case "ean_13":
      return code.length === 13 && isValidGtin(code) ? code : null;
    case "ean_8":
      return code.length === 8 && isValidGtin(code) ? code : null;
    case "upc_a":
      return code.length === 12 && isValidGtin(code) ? code : null;
    case "upc_e": {
      const upcA = expandUpcE(code);
      return upcA && isValidGtin(upcA) ? upcA : null;
    }
    default:
      return null;
  }
}

/**
 * Accepts a code only after `required` identical reads in a row, so a single
 * misread frame never triggers a lookup. Returns true on the confirming read.
 */
export function createScanConfirmer(required = 2) {
  let last: string | null = null;
  let count = 0;
  return (code: string): boolean => {
    count = code === last ? count + 1 : 1;
    last = code;
    return count === required;
  };
}

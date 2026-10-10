import { describe, expect, it } from "vitest";
import { createScanConfirmer, expandUpcE, isValidGtin, normalizeScannedBarcode } from "./barcode";

describe("isValidGtin", () => {
  it("accepts valid EAN-13, EAN-8, UPC-A and GTIN-14", () => {
    expect(isValidGtin("4006381333931")).toBe(true);
    expect(isValidGtin("96385074")).toBe(true);
    expect(isValidGtin("036000291452")).toBe(true);
    expect(isValidGtin("10012345678902")).toBe(true);
  });
  it("rejects a wrong check digit", () => {
    expect(isValidGtin("4006381333932")).toBe(false);
    expect(isValidGtin("96385075")).toBe(false);
    expect(isValidGtin("036000291453")).toBe(false);
  });
  it("rejects non-digits and unsupported lengths", () => {
    expect(isValidGtin("40063813339a1")).toBe(false);
    expect(isValidGtin("1234567")).toBe(false);
    expect(isValidGtin("1234567890")).toBe(false);
    expect(isValidGtin("")).toBe(false);
  });
});

describe("expandUpcE", () => {
  it("expands each last-digit rule to UPC-A", () => {
    expect(expandUpcE("01234565")).toBe("012345000065"); // d6 = 5..9
    expect(expandUpcE("01234505")).toBe("012000003455"); // d6 = 0
    expect(expandUpcE("04252614")).toBe("042100005264"); // d6 = 0..2
    expect(expandUpcE("01234531")).toBe("012300000451"); // d6 = 3
    expect(expandUpcE("01234541")).toBe("012340000051"); // d6 = 4
  });
  it("rejects malformed input", () => {
    expect(expandUpcE("21234505")).toBeNull(); // number system must be 0 or 1
    expect(expandUpcE("0123450")).toBeNull();
    expect(expandUpcE("0123450x")).toBeNull();
  });
});

describe("normalizeScannedBarcode", () => {
  it("keeps valid codes of the matching format", () => {
    expect(normalizeScannedBarcode("4006381333931", "ean_13")).toBe("4006381333931");
    expect(normalizeScannedBarcode(" 96385074 ", "ean_8")).toBe("96385074");
    expect(normalizeScannedBarcode("036000291452", "upc_a")).toBe("036000291452");
  });
  it("expands UPC-E and validates the expanded check digit", () => {
    expect(normalizeScannedBarcode("04252614", "upc_e")).toBe("042100005264");
    expect(normalizeScannedBarcode("04252615", "upc_e")).toBeNull();
  });
  it("rejects misreads, length mismatches and other formats", () => {
    expect(normalizeScannedBarcode("4006381333932", "ean_13")).toBeNull();
    expect(normalizeScannedBarcode("96385074", "ean_13")).toBeNull();
    expect(normalizeScannedBarcode("4006381333931", "qr_code")).toBeNull();
  });
});

describe("createScanConfirmer", () => {
  it("confirms only after N identical reads in a row, once", () => {
    const confirm = createScanConfirmer(2);
    expect(confirm("A")).toBe(false);
    expect(confirm("B")).toBe(false);
    expect(confirm("B")).toBe(true);
    expect(confirm("B")).toBe(false);
  });
  it("restarts the count when a different code is read", () => {
    const confirm = createScanConfirmer(3);
    expect(confirm("A")).toBe(false);
    expect(confirm("A")).toBe(false);
    expect(confirm("B")).toBe(false);
    expect(confirm("A")).toBe(false);
    expect(confirm("A")).toBe(false);
    expect(confirm("A")).toBe(true);
  });
});

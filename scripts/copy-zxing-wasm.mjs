// Copies the zxing-wasm reader used by barcode-detector into public/zxing/<version>/,
// so the scanner loads it from our own origin instead of the default CDN.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
// Resolve zxing-wasm as barcode-detector sees it (it pins its own version).
const fromBarcodeDetector = createRequire(createRequire(path.join(root, "package.json")).resolve("barcode-detector"));
const wasm = fromBarcodeDetector.resolve("zxing-wasm/reader/zxing_reader.wasm");
const { version } = JSON.parse(readFileSync(path.resolve(path.dirname(wasm), "../../package.json"), "utf8"));

const targetDir = path.join(root, "public", "zxing", version);
const target = path.join(targetDir, "zxing_reader.wasm");
if (!existsSync(target)) {
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(wasm, target);
  console.log(`zxing-wasm ${version} copied to public/zxing/${version}/`);
}

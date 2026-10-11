import { createScanConfirmer, normalizeScannedBarcode, PRODUCT_BARCODE_FORMATS } from "./barcode";

// Browser only: camera + BarcodeDetector ponyfill (zxing-wasm). The native BarcodeDetector
// is missing or unreliable on Safari, so the ponyfill is always used.

export type ScanErrorKind = "insecure_context" | "unsupported" | "permission_denied" | "no_camera" | "load_failed";

export const SCAN_ERROR_MESSAGES: Record<ScanErrorKind, string> = {
  insecure_context: "Camera needs HTTPS",
  unsupported: "Camera not supported",
  permission_denied: "Camera access denied",
  no_camera: "No camera found",
  load_failed: "Couldn't load scanner",
};

export class ScanError extends Error {
  constructor(readonly kind: ScanErrorKind) {
    super(SCAN_ERROR_MESSAGES[kind]);
    this.name = "ScanError";
  }
}

const SCAN_INTERVAL_MS = 250;

/** Self-hosted WASM (copied to public/ by scripts/copy-zxing-wasm.mjs), never the default CDN. */
async function loadDetector() {
  const { BarcodeDetector, prepareZXingModule, ZXING_WASM_VERSION } = await import("barcode-detector/ponyfill");
  await prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? `/zxing/${ZXING_WASM_VERSION}/${path}` : prefix + path,
    },
    fireImmediately: true,
  });
  return new BarcodeDetector({ formats: [...PRODUCT_BARCODE_FORMATS] });
}

async function openCamera(): Promise<MediaStream> {
  if (!window.isSecureContext) throw new ScanError("insecure_context");
  if (!navigator.mediaDevices?.getUserMedia) throw new ScanError("unsupported");
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") throw new ScanError("permission_denied");
    if (name === "NotFoundError" || name === "OverconstrainedError") throw new ScanError("no_camera");
    throw new ScanError("unsupported");
  }
}

export interface BarcodeScanOptions {
  video: HTMLVideoElement;
  /** Called once with a validated, confirmed code; scanning stops right before. */
  onCode: (code: string) => void;
  /** Aborting stops the camera. Always abort on unmount. */
  signal: AbortSignal;
}

/** Starts the rear camera and scans until a product barcode is confirmed or `signal` aborts. Rejects with ScanError. */
export async function startBarcodeScan({ video, onCode, signal }: BarcodeScanOptions): Promise<void> {
  let detector: Awaited<ReturnType<typeof loadDetector>>;
  try {
    detector = await loadDetector();
  } catch {
    throw new ScanError("load_failed");
  }
  if (signal.aborted) return;

  const stream = await openCamera();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    clearTimeout(timer);
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };
  if (signal.aborted) return stop();
  signal.addEventListener("abort", stop, { once: true });

  video.srcObject = stream;
  try {
    await video.play();
  } catch {
    // autoplay of a muted inline video is allowed; ignore interruptions caused by stop()
  }

  const confirm = createScanConfirmer(2);
  const tick = async () => {
    if (signal.aborted) return;
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      try {
        for (const barcode of await detector.detect(video)) {
          const code = normalizeScannedBarcode(barcode.rawValue, barcode.format);
          if (code && confirm(code)) {
            stop();
            signal.removeEventListener("abort", stop);
            if (!signal.aborted) onCode(code);
            return;
          }
        }
      } catch {
        // a frame that cannot be decoded is not an error; keep scanning
      }
    }
    if (!signal.aborted) timer = setTimeout(tick, SCAN_INTERVAL_MS);
  };
  void tick();
}

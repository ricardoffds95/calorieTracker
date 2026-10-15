import { appIconResponse } from "@/components/brand/app-icon";

// Public by path: the proxy skips every .png, so the browser can fetch the icons before anyone signs in.
const ICONS: Record<string, { size: number; padded: boolean }> = {
  "192.png": { size: 192, padded: false },
  "512.png": { size: 512, padded: false },
  // a full-bleed square with the mark in the middle, so Android can crop it to any shape
  "maskable-512.png": { size: 512, padded: true },
};

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const icon = ICONS[(await params).file];
  if (!icon) return new Response("Not found", { status: 404 });
  return appIconResponse(icon.size, { padded: icon.padded });
}

import { appIconResponse } from "@/components/brand/app-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIconResponse(size.width, { padded: true });
}

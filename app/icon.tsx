import { appIconResponse } from "@/components/brand/app-icon";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return appIconResponse(size.width, { padded: false });
}

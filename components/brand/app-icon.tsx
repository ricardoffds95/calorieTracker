import { ImageResponse } from "next/og";

// ImageResponse cannot read CSS variables, so the icon uses the literal values of the
// `primary` (light) and `card` tokens from DESIGN.md. Keep them in sync with app/globals.css.
const ICON_BACKGROUND = "#2d6be4";
const ICON_FOREGROUND = "#ffffff";

/** The app mark: an open progress ring (the calories ring) on the accent colour. */
export function appIconResponse(size: number, { padded }: { padded: boolean }) {
  // iOS rounds the corners itself and wants a full-bleed square; small favicons need a bolder ring.
  const ring = padded ? 0.56 : 0.72;
  const stroke = padded ? 0.1 : 0.16;
  const r = 50 - (stroke * 100) / 2;
  const circumference = 2 * Math.PI * r;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: ICON_BACKGROUND,
          borderRadius: padded ? 0 : size * 0.22,
        }}
      >
        <svg width={size * ring} height={size * ring} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke={ICON_FOREGROUND} strokeOpacity="0.3" strokeWidth={stroke * 100} />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={ICON_FOREGROUND}
            strokeWidth={stroke * 100}
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.72} ${circumference}`}
            transform="rotate(-90 50 50)"
          />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}

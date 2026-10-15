import type { MetadataRoute } from "next";

// `minimal-ui` is enough for Chrome (Android) to offer "Install app"; the iPhone shortcut keeps opening in Safari.
// Colours are the literal `primary` and light `background` tokens (a manifest cannot read CSS variables): keep them in sync with app/globals.css.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CalorieTracker",
    short_name: "Calories",
    description: "Calorie and macro tracking",
    start_url: "/",
    scope: "/",
    display: "minimal-ui",
    background_color: "#fafafb",
    theme_color: "#2d6be4",
    icons: [
      { src: "/pwa-icon/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

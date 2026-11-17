import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SharpFlyer AI",
    short_name: "SharpFlyer",
    description: "Create accurate promotional flyers from real templates.",
    start_url: "/",
    display: "standalone",
    background_color: "white",
    theme_color: "rgb(0 113 227)",
    icons: [
      { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "maskable" },
      { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}

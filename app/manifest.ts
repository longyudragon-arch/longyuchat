import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Longyu Chat",
    short_name: "Longyu Chat",
    description: "Multi-model chat workspace for private deployment and mobile-friendly AI collaboration.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ee",
    theme_color: "#bf5f36",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}

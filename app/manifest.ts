import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LongyuChat",
    short_name: "LongyuChat",
    description: "LongyuChat 个人 AI 总站，聚合 AI 日报、多模型聊天室和模型管理。",
    start_url: "/",
    display: "standalone",
    background_color: "#eef4fb",
    theme_color: "#2563eb",
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

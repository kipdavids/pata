import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PATA — Two-Player Number Hunt",
    short_name: "PATA",
    description:
      "Pick a target number. Your opponent races to find it. Every microsecond they take becomes your score.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#07070b",
    theme_color: "#07070b",
    lang: "en",
    categories: ["games", "entertainment"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Play now",
        short_name: "Play",
        description: "Create or join a match",
        url: "/",
      },
      {
        name: "Rankings",
        short_name: "Ranks",
        description: "See the community leaderboard",
        url: "/leaderboard",
      },
    ],
  };
}

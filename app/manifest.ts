import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "iCamp2027 Campground Operations",
    short_name: "iCamp",
    description:
      "Responsive and omnichannel campground operations platform for guests and staff.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f2",
    theme_color: "#173f35",
    orientation: "any",
    categories: ["travel", "business", "utilities"],
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

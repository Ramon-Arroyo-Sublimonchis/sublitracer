import type { MetadataRoute } from "next";

import { SITE_ORIGIN } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_ORIGIN}/`,
      lastModified: new Date("2026-10-25"),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}

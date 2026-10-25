import type { MetadataRoute } from "next";

import { SITE_ORIGIN } from "@/lib/site";

export const dynamic = "force-static";

/** Acceso explícito a los buscadores con IA para que puedan citar la herramienta. */
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "PerplexityBot", "ClaudeBot", "Google-Extended"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}

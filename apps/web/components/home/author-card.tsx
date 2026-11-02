import { BadgeCheck, ExternalLink } from "lucide-react";
import Image from "next/image";

import { AUTHOR, AUTHOR_DISPLAY_NAME, SITE_SHORT_NAME } from "@/lib/site";

/** Tarjeta de autoría (E-E-A-T): quién creó y calibró la herramienta, con sus perfiles. */
export function AuthorCard() {
  return (
    <aside
      aria-labelledby="autor"
      className="flex max-w-3xl flex-col gap-5 rounded-2xl border bg-card p-6 sm:flex-row sm:p-8"
    >
      <Image
        src="/brand/el-mundo-laser-96.png"
        alt=""
        width={64}
        height={64}
        className="size-16 shrink-0 object-contain"
      />
      <div className="flex min-w-0 flex-col gap-3">
        <div>
          <h2 id="autor" className="text-xl font-bold tracking-tight sm:text-2xl">
            Quién creó {SITE_SHORT_NAME}
          </h2>
          <p className="mt-1 font-semibold">{AUTHOR_DISPLAY_NAME}</p>
          <p className="text-sm text-muted-foreground">{AUTHOR.jobTitle}</p>
        </div>
        <p className="text-pretty leading-relaxed text-muted-foreground">{AUTHOR.bio}</p>
        <ul className="flex flex-col gap-1.5 text-sm">
          {AUTHOR.highlights.map((h) => (
            <li key={h} className="flex gap-2">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>{h}</span>
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {AUTHOR.profiles.map((p) => (
            <li key={p.url}>
              <a
                href={p.url}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-2 hover:underline"
              >
                {p.label}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

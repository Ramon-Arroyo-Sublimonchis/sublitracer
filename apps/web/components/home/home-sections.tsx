import { ChevronDown, ExternalLink } from "lucide-react";

import { AdSlot } from "@/components/ads/ad-slot";
import { AuthorCard } from "@/components/home/author-card";
import {
  COMPARISON,
  COMPARISON_NOTE,
  COMPARISON_TOOLS,
  FAQ,
  FEATURES,
  GUIDE,
  GUIDE_LINKS,
  GUIDE_TITLE,
  HOW_TO,
  SUMMARY,
} from "@/lib/content/home";
import { AD_SLOTS, AUTHOR_DISPLAY_NAME } from "@/lib/site";

/** Secciones de contenido bajo la herramienta (renderizadas en el servidor). */
export function HomeSections() {
  return (
    <div className="flex flex-col gap-16 pt-6">
      <Summary />
      <Features />
      <HowTo />
      <Comparison />
      <Guide />
      <AuthorCard />
      <Faq />
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
      {children}
    </h2>
  );
}

function Summary() {
  return (
    <section aria-labelledby="que-es" className="rounded-2xl border bg-card p-6 sm:p-8">
      <SectionTitle id="que-es">¿Qué es Sublitracer?</SectionTitle>
      <p className="mt-3 max-w-3xl text-pretty leading-relaxed text-muted-foreground">{SUMMARY}</p>
    </section>
  );
}

function Features() {
  return (
    <section aria-labelledby="produccion" className="flex flex-col gap-6">
      <SectionTitle id="produccion">Hecho para producción, no solo para pantalla</SectionTitle>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HowTo() {
  return (
    <section aria-labelledby="como-usar" className="flex flex-col gap-6">
      <SectionTitle id="como-usar">Cómo vectorizar una imagen en 3 pasos</SectionTitle>
      <ol className="grid gap-4 md:grid-cols-3">
        {HOW_TO.map((step, i) => (
          <li key={step.title} className="flex gap-4 rounded-xl border bg-card p-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <div>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Comparison() {
  return (
    <section aria-labelledby="comparativa" className="flex flex-col gap-4">
      <SectionTitle id="comparativa">
        Sublitracer frente a Vectorizer.ai, Vector Magic y PowerTRACE
      </SectionTitle>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Comparativa de precio, descargas, formatos, procesamiento y requisitos
          </caption>
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="p-3 font-semibold">
                Característica
              </th>
              {COMPARISON_TOOLS.map((tool, i) => (
                <th
                  key={tool}
                  scope="col"
                  className={i === 0 ? "p-3 font-semibold text-primary" : "p-3 font-semibold"}
                >
                  {tool}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row.attribute} className="border-b last:border-0">
                <th scope="row" className="p-3 align-top font-medium">
                  {row.attribute}
                </th>
                {row.values.map((value, i) => (
                  <td
                    key={COMPARISON_TOOLS[i]}
                    className={
                      i === 0
                        ? "bg-accent/40 p-3 align-top font-medium"
                        : "p-3 align-top text-muted-foreground"
                    }
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Datos de la competencia verificados el {COMPARISON_NOTE.verified} en sus sitios oficiales;
        los precios pueden variar por país. Fuentes:{" "}
        {COMPARISON_NOTE.sources.map((s, i) => (
          <span key={s.url}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {s.label}
            </a>
            {i < COMPARISON_NOTE.sources.length - 1 ? ", " : "."}
          </span>
        ))}
      </p>
    </section>
  );
}

function Guide() {
  const middle = Math.ceil(GUIDE.length / 2);
  const renderSection = (s: (typeof GUIDE)[number]) => (
    <div key={s.heading} className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold">{s.heading}</h3>
      {s.paragraphs.map((p) => (
        <p key={p.slice(0, 32)} className="leading-relaxed text-muted-foreground">
          {p}
        </p>
      ))}
    </div>
  );
  return (
    <article aria-labelledby="guia" className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <SectionTitle id="guia">{GUIDE_TITLE}</SectionTitle>
        <p className="text-sm text-muted-foreground">
          Por{" "}
          <a href="#autor" className="font-medium text-foreground hover:underline">
            {AUTHOR_DISPLAY_NAME}
          </a>
        </p>
      </header>
      {GUIDE.slice(0, middle).map(renderSection)}
      <AdSlot slot={AD_SLOTS.inArticle} format="in-article" />
      {GUIDE.slice(middle).map(renderSection)}
      <ul className="flex flex-col gap-2 text-sm">
        {GUIDE_LINKS.map((link) => (
          <li key={link.url}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-2 hover:underline"
            >
              {link.label}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}

function Faq() {
  return (
    <section aria-labelledby="preguntas" className="flex max-w-3xl flex-col gap-4">
      <SectionTitle id="preguntas">Preguntas frecuentes</SectionTitle>
      <div className="divide-y rounded-xl border bg-card">
        {FAQ.map((item) => (
          <details key={item.q} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
              <h3>{item.q}</h3>
              <ChevronDown
                className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="mt-3 leading-relaxed text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

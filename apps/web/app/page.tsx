import { ShieldCheck } from "lucide-react";
import Image from "next/image";

import { HomeSections } from "@/components/home/home-sections";
import { SiteFooter } from "@/components/home/site-footer";
import { TracerPlayground } from "@/components/tracer-playground";
import { buildHomeJsonLd } from "@/lib/seo/schema";

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD estático generado en el servidor
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildHomeJsonLd()) }}
      />
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2.5 px-4">
          <Image
            src="/brand/el-mundo-laser-96.png"
            alt=""
            width={40}
            height={40}
            priority
            className="size-10 shrink-0 object-contain"
          />
          <span className="truncate text-lg font-semibold tracking-tight">
            Sublitracer <span className="font-normal text-muted-foreground">by</span>{" "}
            <span className="text-primary">Sublimonchis</span>
          </span>
        </div>
      </header>

      {/* Ancho máximo de 1152 px: en pantallas anchas deja márgenes libres para los anuncios
          laterales automáticos de AdSense. */}
      <div className="mx-auto max-w-6xl px-4 py-10">
        <main className="flex min-w-0 flex-col gap-8">
          <section className="flex flex-col gap-3 text-center">
            <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Vectorizar imagen gratis para corte láser, vinil y sublimación
            </h1>
            <p className="mx-auto max-w-2xl text-pretty text-muted-foreground">
              PNG, JPG y WEBP a SVG, DXF, EPS y PDF listos para tu máquina. Sin marca de agua, sin
              cuenta y sin suscripción.
            </p>
            <p className="mx-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              Tus imágenes nunca salen de tu navegador.
            </p>
          </section>

          <TracerPlayground />
          <HomeSections />
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}

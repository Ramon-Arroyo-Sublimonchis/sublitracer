import { ShieldCheck } from "lucide-react";
import Image from "next/image";

import { AdSlot } from "@/components/ads/ad-slot";
import { HomeSections } from "@/components/home/home-sections";
import { SiteFooter } from "@/components/home/site-footer";
import { TracerPlayground } from "@/components/tracer-playground";
import { buildHomeJsonLd } from "@/lib/seo/schema";
import { AD_SLOTS } from "@/lib/site";

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD estático generado en el servidor
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildHomeJsonLd()) }}
      />
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2.5 px-4 xl:max-w-7xl">
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

      {/* Desde xl, una columna lateral de 300 px para el rascacielos; debajo, sin cambios. */}
      <div className="mx-auto max-w-6xl px-4 py-10 xl:grid xl:max-w-7xl xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-8">
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

        <div className="hidden xl:block">
          <AdSlot slot={AD_SLOTS.rail} format="vertical" />
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

import { ShieldCheck } from "lucide-react";

import { TracerPlayground } from "@/components/tracer-playground";

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <span className="text-lg font-semibold tracking-tight">
            Sublitracer <span className="font-normal text-muted-foreground">by</span>{" "}
            <span className="text-primary">Sublimonchis</span>
          </span>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
        <section className="flex flex-col gap-3 text-center">
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Convierte tus imágenes a vector, gratis
          </h1>
          <p className="mx-auto max-w-2xl text-pretty text-muted-foreground">
            PNG, JPG y WEBP a SVG listo para sublimación, corte láser y vinil.
          </p>
          <p className="mx-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            Tus imágenes nunca salen de tu navegador.
          </p>
        </section>

        <TracerPlayground />
      </main>
    </div>
  );
}

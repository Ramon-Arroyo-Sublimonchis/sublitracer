import { AUTHOR_DISPLAY_NAME, LINKS } from "@/lib/site";

const FOOTER_LINKS = [
  { label: "El Mundo Láser", url: LINKS.mainSite },
  { label: "Sublimonchis", url: LINKS.tutorials },
  { label: "Academia de Artes Gráficas", url: LINKS.academy },
  { label: "Convertidor LightBurn a SVG", url: LINKS.lightburnToSvg },
  { label: "Política de privacidad", url: LINKS.privacy },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-card/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Sublitracer</span> es una herramienta
          gratuita de El Mundo Láser by Sublimonchis, creada por {AUTHOR_DISPLAY_NAME}.
        </p>
        <nav aria-label="Sitios y enlaces" className="flex flex-wrap gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground hover:underline"
            >
              {link.label}
            </a>
          ))}
          <a
            href={`mailto:${LINKS.contactEmail}`}
            className="hover:text-foreground hover:underline"
          >
            Contacto
          </a>
        </nav>
      </div>
    </footer>
  );
}

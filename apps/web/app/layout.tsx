import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Sublitracer by Sublimonchis — Convierte imágenes a vector gratis",
    template: "%s · Sublitracer by Sublimonchis",
  },
  description:
    "Vectoriza PNG, JPG y WEBP a SVG, PDF y DXF para sublimación, corte láser y vinil. Gratis y privado: tus imágenes nunca salen de tu navegador.",
  applicationName: "Sublitracer by Sublimonchis",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Sigue el tema del sistema hasta que exista el selector de tema (Fase 2). */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: script inline y estático para evitar el parpadeo de tema
          dangerouslySetInnerHTML={{
            __html: `try{if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>{children}</body>
    </html>
  );
}

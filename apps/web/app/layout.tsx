import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import { AD_CLIENT, SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN, SITE_TITLE } from "@/lib/site";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "El Mundo Láser by Sublimonchis", url: "https://elmundolaser.com/" }],
  publisher: "El Mundo Láser by Sublimonchis",
  keywords: [
    "vectorizar imagen gratis",
    "convertir PNG a SVG",
    "convertir JPG a DXF",
    "vectorizar para corte láser",
    "vectorizar para LightBurn",
    "vectorizar para Silhouette Cameo",
    "vectorizar para Cricut",
    "alternativa gratis a Vectorizer.ai",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: "es",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  robots: { index: true, follow: true },
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
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        {children}
        {process.env.NODE_ENV === "production" && (
          <Script
            id="adsense"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        )}
      </body>
    </html>
  );
}

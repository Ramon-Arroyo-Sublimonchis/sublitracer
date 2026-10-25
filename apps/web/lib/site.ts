/** Datos del sitio usados por metadatos, Schema, sitemap y enlaces. */
export const SITE_ORIGIN = "https://sublitracer.elmundolaser.com";
export const SITE_NAME = "Sublitracer by Sublimonchis";

export const SITE_TITLE =
  "Vectorizar imagen gratis: PNG, JPG y WEBP a SVG, DXF, EPS y PDF | Sublitracer";
export const SITE_DESCRIPTION =
  "Vectoriza gratis y sin marca de agua imágenes PNG, JPG y WEBP a SVG, DXF, EPS y PDF listos para corte láser, plotter de vinil, serigrafía y sublimación. Todo se procesa en tu navegador: tus imágenes no se suben a ningún servidor.";

export const LINKS = {
  mainSite: "https://elmundolaser.com/",
  tutorials: "https://sublimonchis.com/",
  academy: "https://academiadeartesgraficas.com/",
  privacy: "https://elmundolaser.com/politicas-de-privacidad/",
  contactEmail: "suscriptores@sublimonchis.com",
  lightburnToSvg: "https://lightburntosvg.elmundolaser.com/",
  lightburnCourse:
    "https://elmundolaser.com/cursos-gratis-de-lightburn-espanol/lightburn-para-laser-de-diodo/",
  freeVectors: "https://elmundolaser.com/vectores-para-corte-laser-gratis/",
  diodeParams:
    "https://elmundolaser.com/parametros-para-corte-y-grabado-para-laser-de-diodo-xtool-d1-pro-10-watts/",
} as const;

/** Perfiles de la misma entidad (Sublimonchis / El Mundo Láser), para Schema `sameAs`. */
export const SAME_AS = [LINKS.tutorials, LINKS.mainSite, LINKS.academy];

/** Creador de la herramienta: alimenta la tarjeta de autoría y el `Person` del JSON-LD. */
export const AUTHOR = {
  name: "Ramón Arroyo Sublimonchis",
  honorificPrefix: "Lic.",
  jobTitle: "Licenciado en Diseño y Comunicación Visual | Fundador de Sublimonchis",
  description:
    "Especialista en artes gráficas, sublimación, corte láser y desarrollo web con más de 15 años de trayectoria profesional.",
  degree: "Licenciatura en Diseño y Comunicación Visual",
  url: "https://academiadeartesgraficas.com/ramon-arroyo-sublimonchis/",
  sameAs: [
    "https://academiadeartesgraficas.com/ramon-arroyo-sublimonchis/",
    "https://sublimonchis.mx/pages/quien-es-sublimonchis",
    "https://sublimonchis.com/",
    "https://elmundolaser.com/",
  ],
  knowsAbout: [
    "Sublimación",
    "Corte y grabado láser",
    "Láser de diodo, CO2 y fibra óptica MOPA",
    "Corte de vinil",
    "Serigrafía",
    "Diseño gráfico",
    "Desarrollo web",
  ],
  bio: "Licenciado en Diseño y Comunicación Visual, con más de 15 años como diseñador gráfico, desarrollador web y de comercio electrónico, y más de 13 años de práctica en sublimación, corte de vinil y grabado y corte láser de diodo, CO2 y fibra óptica (MOPA). Calibró el motor de Sublitracer con los problemas reales que ve a diario en talleres de producción: líneas dobles, nodos de más y piezas imposibles de cortar.",
  highlights: [
    "Fundador del ecosistema Sublimonchis, con más de 200,000 seguidores en redes sociales",
    "Placa de Plata de YouTube con el canal Sublimonchis Artes Gráficas",
    "Conferencista y expositor en FESPA México",
    "Instructor de cursos presenciales en México y Costa Rica",
    "Ha colaborado con marcas como Color Make®, Geekolor, SubliOne Mx y Subliprint",
  ],
  profiles: [
    {
      label: "Perfil en la Academia de Artes Gráficas",
      url: "https://academiadeartesgraficas.com/ramon-arroyo-sublimonchis/",
    },
    {
      label: "¿Quién es Sublimonchis?",
      url: "https://sublimonchis.mx/pages/quien-es-sublimonchis",
    },
    { label: "Sublimonchis", url: "https://sublimonchis.com/" },
    { label: "El Mundo Láser", url: "https://elmundolaser.com/" },
  ],
} as const;

/** Nombre con prefijo, tal como se firma en la página. */
export const AUTHOR_DISPLAY_NAME = `${AUTHOR.honorificPrefix} ${AUTHOR.name}`;

export const AD_CLIENT = "ca-pub-9446390749680019";

/**
 * Bloques de AdSense por ubicación. Hoy comparten el bloque del proyecto LightBurn to SVG;
 * conviene crear uno por ubicación en AdSense para medir cada una por separado.
 */
export const AD_SLOTS = {
  rail: "7636974134",
  belowDownload: "7636974134",
  inArticle: "7636974134",
} as const;

import { FAQ, FEATURES } from "@/lib/content/home";
import { AUTHOR, LINKS, SAME_AS, SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN } from "@/lib/site";

const HOME = `${SITE_ORIGIN}/`;
const id = (name: string) => `${HOME}#${name}`;

/**
 * JSON-LD de la página de inicio: un solo `@graph` cuyos nodos se enlazan por `@id`.
 * El `FAQPage` sale del mismo FAQ que se muestra.
 */
export function buildHomeJsonLd(): object {
  const website = {
    "@type": "WebSite",
    "@id": id("website"),
    url: HOME,
    name: SITE_NAME,
    inLanguage: "es",
    publisher: { "@id": id("org") },
  };

  const app = {
    "@type": ["WebApplication", "SoftwareApplication"],
    "@id": id("app"),
    name: SITE_NAME,
    url: HOME,
    description: SITE_DESCRIPTION,
    inLanguage: "es",
    applicationCategory: "DesignApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript and WebAssembly",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: FEATURES.map((f) => f.title),
    isPartOf: { "@id": id("website") },
    creator: { "@id": id("ramon") },
    author: { "@id": id("ramon") },
    publisher: { "@id": id("org") },
  };

  const org = {
    "@type": "Organization",
    "@id": id("org"),
    name: "El Mundo Láser by Sublimonchis",
    url: LINKS.mainSite,
    sameAs: SAME_AS,
    founder: { "@id": id("ramon") },
  };

  const person = {
    "@type": "Person",
    "@id": id("ramon"),
    name: AUTHOR.name,
    honorificPrefix: AUTHOR.honorificPrefix,
    jobTitle: AUTHOR.jobTitle,
    description: AUTHOR.description,
    url: AUTHOR.url,
    sameAs: AUTHOR.sameAs,
    knowsAbout: AUTHOR.knowsAbout,
    hasCredential: {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "degree",
      name: AUTHOR.degree,
    },
    worksFor: { "@id": id("org") },
  };

  const faq = {
    "@type": "FAQPage",
    "@id": id("faq"),
    inLanguage: "es",
    isPartOf: { "@id": id("website") },
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return { "@context": "https://schema.org", "@graph": [website, app, org, person, faq] };
}

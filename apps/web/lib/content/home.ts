import { LINKS } from "@/lib/site";

/**
 * Textos de la página de inicio. El FAQ visible y el `FAQPage` del JSON-LD salen de aquí;
 * no duplicar preguntas en otro lado.
 */

export const SUMMARY =
  "VectorizarIA by Sublimonchis es una aplicación web gratuita para vectorizar imágenes PNG, JPG y WEBP y descargarlas en SVG, DXF, EPS, PDF o PNG. A diferencia de las herramientas de suscripción, es gratis, sin marca de agua y sin cuenta, y procesa todo en tu navegador con algoritmos de vectorización: la imagen nunca se sube a un servidor. Está calibrada para producción: entrega contornos con una sola línea por borde, círculos y rectas exactos y capas por color, listos para corte láser (LightBurn), plotters de vinil (Silhouette, Cricut), serigrafía y sublimación.";

export interface Feature {
  title: string;
  text: string;
}

export const FEATURES: Feature[] = [
  {
    title: "Una sola línea por borde",
    text: "Cada frontera entre dos colores se calcula una vez y la comparten ambas formas. El láser y el plotter no cortan dos veces la misma línea.",
  },
  {
    title: "Círculos y rectas exactos",
    text: "Los anillos salen como círculos perfectos, las rectas se enderezan y las esquinas son la intersección exacta de sus lados.",
  },
  {
    title: "Capas por color",
    text: "El DXF trae una capa por color y el contorno se puede descargar aparte, para separar corte, grabado y marcado.",
  },
  {
    title: "DXF para LightBurn y Silhouette",
    text: "DXF R12 en milímetros, el más compatible con LightBurn, Silhouette Studio Basic, Cricut, CorelDRAW e Inkscape.",
  },
  {
    title: "Apilado o recortes",
    text: "Formas apiladas sin costuras para impresión, o recortes que embonan sin huecos para vinil en capas y serigrafía.",
  },
  {
    title: "Privado y sin cuenta",
    text: "El vectorizado corre en tu navegador con WebAssembly. Sin registro, sin límites diarios y sin subir tus diseños.",
  },
];

export interface ComparisonRow {
  attribute: string;
  values: [vectorizarIA: string, vectorizer: string, vectorMagic: string, autoTrace: string];
}

export const COMPARISON_TOOLS = [
  "VectorizarIA",
  "Vectorizer.ai",
  "Vector Magic",
  "Calco automático (Illustrator / CorelDRAW)",
] as const;

/**
 * Solo datos comprobados en las fuentes de `COMPARISON_NOTE`. Si algo de la competencia no se
 * puede confirmar, se deja neutro en lugar de suponerlo.
 */
export const COMPARISON: ComparisonRow[] = [
  {
    attribute: "Precio",
    values: [
      "Gratis (con anuncios)",
      "Suscripción mensual (MX$179/mes consultado desde México)",
      "En línea: MX$129/mes · Escritorio: MX$4,999 pago único",
      "Incluido en Illustrator (suscripción de Adobe) o en CorelDRAW (suscripción o licencia)",
    ],
  },
  {
    attribute: "Descargar el resultado",
    values: [
      "Gratis, sin marca de agua",
      "Requiere suscripción (la vista previa es gratis)",
      "En línea requiere suscripción (la vista previa es gratis)",
      "Con la licencia del programa",
    ],
  },
  {
    attribute: "Formatos de salida",
    values: [
      "SVG, DXF, EPS, PDF, PNG",
      "SVG, PDF, EPS, DXF, PNG",
      "En línea: SVG, EPS, PDF · Escritorio: además DXF y AI (PC)",
      "Los del programa (AI, CDR, SVG, PDF, EPS, DXF…)",
    ],
  },
  {
    attribute: "Contorno para corte",
    values: [
      "Descarga «Solo contornos» y DXF con cada borde una sola vez",
      "Opción de dibujo «stroke edges» (bordes con trazo)",
      "Consultar en su sitio",
      "Consultar en la documentación de cada programa",
    ],
  },
  {
    attribute: "Enfoque",
    values: [
      "Producción física: corte láser, vinil, serigrafía y sublimación",
      "Vectorización general de imágenes",
      "Vectorización general de imágenes",
      "Función dentro de un programa de diseño",
    ],
  },
  {
    attribute: "Dónde se procesa",
    values: [
      "En tu navegador (la imagen no se sube)",
      "En sus servidores (se sube la imagen)",
      "En línea: sus servidores · Escritorio: tu PC",
      "En tu PC",
    ],
  },
  {
    attribute: "Cuenta o instalación",
    values: [
      "No",
      "Cuenta con suscripción para descargar",
      "Suscripción en línea o instalar la versión de escritorio",
      "Instalar Illustrator o CorelDRAW",
    ],
  },
];

export const COMPARISON_NOTE = {
  verified: "25 de octubre de 2026",
  sources: [
    { label: "Precios de Vectorizer.ai", url: "https://vectorizer.ai/pricing" },
    { label: "API de Vectorizer.ai", url: "https://vectorizer.ai/api" },
    { label: "Precios de Vector Magic", url: "https://vectormagic.com/pricing" },
    { label: "Adobe Illustrator", url: "https://www.adobe.com/mx/products/illustrator.html" },
    { label: "CorelDRAW Graphics Suite", url: "https://www.coreldraw.com/" },
  ],
};

export const HOW_TO = [
  {
    title: "Sube tu imagen",
    text: "Arrastra un PNG, JPG o WEBP, haz clic para elegirlo o pégalo con Ctrl+V. Funciona mejor con logos e ilustraciones de colores definidos.",
  },
  {
    title: "Revisa el resultado",
    text: "Usa Comparar para ver el original junto al vector y Contornos para revisar las líneas que seguirá la máquina. Acerca el zoom donde haya detalles finos.",
  },
  {
    title: "Descarga según tu máquina",
    text: "DXF o SVG en «Solo contornos» para láser y plotter, SVG o PDF con formas rellenas para impresión y sublimación. Puedes fijar el tamaño final en milímetros.",
  },
];

export interface GuideSection {
  heading: string;
  paragraphs: string[];
}

export const GUIDE_TITLE = "Cómo preparar un vector para corte en vinil o láser";

export const GUIDE: GuideSection[] = [
  {
    heading: "Un vector para cortar no es igual a uno para imprimir",
    paragraphs: [
      "En impresión, dos formas que se encimen no se notan: la de arriba tapa a la de abajo. Una máquina de corte, en cambio, recorre cada línea del archivo. Por eso un vector que se ve perfecto en pantalla puede producir cortes dobles, piezas que no se desprenden o recorridos innecesarios que alargan el trabajo.",
      "Antes de mandar un diseño al láser o al plotter conviene revisar tres cosas: que no haya líneas duplicadas, que los trazados estén cerrados y que las piezas tengan un tamaño que la máquina y el material puedan resolver.",
    ],
  },
  {
    heading: "Líneas duplicadas: el error que arruina un corte",
    paragraphs: [
      "Muchos vectorizadores trazan cada color por separado. El borde entre una letra blanca y el fondo de color queda dibujado dos veces, una por cada forma, con diferencias de décimas de milímetro. En un láser eso significa pasar dos veces por el mismo lugar: más quemado en la orilla y bordes menos limpios. En vinil, la cuchilla puede rasgar el material.",
      "VectorizarIA calcula cada frontera una sola vez. La vista Contornos muestra exactamente las líneas que seguirá la máquina, y la descarga «Solo contornos» y el DXF las entregan sin repetir. Si trabajas con archivos de otra fuente, en LightBurn puedes usar la función para borrar duplicados del menú Editar antes de cortar.",
    ],
  },
  {
    heading: "Trazados cerrados y pocos nodos",
    paragraphs: [
      "Para que una pieza se desprenda, su contorno debe cerrarse. Un trazado abierto deja un puente de material y obliga a terminar a mano. Los contornos que entrega VectorizarIA son cerrados, y las fronteras entre colores terminan exactamente en los mismos puntos donde empiezan las vecinas.",
      "La cantidad de nodos también importa: un plotter que recibe cientos de segmentos diminutos avanza a tirones y deja bordes dentados. Por eso las curvas se ajustan con Bézier suaves, las rectas salen como un solo segmento y los círculos se reconocen y se dibujan con cuatro arcos exactos.",
    ],
  },
  {
    heading: "Tamaño mínimo: piensa en el pelado y en el haz",
    paragraphs: [
      "Cada material tiene un límite práctico. En vinil, las piezas de pocos milímetros son difíciles de pelar y se despegan al transferir; en láser, el haz se lleva un ancho de corte (kerf) que suele ser de décimas de milímetro según la máquina y el material. Fija el tamaño final en milímetros en el panel de descarga y revisa los detalles más pequeños con el zoom antes de cortar.",
      "Si el original es pequeño o borroso, súbelo con la mayor resolución que tengas. El motor amplía internamente la imagen para ubicar los bordes con precisión subpíxel, pero no puede inventar detalle que no existe.",
    ],
  },
  {
    heading: "Capas por color: corte, grabado y marcado",
    paragraphs: [
      "LightBurn asigna cada color del archivo a una capa con su propia velocidad y potencia. Aprovecha eso: el DXF de VectorizarIA trae una capa por color y el contorno se puede descargar aparte. Un flujo típico es usar el contorno para la capa de corte y las formas rellenas para grabar.",
      `Si estás empezando, el curso gratuito de LightBurn de El Mundo Láser explica cómo configurar capas y parámetros paso a paso, y hay tablas de parámetros probadas para láser de diodo.`,
    ],
  },
  {
    heading: "Qué formato abrir en cada programa",
    paragraphs: [
      "LightBurn: SVG o DXF. Silhouette Studio: DXF en la edición Basic; abrir SVG requiere la mejora Designer Edition. Cricut Design Space: SVG. CorelDRAW e Illustrator: SVG, EPS o PDF. Para sublimación o DTF, un PDF o SVG al tamaño final mantiene los bordes nítidos a cualquier escala, y el PNG de alta resolución sirve cuando el software de impresión no acepta vectores.",
    ],
  },
];

/** Enlaces que se muestran al final de la guía. */
export const GUIDE_LINKS = [
  { label: "Curso gratis de LightBurn en español", url: LINKS.lightburnCourse },
  { label: "Parámetros para láser de diodo", url: LINKS.diodeParams },
  { label: "Vectores gratis para corte láser", url: LINKS.freeVectors },
];

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ: FaqItem[] = [
  {
    q: "¿Cuál es la mejor alternativa gratuita a Vectorizer.ai sin marca de agua?",
    a: "VectorizarIA by Sublimonchis es gratis de verdad: vectorizar y descargar en SVG, DXF, EPS, PDF o PNG no tiene costo, marca de agua, cuenta ni límite de imágenes; se sostiene con anuncios. A diferencia de los servicios de suscripción, procesa todo en tu navegador y está pensada para producción física: entrega contornos con una sola línea por borde para corte láser y plotter de vinil.",
  },
  {
    q: "¿Cómo vectorizar una imagen PNG o JPG a SVG o DXF para corte láser en LightBurn?",
    a: "Sube el PNG o JPG con la mayor resolución que tengas, revisa el resultado en la vista Contornos y descarga DXF o SVG en «Solo contornos». Cada borde viene una sola vez, así que LightBurn no corta dos veces la misma línea. El DXF trae una capa por color y unidades en milímetros, para asignar corte y grabado por capa.",
  },
  {
    q: "¿Cómo pasar un logo pixelado a vectores limpios para Silhouette Cameo, Cricut o CorelDRAW?",
    a: "Sube el logo a VectorizarIA: el motor reduce la imagen a una paleta de colores limpia, quita el antialias y el ruido, y ajusta curvas suaves con círculos y rectas exactos. Para Silhouette Studio en edición Basic descarga DXF (abrir SVG requiere la mejora Designer Edition); para Cricut Design Space, SVG; para CorelDRAW, SVG, EPS o PDF.",
  },
  {
    q: "¿Por qué VectorizarIA genera trazados con pocos nodos, listos para corte?",
    a: "Porque cada etapa del motor está pensada para la máquina: primero agrupa la imagen en pocos colores limpios, después calcula cada frontera entre colores una sola vez, reconoce rectas y círculos para dibujarlos con el mínimo de segmentos exactos y ajusta el resto con curvas Bézier suaves. El resultado son trazados cerrados, sin líneas dobles ni cientos de segmentos diminutos.",
  },
  {
    q: "¿Qué formatos vectoriales descarga VectorizarIA y para qué máquinas sirven?",
    a: "SVG para LightBurn, xTool Creative Space, Cricut Design Space, Inkscape e Illustrator; DXF (R12, en milímetros, una capa por color) para LightBurn, EZCAD, Silhouette Studio y CorelDRAW; EPS y PDF para CorelDRAW, Illustrator, serigrafía y sublimación; y PNG de alta resolución para software de impresión que no acepta vectores.",
  },
  {
    q: "¿Quién creó VectorizarIA by Sublimonchis y por qué es seguro usarlo?",
    a: "La creó el Lic. Ramón Arroyo Sublimonchis, licenciado en Diseño y Comunicación Visual, con más de 15 años en diseño y desarrollo web y más de 13 en sublimación, vinil y láser, fundador de Sublimonchis y El Mundo Láser. Es segura porque el vectorizado se ejecuta en tu navegador con WebAssembly: la imagen no se sube a ningún servidor, así que puedes usarla con diseños de clientes o material confidencial.",
  },
  {
    q: "¿VectorizarIA usa inteligencia artificial?",
    a: "No. «IA» es parte del nombre, pero el motor no usa modelos de inteligencia artificial: funciona con algoritmos de vectorización (paleta de colores, fronteras compartidas entre colores y ajuste de curvas Bézier) que se ejecutan en tu navegador. Por eso el mismo archivo da siempre el mismo resultado y la imagen no se sube a ningún servidor.",
  },
  {
    q: "¿Qué diferencia hay entre formas apiladas y recortes?",
    a: "Apiladas: cada forma se dibuja completa y las de arriba tapan a las de abajo; es lo mejor para impresión y sublimación porque no deja costuras. Recortes: cada forma tiene los huecos exactos de las vecinas y encajan sin superponerse; es lo indicado para vinil en capas y separación de colores.",
  },
  {
    q: "¿Hay un tamaño máximo de imagen?",
    a: "Los archivos pueden pesar hasta 30 MB. Las imágenes de más de 3000 píxeles por lado se reducen antes de vectorizar para que el proceso sea rápido en el navegador.",
  },
  {
    q: "¿Funciona en el celular?",
    a: "Sí, en navegadores modernos de Android y iPhone. Las imágenes grandes tardan más en un celular que en una computadora, porque el procesamiento se hace en el propio dispositivo.",
  },
];

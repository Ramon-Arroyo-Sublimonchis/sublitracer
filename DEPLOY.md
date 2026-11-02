# Publicar en SiteGround

VectorizarIA es un sitio **estático**: el vectorizado ocurre en el navegador del usuario.
No necesita Node.js, bases de datos ni PHP en el hosting; basta el plan compartido normal.

- Dominio: `https://vectorizaria.elmundolaser.com`
- Carpeta en SiteGround: `vectorizaria.elmundolaser.com/public_html`

## 1. Generar el paquete (en tu PC)

```bash
pnpm deploy:zip
```

Compila el motor WebAssembly y la web, y crea `deploy/vectorizaria-<fecha>.zip`
con el contenido de `apps/web/out` en la raíz del ZIP (incluido `.htaccess`).

## 2. Crear el subdominio (solo la primera vez)

1. Site Tools → **Dominio → Subdominios** → crear `vectorizaria` en `elmundolaser.com`.
2. Site Tools → **Seguridad → SSL** → instalar **Let's Encrypt** para
   `vectorizaria.elmundolaser.com`.
3. Site Tools → **Seguridad → HTTPS forzado** → activarlo para el subdominio.

Si el DNS de elmundolaser.com no está en SiteGround, crea en tu proveedor de DNS un
registro `A` para `vectorizaria` con la IP del sitio (Site Tools → Panel → Información del sitio).

## 3. Subir

1. Site Tools → **Sitio → Administrador de archivos** → abre
   `vectorizaria.elmundolaser.com/public_html`.
2. Borra lo que haya dentro (en una actualización, todo lo anterior).
3. **Subir** el ZIP → clic derecho → **Extraer** en esa misma carpeta → borra el ZIP.
4. Comprueba que en `public_html` estén directamente `index.html`, `.htaccess` y `_next/`
   (no dentro de una subcarpeta).

Por FTP/SFTP funciona igual: sube el **contenido** de `apps/web/out`, incluido `.htaccess`
(actívale a tu cliente FTP "mostrar archivos ocultos").

## 4. Comprobar

- `https://vectorizaria.elmundolaser.com/` carga con estilos y el candado de HTTPS.
- Sube una imagen: debe vectorizar. Si no, abre la consola del navegador (F12); un error de
  "MIME type" con el `.wasm` indica que falta el `.htaccess`.
- `/robots.txt`, `/sitemap.xml`, `/llms.txt` y una ruta inexistente (muestra la página 404).
- Site Tools → **Velocidad → Caché**: tras cada actualización, **Vaciar caché** (Dynamic Cache).

## 5. Después de publicar

- **AdSense:** agrega el sitio y activa Anuncios automáticos → Anuncios laterales. Para medir por
  separado el banner superior y el anuncio previo a la descarga, crea un bloque nuevo y pon su ID
  en `topBanner` (`apps/web/lib/site.ts`); hoy comparten el bloque `4079040541`.
  `https://elmundolaser.com/ads.txt` (dominio principal) debe tener la línea
  `google.com, pub-9446390749680019, DIRECT, f08c47fec0942fa0`.
- **Search Console:** agrega la propiedad del subdominio (o usa la de dominio),
  envía `https://vectorizaria.elmundolaser.com/sitemap.xml` y solicita indexación.
- **Prueba de resultados enriquecidos** de Google con la URL de inicio.

## Actualizar

Repite los pasos 1, 3 y 4. Siempre reemplaza todo el contenido: los nombres de archivo de
`_next/` cambian en cada compilación.

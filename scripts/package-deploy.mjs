// Empaqueta el sitio estático para subirlo a SiteGround (u otro hosting estático).
// Uso: `pnpm deploy:zip` (compila antes) o `node scripts/package-deploy.mjs` con out/ ya generado.
// Resultado: deploy/vectorizaria-<fecha>.zip con el CONTENIDO de apps/web/out en la raíz,
// listo para descomprimir dentro de public_html del subdominio.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "apps", "web", "out");
const required = ["index.html", "404.html", ".htaccess", "robots.txt", "sitemap.xml", "_next"];

const missing = required.filter((f) => !existsSync(join(out, f)));
if (missing.length) {
  console.error(`Falta en apps/web/out: ${missing.join(", ")}. Ejecuta primero "pnpm build".`);
  process.exit(1);
}
const wasm = readdirSync(join(out, "_next", "static", "media")).filter((f) => f.endsWith(".wasm"));
if (!wasm.length) {
  console.error('El build no incluye el motor .wasm; ejecuta "pnpm build".');
  process.exit(1);
}

// Fecha y hora locales: AAAAMMDD-HHMM.
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const dir = join(root, "deploy");
const zip = join(dir, `vectorizaria-${stamp}.zip`);
mkdirSync(dir, { recursive: true });
rmSync(zip, { force: true });

// Las entradas se listan una por una para incluir .htaccess y no anteponer "./".
const entries = readdirSync(out);
if (process.platform === "win32") {
  // tar.exe de Windows (bsdtar) escribe rutas con "/". Compress-Archive de PowerShell 5.1 usa
  // "\" y el extractor de SiteGround (Linux) crearía archivos llamados "_next\static\…".
  const tar = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
  execFileSync(tar, ["-a", "-c", "-f", zip, "-C", out, ...entries], { stdio: "inherit" });
} else {
  execFileSync("zip", ["-qr", zip, ...entries], { cwd: out, stdio: "inherit" });
}

console.log(`Listo: ${zip}`);
console.log("Súbelo a public_html del subdominio y descomprímelo ahí (ver DEPLOY.md).");

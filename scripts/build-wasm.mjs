// Compila packages/tracer-wasm con wasm-pack.
//
// - Agrega ~/.cargo/bin al PATH si falta: rustup lo registra en el PATH del usuario,
//   pero las terminales abiertas antes de instalar Rust no lo ven.
// - Con --if-stale omite la compilación cuando pkg/ es más reciente que el código Rust
//   (así `pnpm dev` arranca al instante).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const crateDir = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "tracer-wasm");
const pkgFile = join(crateDir, "pkg", "tracer_wasm_bg.wasm");
const dev = process.argv.includes("--dev");

function newestMtime(path) {
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return Math.max(...readdirSync(path).map((name) => newestMtime(join(path, name))));
}

if (process.argv.includes("--if-stale") && existsSync(pkgFile)) {
  const sources = Math.max(
    newestMtime(join(crateDir, "src")),
    newestMtime(join(crateDir, "Cargo.toml")),
  );
  if (statSync(pkgFile).mtimeMs > sources) {
    console.log("tracer-wasm: pkg/ al día, se omite la compilación.");
    process.exit(0);
  }
}

const cargoBin = join(process.env.CARGO_HOME ?? join(homedir(), ".cargo"), "bin");
const pathKey = Object.keys(process.env).find((k) => k.toUpperCase() === "PATH") ?? "PATH";
const env = { ...process.env, [pathKey]: [cargoBin, process.env[pathKey]].join(delimiter) };

const args = ["build", dev ? "--dev" : "--release", "--target", "web"];
args.push("--out-dir", "pkg", "--out-name", "tracer_wasm", "--no-pack");

const result = spawnSync("wasm-pack", args, { cwd: crateDir, env, stdio: "inherit", shell: true });
if (result.status !== 0) {
  console.error(
    "\nNo se pudo compilar el motor WASM. Verifica que Rust esté instalado " +
      "(rustup, target wasm32-unknown-unknown) y que wasm-pack esté disponible.",
  );
}
process.exit(result.status ?? 1);

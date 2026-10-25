export type ImageFormat = "png" | "jpeg" | "webp" | "gif" | "bmp";

/** Valor para el atributo `accept` de los `<input type="file">`. */
export const ACCEPTED_MIME_TYPES = "image/png,image/jpeg,image/webp,image/bmp,image/gif";

export const MAX_FILE_BYTES = 30 * 1024 * 1024;

/**
 * Detecta el formato por su firma ("magic bytes"), no por la extensión ni por el
 * MIME que reporta el sistema, que pueden mentir (p. ej. un .png que en realidad es WEBP).
 */
export function detectImageFormat(header: Uint8Array): ImageFormat | null {
  const at = (offset: number, bytes: number[]) => bytes.every((b, i) => header[offset + i] === b);

  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (at(0, [0xff, 0xd8, 0xff])) return "jpeg";
  // "RIFF" .... "WEBP"
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return "webp";
  // "GIF87a" / "GIF89a"
  if (at(0, [0x47, 0x49, 0x46, 0x38])) return "gif";
  // "BM"
  if (at(0, [0x42, 0x4d])) return "bmp";
  return null;
}

export type ValidationResult = { ok: true; format: ImageFormat } | { ok: false; message: string };

export async function validateImageFile(file: Blob): Promise<ValidationResult> {
  if (file.size === 0) return { ok: false, message: "El archivo está vacío." };
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, message: "El archivo supera el límite de 30 MB." };
  }
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const format = detectImageFormat(header);
  if (!format) {
    return {
      ok: false,
      message: "Formato no compatible. Usa PNG, JPG, WEBP, BMP o GIF.",
    };
  }
  return { ok: true, format };
}

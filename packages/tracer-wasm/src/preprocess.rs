//! Limpieza de la imagen antes de cuantizar: alfa binaria y suavizado de texturas.

use crate::color::{dist2, Lab, LinearLut};

/// Imagen en OKLab con máscara de opacidad, a la resolución original.
pub struct LabImage {
    pub width: usize,
    pub height: usize,
    pub lab: Vec<Lab>,
    pub opaque: Vec<bool>,
    /// Alfa original (0–1), para ubicar el contorno con precisión subpíxel al ampliar.
    pub alpha: Vec<f32>,
}

/// Convierte RGBA a OKLab y binariza la alfa con `threshold`.
///
/// Los píxeles de borde que eran semitransparentes conservan su forma pero toman el color
/// medio de sus vecinos totalmente opacos: en un PNG exportado, el RGB de esos píxeles
/// suele estar contaminado (halo oscuro o claro) y generaría un anillo de formas extra.
pub fn to_lab_image(rgba: &[u8], width: usize, height: usize, threshold: u8) -> LabImage {
    let lut = LinearLut::new();
    let n = width * height;
    let mut lab = Vec::with_capacity(n);
    let mut opaque = Vec::with_capacity(n);
    let mut alpha_f = Vec::with_capacity(n);
    for p in rgba.chunks_exact(4) {
        lab.push(lut.to_lab(p[0], p[1], p[2]));
        opaque.push(p[3] >= threshold.max(1));
        alpha_f.push(p[3] as f32 / 255.0);
    }

    let alpha = |i: usize| rgba[i * 4 + 3];
    let mut bled = lab.clone();
    for y in 0..height {
        for x in 0..width {
            let i = y * width + x;
            if !opaque[i] || alpha(i) == 255 {
                continue;
            }
            let mut sum = [0.0f32; 3];
            let mut count = 0.0;
            for (nx, ny) in neighbours(x, y, width, height, 1) {
                let j = ny * width + nx;
                if alpha(j) == 255 {
                    for c in 0..3 {
                        sum[c] += lab[j][c];
                    }
                    count += 1.0;
                }
            }
            if count > 0.0 {
                bled[i] = [sum[0] / count, sum[1] / count, sum[2] / count];
            }
        }
    }

    LabImage {
        width,
        height,
        lab: bled,
        opaque,
        alpha: alpha_f,
    }
}

/// Filtro bilateral en OKLab: promedia con vecinos de color parecido y respeta los bordes.
/// Aplana texturas (veta de madera, ruido JPG) sin redondear el contorno del texto.
pub fn bilateral(img: &mut LabImage, radius: usize, sigma_color: f32, passes: usize) {
    if radius == 0 || passes == 0 {
        return;
    }
    let (w, h) = (img.width, img.height);
    let sigma_space = radius as f32 / 1.5;
    let inv_2ss = 1.0 / (2.0 * sigma_space * sigma_space);
    let inv_2sc = 1.0 / (2.0 * sigma_color * sigma_color);
    let r = radius as isize;
    // exp(−d²/2σ²) tabulada: el filtro llama a esto ~50 veces por píxel.
    const LUT_SIZE: usize = 1024;
    const LUT_RANGE: f32 = 9.0; // hasta 3σ; más allá el peso es despreciable
    let range_lut: Vec<f32> = (0..LUT_SIZE)
        .map(|i| (-(i as f32 / LUT_SIZE as f32 * LUT_RANGE)).exp())
        .collect();
    let to_bin = LUT_SIZE as f32 / LUT_RANGE;
    let spatial: Vec<f32> = (-r..=r)
        .flat_map(|dy| (-r..=r).map(move |dx| (-((dx * dx + dy * dy) as f32) * inv_2ss).exp()))
        .collect();

    for _ in 0..passes {
        let src = img.lab.clone();
        for y in 0..h {
            for x in 0..w {
                let i = y * w + x;
                if !img.opaque[i] {
                    continue;
                }
                let center = src[i];
                let mut acc = [0.0f32; 3];
                let mut total = 0.0f32;
                let mut k = 0;
                for dy in -r..=r {
                    let ny = y as isize + dy;
                    for dx in -r..=r {
                        let nx = x as isize + dx;
                        let ws = spatial[k];
                        k += 1;
                        if ny < 0 || nx < 0 || ny >= h as isize || nx >= w as isize {
                            continue;
                        }
                        let j = ny as usize * w + nx as usize;
                        if !img.opaque[j] {
                            continue;
                        }
                        let c = &src[j];
                        let bin = (dist2(&center, c) * inv_2sc * to_bin) as usize;
                        let Some(&wr) = range_lut.get(bin) else {
                            continue;
                        };
                        let weight = ws * wr;
                        acc[0] += c[0] * weight;
                        acc[1] += c[1] * weight;
                        acc[2] += c[2] * weight;
                        total += weight;
                    }
                }
                img.lab[i] = [acc[0] / total, acc[1] / total, acc[2] / total];
            }
        }
    }
}

/// Vecinos dentro de un radio (sin el propio píxel), recortados a la imagen.
pub fn neighbours(
    x: usize,
    y: usize,
    w: usize,
    h: usize,
    r: usize,
) -> impl Iterator<Item = (usize, usize)> {
    let (x0, x1) = (x.saturating_sub(r), (x + r).min(w - 1));
    let (y0, y1) = (y.saturating_sub(r), (y + r).min(h - 1));
    (y0..=y1)
        .flat_map(move |ny| (x0..=x1).map(move |nx| (nx, ny)))
        .filter(move |&p| p != (x, y))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn alpha_is_binarized_and_edge_colour_bleeds_from_opaque_neighbours() {
        // 3×1: rojo opaco | rojo "contaminado" a medio alfa | transparente
        let rgba = [255, 0, 0, 255, 90, 20, 20, 200, 0, 0, 0, 10];
        let img = to_lab_image(&rgba, 3, 1, 128);
        assert_eq!(img.opaque, vec![true, true, false]);
        let red = LinearLut::new().to_lab(255, 0, 0);
        assert!(
            dist2(&img.lab[1], &red) < 1e-6,
            "el borde toma el color del vecino opaco"
        );
    }

    #[test]
    fn bilateral_flattens_noise_but_keeps_edges() {
        // Mitad izquierda gris con ruido leve, mitad derecha negra.
        let (w, h) = (20, 10);
        let mut rgba = Vec::new();
        for y in 0..h {
            for x in 0..w {
                let v = if x < 10 {
                    150 + ((x * 7 + y * 13) % 5) as u8 * 3
                } else {
                    0
                };
                rgba.extend_from_slice(&[v, v, v, 255]);
            }
        }
        let mut img = to_lab_image(&rgba, w, h, 128);
        let before = img.lab[5 * w + 9];
        bilateral(&mut img, 2, 0.05, 1);
        let gray: Vec<f32> = (0..9).map(|x| img.lab[5 * w + x][0]).collect();
        let spread = gray.iter().cloned().fold(f32::MIN, f32::max)
            - gray.iter().cloned().fold(f32::MAX, f32::min);
        assert!(spread < 0.01, "el ruido se aplana: {spread}");
        assert!(
            (img.lab[5 * w + 9][0] - before[0]).abs() < 0.02,
            "el borde no se mezcla con el negro"
        );
        assert!(img.lab[5 * w + 10][0] < 0.01, "el negro sigue negro");
    }
}

//! Limpieza del mapa de etiquetas (un índice de paleta por píxel) y ampliación con
//! bordes suaves.

use crate::color::{dist2, Lab};
use crate::preprocess::{neighbours, LabImage};
use crate::quantize::TRANSPARENT;

/// Filtro de moda 3×3: un píxel adopta la etiqueta que ocupa la mayoría (≥ 5 de 9) de su
/// vecindario. Borra astillas de 1 px (antialias convertido en otro color) sin mover los
/// bordes de las formas grandes.
pub fn mode_filter(labels: &mut [u16], w: usize, h: usize, passes: usize) {
    let mut src = labels.to_vec();
    for _ in 0..passes {
        let mut changed = false;
        for y in 0..h {
            for x in 0..w {
                let mut seen: [(u16, u8); 9] = [(0, 0); 9];
                let mut kinds = 0;
                for ny in y.saturating_sub(1)..=(y + 1).min(h - 1) {
                    for nx in x.saturating_sub(1)..=(x + 1).min(w - 1) {
                        let l = src[ny * w + nx];
                        match seen[..kinds].iter_mut().find(|(k, _)| *k == l) {
                            Some(entry) => entry.1 += 1,
                            None => {
                                seen[kinds] = (l, 1);
                                kinds += 1;
                            }
                        }
                    }
                }
                let (best, count) = seen[..kinds]
                    .iter()
                    .copied()
                    .max_by_key(|&(_, c)| c)
                    .unwrap();
                let i = y * w + x;
                if count >= 5 && best != src[i] {
                    labels[i] = best;
                    changed = true;
                }
            }
        }
        if !changed {
            break;
        }
        src.copy_from_slice(labels);
    }
}

/// Componentes conexos (4-vecindad) de igual etiqueta. Devuelve el id de componente por
/// píxel y el tamaño de cada componente.
fn components(labels: &[u16], w: usize, h: usize) -> (Vec<u32>, Vec<u32>) {
    let mut comp = vec![u32::MAX; labels.len()];
    let mut sizes = Vec::new();
    let mut stack = Vec::new();
    for start in 0..labels.len() {
        if comp[start] != u32::MAX {
            continue;
        }
        let id = sizes.len() as u32;
        let label = labels[start];
        let mut size = 0;
        comp[start] = id;
        stack.push(start);
        while let Some(i) = stack.pop() {
            size += 1;
            let (x, y) = (i % w, i / w);
            let mut visit = |j: usize| {
                if comp[j] == u32::MAX && labels[j] == label {
                    comp[j] = id;
                    stack.push(j);
                }
            };
            if x > 0 {
                visit(i - 1);
            }
            if x + 1 < w {
                visit(i + 1);
            }
            if y > 0 {
                visit(i - w);
            }
            if y + 1 < h {
                visit(i + w);
            }
        }
        sizes.push(size);
    }
    (comp, sizes)
}

pub struct MergeSettings {
    /// Regiones menores a esto son candidatas a fusionarse.
    pub min_area: usize,
    /// Regiones menores a esto se fusionan siempre, aunque contrasten (ruido puro).
    pub always_below: usize,
    /// Distancia OKLab a partir de la cual una región pequeña es un detalle real (un
    /// punto, un ojo, una tilde) y se conserva.
    pub keep_contrast: f32,
}

/// Une cada región pequeña con el vecino con el que comparte más borde (en empate, el de
/// color más parecido). Quita motas y restos de textura de color parecido al entorno,
/// pero conserva los detalles chicos que contrastan.
pub fn merge_small_regions(
    labels: &mut [u16],
    w: usize,
    h: usize,
    palette: &[Lab],
    settings: &MergeSettings,
) {
    let min_area = settings.min_area;
    if min_area <= 1 {
        return;
    }
    for _ in 0..4 {
        let (comp, sizes) = components(labels, w, h);
        if sizes.len() <= 1 {
            return;
        }
        // Votos de borde: (componente pequeño, etiqueta vecina) → píxeles de contacto.
        let mut votes: Vec<Vec<(u16, u32)>> = vec![Vec::new(); sizes.len()];
        let small = |c: u32| (sizes[c as usize] as usize) < min_area;
        let mut any = false;
        for i in 0..labels.len() {
            let c = comp[i];
            if !small(c) {
                continue;
            }
            any = true;
            let (x, y) = (i % w, i / w);
            let mut add = |j: usize| {
                if comp[j] != c {
                    let l = labels[j];
                    let v = &mut votes[c as usize];
                    match v.iter_mut().find(|(k, _)| *k == l) {
                        Some(e) => e.1 += 1,
                        None => v.push((l, 1)),
                    }
                }
            };
            if x > 0 {
                add(i - 1);
            }
            if x + 1 < w {
                add(i + 1);
            }
            if y > 0 {
                add(i - w);
            }
            if y + 1 < h {
                add(i + w);
            }
        }
        if !any {
            return;
        }

        // Etiqueta propia de cada componente, para desempatar por parecido de color.
        let mut own = vec![TRANSPARENT; sizes.len()];
        for (i, &c) in comp.iter().enumerate() {
            own[c as usize] = labels[i];
        }
        // Distancia de color entre etiquetas; la transparencia está "lejos" de todo.
        let distance = |a: u16, b: u16| match (palette.get(a as usize), palette.get(b as usize)) {
            (Some(x), Some(y)) => dist2(x, y),
            _ => f32::MAX,
        };
        let keep2 = settings.keep_contrast * settings.keep_contrast;
        let target: Vec<Option<u16>> = votes
            .iter()
            .zip(&own)
            .zip(&sizes)
            .map(|((v, &mine), &size)| {
                let best = v
                    .iter()
                    .copied()
                    .max_by(|a, b| {
                        a.1.cmp(&b.1)
                            .then_with(|| distance(mine, b.0).total_cmp(&distance(mine, a.0)))
                    })
                    .map(|(l, _)| l)?;
                let distinct = distance(mine, best) > keep2;
                if size as usize >= settings.always_below && distinct {
                    None // detalle real que contrasta: se conserva
                } else {
                    Some(best)
                }
            })
            .collect();
        let mut merged = false;
        for i in 0..labels.len() {
            if let Some(t) = target[comp[i] as usize] {
                merged |= labels[i] != t;
                labels[i] = t;
            }
        }
        if !merged {
            return;
        }
    }
}

/// Quita el antialias convertido en color propio: un píxel de borde cuyo color queda
/// *entre* los de dos regiones vecinas (p. ej. el gris entre un texto blanco y su sombra
/// oscura) se asigna a la más parecida de las dos. Las regiones con color propio no se
/// tocan, porque sus píxeles interiores no tienen dos vecinos distintos.
pub fn deantialias(labels: &mut [u16], img: &LabImage, palette: &[Lab]) {
    let (w, h) = (img.width, img.height);
    let src = labels.to_vec();
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            let own = src[i];
            if own == TRANSPARENT {
                continue;
            }
            let mut others: [u16; 8] = [0; 8];
            let mut k = 0;
            for (nx, ny) in neighbours(x, y, w, h, 1) {
                let l = src[ny * w + nx];
                if l != own && l != TRANSPARENT && !others[..k].contains(&l) {
                    others[k] = l;
                    k += 1;
                }
            }
            if k < 2 {
                continue;
            }
            let c = img.lab[i];
            let mut best: Option<(f32, u16)> = None;
            for a_i in 0..k {
                for b_i in a_i + 1..k {
                    let (la, lb) = (others[a_i], others[b_i]);
                    let (a, b) = (palette[la as usize], palette[lb as usize]);
                    let ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
                    let len2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
                    if len2 < 1e-6 {
                        continue;
                    }
                    let t = ((c[0] - a[0]) * ab[0] + (c[1] - a[1]) * ab[1] + (c[2] - a[2]) * ab[2])
                        / len2;
                    if !(0.05..=0.95).contains(&t) {
                        continue;
                    }
                    let proj = [a[0] + t * ab[0], a[1] + t * ab[1], a[2] + t * ab[2]];
                    let off = dist2(&c, &proj) / len2;
                    if off > 0.04 {
                        continue; // demasiado lejos de la mezcla A↔B: es un color propio
                    }
                    if best.is_none_or(|(o, _)| off < o) {
                        best = Some((off, if t < 0.5 { la } else { lb }));
                    }
                }
            }
            if let Some((_, l)) = best {
                labels[i] = l;
            }
        }
    }
}

/// Amplía el mapa de etiquetas ×`scale` usando la imagen como guía. Cada píxel nuevo
/// interpola (bilineal) el color sRGB y la alfa, y elige la etiqueta de color más
/// parecido entre las que hay en el vecindario 3×3 del píxel original más cercano.
///
/// Se compara en sRGB porque el antialias de un PNG es una mezcla en sRGB: así el borde cae
/// en la mitad de la cobertura, con precisión subpíxel, y una recta inclinada sale recta
/// (no la escalera del mapa a 1×). No aparecen colores nuevos ni astillas: solo se puede
/// elegir entre etiquetas que ya se tocan.
pub fn upscale_guided(
    labels: &[u16],
    img: &LabImage,
    rgb: &[[f32; 3]],
    palette_rgb: &[[u8; 3]],
    scale: usize,
    alpha_threshold: f32,
) -> Vec<u16> {
    let (w, h) = (img.width, img.height);
    if scale <= 1 {
        return labels.to_vec();
    }
    let palette: Vec<[f32; 3]> = palette_rgb
        .iter()
        .map(|c| [c[0] as f32, c[1] as f32, c[2] as f32])
        .collect();
    let (sw, sh) = (w * scale, h * scale);
    let mut out = vec![0u16; sw * sh];
    let mut candidates: Vec<u16> = Vec::with_capacity(9);
    for oy in 0..sh {
        let v = ((oy as f32 + 0.5) / scale as f32 - 0.5).clamp(0.0, (h - 1) as f32);
        let y0 = v.floor() as usize;
        let y1 = (y0 + 1).min(h - 1);
        let fy = v - y0 as f32;
        let cy = (v + 0.5) as usize;
        for ox in 0..sw {
            let u = ((ox as f32 + 0.5) / scale as f32 - 0.5).clamp(0.0, (w - 1) as f32);
            let x0 = u.floor() as usize;
            let x1 = (x0 + 1).min(w - 1);
            let fx = u - x0 as f32;
            let cx = (u + 0.5) as usize;

            candidates.clear();
            for (nx, ny) in neighbours(cx, cy, w, h, 1).chain(std::iter::once((cx, cy))) {
                let l = labels[ny * w + nx];
                if !candidates.contains(&l) {
                    candidates.push(l);
                }
            }
            let o = oy * sw + ox;
            if candidates.len() == 1 {
                out[o] = candidates[0];
                continue;
            }

            let taps = [
                (y0 * w + x0, (1.0 - fx) * (1.0 - fy)),
                (y0 * w + x1, fx * (1.0 - fy)),
                (y1 * w + x0, (1.0 - fx) * fy),
                (y1 * w + x1, fx * fy),
            ];
            if candidates.contains(&TRANSPARENT) {
                let alpha: f32 = taps.iter().map(|&(i, wt)| img.alpha[i] * wt).sum();
                if alpha < alpha_threshold {
                    out[o] = TRANSPARENT;
                    continue;
                }
            }
            // Color interpolado solo con los vecinos opacos.
            let mut c = [0.0f32; 3];
            let mut total = 0.0;
            for &(i, wt) in &taps {
                if img.opaque[i] && wt > 0.0 {
                    for k in 0..3 {
                        c[k] += rgb[i][k] * wt;
                    }
                    total += wt;
                }
            }
            let nearest_tap = labels[cy * w + cx];
            if total <= 0.0 {
                out[o] = nearest_tap;
                continue;
            }
            let c = [c[0] / total, c[1] / total, c[2] / total];
            let d2 = |l: u16| {
                let p = palette[l as usize];
                (p[0] - c[0]).powi(2) + (p[1] - c[1]).powi(2) + (p[2] - c[2]).powi(2)
            };
            out[o] = candidates
                .iter()
                .copied()
                .filter(|&l| l != TRANSPARENT)
                .min_by(|&a, &b| d2(a).total_cmp(&d2(b)))
                .unwrap_or(nearest_tap);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::color::LinearLut;
    use crate::preprocess::to_lab_image;

    fn lab(rgb: [u8; 3]) -> Lab {
        LinearLut::new().to_lab(rgb[0], rgb[1], rgb[2])
    }

    #[test]
    fn deantialias_removes_an_intermediate_sliver_between_two_regions() {
        // Blanco | columna gris (mezcla) | negro. El gris existe en la paleta.
        let (w, h) = (9, 6);
        let mut rgba = Vec::new();
        let mut labels = Vec::new();
        for _ in 0..h {
            for x in 0..w {
                let (rgb, l) = match x {
                    0..=3 => ([255, 255, 255], 0),
                    4 => ([128, 128, 128], 2),
                    _ => ([0, 0, 0], 1),
                };
                rgba.extend_from_slice(&[rgb[0], rgb[1], rgb[2], 255]);
                labels.push(l);
            }
        }
        let img = to_lab_image(&rgba, w, h, 128);
        let palette = [lab([255, 255, 255]), lab([0, 0, 0]), lab([128, 128, 128])];
        deantialias(&mut labels, &img, &palette);
        assert!(
            !labels.contains(&2),
            "la astilla gris desaparece: {labels:?}"
        );
        assert!(labels[..4].iter().all(|&l| l == 0), "el blanco no cambia");
    }

    #[test]
    fn merge_keeps_contrasting_details_and_removes_similar_specks() {
        // Fondo madera (0) con una mota de madera más clara (1) y un punto oscuro (2), 3×3 cada uno.
        let (w, h) = (20, 10);
        let mut labels = vec![0u16; w * h];
        for y in 3..6 {
            for x in 3..6 {
                labels[y * w + x] = 1;
            }
            for x in 13..16 {
                labels[y * w + x] = 2;
            }
        }
        let palette = [lab([200, 140, 80]), lab([215, 155, 95]), lab([60, 40, 30])];
        let settings = MergeSettings {
            min_area: 16,
            always_below: 4,
            keep_contrast: 0.15,
        };
        merge_small_regions(&mut labels, w, h, &palette, &settings);
        assert!(!labels.contains(&1), "la mota parecida se funde");
        assert_eq!(
            labels.iter().filter(|&&l| l == 2).count(),
            9,
            "el punto oscuro se conserva"
        );
    }

    #[test]
    fn guided_upscale_moves_the_edge_with_the_antialias_coverage() {
        // Borde vertical blanco→negro con un píxel de transición gris. Cuanto más oscuro el
        // gris (más cobertura negra), antes debe empezar el negro en la imagen ampliada:
        // eso es la precisión subpíxel que una ampliación de etiquetas sola no tiene.
        let edge = |gray: u8| {
            let rgba = [
                255, 255, 255, 255, 255, 255, 255, 255, gray, gray, gray, 255, 0, 0, 0, 255,
            ];
            let img = to_lab_image(&rgba, 4, 1, 128);
            let rgb: Vec<[f32; 3]> = rgba
                .chunks(4)
                .map(|p| [p[0] as f32, p[1] as f32, p[2] as f32])
                .collect();
            let labels = [0, 0, if gray > 128 { 0 } else { 1 }, 1];
            let up = upscale_guided(&labels, &img, &rgb, &[[255, 255, 255], [0, 0, 0]], 4, 0.5);
            up.iter().position(|&l| l == 1).unwrap()
        };
        let (light, mid, dark) = (edge(220), edge(150), edge(60));
        assert!(
            dark < mid && mid < light,
            "bordes: {dark} < {mid} < {light}"
        );
        assert!((6..=14).contains(&dark) && (6..=14).contains(&light));
    }
}

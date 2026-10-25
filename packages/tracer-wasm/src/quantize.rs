//! Paleta global: reduce la imagen a K colores con k-means en OKLab.

use crate::color::{dist2, Lab};
use crate::preprocess::LabImage;

/// Etiqueta de los píxeles transparentes.
pub const TRANSPARENT: u16 = u16::MAX;

const MAX_SAMPLES: usize = 40_000;
const LLOYD_ITERATIONS: usize = 12;

pub struct PaletteSettings {
    /// `Some(k)`: exactamente `k` colores (si la imagen los tiene). `None`: automático.
    pub colors: Option<usize>,
    pub max_auto_colors: usize,
    /// En automático, se agregan colores mientras el percentil 95 del error (distancia
    /// OKLab de cada muestra a su color) supere este valor.
    pub auto_error: f32,
}

/// Muestra determinista y uniforme de los píxeles opacos.
fn sample(img: &LabImage) -> Vec<Lab> {
    let opaque = img.opaque.iter().filter(|&&o| o).count();
    let step = opaque.div_ceil(MAX_SAMPLES).max(1);
    img.lab
        .iter()
        .zip(&img.opaque)
        .filter(|(_, &o)| o)
        .step_by(step)
        .map(|(c, _)| *c)
        .collect()
}

fn nearest(palette: &[Lab], c: &Lab) -> (usize, f32) {
    let mut best = (0, f32::MAX);
    for (i, p) in palette.iter().enumerate() {
        let d = dist2(p, c);
        if d < best.1 {
            best = (i, d);
        }
    }
    best
}

fn p95(distances: &mut [f32]) -> f32 {
    if distances.is_empty() {
        return 0.0;
    }
    let k = (distances.len() as f32 * 0.95) as usize;
    let k = k.min(distances.len() - 1);
    *distances.select_nth_unstable_by(k, |a, b| a.total_cmp(b)).1
}

/// Iteraciones de Lloyd; elimina los centros que se quedan sin muestras.
fn lloyd(samples: &[Lab], centers: &mut Vec<Lab>, iterations: usize) {
    for _ in 0..iterations {
        let mut sums = vec![[0.0f64; 3]; centers.len()];
        let mut counts = vec![0usize; centers.len()];
        for s in samples {
            let (i, _) = nearest(centers, s);
            for c in 0..3 {
                sums[i][c] += s[c] as f64;
            }
            counts[i] += 1;
        }
        let mut moved = false;
        let mut next = Vec::with_capacity(centers.len());
        for (i, center) in centers.iter().enumerate() {
            if counts[i] == 0 {
                moved = true;
                continue;
            }
            let n = counts[i] as f64;
            let c = [
                (sums[i][0] / n) as f32,
                (sums[i][1] / n) as f32,
                (sums[i][2] / n) as f32,
            ];
            moved |= dist2(&c, center) > 1e-10;
            next.push(c);
        }
        *centers = next;
        if !moved {
            break;
        }
    }
}

/// Construye la paleta. Inserta centros por "punto más lejano" (determinista, cubre los
/// colores minoritarios pero distintos, como un texto rojo pequeño) y refina con Lloyd.
pub fn build_palette(img: &LabImage, settings: &PaletteSettings) -> Vec<Lab> {
    let samples = sample(img);
    if samples.is_empty() {
        return Vec::new();
    }

    // Primer centro: la muestra más cercana a la media.
    let mean = samples.iter().fold([0.0f32; 3], |acc, s| {
        [acc[0] + s[0], acc[1] + s[1], acc[2] + s[2]]
    });
    let n = samples.len() as f32;
    let mean = [mean[0] / n, mean[1] / n, mean[2] / n];
    let first = *samples
        .iter()
        .min_by(|a, b| dist2(a, &mean).total_cmp(&dist2(b, &mean)))
        .unwrap();

    let target = settings.colors.map(|k| k.clamp(1, 256));
    let max = target.unwrap_or(settings.max_auto_colors);
    let mut centers = vec![first];
    let mut dist: Vec<f32> = samples.iter().map(|s| dist2(s, &first)).collect();

    while centers.len() < max {
        if target.is_none() {
            let mut d: Vec<f32> = dist.iter().map(|d| d.sqrt()).collect();
            if p95(&mut d) <= settings.auto_error {
                break;
            }
        }
        let (far, &far_d) = dist
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.total_cmp(b.1))
            .unwrap();
        if far_d <= 1e-8 {
            break; // la imagen no tiene más colores distintos
        }
        let c = samples[far];
        for (d, s) in dist.iter_mut().zip(&samples) {
            *d = d.min(dist2(s, &c));
        }
        centers.push(c);
    }

    lloyd(&samples, &mut centers, LLOYD_ITERATIONS);
    centers
}

/// Asigna a cada píxel el índice de su color de paleta más cercano.
pub fn assign(img: &LabImage, palette: &[Lab]) -> Vec<u16> {
    img.lab
        .iter()
        .zip(&img.opaque)
        .map(|(c, &o)| {
            if o {
                nearest(palette, c).0 as u16
            } else {
                TRANSPARENT
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::preprocess::to_lab_image;

    fn auto() -> PaletteSettings {
        PaletteSettings {
            colors: None,
            max_auto_colors: 32,
            auto_error: 0.04,
        }
    }

    /// Tres franjas de color con una columna de antialias entre cada una.
    fn three_colours() -> Vec<u8> {
        let cols: [[u8; 3]; 7] = [
            [200, 30, 30],
            [200, 30, 30],
            [200, 120, 80], // antialias rojo→blanco
            [250, 250, 250],
            [130, 140, 160], // antialias blanco→azul
            [20, 40, 120],
            [20, 40, 120],
        ];
        let mut px = Vec::new();
        for _y in 0..40 {
            for x in 0..70 {
                let c = cols[x / 10];
                px.extend_from_slice(&[c[0], c[1], c[2], 255]);
            }
        }
        px
    }

    #[test]
    fn fixed_palette_size_is_respected() {
        let img = to_lab_image(&three_colours(), 70, 40, 128);
        let palette = build_palette(
            &img,
            &PaletteSettings {
                colors: Some(3),
                ..auto()
            },
        );
        assert_eq!(palette.len(), 3);
    }

    #[test]
    fn auto_palette_finds_distinct_colours() {
        let img = to_lab_image(&three_colours(), 70, 40, 128);
        let palette = build_palette(&img, &auto());
        assert!(
            (3..=5).contains(&palette.len()),
            "{} colores",
            palette.len()
        );
    }

    #[test]
    fn transparent_pixels_get_the_transparent_label() {
        let mut px = three_colours();
        px[3] = 0;
        let img = to_lab_image(&px, 70, 40, 128);
        let labels = assign(&img, &build_palette(&img, &auto()));
        assert_eq!(labels[0], TRANSPARENT);
        assert_ne!(labels[1], TRANSPARENT);
    }
}

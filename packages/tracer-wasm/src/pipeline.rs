//! Preparación de la imagen antes del mapa planar (modo con paleta global):
//!
//! 1. Alfa binaria + color de borde limpio          → bordes sin "pelos"
//! 2. Filtro bilateral en OKLab                     → texturas planas, bordes nítidos
//! 3. Paleta k-means en OKLab                       → pocos colores, bien elegidos
//! 4. Anti-antialias + moda + fusión de regiones    → sin astillas ni motas
//! 5. Ampliación ×s guiada por el color original    → bordes subpíxel, curvas suaves
//!
//! El resultado es un mapa de etiquetas ampliado (un índice de paleta por píxel, o
//! transparencia) que `planar` convierte en fronteras compartidas.

use crate::color::{lab_to_rgb, Lab, LinearLut};
use crate::config::{ColorMode, Detail, TraceOptions};
use crate::preprocess::{bilateral, to_lab_image};
use crate::quantize::{assign, build_palette, PaletteSettings, TRANSPARENT};
use crate::regions::{
    deantialias, merge_small_regions, mode_filter, upscale_guided, MergeSettings,
};

/// Lado máximo, tras ampliar, que se considera razonable para trazar en el navegador.
const UPSCALE_TARGET_SIDE: usize = 2000;
const MAX_UPSCALE: usize = 4;
const MAX_AUTO_COLORS: usize = 32;
/// Distancia OKLab a partir de la cual una región pequeña se considera un detalle real.
const KEEP_CONTRAST: f32 = 0.15;

pub struct Prepared {
    /// Mapa de etiquetas ampliado (`width × height`).
    pub labels: Vec<u16>,
    pub width: usize,
    pub height: usize,
    pub scale: usize,
    /// Color de cada etiqueta.
    pub palette_rgb: Vec<[u8; 3]>,
    /// Fracción del área opaca que ocupa cada etiqueta.
    pub coverage: Vec<f32>,
    /// Etiquetas que no se dibujan (el blanco en modo blanco y negro).
    pub hidden: Vec<u16>,
    /// Tolerancia (px originales) para el ajuste de curvas.
    pub fit_tolerance: f64,
}

struct DetailParams {
    bilateral_radius: usize,
    bilateral_sigma: f32,
    bilateral_passes: usize,
    mode_passes: usize,
    /// Área mínima de una región: fracción del área de la imagen, con un piso en píxeles.
    min_region_fraction: f64,
    min_region_floor: usize,
    /// Error tolerado por la paleta automática (distancia OKLab, percentil 95).
    auto_error: f32,
    fit_tolerance: f64,
}

fn detail_params(detail: Detail) -> DetailParams {
    match detail {
        Detail::Low => DetailParams {
            bilateral_radius: 3,
            bilateral_sigma: 0.09,
            bilateral_passes: 2,
            mode_passes: 1,
            min_region_fraction: 0.0004,
            min_region_floor: 64,
            auto_error: 0.07,
            fit_tolerance: 0.8,
        },
        Detail::Medium => DetailParams {
            bilateral_radius: 3,
            bilateral_sigma: 0.07,
            bilateral_passes: 2,
            mode_passes: 1,
            min_region_fraction: 0.00015,
            min_region_floor: 16,
            auto_error: 0.05,
            fit_tolerance: 0.5,
        },
        Detail::High => DetailParams {
            bilateral_radius: 1,
            bilateral_sigma: 0.04,
            bilateral_passes: 1,
            mode_passes: 1,
            min_region_fraction: 0.00003,
            min_region_floor: 4,
            auto_error: 0.035,
            fit_tolerance: 0.35,
        },
    }
}

pub fn auto_scale(width: usize, height: usize) -> usize {
    (UPSCALE_TARGET_SIDE / width.max(height).max(1)).clamp(1, MAX_UPSCALE)
}

pub fn prepare(rgba: &[u8], width: usize, height: usize, options: &TraceOptions) -> Prepared {
    let p = detail_params(options.detail);

    let mut img = to_lab_image(rgba, width, height, options.alpha_threshold);
    // Guía de la ampliación: color sRGB *antes* del filtro bilateral. El bilateral promedia
    // los píxeles de antialias a lo largo del borde y borraría la información subpíxel
    // que ubica el contorno (ver `upscale_guided`).
    let rgb: Vec<[f32; 3]> = img
        .lab
        .iter()
        .map(|&c| {
            let [r, g, b] = lab_to_rgb(c);
            [r as f32, g as f32, b as f32]
        })
        .collect();
    bilateral(
        &mut img,
        p.bilateral_radius,
        p.bilateral_sigma,
        p.bilateral_passes,
    );

    // Blanco y negro: dos "colores" de decisión centrados en el umbral (así la asignación
    // y la ampliación guiada cortan justo ahí), dibujados como negro puro; el blanco no
    // se dibuja.
    let binary = options.color_mode == ColorMode::Binary;
    let (palette, mut palette_rgb, hidden) = if binary {
        let t = options.binary_threshold;
        let mid = LinearLut::new().to_lab(t, t, t)[0];
        let gray = |l: f32| -> Lab { [l, 0.0, 0.0] };
        (
            vec![gray(mid - 0.2), gray(mid + 0.2)],
            vec![[0, 0, 0], [255, 255, 255]],
            vec![1],
        )
    } else {
        let palette = build_palette(
            &img,
            &PaletteSettings {
                colors: options.colors,
                max_auto_colors: MAX_AUTO_COLORS,
                auto_error: p.auto_error,
            },
        );
        (palette, Vec::new(), Vec::new())
    };
    let mut labels = assign(&img, &palette);
    deantialias(&mut labels, &img, &palette);
    mode_filter(&mut labels, width, height, p.mode_passes);
    let min_area = ((width * height) as f64 * p.min_region_fraction) as usize;
    merge_small_regions(
        &mut labels,
        width,
        height,
        &palette,
        &MergeSettings {
            min_area: min_area.max(p.min_region_floor),
            always_below: p.min_region_floor.min(6),
            keep_contrast: KEEP_CONTRAST,
        },
    );

    if palette_rgb.is_empty() {
        palette_rgb = palette.iter().map(|&c| lab_to_rgb(c)).collect();
    }

    let mut counts = vec![0usize; palette.len()];
    for &l in &labels {
        if l != TRANSPARENT {
            counts[l as usize] += 1;
        }
    }
    let opaque = counts.iter().sum::<usize>().max(1) as f32;
    let coverage = counts.iter().map(|&n| n as f32 / opaque).collect();

    let scale = options
        .upscale
        .unwrap_or_else(|| auto_scale(width, height))
        .clamp(1, MAX_UPSCALE);
    let mut labels = upscale_guided(
        &labels,
        &img,
        &rgb,
        &palette_rgb,
        scale,
        options.alpha_threshold as f32 / 255.0,
    );
    if scale > 1 {
        // La guía sin filtrar sigue la textura junto a los bordes y deja motas del tamaño
        // de un píxel original: se funden aquí, a alta resolución, sin tocar los detalles
        // que contrastan. (Un filtro de moda movería los escalones de las diagonales.)
        let (hw, hh) = (width * scale, height * scale);
        merge_small_regions(
            &mut labels,
            hw,
            hh,
            &palette,
            &MergeSettings {
                min_area: 2 * scale * scale,
                always_below: scale * scale,
                keep_contrast: KEEP_CONTRAST,
            },
        );
    }

    Prepared {
        labels,
        width: width * scale,
        height: height * scale,
        scale,
        palette_rgb,
        coverage,
        hidden,
        fit_tolerance: p.fit_tolerance,
    }
}

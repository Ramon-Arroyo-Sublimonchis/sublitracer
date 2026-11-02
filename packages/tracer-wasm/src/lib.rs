//! Motor de vectorización de VectorizarIA by Sublimonchis.

mod color;
mod config;
mod converter;
mod fit;
mod geometry;
mod pipeline;
mod planar;
mod preprocess;
mod quantize;
mod regions;
mod svg;

use visioncortex::ColorImage;
use wasm_bindgen::prelude::*;

pub use config::{Background, ColorMode, CurveMode, Detail, Hierarchical, TraceOptions};

/// Resultado de un trazado, listo para mostrarse o exportarse.
#[wasm_bindgen(getter_with_clone)]
pub struct TraceResult {
    /// Formas rellenas.
    pub svg: String,
    /// Contornos: cada frontera entre colores exactamente una vez, sin el marco de la
    /// imagen (para la vista de contornos, el corte láser y el DXF). Vacío en modo clásico.
    #[wasm_bindgen(js_name = outlineSvg)]
    pub outline_svg: String,
    /// Colores dibujados en formato `#RRGGBB`. Con paleta global, de mayor a menor
    /// superficie; en modo clásico, en orden de aparición.
    pub palette: Vec<String>,
    /// Fracción del área opaca que ocupa cada color de `palette` (vacío en modo clásico).
    pub coverage: Vec<f32>,
    pub width: u32,
    pub height: u32,
    #[wasm_bindgen(js_name = pathCount)]
    pub path_count: u32,
}

/// API nativa (usada por las pruebas y por `trace`).
pub fn trace_rgba(
    rgba: &[u8],
    width: u32,
    height: u32,
    options: TraceOptions,
) -> Result<TraceResult, String> {
    let (w, h) = (width as usize, height as usize);
    if rgba.len() != w * h * 4 {
        return Err(format!(
            "Se esperaban {} bytes RGBA para {width}×{height}, llegaron {}",
            w * h * 4,
            rgba.len()
        ));
    }
    if w == 0 || h == 0 {
        return Err("La imagen está vacía".into());
    }
    if options.quantize || options.color_mode == ColorMode::Binary {
        Ok(trace_planar(rgba, width, height, &options))
    } else {
        trace_classic(rgba, width, height, options)
    }
}

/// Paleta global + mapa planar: fronteras compartidas y geometría exacta.
fn trace_planar(rgba: &[u8], width: u32, height: u32, options: &TraceOptions) -> TraceResult {
    let p = pipeline::prepare(rgba, width as usize, height as usize, options);

    let mut hidden = p.hidden.clone();
    if options.background == Background::Remove {
        hidden.extend(planar::detect_background(&p.labels, p.width, p.height));
    }
    let settings = planar::PlanarSettings {
        fit: geometry::ChainFit {
            tolerance: p.fit_tolerance,
            corner_turn: config::deg2rad(options.corner_threshold.clamp(0, 180)),
            corner_reach: 1.5,
            geometry: options.geometry,
            noise: 0.5 / p.scale as f64,
        },
        stacked: options.hierarchical == Hierarchical::Stacked,
        hidden,
        colors: p.palette_rgb.clone(),
        precision: options.path_precision.unwrap_or(2).min(8) as usize,
    };
    let out = planar::trace(&p.labels, p.width, p.height, p.scale, &settings);

    let mut used = out.labels_used.clone();
    used.sort_by(|&a, &b| p.coverage[b as usize].total_cmp(&p.coverage[a as usize]));
    let hex = |l: u16| {
        let [r, g, b] = p.palette_rgb[l as usize];
        format!("#{r:02X}{g:02X}{b:02X}")
    };

    TraceResult {
        svg: out.fill_svg,
        outline_svg: out.outline_svg,
        palette: used.iter().map(|&l| hex(l)).collect(),
        coverage: used.iter().map(|&l| p.coverage[l as usize]).collect(),
        width,
        height,
        path_count: out.shapes as u32,
    }
}

/// VTracer clásico (visioncortex), sin paleta global.
fn trace_classic(
    rgba: &[u8],
    width: u32,
    height: u32,
    options: TraceOptions,
) -> Result<TraceResult, String> {
    let config = options.into_converter_config();
    let image = ColorImage {
        pixels: rgba.to_vec(),
        width: width as usize,
        height: height as usize,
    };
    let traced = converter::convert(image, &config)?;

    let mut palette: Vec<String> = Vec::new();
    for layer in &traced.layers {
        let hex = layer.color.to_hex_string();
        if !palette.contains(&hex) {
            palette.push(hex);
        }
    }

    Ok(TraceResult {
        svg: svg::to_svg(&traced, config.path_precision),
        outline_svg: String::new(),
        palette,
        coverage: Vec::new(),
        width,
        height,
        path_count: traced.layers.len() as u32,
    })
}

/// Vectoriza píxeles RGBA (`ImageData.data`). `options` es un objeto parcial de
/// `TraceOptions` en camelCase; los campos ausentes toman su valor por defecto.
#[wasm_bindgen]
pub fn trace(
    rgba: &[u8],
    width: u32,
    height: u32,
    options: JsValue,
) -> Result<TraceResult, JsError> {
    let options: TraceOptions = if options.is_undefined() || options.is_null() {
        TraceOptions::default()
    } else {
        serde_wasm_bindgen::from_value(options).map_err(|e| JsError::new(&e.to_string()))?
    };
    trace_rgba(rgba, width, height, options).map_err(|e| JsError::new(&e))
}

#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Imagen de prueba: fondo blanco con un cuadrado rojo y un círculo azul.
    fn fixture(size: u32) -> Vec<u8> {
        let mut px = Vec::with_capacity((size * size * 4) as usize);
        let c = size as f64 / 2.0;
        for y in 0..size {
            for x in 0..size {
                let (fx, fy) = (x as f64, y as f64);
                let in_square = x > size / 8 && x < size / 2 && y > size / 8 && y < size / 2;
                let in_circle = (fx - c * 1.3).hypot(fy - c * 1.3) < size as f64 / 6.0;
                let rgb = if in_square {
                    [220, 30, 30]
                } else if in_circle {
                    [30, 60, 220]
                } else {
                    [255, 255, 255]
                };
                px.extend_from_slice(&[rgb[0], rgb[1], rgb[2], 255]);
            }
        }
        px
    }

    #[test]
    fn color_trace_produces_valid_svg_with_expected_colors() {
        let result = trace_rgba(&fixture(128), 128, 128, TraceOptions::default()).unwrap();
        assert!(result.svg.contains(r#"viewBox="0 0 128 128""#));
        assert!(result.svg.trim_end().ends_with("</svg>"));
        assert!(result.path_count >= 3, "paths: {}", result.path_count);
        assert!(result.palette.len() >= 3, "palette: {:?}", result.palette);
    }

    #[test]
    fn binary_trace_is_black_only() {
        let options = TraceOptions {
            color_mode: ColorMode::Binary,
            ..Default::default()
        };
        let result = trace_rgba(&fixture(128), 128, 128, options).unwrap();
        assert_eq!(result.palette, vec!["#000000".to_string()]);
        assert!(result.path_count >= 1);
    }

    #[test]
    fn cutout_mode_traces() {
        let options = TraceOptions {
            hierarchical: Hierarchical::Cutout,
            ..Default::default()
        };
        let result = trace_rgba(&fixture(96), 96, 96, options).unwrap();
        assert!(result.path_count >= 2);
    }

    #[test]
    fn transparent_background_is_not_traced_in_stacked_mode() {
        let mut px = fixture(64);
        for p in px.chunks_exact_mut(4) {
            if p[..3] == [255, 255, 255] {
                p[3] = 0;
            }
        }
        let result = trace_rgba(&px, 64, 64, TraceOptions::default()).unwrap();
        assert!(
            !result.palette.iter().any(|c| c == "#ffffff"),
            "{:?}",
            result.palette
        );
    }

    #[test]
    fn output_is_deterministic() {
        let a = trace_rgba(&fixture(64), 64, 64, TraceOptions::default()).unwrap();
        let b = trace_rgba(&fixture(64), 64, 64, TraceOptions::default()).unwrap();
        assert_eq!(a.svg, b.svg);
    }

    #[test]
    fn rejects_wrong_buffer_size() {
        assert!(trace_rgba(&[0; 10], 4, 4, TraceOptions::default()).is_err());
    }

    /// Disco rojo con borde suavizado (alfa parcial) sobre fondo transparente.
    fn soft_disc(size: u32) -> Vec<u8> {
        let c = size as f64 / 2.0;
        let mut px = Vec::new();
        for y in 0..size {
            for x in 0..size {
                let d = (x as f64 + 0.5 - c).hypot(y as f64 + 0.5 - c);
                let a = ((c * 0.7 - d + 0.5).clamp(0.0, 1.0) * 255.0) as u8;
                px.extend_from_slice(&[200, 30, 30, a]);
            }
        }
        px
    }

    #[test]
    fn soft_alpha_edge_produces_a_single_clean_shape() {
        let result = trace_rgba(&soft_disc(64), 64, 64, TraceOptions::default()).unwrap();
        assert_eq!(result.path_count, 1, "{}", result.svg);
        assert_eq!(result.palette.len(), 1);
    }

    #[test]
    fn antialiased_stripes_give_exactly_their_colours() {
        let result = trace_rgba(&fixture(128), 128, 128, TraceOptions::default()).unwrap();
        assert_eq!(result.palette.len(), 3, "{:?}", result.palette);
        let total: f32 = result.coverage.iter().sum();
        assert!((total - 1.0).abs() < 0.01, "cobertura {total}");
    }

    #[test]
    fn upscaling_keeps_the_original_viewbox() {
        let options = TraceOptions {
            upscale: Some(3),
            ..Default::default()
        };
        let result = trace_rgba(&fixture(64), 64, 64, options).unwrap();
        assert!(result.svg.contains(r#"viewBox="0 0 64 64""#));
        assert_eq!((result.width, result.height), (64, 64));
    }

    #[test]
    fn classic_mode_is_still_available() {
        let options = TraceOptions {
            quantize: false,
            ..Default::default()
        };
        let result = trace_rgba(&fixture(64), 64, 64, options).unwrap();
        assert!(result.coverage.is_empty());
        assert!(result.path_count >= 3);
    }
}

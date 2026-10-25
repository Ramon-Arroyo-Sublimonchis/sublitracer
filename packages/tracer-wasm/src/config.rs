//! Opciones de trazado expuestas a JavaScript.
//!
//! Los nombres y valores por defecto siguen a VTracer (MIT, visioncortex) para que los
//! presets de la web sean fáciles de razonar.

use serde::Deserialize;
use visioncortex::PathSimplifyMode;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ColorMode {
    Color,
    Binary,
}

/// `Stacked`: las capas se apilan (sin huecos entre colores, ideal para impresión).
/// `Cutout`: cada color es una forma independiente con agujeros (ideal para vinil).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Hierarchical {
    Stacked,
    Cutout,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CurveMode {
    Pixel,
    Polygon,
    Spline,
}

impl From<CurveMode> for PathSimplifyMode {
    fn from(mode: CurveMode) -> Self {
        match mode {
            CurveMode::Pixel => PathSimplifyMode::None,
            CurveMode::Polygon => PathSimplifyMode::Polygon,
            CurveMode::Spline => PathSimplifyMode::Spline,
        }
    }
}

/// Cuánto detalle conservar al limpiar la imagen antes de trazar.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Detail {
    Low,
    Medium,
    High,
}

/// Qué hacer con el fondo (la región que ocupa la mayor parte del borde de la imagen).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Background {
    Keep,
    Remove,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TraceOptions {
    /// Reduce la imagen a una paleta global antes de trazar (ver `pipeline`).
    /// `false` = comportamiento clásico de VTracer (útil para fotos con degradados).
    pub quantize: bool,
    /// Número de colores de la paleta; `None` = automático.
    pub colors: Option<usize>,
    pub detail: Detail,
    /// Factor de ampliación interna; `None` = automático según el tamaño.
    pub upscale: Option<usize>,
    /// Los píxeles con alfa menor se consideran transparentes.
    pub alpha_threshold: u8,
    /// Reconocer rectas, arcos y círculos exactos al ajustar las curvas.
    pub geometry: bool,
    pub background: Background,
    pub color_mode: ColorMode,
    pub hierarchical: Hierarchical,
    pub mode: CurveMode,
    /// Descarta manchas de menos de `filter_speckle²` píxeles.
    pub filter_speckle: usize,
    /// Bits significativos por canal (1–8). Menos bits = menos colores.
    pub color_precision: i32,
    /// Diferencia de color mínima entre capas (0–255).
    pub layer_difference: i32,
    /// Ángulo mínimo, en grados, para considerar un vértice como esquina.
    pub corner_threshold: i32,
    pub length_threshold: f64,
    pub max_iterations: usize,
    /// Ángulo mínimo, en grados, para partir una spline.
    pub splice_threshold: i32,
    /// Umbral de luminancia (0–255) para el modo binario.
    pub binary_threshold: u8,
    pub path_precision: Option<u32>,
}

impl Default for TraceOptions {
    fn default() -> Self {
        Self {
            quantize: true,
            colors: None,
            detail: Detail::Medium,
            upscale: None,
            alpha_threshold: 128,
            geometry: true,
            background: Background::Keep,
            color_mode: ColorMode::Color,
            hierarchical: Hierarchical::Stacked,
            mode: CurveMode::Spline,
            filter_speckle: 4,
            color_precision: 6,
            layer_difference: 16,
            corner_threshold: 60,
            length_threshold: 4.0,
            max_iterations: 10,
            splice_threshold: 45,
            binary_threshold: 128,
            path_precision: Some(2),
        }
    }
}

/// Opciones ya validadas y convertidas a las unidades que espera visioncortex.
#[derive(Debug, Clone)]
pub(crate) struct ConverterConfig {
    pub color_mode: ColorMode,
    pub hierarchical: Hierarchical,
    pub mode: PathSimplifyMode,
    pub filter_speckle_area: usize,
    pub color_precision_loss: i32,
    pub layer_difference: i32,
    pub corner_threshold: f64,
    pub length_threshold: f64,
    pub max_iterations: usize,
    pub splice_threshold: f64,
    pub binary_threshold: u8,
    pub path_precision: Option<u32>,
}

impl TraceOptions {
    pub(crate) fn into_converter_config(self) -> ConverterConfig {
        ConverterConfig {
            color_mode: self.color_mode,
            hierarchical: self.hierarchical,
            mode: self.mode.into(),
            filter_speckle_area: self.filter_speckle.min(128).pow(2),
            color_precision_loss: 8 - self.color_precision.clamp(1, 8),
            layer_difference: self.layer_difference.clamp(0, 255),
            corner_threshold: deg2rad(self.corner_threshold.clamp(0, 180)),
            length_threshold: self.length_threshold.clamp(3.5, 10.0),
            max_iterations: self.max_iterations.clamp(1, 50),
            splice_threshold: deg2rad(self.splice_threshold.clamp(0, 180)),
            binary_threshold: self.binary_threshold,
            path_precision: self.path_precision.map(|p| p.min(8)),
        }
    }
}

pub(crate) fn deg2rad(deg: i32) -> f64 {
    deg as f64 / 180.0 * std::f64::consts::PI
}

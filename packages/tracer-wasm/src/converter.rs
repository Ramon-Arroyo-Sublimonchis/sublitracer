//! Conversión de una imagen RGBA a capas vectoriales.
//!
//! Adaptado de `vtracer::converter` (MIT © visioncortex). Diferencias: la búsqueda del
//! color clave es determinista (mismo resultado para la misma entrada) y el modo binario
//! acepta un umbral de luminancia configurable.

use visioncortex::color_clusters::{KeyingAction, Runner, RunnerConfig, HIERARCHICAL_MAX};
use visioncortex::{Color, ColorImage, CompoundPath};

use crate::config::{ColorMode, ConverterConfig, Hierarchical};

/// Fracción de píxeles transparentes en las líneas de muestreo a partir de la cual se
/// "enmascara" la transparencia con un color clave.
const KEYING_THRESHOLD: f32 = 0.2;

pub struct Layer {
    pub path: CompoundPath,
    pub color: Color,
}

pub struct Traced {
    pub width: usize,
    pub height: usize,
    pub layers: Vec<Layer>,
}

pub fn convert(img: ColorImage, config: &ConverterConfig) -> Result<Traced, String> {
    if img.width == 0 || img.height == 0 {
        return Err("La imagen está vacía".into());
    }
    match config.color_mode {
        ColorMode::Color => color_image_to_layers(img, config),
        ColorMode::Binary => binary_image_to_layers(img, config),
    }
}

fn color_exists_in_image(img: &ColorImage, color: Color) -> bool {
    img.pixels
        .chunks_exact(4)
        .any(|p| p[0] == color.r && p[1] == color.g && p[2] == color.b)
}

fn find_unused_color_in_image(img: &ColorImage) -> Result<Color, String> {
    let special = [
        Color::new(255, 0, 0),
        Color::new(0, 255, 0),
        Color::new(0, 0, 255),
        Color::new(255, 255, 0),
        Color::new(0, 255, 255),
        Color::new(255, 0, 255),
    ];
    // Generador congruencial simple: suficiente para encontrar un color libre y
    // mantiene la salida reproducible.
    let mut seed: u32 = 0x9E37_79B9;
    let pseudo_random = (0..32).map(move |_| {
        seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        let [r, g, b, _] = seed.to_le_bytes();
        Color::new(r, g, b)
    });
    special
        .into_iter()
        .chain(pseudo_random)
        .find(|&c| !color_exists_in_image(img, c))
        .ok_or_else(|| "No se encontró un color libre para la transparencia".into())
}

fn should_key_image(img: &ColorImage) -> bool {
    let threshold = ((img.width * 2) as f32 * KEYING_THRESHOLD) as usize;
    let rows = [
        0,
        img.height / 4,
        img.height / 2,
        3 * img.height / 4,
        img.height - 1,
    ];
    let mut transparent = 0;
    for y in rows {
        for x in 0..img.width {
            if img.get_pixel(x, y).a == 0 {
                transparent += 1;
                if transparent >= threshold {
                    return true;
                }
            }
        }
    }
    false
}

fn color_image_to_layers(mut img: ColorImage, config: &ConverterConfig) -> Result<Traced, String> {
    let (width, height) = (img.width, img.height);

    let key_color = if should_key_image(&img) {
        let key_color = find_unused_color_in_image(&img)?;
        for y in 0..height {
            for x in 0..width {
                if img.get_pixel(x, y).a == 0 {
                    img.set_pixel(x, y, &key_color);
                }
            }
        }
        key_color
    } else {
        // Todo ceros: visioncortex lo interpreta como "sin color clave".
        Color::default()
    };

    let runner = Runner::new(
        RunnerConfig {
            diagonal: config.layer_difference == 0,
            hierarchical: HIERARCHICAL_MAX,
            batch_size: 25600,
            good_min_area: config.filter_speckle_area,
            good_max_area: width * height,
            is_same_color_a: config.color_precision_loss,
            is_same_color_b: 1,
            deepen_diff: config.layer_difference,
            hollow_neighbours: 1,
            key_color,
            keying_action: match config.hierarchical {
                Hierarchical::Cutout => KeyingAction::Keep,
                Hierarchical::Stacked => KeyingAction::Discard,
            },
        },
        img,
    );
    let mut clusters = runner.run();

    if config.hierarchical == Hierarchical::Cutout {
        let image = clusters.view().to_color_image();
        let runner = Runner::new(
            RunnerConfig {
                diagonal: false,
                hierarchical: 64,
                batch_size: 25600,
                good_min_area: 0,
                good_max_area: image.width * image.height,
                is_same_color_a: 0,
                is_same_color_b: 1,
                deepen_diff: 0,
                hollow_neighbours: 0,
                key_color,
                keying_action: KeyingAction::Discard,
            },
            image,
        );
        clusters = runner.run();
    }

    let view = clusters.view();
    let layers = view
        .clusters_output
        .iter()
        .rev()
        .map(|&index| {
            let cluster = view.get_cluster(index);
            Layer {
                path: cluster.to_compound_path(
                    &view,
                    false,
                    config.mode,
                    config.corner_threshold,
                    config.length_threshold,
                    config.max_iterations,
                    config.splice_threshold,
                ),
                color: cluster.residue_color(),
            }
        })
        .collect();

    Ok(Traced {
        width,
        height,
        layers,
    })
}

fn binary_image_to_layers(img: ColorImage, config: &ConverterConfig) -> Result<Traced, String> {
    let threshold = config.binary_threshold as u32;
    // Luminancia Rec. 601; los píxeles transparentes cuentan como fondo.
    let binary = img.to_binary_image(|c| {
        c.a >= 128 && (299 * c.r as u32 + 587 * c.g as u32 + 114 * c.b as u32) / 1000 < threshold
    });
    let (width, height) = (binary.width, binary.height);
    let clusters = binary.to_clusters(false);

    let layers = (0..clusters.len())
        .map(|i| clusters.get_cluster(i))
        .filter(|cluster| cluster.size() >= config.filter_speckle_area)
        .map(|cluster| Layer {
            path: cluster.to_compound_path(
                config.mode,
                config.corner_threshold,
                config.length_threshold,
                config.max_iterations,
                config.splice_threshold,
            ),
            color: Color::new(0, 0, 0),
        })
        .collect();

    Ok(Traced {
        width,
        height,
        layers,
    })
}

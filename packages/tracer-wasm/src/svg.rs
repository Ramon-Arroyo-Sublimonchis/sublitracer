use std::fmt::Write;

use visioncortex::PointF64;

use crate::converter::Traced;

/// Serializa las capas como SVG. Incluye `viewBox` para que el vector escale sin
/// recortes cuando se muestra en `<img>` o se importa en programas de diseño.
pub fn to_svg(traced: &Traced, precision: Option<u32>) -> String {
    let mut out = String::with_capacity(traced.layers.len() * 256);
    let (w, h) = (traced.width, traced.height);
    let _ = writeln!(out, r#"<?xml version="1.0" encoding="UTF-8"?>"#);
    let _ = writeln!(out, "<!-- Generado con VectorizarIA by Sublimonchis -->");
    let _ = writeln!(
        out,
        r#"<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="{w}" height="{h}" viewBox="0 0 {w} {h}">"#
    );
    for layer in &traced.layers {
        let (d, offset) = layer
            .path
            .to_svg_string(true, PointF64::default(), precision);
        if d.is_empty() {
            continue;
        }
        let _ = writeln!(
            out,
            r#"<path d="{d}" fill="{}" transform="translate({},{})"/>"#,
            layer.color.to_hex_string(),
            offset.x,
            offset.y
        );
    }
    out.push_str("</svg>\n");
    out
}

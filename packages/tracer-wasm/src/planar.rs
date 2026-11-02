//! Mapa planar: las fronteras entre regiones como un grafo de **cadenas compartidas**.
//!
//! Cada frontera entre dos colores se extrae y se ajusta **una sola vez**, y las dos
//! formas que separa la usan tal cual. Así no hay huecos ni superposiciones entre colores,
//! y la vista de contornos (y el corte láser) recibe cada línea exactamente una vez.
//!
//! - Aristas: bordes entre píxeles vecinos con distinta etiqueta, sobre la rejilla de
//!   esquinas de píxel. Fuera de la imagen cuenta como transparente.
//! - Nodos: esquinas donde se tocan 3+ regiones (grado ≥ 3).
//! - Cadenas: recorridos de nodo a nodo, o anillos cerrados sin nodos.

use std::collections::HashMap;
use std::fmt::Write;

use crate::fit::{cross, Cubic, Pt};
use crate::geometry::{fit_chain, ChainFit, Circle};
use crate::quantize::TRANSPARENT;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Dir {
    Right,
    Down,
    Left,
    Up,
}

const DIRS: [Dir; 4] = [Dir::Right, Dir::Down, Dir::Left, Dir::Up];

impl Dir {
    fn delta(self) -> (isize, isize) {
        match self {
            Dir::Right => (1, 0),
            Dir::Down => (0, 1),
            Dir::Left => (-1, 0),
            Dir::Up => (0, -1),
        }
    }
    fn reverse(self) -> Dir {
        match self {
            Dir::Right => Dir::Left,
            Dir::Down => Dir::Up,
            Dir::Left => Dir::Right,
            Dir::Up => Dir::Down,
        }
    }
}

#[derive(Debug)]
pub struct Chain {
    /// Puntos en píxeles de la imagen original.
    pub points: Vec<Pt>,
    /// Etiqueta a la izquierda / derecha del sentido de recorrido (eje Y hacia abajo).
    pub left: u16,
    pub right: u16,
    pub closed: bool,
    /// Nodos de inicio y fin (índices de la rejilla de esquinas).
    pub start: usize,
    pub end: usize,
    /// Corre entera sobre el marco de la imagen.
    pub frame: bool,
}

struct Grid<'a> {
    labels: &'a [u16],
    w: usize,
    h: usize,
}

impl Grid<'_> {
    fn label(&self, x: isize, y: isize) -> u16 {
        if x < 0 || y < 0 || x >= self.w as isize || y >= self.h as isize {
            TRANSPARENT
        } else {
            self.labels[y as usize * self.w + x as usize]
        }
    }

    /// Etiquetas a la izquierda y a la derecha al salir de (x, y) en dirección `d`.
    fn sides(&self, x: usize, y: usize, d: Dir) -> (u16, u16) {
        let (x, y) = (x as isize, y as isize);
        match d {
            Dir::Right => (self.label(x, y - 1), self.label(x, y)),
            Dir::Left => (self.label(x - 1, y), self.label(x - 1, y - 1)),
            Dir::Down => (self.label(x, y), self.label(x - 1, y)),
            Dir::Up => (self.label(x - 1, y - 1), self.label(x, y - 1)),
        }
    }

    fn has(&self, x: usize, y: usize, d: Dir) -> bool {
        let inside = match d {
            Dir::Right => x < self.w,
            Dir::Left => x > 0,
            Dir::Down => y < self.h,
            Dir::Up => y > 0,
        };
        inside && {
            let (l, r) = self.sides(x, y, d);
            l != r
        }
    }

    fn degree(&self, x: usize, y: usize) -> usize {
        DIRS.iter().filter(|&&d| self.has(x, y, d)).count()
    }

    /// Índice único de la arista (horizontales primero, luego verticales).
    fn edge_id(&self, x: usize, y: usize, d: Dir) -> usize {
        let horizontal = (self.h + 1) * self.w;
        match d {
            Dir::Right => y * self.w + x,
            Dir::Left => y * self.w + x - 1,
            Dir::Down => horizontal + y * (self.w + 1) + x,
            Dir::Up => horizontal + (y - 1) * (self.w + 1) + x,
        }
    }

    fn on_frame(&self, x: usize, y: usize, d: Dir) -> bool {
        match d {
            Dir::Right | Dir::Left => y == 0 || y == self.h,
            Dir::Up | Dir::Down => x == 0 || x == self.w,
        }
    }

    fn vertex(&self, x: usize, y: usize) -> usize {
        y * (self.w + 1) + x
    }
}

/// Extrae todas las cadenas. `scale` es el factor de ampliación del mapa de etiquetas.
pub fn extract_chains(labels: &[u16], w: usize, h: usize, scale: usize) -> Vec<Chain> {
    let g = Grid { labels, w, h };
    let mut seen = vec![false; (h + 1) * w + h * (w + 1)];
    let k = 1.0 / scale as f64;
    let mut chains = Vec::new();

    let walk = |x0: usize, y0: usize, d0: Dir, seen: &mut Vec<bool>| -> Chain {
        let (left, right) = g.sides(x0, y0, d0);
        let mut points = vec![[x0 as f64 * k, y0 as f64 * k]];
        let (mut x, mut y, mut d) = (x0, y0, d0);
        let mut frame = true;
        let closed = loop {
            seen[g.edge_id(x, y, d)] = true;
            frame &= g.on_frame(x, y, d);
            let (dx, dy) = d.delta();
            x = (x as isize + dx) as usize;
            y = (y as isize + dy) as usize;
            points.push([x as f64 * k, y as f64 * k]);
            if (x, y) == (x0, y0) {
                break g.degree(x, y) == 2;
            }
            if g.degree(x, y) != 2 {
                break false;
            }
            d = DIRS
                .into_iter()
                .find(|&n| n != d.reverse() && g.has(x, y, n))
                .expect("vértice de grado 2 sin salida");
        };
        // Quitar los vértices intermedios colineales: la rejilla es de pasos de 1 px.
        let points = collinear_simplify(points, closed);
        Chain {
            points,
            left,
            right,
            closed,
            start: g.vertex(x0, y0),
            end: g.vertex(x, y),
            frame,
        }
    };

    for y in 0..=h {
        for x in 0..=w {
            if g.degree(x, y) < 3 {
                continue;
            }
            for d in DIRS {
                if g.has(x, y, d) && !seen[g.edge_id(x, y, d)] {
                    chains.push(walk(x, y, d, &mut seen));
                }
            }
        }
    }
    // Lo que queda son anillos sin nodos; todo anillo de la rejilla tiene aristas horizontales.
    for y in 0..=h {
        for x in 0..w {
            if g.has(x, y, Dir::Right) && !seen[g.edge_id(x, y, Dir::Right)] {
                chains.push(walk(x, y, Dir::Right, &mut seen));
            }
        }
    }
    chains
}

fn collinear_simplify(points: Vec<Pt>, closed: bool) -> Vec<Pt> {
    let n = points.len();
    if n < 3 {
        return points;
    }
    let mut out = Vec::with_capacity(n / 2);
    out.push(points[0]);
    for i in 1..n - 1 {
        let (a, b, c) = (points[i - 1], points[i], points[i + 1]);
        if cross([b[0] - a[0], b[1] - a[1]], [c[0] - b[0], c[1] - b[1]]).abs() > 1e-12 {
            out.push(b);
        }
    }
    out.push(points[n - 1]);
    if closed && out.len() > 1 && out[0] == out[out.len() - 1] {
        out.pop();
    }
    out
}

pub struct PlanarSettings {
    pub fit: ChainFit,
    /// Apilado (formas sin agujeros, de mayor a menor) o recortes (formas que embonan).
    pub stacked: bool,
    /// Etiquetas que no se dibujan (fondo quitado, blanco en modo B/N), además de la
    /// transparencia.
    pub hidden: Vec<u16>,
    /// Color de cada etiqueta.
    pub colors: Vec<[u8; 3]>,
    pub precision: usize,
}

pub struct PlanarOutput {
    pub fill_svg: String,
    pub outline_svg: String,
    pub shapes: usize,
    /// Etiquetas dibujadas, en el orden de la paleta.
    pub labels_used: Vec<u16>,
}

#[derive(Clone, Copy)]
struct Use {
    chain: usize,
    reversed: bool,
}

pub fn trace(labels: &[u16], w: usize, h: usize, scale: usize, s: &PlanarSettings) -> PlanarOutput {
    let chains = extract_chains(labels, w, h, scale);
    let mut curves: Vec<Vec<Cubic>> = Vec::with_capacity(chains.len());
    let mut circles: Vec<(usize, Circle)> = Vec::new();
    for (i, chain) in chains.iter().enumerate() {
        let fitted = fit_chain(&chain.points, chain.closed, &s.fit);
        if let Some(c) = fitted.circle {
            circles.push((i, c));
        }
        curves.push(fitted.curves);
    }
    snap_concentric(&mut curves, &circles, s.fit.tolerance.max(0.5));

    let hidden = |l: u16| l == TRANSPARENT || s.hidden.contains(&l);
    let (ow, oh) = (w / scale, h / scale);
    let header = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!-- Generado con VectorizarIA by Sublimonchis -->\n<svg xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\" width=\"{ow}\" height=\"{oh}\" viewBox=\"0 0 {ow} {oh}\">\n"
    );

    // ---------- Contorno: cada frontera una sola vez ----------
    let mut outline = header.clone();
    for (chain, cubics) in chains.iter().zip(&curves) {
        if chain.frame || (hidden(chain.left) && hidden(chain.right)) || cubics.is_empty() {
            continue;
        }
        let mut d = String::new();
        write_curves(&mut d, cubics, true, s.precision);
        if chain.closed {
            d.push('Z');
        }
        let _ = writeln!(outline, r##"<path d="{d}" fill="none" stroke="#000000"/>"##);
    }
    outline.push_str("</svg>\n");

    // ---------- Ciclos por etiqueta ----------
    let mut by_label: HashMap<u16, Vec<Use>> = HashMap::new();
    for (i, chain) in chains.iter().enumerate() {
        if !hidden(chain.left) {
            by_label.entry(chain.left).or_default().push(Use {
                chain: i,
                reversed: false,
            });
        }
        if !hidden(chain.right) {
            by_label.entry(chain.right).or_default().push(Use {
                chain: i,
                reversed: true,
            });
        }
    }
    let mut label_order: Vec<u16> = by_label.keys().copied().collect();
    label_order.sort_unstable();

    struct Cycle {
        label: u16,
        uses: Vec<Use>,
        area: f64,
    }
    let mut cycles: Vec<Cycle> = Vec::new();
    for &label in &label_order {
        for uses in link_cycles(&chains, &by_label[&label]) {
            let area = signed_area(&chains, &uses);
            cycles.push(Cycle { label, uses, area });
        }
    }

    // ---------- Relleno ----------
    let mut fill = header;
    let mut shapes = 0;
    let color = |l: u16| {
        let [r, g, b] = s.colors[l as usize];
        format!("#{r:02X}{g:02X}{b:02X}")
    };
    if s.stacked {
        // Exteriores (área negativa con Y hacia abajo) de mayor a menor: las formas de
        // arriba tapan los agujeros de las de abajo, sin costuras. Solo se conservan los
        // agujeros que dan a la transparencia.
        let outers: Vec<usize> = (0..cycles.len())
            .filter(|&i| cycles[i].area < 0.0)
            .collect();
        let mut holes_of: HashMap<usize, Vec<usize>> = HashMap::new();
        for (i, cycle) in cycles.iter().enumerate() {
            if cycle.area < 0.0 {
                continue;
            }
            let borders_hidden = cycle.uses.iter().any(|u| {
                let c = &chains[u.chain];
                let other = if u.reversed { c.left } else { c.right };
                hidden(other)
            });
            if !borders_hidden {
                continue;
            }
            let probe = interior_probe(&chains, &cycle.uses);
            let owner = outers
                .iter()
                .copied()
                .filter(|&o| cycles[o].label == cycle.label)
                .filter(|&o| point_in_cycle(&chains, &cycles[o].uses, probe))
                .min_by(|&a, &b| cycles[a].area.abs().total_cmp(&cycles[b].area.abs()));
            if let Some(o) = owner {
                holes_of.entry(o).or_default().push(i);
            }
        }
        let mut order = outers.clone();
        order.sort_by(|&a, &b| cycles[b].area.abs().total_cmp(&cycles[a].area.abs()));
        for o in order {
            let mut d = String::new();
            write_cycle(&mut d, &curves, &cycles[o].uses, s.precision);
            for &hole in holes_of.get(&o).into_iter().flatten() {
                write_cycle(&mut d, &curves, &cycles[hole].uses, s.precision);
            }
            let _ = writeln!(fill, r#"<path d="{d}" fill="{}"/>"#, color(cycles[o].label));
            shapes += 1;
        }
    } else {
        for &label in &label_order {
            let mut d = String::new();
            for cycle in cycles.iter().filter(|c| c.label == label) {
                write_cycle(&mut d, &curves, &cycle.uses, s.precision);
            }
            if !d.is_empty() {
                let _ = writeln!(fill, r#"<path d="{d}" fill="{}"/>"#, color(label));
                shapes += 1;
            }
        }
    }
    fill.push_str("</svg>\n");

    PlanarOutput {
        fill_svg: fill,
        outline_svg: outline,
        shapes,
        labels_used: label_order,
    }
}

/// Etiqueta de fondo: la que ocupa más del 60 % del borde de la imagen (si no es
/// transparente).
pub fn detect_background(labels: &[u16], w: usize, h: usize) -> Option<u16> {
    let mut counts: HashMap<u16, usize> = HashMap::new();
    let mut total = 0;
    let mut add = |l: u16| {
        *counts.entry(l).or_default() += 1;
        total += 1;
    };
    for x in 0..w {
        add(labels[x]);
        add(labels[(h - 1) * w + x]);
    }
    for y in 1..h.saturating_sub(1) {
        add(labels[y * w]);
        add(labels[y * w + w - 1]);
    }
    let (label, n) = counts.into_iter().max_by_key(|&(_, n)| n)?;
    (label != TRANSPARENT && n * 10 > total * 6).then_some(label)
}

/// Los círculos completos cuyos centros casi coinciden pasan a compartir el centro exacto.
fn snap_concentric(curves: &mut [Vec<Cubic>], circles: &[(usize, Circle)], tolerance: f64) {
    let mut clusters: Vec<(Pt, Vec<usize>)> = Vec::new();
    for (k, (_, c)) in circles.iter().enumerate() {
        match clusters.iter_mut().find(|(center, _)| {
            let d = [center[0] - c.center[0], center[1] - c.center[1]];
            (d[0] * d[0] + d[1] * d[1]).sqrt() <= tolerance
        }) {
            Some((_, members)) => members.push(k),
            None => clusters.push((c.center, vec![k])),
        }
    }
    for (_, members) in clusters.into_iter().filter(|(_, m)| m.len() > 1) {
        let n = members.len() as f64;
        let center = members.iter().fold([0.0, 0.0], |acc, &k| {
            [
                acc[0] + circles[k].1.center[0] / n,
                acc[1] + circles[k].1.center[1] / n,
            ]
        });
        for k in members {
            let (chain, circle) = circles[k];
            curves[chain] = Circle { center, ..circle }.curves();
        }
    }
}

fn use_ends(chains: &[Chain], u: Use) -> (usize, usize) {
    let c = &chains[u.chain];
    if u.reversed {
        (c.end, c.start)
    } else {
        (c.start, c.end)
    }
}

fn use_points(chains: &[Chain], u: Use) -> Vec<Pt> {
    let mut p = chains[u.chain].points.clone();
    if u.reversed {
        p.reverse();
    }
    p
}

/// Enlaza las cadenas de una etiqueta (con la etiqueta a la izquierda) en ciclos cerrados.
fn link_cycles(chains: &[Chain], uses: &[Use]) -> Vec<Vec<Use>> {
    let mut cycles = Vec::new();
    let mut by_start: HashMap<usize, Vec<usize>> = HashMap::new();
    for (i, &u) in uses.iter().enumerate() {
        if chains[u.chain].closed {
            cycles.push(vec![u]);
        } else {
            by_start.entry(use_ends(chains, u).0).or_default().push(i);
        }
    }
    let mut used = vec![false; uses.len()];
    let dir_out = |u: Use| {
        let p = use_points(chains, u);
        [p[1][0] - p[0][0], p[1][1] - p[0][1]]
    };
    let dir_in = |u: Use| {
        let p = use_points(chains, u);
        let n = p.len();
        [p[n - 1][0] - p[n - 2][0], p[n - 1][1] - p[n - 2][1]]
    };
    for i in 0..uses.len() {
        if used[i] || chains[uses[i].chain].closed {
            continue;
        }
        used[i] = true;
        let first = uses[i];
        let origin = use_ends(chains, first).0;
        let mut cycle = vec![first];
        let mut current = first;
        let mut v = use_ends(chains, first).1;
        while v != origin {
            let incoming = dir_in(current);
            // Siguiente tramo: el que gira más hacia el mismo lado (regla fija y coherente
            // en los nodos donde una región se toca a sí misma).
            let next = by_start.get(&v).and_then(|cands| {
                cands
                    .iter()
                    .copied()
                    .filter(|&c| !used[c])
                    .max_by(|&a, &b| {
                        let turn = |c: usize| {
                            let o = dir_out(uses[c]);
                            cross(incoming, o).atan2(incoming[0] * o[0] + incoming[1] * o[1])
                        };
                        turn(a).total_cmp(&turn(b))
                    })
            });
            let Some(n) = next else { break };
            used[n] = true;
            cycle.push(uses[n]);
            current = uses[n];
            v = use_ends(chains, current).1;
        }
        cycles.push(cycle);
    }
    cycles
}

/// Área con signo del ciclo (polígono de la rejilla, exacto). Negativa = contorno exterior.
fn signed_area(chains: &[Chain], uses: &[Use]) -> f64 {
    let pts: Vec<Pt> = uses.iter().flat_map(|&u| use_points(chains, u)).collect();
    let n = pts.len();
    (0..n).map(|i| cross(pts[i], pts[(i + 1) % n])).sum::<f64>() / 2.0
}

/// Un punto apenas a la izquierda (dentro de la región) del primer tramo del ciclo.
fn interior_probe(chains: &[Chain], uses: &[Use]) -> Pt {
    let p = use_points(chains, uses[0]);
    let (a, b) = (p[0], p[1]);
    let d = [b[0] - a[0], b[1] - a[1]];
    let l = (d[0] * d[0] + d[1] * d[1]).sqrt().max(1e-9);
    let mid = [(a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0];
    // Izquierda con Y hacia abajo: (dy, −dx).
    [mid[0] + d[1] / l * 0.05, mid[1] - d[0] / l * 0.05]
}

fn point_in_cycle(chains: &[Chain], uses: &[Use], p: Pt) -> bool {
    let pts: Vec<Pt> = uses.iter().flat_map(|&u| use_points(chains, u)).collect();
    let n = pts.len();
    let mut inside = false;
    for i in 0..n {
        let (a, b) = (pts[i], pts[(i + 1) % n]);
        if (a[1] > p[1]) != (b[1] > p[1]) {
            let x = a[0] + (p[1] - a[1]) / (b[1] - a[1]) * (b[0] - a[0]);
            if p[0] < x {
                inside = !inside;
            }
        }
    }
    inside
}

fn write_cycle(out: &mut String, curves: &[Vec<Cubic>], uses: &[Use], precision: usize) {
    let mut first = true;
    for &u in uses {
        let cubics = &curves[u.chain];
        if cubics.is_empty() {
            continue;
        }
        if u.reversed {
            let rev: Vec<Cubic> = cubics.iter().rev().map(Cubic::reversed).collect();
            write_curves(out, &rev, first, precision);
        } else {
            write_curves(out, cubics, first, precision);
        }
        first = false;
    }
    if !first {
        out.push('Z');
    }
}

fn num(v: f64, precision: usize) -> String {
    let s = format!("{v:.precision$}");
    let s = if s.contains('.') {
        s.trim_end_matches('0').trim_end_matches('.').to_string()
    } else {
        s
    };
    if s == "-0" {
        "0".into()
    } else {
        s
    }
}

fn write_curves(out: &mut String, cubics: &[Cubic], move_to: bool, precision: usize) {
    let p = |v: f64| num(v, precision);
    if move_to {
        let [x, y] = cubics[0].0[0];
        let _ = write!(out, "M{} {}", p(x), p(y));
    }
    for c in cubics {
        let [_, c1, c2, e] = c.0;
        let _ = write!(
            out,
            "C{} {} {} {} {} {}",
            p(c1[0]),
            p(c1[1]),
            p(c2[0]),
            p(c2[1]),
            p(e[0]),
            p(e[1])
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings(stacked: bool, colors: usize) -> PlanarSettings {
        PlanarSettings {
            fit: ChainFit {
                tolerance: 0.5,
                corner_turn: 60f64.to_radians(),
                corner_reach: 1.5,
                geometry: true,
                noise: 0.5,
            },
            stacked,
            hidden: vec![],
            colors: (0..colors).map(|i| [i as u8 * 60, 0, 0]).collect(),
            precision: 3,
        }
    }

    /// Fondo 0, un rectángulo 1 a la izquierda y un rectángulo 2 a la derecha que se tocan.
    fn three_regions() -> (Vec<u16>, usize, usize) {
        let (w, h) = (30, 20);
        let mut l = vec![0u16; w * h];
        for y in 5..15 {
            for x in 5..15 {
                l[y * w + x] = 1;
            }
            for x in 15..25 {
                l[y * w + x] = 2;
            }
        }
        (l, w, h)
    }

    #[test]
    fn each_pair_of_neighbours_shares_exactly_one_chain() {
        let (l, w, h) = three_regions();
        let chains = extract_chains(&l, w, h, 1);
        let pairs = |a: u16, b: u16| {
            chains
                .iter()
                .filter(|c| (c.left, c.right) == (a, b) || (c.left, c.right) == (b, a))
                .count()
        };
        assert_eq!(pairs(1, 2), 1, "frontera 1|2");
        // 0|1 y 0|2: cada una es una sola cadena entre los dos nodos triples.
        assert_eq!(pairs(0, 1), 1);
        assert_eq!(pairs(0, 2), 1);
        // El marco de la imagen (0 | transparente) es un anillo de marco.
        assert!(chains.iter().any(|c| c.frame && c.closed));
    }

    #[test]
    fn outline_has_no_duplicates_and_no_frame() {
        let (l, w, h) = three_regions();
        let out = trace(&l, w, h, 1, &settings(true, 3));
        // 3 fronteras internas: 0|1, 0|2 y 1|2.
        assert_eq!(out.outline_svg.matches("<path").count(), 3);
    }

    #[test]
    fn cutout_shapes_tile_the_plane() {
        let (l, w, h) = three_regions();
        let out = trace(&l, w, h, 1, &settings(false, 3));
        assert_eq!(out.shapes, 3);
        // El fondo recortado tiene un agujero: dos subrutas.
        let background = out
            .fill_svg
            .lines()
            .find(|l| l.contains("#000000"))
            .unwrap();
        assert_eq!(background.matches('M').count(), 2);
    }

    #[test]
    fn stacked_shapes_have_no_holes_and_go_largest_first() {
        let (l, w, h) = three_regions();
        let out = trace(&l, w, h, 1, &settings(true, 3));
        let paths: Vec<&str> = out
            .fill_svg
            .lines()
            .filter(|l| l.starts_with("<path"))
            .collect();
        assert_eq!(paths.len(), 3);
        assert!(
            paths[0].contains("#000000"),
            "el fondo va primero: {}",
            paths[0]
        );
        assert!(
            paths.iter().all(|p| p.matches('M').count() == 1),
            "sin agujeros"
        );
    }

    #[test]
    fn transparent_holes_are_kept_in_stacked_mode() {
        // Anillo (1) con agujero transparente sobre fondo transparente.
        let (w, h) = (20, 20);
        let mut l = vec![TRANSPARENT; w * h];
        for y in 2..18 {
            for x in 2..18 {
                if !(6..14).contains(&x) || !(6..14).contains(&y) {
                    l[y * w + x] = 0;
                }
            }
        }
        let out = trace(&l, w, h, 1, &settings(true, 1));
        let path = out
            .fill_svg
            .lines()
            .find(|l| l.starts_with("<path"))
            .unwrap();
        assert_eq!(
            path.matches('M').count(),
            2,
            "el agujero transparente se conserva"
        );
        assert_eq!(
            out.outline_svg.matches("<path").count(),
            2,
            "borde exterior e interior"
        );
    }

    #[test]
    fn concentric_rings_share_the_exact_centre() {
        let (w, h) = (90, 90);
        let mut l = vec![0u16; w * h];
        for y in 0..h {
            for x in 0..w {
                let d = ((x as f64 + 0.5 - 45.2).powi(2) + (y as f64 + 0.5 - 44.8).powi(2)).sqrt();
                l[y * w + x] = if d < 20.0 {
                    2
                } else if d < 35.0 {
                    1
                } else {
                    0
                };
            }
        }
        let chains = extract_chains(&l, w, h, 1);
        let rings: Vec<&Chain> = chains.iter().filter(|c| c.closed && !c.frame).collect();
        assert_eq!(rings.len(), 2);
        let out = trace(&l, w, h, 1, &settings(true, 3));
        // Los dos círculos del contorno: cada uno son 4 cuartos de círculo.
        let paths: Vec<&str> = out
            .outline_svg
            .lines()
            .filter(|l| l.starts_with("<path"))
            .collect();
        assert_eq!(paths.len(), 2);
        assert!(
            paths.iter().all(|p| p.matches('C').count() == 4),
            "{paths:?}"
        );
    }
}

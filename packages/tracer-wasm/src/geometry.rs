//! Contorno → curvas, con geometría exacta donde la hay.
//!
//! Para cada cadena del mapa planar (abierta entre dos nodos, o cerrada):
//! 1. Se detectan las **esquinas** midiendo el giro a una distancia fija a cada lado, lo
//!    que ignora el escalonado de píxeles.
//! 2. Se suaviza levemente sin cruzar esquinas ni mover los extremos.
//! 3. Cada tramo entre esquinas se clasifica: **recta** (enderezada al eje si está a menos
//!    de 1°), **arco** (con los extremos fijos) o curva libre (Bézier de Schneider).
//! 4. Donde se unen dos rectas, la esquina es su **intersección exacta**.
//! 5. Una cadena cerrada sin esquinas que es un círculo se reemplaza por un **círculo
//!    perfecto**.

use crate::fit::{add, cross, dot, fit_cubic, len, mul, normalize, sub, Cubic, Pt};

/// Tolerancia angular para enderezar rectas a horizontal/vertical (~1°).
const AXIS_SNAP_SIN: f64 = 0.017_452;
/// Ángulo mínimo entre dos rectas para reemplazar la esquina por su intersección (~15°).
const MIN_INTERSECTION_SIN: f64 = 0.258_8;
const TAU: f64 = std::f64::consts::TAU;

pub struct ChainFit {
    /// Distancia máxima (px) entre la curva libre y el contorno.
    pub tolerance: f64,
    /// Giro mínimo (radianes) para considerar un punto como esquina.
    pub corner_turn: f64,
    /// Distancia (px) a cada lado usada para medir el giro.
    pub corner_reach: f64,
    /// Reconocer rectas, arcos y círculos exactos.
    pub geometry: bool,
    /// Ruido del contorno (px): media celda de la rejilla, 0.5 / ampliación. Un borde
    /// trazado a 1× tiene escalones de píxel que deben absorberse.
    pub noise: f64,
}

impl ChainFit {
    /// Tolerancia efectiva: la pedida más la mitad del ruido de la rejilla.
    fn tol(&self) -> f64 {
        self.tolerance + 0.5 * self.noise
    }
    /// Alcance (px) de la media móvil que elimina el escalonado antes del ajuste.
    fn smooth_reach(&self) -> f64 {
        1.0 + 2.0 * self.noise
    }
    fn line_tolerance(&self) -> f64 {
        0.6 * self.tol()
    }
    fn arc_max(&self) -> f64 {
        self.tol()
    }
    fn arc_mean(&self) -> f64 {
        0.4 * self.tol()
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Circle {
    pub center: Pt,
    pub radius: f64,
    /// Ángulo inicial y sentido de recorrido (+1 o −1), para conservar la orientación.
    pub start: f64,
    pub direction: f64,
}

impl Circle {
    pub fn curves(&self) -> Vec<Cubic> {
        arc_curves(
            self.center,
            self.radius,
            self.start,
            self.direction * TAU,
            None,
            None,
        )
    }
}

pub struct Fitted {
    pub curves: Vec<Cubic>,
    /// Si la cadena resultó ser un círculo completo (para alinear círculos concéntricos).
    pub circle: Option<Circle>,
}

/// Puntos de un contorno con acceso abierto o cíclico.
struct Contour {
    pts: Vec<Pt>,
    /// `seg[i]` = distancia de `pts[i]` a su siguiente.
    seg: Vec<f64>,
    closed: bool,
}

impl Contour {
    fn new(pts: Vec<Pt>, closed: bool) -> Self {
        let n = pts.len();
        let seg = (0..n)
            .map(|i| {
                if i + 1 < n {
                    len(sub(pts[i + 1], pts[i]))
                } else if closed {
                    len(sub(pts[0], pts[i]))
                } else {
                    0.0
                }
            })
            .collect();
        Self { pts, seg, closed }
    }

    fn n(&self) -> usize {
        self.pts.len()
    }

    fn step(&self, i: usize, forward: bool) -> Option<usize> {
        let n = self.n();
        match (forward, self.closed) {
            (true, _) if i + 1 < n => Some(i + 1),
            (true, true) => Some(0),
            (false, _) if i > 0 => Some(i - 1),
            (false, true) => Some(n - 1),
            _ => None,
        }
    }

    /// Índice a una distancia ≥ `reach` sobre el contorno (o el extremo, si es abierto).
    fn offset(&self, i: usize, forward: bool, reach: f64) -> usize {
        let (mut j, mut acc) = (i, 0.0);
        while acc < reach {
            let Some(next) = self.step(j, forward) else {
                break;
            };
            acc += if forward { self.seg[j] } else { self.seg[next] };
            j = next;
            if j == i {
                break;
            }
        }
        j
    }

    fn perimeter(&self) -> f64 {
        self.seg.iter().sum()
    }
}

pub fn fit_chain(raw: &[Pt], closed: bool, s: &ChainFit) -> Fitted {
    let pts = densify(&dedupe(raw, closed), 1.0, closed);
    let n = pts.len();
    if n < 2 {
        return Fitted {
            curves: Vec::new(),
            circle: None,
        };
    }
    if n < 4 {
        return Fitted {
            curves: polyline(&pts, closed),
            circle: None,
        };
    }
    let contour = Contour::new(pts, closed);
    let reach = s.corner_reach.min(contour.perimeter() / 8.0).max(1e-6);

    if closed && s.geometry {
        // El círculo se mide sobre el contorno suavizado entero (sin esquinas).
        let smoothed = smooth(&contour, &[], s.smooth_reach());
        if let Some(circle) = fit_full_circle(&smoothed, s) {
            return Fitted {
                curves: circle.curves(),
                circle: Some(circle),
            };
        }
    }

    let corners = detect_corners(&contour, reach, s.corner_turn);
    let smooth = smooth(&contour, &corners, s.smooth_reach());
    let contour = Contour::new(smooth, closed);

    let curves = if closed && corners.is_empty() {
        fit_smooth_loop(&contour, reach, s.tol())
    } else {
        let breaks: Vec<usize> = if closed {
            corners
        } else {
            let mut b = vec![0];
            b.extend(corners);
            b.push(n - 1);
            b
        };
        fit_runs(&contour, &breaks, reach, s)
    };
    Fitted {
        curves,
        circle: None,
    }
}

fn dedupe(raw: &[Pt], closed: bool) -> Vec<Pt> {
    let mut out: Vec<Pt> = Vec::with_capacity(raw.len());
    for &p in raw {
        if out.last().is_none_or(|q| len(sub(p, *q)) > 1e-9) {
            out.push(p);
        }
    }
    if closed {
        while out.len() > 1 && len(sub(out[0], out[out.len() - 1])) < 1e-9 {
            out.pop();
        }
    }
    out
}

/// Inserta puntos en los lados largos para que el ajuste vea toda su longitud.
fn densify(pts: &[Pt], spacing: f64, closed: bool) -> Vec<Pt> {
    let n = pts.len();
    let mut out = Vec::with_capacity(n * 2);
    let last = if closed { n } else { n.saturating_sub(1) };
    for i in 0..last {
        let (a, b) = (pts[i], pts[(i + 1) % n]);
        out.push(a);
        let steps = (len(sub(b, a)) / spacing).floor() as usize;
        for k in 1..steps {
            out.push(add(a, mul(sub(b, a), k as f64 / steps as f64)));
        }
    }
    if !closed {
        out.extend(pts.last());
    }
    out
}

fn polyline(pts: &[Pt], closed: bool) -> Vec<Cubic> {
    let n = pts.len();
    let count = if closed { n } else { n - 1 };
    (0..count)
        .map(|i| Cubic::line(pts[i], pts[(i + 1) % n]))
        .collect()
}

fn detect_corners(c: &Contour, reach: f64, threshold: f64) -> Vec<usize> {
    let n = c.n();
    let turn: Vec<f64> = (0..n)
        .map(|i| {
            let (b, f) = (c.offset(i, false, reach), c.offset(i, true, reach));
            if b == i || f == i {
                return 0.0; // extremo de una cadena abierta
            }
            let a = normalize(sub(c.pts[i], c.pts[b]));
            let d = normalize(sub(c.pts[f], c.pts[i]));
            dot(a, d).clamp(-1.0, 1.0).acos()
        })
        .collect();

    let mut corners = Vec::new();
    for i in 0..n {
        if turn[i] < threshold {
            continue;
        }
        // Máximo local dentro de `reach` (en empate gana el primero).
        let (back, fwd) = (c.offset(i, false, reach), c.offset(i, true, reach));
        let mut j = back;
        let mut is_max = true;
        loop {
            if j != i && (turn[j] > turn[i] || (turn[j] == turn[i] && j < i)) {
                is_max = false;
                break;
            }
            if j == fwd {
                break;
            }
            match c.step(j, true) {
                Some(next) => j = next,
                None => break,
            }
        }
        if is_max {
            corners.push(i);
        }
    }
    corners
}

/// Media móvil de ±`reach` px que no cruza esquinas ni mueve los extremos.
fn smooth(c: &Contour, corners: &[usize], reach: f64) -> Vec<Pt> {
    let n = c.n();
    let mut fixed = vec![false; n];
    for &k in corners {
        fixed[k] = true;
    }
    if !c.closed {
        fixed[0] = true;
        fixed[n - 1] = true;
    }
    let mut out = c.pts.clone();
    for i in 0..n {
        if fixed[i] {
            continue;
        }
        let mut sum = c.pts[i];
        let mut count = 1.0;
        for forward in [true, false] {
            let (mut j, mut acc) = (i, 0.0);
            while let Some(next) = c.step(j, forward) {
                acc += if forward { c.seg[j] } else { c.seg[next] };
                if acc > reach || next == i {
                    break;
                }
                j = next;
                sum = add(sum, c.pts[j]);
                count += 1.0;
                if fixed[j] {
                    break;
                }
            }
        }
        out[i] = mul(sum, 1.0 / count);
    }
    out
}

/// Contorno cerrado y suave que no es círculo: dos cortes opuestos con tangente continua.
fn fit_smooth_loop(c: &Contour, reach: f64, tol: f64) -> Vec<Cubic> {
    let n = c.n();
    let splits = [0, n / 2];
    let tangent = |i: usize| {
        normalize(sub(
            c.pts[c.offset(i, true, reach)],
            c.pts[c.offset(i, false, reach)],
        ))
    };
    let mut out = Vec::new();
    for k in 0..2 {
        let (a, b) = (splits[k], splits[(k + 1) % 2]);
        let run = slice(c, a, b);
        fit_cubic(&run, tangent(a), mul(tangent(b), -1.0), tol, &mut out);
    }
    out
}

/// Puntos de `a` a `b` inclusive, recorriendo hacia adelante (con vuelta si es cerrado).
fn slice(c: &Contour, a: usize, b: usize) -> Vec<Pt> {
    let mut run = vec![c.pts[a]];
    let mut i = a;
    loop {
        i = c.step(i, true).expect("tramo fuera del contorno");
        run.push(c.pts[i]);
        if i == b {
            return run;
        }
    }
}

#[derive(Clone, Copy)]
struct Line {
    point: Pt,
    dir: Pt,
}

enum Run {
    Line(Line),
    Free,
}

fn fit_runs(c: &Contour, breaks: &[usize], reach: f64, s: &ChainFit) -> Vec<Cubic> {
    let closed = c.closed;
    let count = if closed {
        breaks.len()
    } else {
        breaks.len() - 1
    };
    let runs: Vec<Vec<Pt>> = (0..count)
        .map(|k| slice(c, breaks[k], breaks[(k + 1) % breaks.len()]))
        .collect();

    // 1. Rectas (con enderezado a los ejes).
    let kinds: Vec<Run> = runs
        .iter()
        .map(|run| {
            match s
                .geometry
                .then(|| fit_line(run, s.line_tolerance()))
                .flatten()
            {
                Some(line) => Run::Line(line),
                None => Run::Free,
            }
        })
        .collect();

    // 2. Esquinas exactas entre dos rectas.
    let mut pos: Vec<Pt> = breaks.iter().map(|&b| c.pts[b]).collect();
    let movable = |k: usize| closed || (k > 0 && k + 1 < breaks.len());
    for k in 0..breaks.len() {
        if !movable(k) {
            continue;
        }
        let before = if k == 0 { count - 1 } else { k - 1 };
        let (Run::Line(l1), Run::Line(l2)) = (&kinds[before], &kinds[k % count]) else {
            continue;
        };
        if let Some(p) = intersect(l1, l2) {
            if len(sub(p, pos[k])) <= 2.0 * s.tol() + 1.0 {
                pos[k] = p;
            }
        }
    }

    // 3. Segmentos con los extremos definitivos.
    let mut out = Vec::new();
    for (k, run) in runs.iter().enumerate() {
        let (a, b) = (pos[k], pos[(k + 1) % pos.len()]);
        match &kinds[k] {
            Run::Line(_) => out.push(Cubic::line(a, b)),
            Run::Free => {
                if s.geometry {
                    if let Some(arc) = fit_arc(run, a, b, s) {
                        out.extend(arc);
                        continue;
                    }
                }
                let mut d = run.clone();
                let last = d.len() - 1;
                d[0] = a;
                d[last] = b;
                let t1 = one_sided_tangent(&d, reach, true);
                let t2 = one_sided_tangent(&d, reach, false);
                fit_cubic(&d, t1, t2, s.tol(), &mut out);
            }
        }
    }
    out
}

fn one_sided_tangent(d: &[Pt], reach: f64, from_start: bool) -> Pt {
    let n = d.len();
    let (origin, mut acc) = (if from_start { 0 } else { n - 1 }, 0.0);
    let mut j = origin;
    loop {
        let next = if from_start { j + 1 } else { j.wrapping_sub(1) };
        if next >= n {
            break;
        }
        acc += len(sub(d[next], d[j]));
        j = next;
        if acc >= reach {
            break;
        }
    }
    normalize(sub(d[j], d[origin]))
}

/// Recta por mínimos cuadrados totales; `None` si algún punto se aparta más que `tol`.
fn fit_line(run: &[Pt], tol: f64) -> Option<Line> {
    let n = run.len() as f64;
    let first = run[0];
    let last = run[run.len() - 1];
    if run.len() < 2 || len(sub(last, first)) < 1.5 {
        return None;
    }
    let m = mul(run.iter().fold([0.0, 0.0], |acc, p| add(acc, *p)), 1.0 / n);
    let (mut sxx, mut sxy, mut syy) = (0.0, 0.0, 0.0);
    for p in run {
        let d = sub(*p, m);
        sxx += d[0] * d[0];
        sxy += d[0] * d[1];
        syy += d[1] * d[1];
    }
    let theta = 0.5 * (2.0 * sxy).atan2(sxx - syy);
    let mut dir = [theta.cos(), theta.sin()];
    if dot(dir, sub(last, first)) < 0.0 {
        dir = mul(dir, -1.0);
    }
    if run.iter().any(|p| cross(dir, sub(*p, m)).abs() > tol) {
        return None;
    }
    // Enderezar a horizontal o vertical si está a menos de ~1°.
    if dir[1].abs() < AXIS_SNAP_SIN {
        dir = [dir[0].signum(), 0.0];
    } else if dir[0].abs() < AXIS_SNAP_SIN {
        dir = [0.0, dir[1].signum()];
    }
    Some(Line { point: m, dir })
}

fn intersect(l1: &Line, l2: &Line) -> Option<Pt> {
    let denom = cross(l1.dir, l2.dir);
    if denom.abs() < MIN_INTERSECTION_SIN {
        return None; // casi paralelas: no es una esquina de verdad
    }
    let t = cross(sub(l2.point, l1.point), l2.dir) / denom;
    Some(add(l1.point, mul(l1.dir, t)))
}

/// Círculo algebraico (Kåsa) relativo al centroide. Devuelve centro y radio.
fn kasa(points: &[Pt]) -> Option<(Pt, f64)> {
    let n = points.len() as f64;
    let m = mul(
        points.iter().fold([0.0, 0.0], |acc, p| add(acc, *p)),
        1.0 / n,
    );
    let (mut suu, mut suv, mut svv, mut suz, mut svz, mut sz) = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
    for p in points {
        let [u, v] = sub(*p, m);
        let z = u * u + v * v;
        suu += u * u;
        suv += u * v;
        svv += v * v;
        suz += u * z;
        svz += v * z;
        sz += z;
    }
    let det = suu * svv - suv * suv;
    if det.abs() < 1e-12 {
        return None;
    }
    let a = -(svv * suz - suv * svz) / det;
    let b = -(suu * svz - suv * suz) / det;
    let c = -sz / n;
    let r2 = (a * a + b * b) / 4.0 - c;
    (r2 > 0.0).then(|| (add(m, [-a / 2.0, -b / 2.0]), r2.sqrt()))
}

fn residuals(points: &[Pt], center: Pt, radius: f64) -> (f64, f64) {
    let mut max: f64 = 0.0;
    let mut sum = 0.0;
    for p in points {
        let e = (len(sub(*p, center)) - radius).abs();
        max = max.max(e);
        sum += e;
    }
    (sum / points.len() as f64, max)
}

fn fit_full_circle(pts: &[Pt], s: &ChainFit) -> Option<Circle> {
    if pts.len() < 8 {
        return None;
    }
    let (center, radius) = kasa(pts)?;
    if radius < 2.0 {
        return None;
    }
    let (mean, max) = residuals(pts, center, radius);
    if mean > 0.35 * s.tol() || max > s.tol() {
        return None;
    }
    // Sentido de recorrido: el del área con signo del contorno original.
    let area: f64 = (0..pts.len())
        .map(|i| cross(pts[i], pts[(i + 1) % pts.len()]))
        .sum();
    let start = sub(pts[0], center);
    Some(Circle {
        center,
        radius,
        start: start[1].atan2(start[0]),
        direction: if area >= 0.0 { 1.0 } else { -1.0 },
    })
}

/// Arco que pasa exactamente por `a` y `b` (centro sobre la mediatriz) ajustado a `run`.
fn fit_arc(run: &[Pt], a: Pt, b: Pt, s: &ChainFit) -> Option<Vec<Cubic>> {
    if run.len() < 6 {
        return None;
    }
    let chord = sub(b, a);
    let half = len(chord) / 2.0;
    if half < 1.0 {
        return None;
    }
    let mid = mul(add(a, b), 0.5);
    let u = normalize(chord);
    let nrm = [-u[1], u[0]];
    let (k_center, _) = kasa(run)?;
    let mut t = dot(sub(k_center, mid), nrm);
    // Gauss–Newton sobre la posición del centro en la mediatriz.
    for _ in 0..12 {
        let c = add(mid, mul(nrm, t));
        let r = (half * half + t * t).sqrt();
        let (mut jr, mut jj) = (0.0, 0.0);
        for p in run {
            let d = sub(*p, c);
            let dl = len(d).max(1e-9);
            let res = dl - r;
            let jac = -dot(d, nrm) / dl - t / r;
            jr += jac * res;
            jj += jac * jac;
        }
        if jj < 1e-12 {
            break;
        }
        let step = jr / jj;
        t -= step;
        if step.abs() < 1e-6 {
            break;
        }
    }
    let center = add(mid, mul(nrm, t));
    let radius = (half * half + t * t).sqrt();
    if radius > 50.0 * half {
        return None; // prácticamente recto: lo resuelve la curva libre
    }
    let (mean, max) = residuals(run, center, radius);
    if mean > s.arc_mean() || max > s.arc_max() {
        return None;
    }

    let angle = |p: Pt| {
        let d = sub(p, center);
        d[1].atan2(d[0])
    };
    let (a0, a1, am) = (angle(a), angle(b), angle(run[run.len() / 2]));
    let ccw = (a1 - a0).rem_euclid(TAU);
    let sweep = if (am - a0).rem_euclid(TAU) <= ccw {
        ccw
    } else {
        ccw - TAU
    };
    Some(arc_curves(center, radius, a0, sweep, Some(a), Some(b)))
}

/// Arco como cúbicas de a lo sumo 90° (error < 0.03 % del radio). Si se dan, los extremos
/// se fijan exactamente para que el arco empalme sin huecos con lo que lo rodea.
fn arc_curves(
    center: Pt,
    radius: f64,
    start: f64,
    sweep: f64,
    from: Option<Pt>,
    to: Option<Pt>,
) -> Vec<Cubic> {
    let pieces = (sweep.abs() / (TAU / 4.0)).ceil().max(1.0) as usize;
    let phi = sweep / pieces as f64;
    let h = 4.0 / 3.0 * (phi / 4.0).tan() * radius;
    let point = |a: f64| add(center, [radius * a.cos(), radius * a.sin()]);
    let tangent = |a: f64| [-a.sin(), a.cos()];
    let mut out: Vec<Cubic> = (0..pieces)
        .map(|i| {
            let (t0, t1) = (start + phi * i as f64, start + phi * (i + 1) as f64);
            let (p0, p3) = (point(t0), point(t1));
            Cubic([
                p0,
                add(p0, mul(tangent(t0), h)),
                sub(p3, mul(tangent(t1), h)),
                p3,
            ])
        })
        .collect();
    if let Some(a) = from {
        out[0].0[0] = a;
    }
    if let Some(b) = to {
        out[pieces - 1].0[3] = b;
    }
    if from.is_none() && to.is_none() {
        // Círculo completo: cerrar exactamente.
        out[pieces - 1].0[3] = out[0].0[0];
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fit::bezier;

    fn settings() -> ChainFit {
        ChainFit {
            tolerance: 0.5,
            corner_turn: 60f64.to_radians(),
            corner_reach: 1.5,
            geometry: true,
            noise: 1.0 / 6.0,
        }
    }

    fn deviation(points: &[Pt], curves: &[Cubic]) -> f64 {
        let samples: Vec<Pt> = curves
            .iter()
            .flat_map(|c| (0..=50).map(move |i| bezier(c, i as f64 / 50.0)))
            .collect();
        points
            .iter()
            .map(|p| {
                samples
                    .iter()
                    .map(|s| len(sub(*s, *p)))
                    .fold(f64::MAX, f64::min)
            })
            .fold(0.0, f64::max)
    }

    /// Contorno de un disco con la precisión de un borde ampliado ×3 (escalón de 1/3 px).
    fn sampled_circle(cx: f64, cy: f64, r: f64) -> Vec<Pt> {
        let steps = (r * 20.0) as usize;
        (0..steps)
            .map(|i| {
                let a = i as f64 / steps as f64 * TAU;
                let q = |v: f64| (v * 3.0).round() / 3.0;
                [q(cx + r * a.cos()), q(cy + r * a.sin())]
            })
            .collect()
    }

    #[test]
    fn a_ring_becomes_a_perfect_circle() {
        let fitted = fit_chain(&sampled_circle(50.0, 40.0, 30.0), true, &settings());
        let circle = fitted.circle.expect("debe reconocerse como círculo");
        assert!(
            (circle.radius - 30.0).abs() < 0.1,
            "radio {}",
            circle.radius
        );
        assert!(len(sub(circle.center, [50.0, 40.0])) < 0.1);
        assert_eq!(fitted.curves.len(), 4);
    }

    #[test]
    fn a_tilted_rectangle_is_straightened_with_exact_corners() {
        // Rectángulo 40×20 rotado 0.5°, muestreado cada 0.33 px y redondeado a 1/3 px.
        let rot = 0.5f64.to_radians();
        let corners = [[0.0, 0.0], [40.0, 0.0], [40.0, 20.0], [0.0, 20.0]];
        let mut pts = Vec::new();
        for k in 0..4 {
            let (a, b) = (corners[k], corners[(k + 1) % 4]);
            let steps = (len(sub(b, a)) * 3.0) as usize;
            for i in 0..steps {
                let p = add(a, mul(sub(b, a), i as f64 / steps as f64));
                let r = [
                    p[0] * rot.cos() - p[1] * rot.sin(),
                    p[0] * rot.sin() + p[1] * rot.cos(),
                ];
                pts.push([
                    (r[0] * 3.0).round() / 3.0 + 10.0,
                    (r[1] * 3.0).round() / 3.0 + 10.0,
                ]);
            }
        }
        let fitted = fit_chain(&pts, true, &settings());
        assert_eq!(fitted.curves.len(), 4, "4 lados rectos");
        for c in &fitted.curves {
            let d = sub(c.0[3], c.0[0]);
            assert!(
                d[0].abs() < 1e-9 || d[1].abs() < 1e-9,
                "lado no alineado al eje: {d:?}"
            );
        }
    }

    #[test]
    fn open_chain_keeps_its_endpoints() {
        let pts: Vec<Pt> = (0..=60)
            .map(|i| [i as f64, (i as f64 / 10.0).sin() * 5.0])
            .collect();
        let fitted = fit_chain(&pts, false, &settings());
        let first = fitted.curves.first().unwrap().0[0];
        let last = fitted.curves.last().unwrap().0[3];
        assert_eq!(first, pts[0]);
        assert_eq!(last, pts[60]);
        let dev = deviation(&pts, &fitted.curves);
        assert!(dev < 0.7, "desvío {dev}, {} curvas", fitted.curves.len());
    }

    #[test]
    fn an_open_arc_between_fixed_nodes_is_exact() {
        // Medio círculo r = 25 abierto entre dos nodos.
        let pts: Vec<Pt> = (0..=150)
            .map(|i| {
                let a = std::f64::consts::PI * i as f64 / 150.0;
                let q = |v: f64| (v * 3.0).round() / 3.0;
                [q(30.0 + 25.0 * a.cos()), q(30.0 + 25.0 * a.sin())]
            })
            .collect();
        let fitted = fit_chain(&pts, false, &settings());
        assert!(fitted.curves.len() <= 3, "{} curvas", fitted.curves.len());
        assert!(deviation(&pts, &fitted.curves) < 0.4);
    }

    #[test]
    fn without_geometry_curves_are_still_fitted() {
        let s = ChainFit {
            geometry: false,
            ..settings()
        };
        let pts = sampled_circle(20.0, 20.0, 15.0);
        let fitted = fit_chain(&pts, true, &s);
        assert!(fitted.circle.is_none());
        let dev = deviation(&pts, &fitted.curves);
        assert!(dev < 0.7, "desvío {dev}, {} curvas", fitted.curves.len());
    }
}

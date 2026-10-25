//! Núcleo del ajuste de curvas: una Bézier cúbica (o varias) a un tramo de puntos con
//! extremos y tangentes fijos.
//!
//! Basado en Philip J. Schneider, "An Algorithm for Automatically Fitting Digitized
//! Curves" (Graphics Gems, 1990): mínimos cuadrados con tangentes fijas, refinamiento de
//! parámetros por Newton y división recursiva donde el error supera la tolerancia.
//! La lógica de contorno (esquinas, rectas, arcos, círculos) vive en `geometry`.

pub type Pt = [f64; 2];

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Cubic(pub [Pt; 4]);

impl Cubic {
    /// Segmento recto como cúbica (manijas a 1/3 y 2/3).
    pub fn line(a: Pt, b: Pt) -> Self {
        let d = sub(b, a);
        Cubic([a, add(a, mul(d, 1.0 / 3.0)), add(a, mul(d, 2.0 / 3.0)), b])
    }

    pub fn reversed(&self) -> Self {
        let [a, b, c, d] = self.0;
        Cubic([d, c, b, a])
    }
}

#[inline]
pub fn sub(a: Pt, b: Pt) -> Pt {
    [a[0] - b[0], a[1] - b[1]]
}
#[inline]
pub fn add(a: Pt, b: Pt) -> Pt {
    [a[0] + b[0], a[1] + b[1]]
}
#[inline]
pub fn mul(a: Pt, k: f64) -> Pt {
    [a[0] * k, a[1] * k]
}
#[inline]
pub fn dot(a: Pt, b: Pt) -> f64 {
    a[0] * b[0] + a[1] * b[1]
}
#[inline]
pub fn cross(a: Pt, b: Pt) -> f64 {
    a[0] * b[1] - a[1] * b[0]
}
#[inline]
pub fn len(a: Pt) -> f64 {
    dot(a, a).sqrt()
}
pub fn normalize(a: Pt) -> Pt {
    let l = len(a);
    if l < 1e-12 {
        [0.0, 0.0]
    } else {
        mul(a, 1.0 / l)
    }
}

pub fn bezier(b: &Cubic, t: f64) -> Pt {
    let u = 1.0 - t;
    let [p0, p1, p2, p3] = b.0;
    add(
        add(mul(p0, u * u * u), mul(p1, 3.0 * u * u * t)),
        add(mul(p2, 3.0 * u * t * t), mul(p3, t * t * t)),
    )
}

/// Ajusta `d` (extremos incluidos y respetados) con una o más cúbicas. `t1` es la
/// tangente de salida en `d[0]`; `t2` apunta hacia atrás desde el último punto.
pub fn fit_cubic(d: &[Pt], t1: Pt, t2: Pt, tol: f64, out: &mut Vec<Cubic>) {
    fit_recursive(d, t1, t2, tol, out, 0);
}

fn fit_recursive(d: &[Pt], t1: Pt, t2: Pt, tol: f64, out: &mut Vec<Cubic>, depth: usize) {
    let n = d.len();
    let (first, last) = (d[0], d[n - 1]);
    if n == 2 {
        let dist = len(sub(last, first)) / 3.0;
        out.push(Cubic([
            first,
            add(first, mul(t1, dist)),
            add(last, mul(t2, dist)),
            last,
        ]));
        return;
    }

    let tol2 = tol * tol;
    let mut u = chord_length(d);
    let mut bez = generate(d, &u, t1, t2);
    let (mut err, mut split) = max_error(d, &bez, &u);
    if err < tol2 {
        out.push(bez);
        return;
    }
    if err < tol2 * 16.0 {
        for _ in 0..4 {
            u = reparameterize(d, &u, &bez);
            bez = generate(d, &u, t1, t2);
            (err, split) = max_error(d, &bez, &u);
            if err < tol2 {
                out.push(bez);
                return;
            }
        }
    }
    if depth > 40 {
        out.push(bez);
        return;
    }
    let center = normalize(sub(d[split - 1], d[split + 1]));
    fit_recursive(&d[..=split], t1, center, tol, out, depth + 1);
    fit_recursive(&d[split..], mul(center, -1.0), t2, tol, out, depth + 1);
}

fn chord_length(d: &[Pt]) -> Vec<f64> {
    let mut u = Vec::with_capacity(d.len());
    u.push(0.0);
    for i in 1..d.len() {
        u.push(u[i - 1] + len(sub(d[i], d[i - 1])));
    }
    let total = *u.last().unwrap();
    if total > 0.0 {
        for v in &mut u {
            *v /= total;
        }
    }
    u
}

/// Mínimos cuadrados para la longitud de las dos manijas con tangentes fijas.
fn generate(d: &[Pt], u: &[f64], t1: Pt, t2: Pt) -> Cubic {
    let (first, last) = (d[0], d[d.len() - 1]);
    let (mut c00, mut c01, mut c11, mut x0, mut x1) = (0.0, 0.0, 0.0, 0.0, 0.0);
    for (p, &t) in d.iter().zip(u) {
        let s = 1.0 - t;
        let (b0, b1, b2, b3) = (s * s * s, 3.0 * s * s * t, 3.0 * s * t * t, t * t * t);
        let a0 = mul(t1, b1);
        let a1 = mul(t2, b2);
        c00 += dot(a0, a0);
        c01 += dot(a0, a1);
        c11 += dot(a1, a1);
        let tmp = sub(*p, add(mul(first, b0 + b1), mul(last, b2 + b3)));
        x0 += dot(a0, tmp);
        x1 += dot(a1, tmp);
    }
    let det = c00 * c11 - c01 * c01;
    let seg = len(sub(last, first));
    let (mut al, mut ar) = if det.abs() > 1e-12 {
        ((c11 * x0 - c01 * x1) / det, (c00 * x1 - c01 * x0) / det)
    } else {
        (0.0, 0.0)
    };
    // Manijas negativas o desmedidas producen bucles: usar la heurística clásica.
    let eps = 1e-6 * seg;
    if al < eps || ar < eps || al > 2.0 * seg || ar > 2.0 * seg {
        al = seg / 3.0;
        ar = seg / 3.0;
    }
    Cubic([first, add(first, mul(t1, al)), add(last, mul(t2, ar)), last])
}

fn max_error(d: &[Pt], b: &Cubic, u: &[f64]) -> (f64, usize) {
    let mut best = (0.0, d.len() / 2);
    for i in 1..d.len() - 1 {
        let e = sub(bezier(b, u[i]), d[i]);
        let e2 = dot(e, e);
        if e2 >= best.0 {
            best = (e2, i);
        }
    }
    best
}

/// Un paso de Newton–Raphson por punto para acercar el parámetro a la proyección.
fn reparameterize(d: &[Pt], u: &[f64], b: &Cubic) -> Vec<f64> {
    let [p0, p1, p2, p3] = b.0;
    let q1 = [
        mul(sub(p1, p0), 3.0),
        mul(sub(p2, p1), 3.0),
        mul(sub(p3, p2), 3.0),
    ];
    let q2 = [mul(sub(q1[1], q1[0]), 2.0), mul(sub(q1[2], q1[1]), 2.0)];
    d.iter()
        .zip(u)
        .map(|(p, &t)| {
            let s = 1.0 - t;
            let q = bezier(b, t);
            let d1 = add(
                add(mul(q1[0], s * s), mul(q1[1], 2.0 * s * t)),
                mul(q1[2], t * t),
            );
            let d2 = add(mul(q2[0], s), mul(q2[1], t));
            let diff = sub(q, *p);
            let num = dot(diff, d1);
            let den = dot(d1, d1) + dot(diff, d2);
            if den.abs() < 1e-12 {
                t
            } else {
                (t - num / den).clamp(0.0, 1.0)
            }
        })
        .collect()
}

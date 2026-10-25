//! Conversión sRGB ↔ OKLab. OKLab es perceptualmente uniforme: la distancia euclídea
//! entre dos colores se parece a cuán distintos los ve una persona, que es lo que
//! necesitan el filtro bilateral y la paleta.

pub type Lab = [f32; 3];

fn srgb_to_linear(c: u8) -> f32 {
    let v = c as f32 / 255.0;
    if v <= 0.04045 {
        v / 12.92
    } else {
        ((v + 0.055) / 1.055).powf(2.4)
    }
}

fn linear_to_srgb(v: f32) -> u8 {
    let v = v.clamp(0.0, 1.0);
    let s = if v <= 0.003_130_8 {
        v * 12.92
    } else {
        1.055 * v.powf(1.0 / 2.4) - 0.055
    };
    (s * 255.0).round() as u8
}

/// Tabla sRGB → lineal (evita 3 `powf` por píxel).
pub struct LinearLut([f32; 256]);

impl LinearLut {
    pub fn new() -> Self {
        let mut t = [0.0; 256];
        for (i, v) in t.iter_mut().enumerate() {
            *v = srgb_to_linear(i as u8);
        }
        Self(t)
    }

    pub fn to_lab(&self, r: u8, g: u8, b: u8) -> Lab {
        let (r, g, b) = (self.0[r as usize], self.0[g as usize], self.0[b as usize]);
        let l = (0.412_221_47 * r + 0.536_332_54 * g + 0.051_445_99 * b).cbrt();
        let m = (0.211_903_5 * r + 0.680_699_5 * g + 0.107_396_96 * b).cbrt();
        let s = (0.088_302_46 * r + 0.281_718_85 * g + 0.629_978_7 * b).cbrt();
        [
            0.210_454_26 * l + 0.793_617_8 * m - 0.004_072_047 * s,
            1.977_998_5 * l - 2.428_592_2 * m + 0.450_593_7 * s,
            0.025_904_037 * l + 0.782_771_77 * m - 0.808_675_77 * s,
        ]
    }
}

pub fn lab_to_rgb([l, a, b]: Lab) -> [u8; 3] {
    let l_ = l + 0.396_337_78 * a + 0.215_803_76 * b;
    let m_ = l - 0.105_561_346 * a - 0.063_854_17 * b;
    let s_ = l - 0.089_484_18 * a - 1.291_485_5 * b;
    let (l, m, s) = (l_ * l_ * l_, m_ * m_ * m_, s_ * s_ * s_);
    [
        linear_to_srgb(4.076_741_7 * l - 3.307_711_6 * m + 0.230_969_94 * s),
        linear_to_srgb(-1.268_438 * l + 2.609_757_4 * m - 0.341_319_38 * s),
        linear_to_srgb(-0.004_196_086_3 * l - 0.703_418_6 * m + 1.707_614_7 * s),
    ]
}

#[inline]
pub fn dist2(a: &Lab, b: &Lab) -> f32 {
    let (d0, d1, d2) = (a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    d0 * d0 + d1 * d1 + d2 * d2
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_is_stable() {
        let lut = LinearLut::new();
        for rgb in [
            [0, 0, 0],
            [255, 255, 255],
            [220, 30, 30],
            [12, 200, 90],
            [128, 64, 250],
        ] {
            assert_eq!(lab_to_rgb(lut.to_lab(rgb[0], rgb[1], rgb[2])), rgb);
        }
    }
}

/* Lop phu watermark GIONG HET NHAU tren moi anh - dung de kiem tra cach
 * "hoc lop phu roi go nguoc".
 *
 * That te cai dau ✦ cua Flow khong phai chi mo deu: giua thi dac (che sach nen
 * ben duoi), ra vien thi mo dan. Hai kieu do phai xu ly hai duong khac nhau:
 *   - vien mo  -> tru nguoc lai la ra dung nen that
 *   - giua dac -> nen mat han, chi con cach va theo cau truc
 * Nen fixture nay lam dung ca hai, khong lam moi thu mo deu cho de.
 */
"use strict";

/** Ban do alpha cua dau sao 4 canh, tam (cx, cy), ban kinh r. */
function banDoAlpha(rong, cao, cx, cy, r, damGiua) {
  const alpha = new Float32Array(rong * cao);
  for (let y = Math.floor(cy - r) - 1; y <= Math.ceil(cy + r) + 1; y++) {
    for (let x = Math.floor(cx - r) - 1; x <= Math.ceil(cx + r) + 1; x++) {
      if (x < 0 || y < 0 || x >= rong || y >= cao) continue;
      const dx = Math.abs(x - cx) / r, dy = Math.abs(y - cy) / r;
      const v = Math.pow(dx, 0.55) + Math.pow(dy, 0.55);
      if (v > 1) continue;
      // giua dac, tu 0.45 tro ra mo dan den 0 o mep
      const m = v <= 0.45 ? damGiua : damGiua * Math.max(0, (1 - v) / 0.55);
      alpha[y * rong + x] = m;
    }
  }
  return alpha;
}

/**
 * Dan lop phu len anh. Moi anh dung y het mot ban do alpha va mot mau logo.
 * Tra { rong, cao, du_lieu, sao } - sao la o vuong bao quanh dau sao.
 */
function danLopPhu(anh, tuyChon) {
  const t = tuyChon || {};
  const le = t.le == null ? 26 : t.le;
  const canh = t.canh == null ? 30 : t.canh;
  const damGiua = t.dam_giua == null ? 1 : t.dam_giua;
  const mauLogo = t.mau_logo || [255, 255, 255];
  const { rong, cao } = anh;
  const d = new Uint8ClampedArray(anh.du_lieu);
  const cx = rong - le - canh / 2, cy = cao - le - canh / 2, r = canh / 2;
  const alpha = banDoAlpha(rong, cao, cx, cy, r, damGiua);

  for (let k = 0; k < alpha.length; k++) {
    const m = alpha[k];
    if (m <= 0) continue;
    const i = k * 4;
    for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * (1 - m) + mauLogo[c] * m;
  }
  return {
    rong, cao, du_lieu: d, alpha,
    sao: { x: Math.round(cx - r), y: Math.round(cy - r), w: canh, h: canh },
  };
}

function nhienNgau(hat) {
  let s = (hat >>> 0) + 1;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Canh moi anh mot khac, va khac NGAY O GOC duoi phai - dung nhu mot du an that
 * (200 canh khac nhau). Co ca vet gradient, hat nhieu va vat the di qua goc.
 * `kho` = co vat the trang vien den dung dung cho logo hay nam.
 */
function anhNenDoi(hat, kho, rong, cao) {
  rong = rong || 1376; cao = cao || 768;
  const rnd = nhienNgau(hat);
  const d = new Uint8ClampedArray(rong * cao * 4);
  const tren = [30 + rnd() * 150, 30 + rnd() * 150, 40 + rnd() * 170];
  const duoi = [30 + rnd() * 150, 30 + rnd() * 150, 30 + rnd() * 150];
  const song = 6 + rnd() * 26;
  for (let y = 0; y < cao; y++) {
    const t = y / (cao - 1);
    for (let x = 0; x < rong; x++) {
      const i = (y * rong + x) * 4;
      const n = Math.sin((x * 0.021 + y * 0.013) * (1 + rnd() * 0.0001)) * song;
      for (let c = 0; c < 3; c++) d[i + c] = tren[c] * (1 - t) + duoi[c] * t + n;
      d[i + 3] = 255;
    }
  }
  function o(x0, y0, w, h, mau) {
    for (let y = Math.max(0, y0); y < Math.min(cao, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(rong, x0 + w); x++) {
        const i = (y * rong + x) * 4;
        for (let c = 0; c < 3; c++) d[i + c] = mau[c];
      }
    }
  }
  // vai khoi mau rai rac, trong do it nhat mot khoi lien quan den goc duoi phai
  for (let k = 0; k < 4; k++) {
    const w = 60 + Math.floor(rnd() * 200), h = 40 + Math.floor(rnd() * 160);
    o(Math.floor(rnd() * (rong - w)), Math.floor(rnd() * (cao - h)), w, h,
      [30 + rnd() * 200, 30 + rnd() * 200, 30 + rnd() * 200]);
  }
  // dai dat: cao thap moi anh mot khac -> goc duoi phai khi la dat, khi la troi
  const dat = Math.round(cao * (0.72 + rnd() * 0.22));
  o(0, dat, rong, cao - dat, [200 + rnd() * 50, 150 + rnd() * 80, 30 + rnd() * 60]);

  if (kho) {
    // cot trang vien den di ngay qua cho logo: vua trang giong logo, vua co
    // canh den sac net - va vao la lo ngay
    const x = rong - 26 - 15 + Math.floor((rnd() - 0.5) * 16);
    o(x - 4, Math.round(cao * 0.45), 30, cao - Math.round(cao * 0.45), [17, 17, 17]);
    o(x, Math.round(cao * 0.45), 22, cao - Math.round(cao * 0.45), [252, 252, 250]);
    o(x - 40, cao - 40 - Math.floor(rnd() * 20), 90, 14, [17, 17, 17]);
  }
  return { rong, cao, du_lieu: d };
}

/** Trung binh |lech| tren 3 kenh trong mot o, thang 0-255. */
function lechTrung(a, b, o) {
  let tong = 0, dem = 0;
  for (let y = o.y; y < o.y + o.h; y++) {
    for (let x = o.x; x < o.x + o.w; x++) {
      if (x < 0 || y < 0 || x >= a.rong || y >= a.cao) continue;
      const i = (y * a.rong + x) * 4;
      for (let c = 0; c < 3; c++) { tong += Math.abs(a.du_lieu[i + c] - b.du_lieu[i + c]); dem++; }
    }
  }
  return tong / Math.max(1, dem);
}

module.exports = { danLopPhu, banDoAlpha, anhNenDoi, lechTrung };

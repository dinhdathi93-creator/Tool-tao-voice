/* Dung anh gia DUNG KIEU FLOW cua kenh: nen xanh dam, dai dat vang o duoi,
 * hinh que trang moi anh mot kieu, va dau ✦ nho xiu o goc duoi ben phai.
 *
 * Cai bay o day: dai dat vang tao ra mot duong ranh NGANG dai het anh, nam
 * dung mot cho o moi anh - y het watermark ve mat "net nao cung co". Bo do vung
 * phai phan biet duoc no voi cai logo nho o goc.
 */
"use strict";

function nhienNgau(hat) {
  let s = (hat >>> 0) + 1;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const XANH = [26, 42, 74];
const VANG = [247, 196, 39];
const TRANG = [255, 255, 255];

function anhKieuFlow(hat, rong = 1376, cao = 768) {
  const rnd = nhienNgau(hat);
  const d = new Uint8ClampedArray(rong * cao * 4);
  const dat = Math.round(cao * 0.87);          // dai dat vang, moi anh deu o day

  function cham(x, y, mau) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= rong || y >= cao) return;
    const i = (y * rong + x) * 4;
    d[i] = mau[0]; d[i + 1] = mau[1]; d[i + 2] = mau[2]; d[i + 3] = 255;
  }
  function o(x0, y0, w, h, mau) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) cham(x, y, mau);
  }

  o(0, 0, rong, cao, XANH);
  o(0, dat, rong, cao - dat, VANG);

  // vai hinh que trang, moi anh moi cho
  const soHinh = 2 + Math.floor(rnd() * 3);
  for (let n = 0; n < soHinh; n++) {
    const x = 80 + rnd() * (rong - 300);
    const y = dat - 60 - rnd() * (cao * 0.5);
    const caoNguoi = 70 + rnd() * 90;
    const day = Math.max(3, Math.round(caoNguoi / 22));
    o(Math.round(x), Math.round(y), day, Math.round(caoNguoi * 0.55), TRANG);   // than
    for (let t = 0; t < Math.round(caoNguoi * 0.2); t++) {                      // dau
      cham(x - 6 + t, y - 12, TRANG); cham(x - 6 + t, y - 4, TRANG);
    }
    for (let t = 0; t < Math.round(caoNguoi * 0.4); t++) {                      // chan
      cham(x - t * 0.4, y + caoNguoi * 0.55 + t, TRANG);
      cham(x + day + t * 0.4, y + caoNguoi * 0.55 + t, TRANG);
    }
  }
  // doi khi co khoi mau (o cua, xe...) - moi anh mot cho
  if (rnd() > 0.3) {
    o(Math.round(rnd() * (rong - 260)), Math.round(dat - 120 - rnd() * 200),
      Math.round(90 + rnd() * 150), Math.round(70 + rnd() * 90), VANG);
  }
  return { rong, cao, du_lieu: d, dat };
}

/** Dau ✦ trang nho o goc duoi ben phai - dung kieu Flow dan vao. */
function danSaoGoc(anh, le = 26, cao_sao = 30) {
  const { rong, cao } = anh;
  const d = new Uint8ClampedArray(anh.du_lieu);
  const cx = rong - le - cao_sao / 2;
  const cy = cao - le - cao_sao / 2;
  const r = cao_sao / 2;

  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || y < 0 || x >= rong || y >= cao) continue;
      const dx = Math.abs(x - cx) / r, dy = Math.abs(y - cy) / r;
      // hinh sao 4 canh: |x|^0.55 + |y|^0.55 <= 1
      const v = Math.pow(dx, 0.55) + Math.pow(dy, 0.55);
      if (v <= 1) {
        const i = (y * rong + x) * 4;
        const dam = v > 0.85 ? (1 - v) / 0.15 : 1;   // vien hoi mo
        for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * (1 - dam) + 255 * dam;
      }
    }
  }
  return { rong, cao, du_lieu: d, sao: { x: Math.round(cx - r), y: Math.round(cy - r),
                                         w: Math.round(2 * r), h: Math.round(2 * r) } };
}

module.exports = { anhKieuFlow, danSaoGoc };

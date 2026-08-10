/* Anh gia kieu Flow nhung logo DE LEN VAT THE: hang hinh que trang vien den
 * dung tren dai dat vang, dau sao nam de len chan mot hinh que.
 *
 * Day la ca kho nhat: logo trang de len vat the cung trang, khong tach duoc
 * bang mau. Chi co the dua vao CAU TRUC (chan la vach doc, keo doc xuong la ra).
 */
"use strict";

const XANH = [26, 42, 74];
const VANG = [247, 196, 39];
const TRANG = [255, 255, 255];
const DEN = [17, 17, 17];

function nhienNgau(hat) {
  let s = (hat >>> 0) + 1;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Hang hinh que tren nen xanh + dai dat vang.
 * Nguoi cuoi cung dung SAT GOC DUOI PHAI, dung cho watermark roi trung vao chan
 * - day moi la tinh huong that: logo luon o mot cho, thinh thoang co vat the
 * dung ngay do.
 */
function anhHangNguoi(hat, rong = 1376, cao = 768, soNguoi = 6) {
  const rnd = nhienNgau(hat);
  const d = new Uint8ClampedArray(rong * cao * 4);
  const dat = Math.round(cao * 0.87);

  function o(x0, y0, w, h, mau) {
    for (let y = Math.max(0, y0); y < Math.min(cao, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(rong, x0 + w); x++) {
        const i = (y * rong + x) * 4;
        d[i] = mau[0]; d[i + 1] = mau[1]; d[i + 2] = mau[2]; d[i + 3] = 255;
      }
    }
  }
  /** thanh doc trang co vien den - dung lam than va chan hinh que */
  function thanh(x, y, w, h) {
    o(x - 2, y - 2, w + 4, h + 4, DEN);
    o(x, y, w, h, TRANG);
  }

  o(0, 0, rong, cao, XANH);
  o(0, dat, rong, cao - dat, VANG);

  const buoc = Math.floor(rong / (soNguoi + 1));
  const chan = [];
  for (let n = 0; n < soNguoi; n++) {
    // nguoi cuoi cung keo han ra goc de chan trung vao cho watermark hay nam
    const x = n === soNguoi - 1
      ? rong - 34
      : buoc * (n + 1) + Math.floor((rnd() - 0.5) * 20);
    const dinh = Math.round(cao * 0.30);
    const rongThan = 46;
    // dau
    o(x - 30, dinh - 56, 60, 60, DEN);
    o(x - 26, dinh - 52, 52, 52, TRANG);
    // than
    thanh(x - rongThan / 2, dinh + 8, rongThan, Math.round(cao * 0.22));
    // hai chan cham dat
    const yChan = dinh + 8 + Math.round(cao * 0.22);
    thanh(x - 20, yChan, 14, dat - yChan + 4);
    thanh(x + 8, yChan, 14, dat - yChan + 4);
    chan.push({ x: x + 8, y: yChan, w: 14, cao_chan: dat - yChan + 4 });
  }
  return { rong, cao, du_lieu: d, dat, chan };
}

/** Dan dau sao trang o DUNG VI TRI CHUAN (goc duoi phai) - cho no trung vao
 * chan cua hinh que dung sat goc. */
function danSaoDeLenChan(anh, le = 26, canh = 30, dam = 0.9) {
  const { rong, cao } = anh;
  const d = new Uint8ClampedArray(anh.du_lieu);
  const cx = rong - le - canh / 2;
  const cy = cao - le - canh / 2;
  const r = canh / 2;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || y < 0 || x >= rong || y >= cao) continue;
      const dx = Math.abs(x - cx) / r, dy = Math.abs(y - cy) / r;
      const v = Math.pow(dx, 0.55) + Math.pow(dy, 0.55);
      if (v <= 1) {
        const i = (y * rong + x) * 4;
        const m = v > 0.85 ? ((1 - v) / 0.15) * dam : dam;
        for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * (1 - m) + 255 * m;
      }
    }
  }
  return {
    rong, cao, du_lieu: d,
    sao: { x: Math.round(cx - r), y: Math.round(cy - r), w: canh, h: canh },
  };
}

module.exports = { anhHangNguoi, danSaoDeLenChan };

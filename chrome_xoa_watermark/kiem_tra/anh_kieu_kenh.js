/* Anh DUNG KIEU KENH cua nguoi dung: vector phang, nen xanh navy, dai dat vang,
 * hang hinh que trang vien den. Dau ✦ mo nam o goc duoi phai, co anh no de len
 * ban chan.
 *
 * Cai bay o day - va la cai lam ban truoc hong tren anh that:
 *   GOC DUOI PHAI CUA MOI ANH GIONG HET NHAU (van la nen navy + dai vang do).
 * Nen phep "so nen giua cac anh" khong co gi ma so: nen khong doi thi khong
 * tinh ra duoc do mo cua logo. Chi vai cho co ban chan di qua la doi - va dung
 * may cho do de suy ra logo thi lai suy nham.
 */
"use strict";

const NAVY = [26, 42, 74];
const VANG = [244, 194, 32];
const TRANG = [252, 252, 250];
const DEN = [12, 14, 18];

function nhienNgau(hat) {
  let s = (hat >>> 0) + 1;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * @param {number} hat
 * @param {boolean} chanQuaLogo dat mot ban chan dung ngay cho logo hay nam
 */
function anhKieuKenh(hat, chanQuaLogo, rong, cao) {
  rong = rong || 1376; cao = cao || 768;
  const rnd = nhienNgau(hat);
  const d = new Uint8ClampedArray(rong * cao * 4);
  // Dai dat cat NGANG QUA dau sao (sao cao 30, cach day 26 -> tam o cao-41):
  // dung tinh huong kho nhat, y het anh that cua kenh.
  const dat = cao - 34;

  function o(x0, y0, w, h, mau) {
    for (let y = Math.max(0, y0); y < Math.min(cao, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(rong, x0 + w); x++) {
        const i = (y * rong + x) * 4;
        d[i] = mau[0]; d[i + 1] = mau[1]; d[i + 2] = mau[2]; d[i + 3] = 255;
      }
    }
  }

  o(0, 0, rong, cao, NAVY);
  o(0, dat, rong, cao - dat, VANG);

  /* Mot cai chan dung tren dai dat: cang trang vien den, ban chan quay phai. */
  function chan(x, cao_cang) {
    const rongCang = 22, day = 5, caoBan = 16, daiBan = 30;
    o(x - day, dat - cao_cang, rongCang + 2 * day, cao_cang, DEN);
    o(x, dat - cao_cang, rongCang, cao_cang - caoBan, TRANG);
    o(x, dat - caoBan, rongCang + daiBan + day, caoBan, DEN);
    o(x, dat - caoBan + day, rongCang + daiBan, caoBan - day, TRANG);
  }

  const buoc = 150, lech = Math.round(rnd() * 40);
  for (let x = 60 + lech; x < rong - 150; x += buoc) chan(x, 90 + Math.round(rnd() * 50));
  // ban chan cham DUNG vao dau sao (sao o x = rong-56 .. rong-26)
  if (chanQuaLogo) chan(rong - 92, 110 + Math.round(rnd() * 30));

  return { rong, cao, du_lieu: d, dat };
}

/**
 * Dau ✦ mo dan cua Flow, GIONG HET NHAU o moi anh.
 * damGiua = do dac o giua (1 = che sach nen).
 */
function danSaoMo(anh, tuyChon) {
  const t = tuyChon || {};
  const le = t.le == null ? 26 : t.le;
  const canh = t.canh == null ? 30 : t.canh;
  const damGiua = t.dam_giua == null ? 0.55 : t.dam_giua;
  const mau = t.mau || [255, 255, 255];
  const { rong, cao } = anh;
  const d = new Uint8ClampedArray(anh.du_lieu);
  const cx = rong - le - canh / 2, cy = cao - le - canh / 2, r = canh / 2;
  const alpha = new Float32Array(rong * cao);

  for (let y = Math.floor(cy - r) - 1; y <= Math.ceil(cy + r) + 1; y++) {
    for (let x = Math.floor(cx - r) - 1; x <= Math.ceil(cx + r) + 1; x++) {
      if (x < 0 || y < 0 || x >= rong || y >= cao) continue;
      const dx = Math.abs(x - cx) / r, dy = Math.abs(y - cy) / r;
      const v = Math.pow(dx, 0.55) + Math.pow(dy, 0.55);
      if (v > 1) continue;
      const m = v <= 0.45 ? damGiua : damGiua * Math.max(0, (1 - v) / 0.55);
      alpha[y * rong + x] = m;
      const i = (y * rong + x) * 4;
      for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * (1 - m) + mau[c] * m;
    }
  }
  return {
    rong, cao, du_lieu: d, alpha,
    sao: { x: Math.round(cx - r), y: Math.round(cy - r), w: canh, h: canh },
  };
}

module.exports = { anhKieuKenh, danSaoMo, NAVY, VANG, TRANG, DEN };

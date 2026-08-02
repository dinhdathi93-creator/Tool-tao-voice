/* Dung anh gia + ma hoa PNG bang tay - dung chung cho cac bai test chay o Node.
 * (Node khong co canvas nen phai tu ghi PNG.)
 */
"use strict";

const zlib = require("zlib");

function nhienNgau(hat) {
  let s = (hat >>> 0) + 1;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Anh nen kieu vector phang: chuyen mau + vai mang mau. */
function anhGia(hat, rong = 1280, cao = 720) {
  const rnd = nhienNgau(hat);
  const d = new Uint8ClampedArray(rong * cao * 4);
  const tren = [60 + rnd() * 140, 60 + rnd() * 140, 60 + rnd() * 140];
  const duoi = [60 + rnd() * 140, 60 + rnd() * 140, 60 + rnd() * 140];
  for (let y = 0; y < cao; y++) {
    const t = y / (cao - 1);
    for (let x = 0; x < rong; x++) {
      const i = (y * rong + x) * 4;
      for (let c = 0; c < 3; c++) d[i + c] = tren[c] * (1 - t) + duoi[c] * t;
      d[i + 3] = 255;
    }
  }
  for (let k = 0; k < 4; k++) {
    const x0 = Math.floor(rnd() * (rong - 200));
    const y0 = Math.floor(rnd() * (cao - 150));
    const w = 100 + Math.floor(rnd() * 250);
    const h = 60 + Math.floor(rnd() * 140);
    const mau = [40 + rnd() * 180, 40 + rnd() * 180, 40 + rnd() * 180];
    for (let y = y0; y < Math.min(cao, y0 + h); y++) {
      for (let x = x0; x < Math.min(rong, x0 + w); x++) {
        const i = (y * rong + x) * 4;
        for (let c = 0; c < 3; c++) d[i + c] = mau[c];
      }
    }
  }
  return { rong, cao, du_lieu: d };
}

/** Dan watermark trang mo: vien khung + duong cheo + vai net doc kieu chu. */
function danWatermark(anh, vung, dam = 0.85) {
  const { rong, cao } = anh;
  const d = new Uint8ClampedArray(anh.du_lieu);
  const tron = (x, y) => {
    if (x < 0 || y < 0 || x >= rong || y >= cao) return;
    const i = (y * rong + x) * 4;
    for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * (1 - dam) + 255 * dam;
  };
  for (let t = 0; t < 3; t++) {
    for (let x = vung.x; x < vung.x + vung.w; x++) {
      tron(x, vung.y + t); tron(x, vung.y + vung.h - 1 - t);
    }
    for (let y = vung.y; y < vung.y + vung.h; y++) {
      tron(vung.x + t, y); tron(vung.x + vung.w - 1 - t, y);
    }
  }
  for (let x = 0; x < vung.w; x++) {
    const y = Math.round(vung.h - 8 - ((vung.h - 16) * x) / vung.w);
    for (let t = 0; t < 4; t++) tron(vung.x + x, vung.y + y + t);
  }
  for (let n = 0; n < 6; n++) {
    const x = vung.x + 10 + n * Math.floor(vung.w / 8);
    for (let y = vung.y + 8; y < vung.y + Math.floor(vung.h / 2); y++) {
      for (let t = 0; t < 3; t++) tron(x + t, y);
    }
  }
  return { rong, cao, du_lieu: d };
}

// --- Ghi PNG -------------------------------------------------------------

const BANG_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = BANG_CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function khoi(kieu, duLieu) {
  const dai = Buffer.alloc(4);
  dai.writeUInt32BE(duLieu.length);
  const than = Buffer.concat([Buffer.from(kieu), Buffer.from(duLieu)]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(than));
  return Buffer.concat([dai, than, c]);
}

/** { rong, cao, du_lieu } -> Buffer PNG (RGBA, khong mat mat). */
function ghiPng(anh) {
  const { rong, cao, du_lieu } = anh;
  const tho = Buffer.alloc(cao * (rong * 4 + 1));
  for (let y = 0; y < cao; y++) {
    tho[y * (rong * 4 + 1)] = 0;   // filter none
    Buffer.from(du_lieu.buffer, du_lieu.byteOffset + y * rong * 4, rong * 4)
      .copy(tho, y * (rong * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(rong, 0);
  ihdr.writeUInt32BE(cao, 4);
  ihdr[8] = 8;    // 8 bit moi kenh
  ihdr[9] = 6;    // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    khoi("IHDR", ihdr),
    khoi("IDAT", zlib.deflateSync(tho)),
    khoi("IEND", Buffer.alloc(0)),
  ]);
}

module.exports = { anhGia, danWatermark, ghiPng, nhienNgau };

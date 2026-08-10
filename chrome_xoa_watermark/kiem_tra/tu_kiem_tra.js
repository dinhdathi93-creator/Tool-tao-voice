/* Tu kiem tra loi xu ly + doc/ghi zip, chay bang Node:
 *     node chrome_xoa_watermark/kiem_tra/tu_kiem_tra.js
 *
 * Phan canvas (anh.js, xu_ly.js) khong test o day duoc vi Node khong co
 * createImageBitmap - phan do co bai test rieng chay trong Chromium:
 *     node chrome_xoa_watermark/kiem_tra/tu_kiem_tra_chrome.js
 */
"use strict";

const zlib = require("zlib");
const LOI = require("../loi_xoa.js");
const { anhKieuFlow, danSaoGoc } = require("./anh_kieu_flow.js");
const ZIP = require("../zip.js");

const loi = [];
function kiem(dat, ghiChu) { if (!dat) loi.push(ghiChu); }

// ---------------------------------------------------------------------------
// Anh gia: nen chuyen mau + vai mang mau, moi anh mot kieu
// ---------------------------------------------------------------------------

function nhienNgau(hat) {
  let s = hat >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function anhGia(hat, rong = 480, cao = 270) {
  const rnd = nhienNgau(hat + 1);
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
  for (let k = 0; k < 3; k++) {
    const x0 = Math.floor(rnd() * (rong - 60));
    const y0 = Math.floor(rnd() * (cao - 40));
    const w = 40 + Math.floor(rnd() * 80);
    const h = 20 + Math.floor(rnd() * 40);
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

/** Dan "watermark" trang mo: vien khung + duong cheo + vai net doc. */
function danWatermark(anh, vung, dam = 0.85) {
  const { rong, cao } = anh;
  const d = new Uint8ClampedArray(anh.du_lieu);
  const tron = (x, y) => {
    if (x < 0 || y < 0 || x >= rong || y >= cao) return;
    const i = (y * rong + x) * 4;
    for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * (1 - dam) + 255 * dam;
  };
  for (let t = 0; t < 2; t++) {
    for (let x = vung.x; x < vung.x + vung.w; x++) {
      tron(x, vung.y + t); tron(x, vung.y + vung.h - 1 - t);
    }
    for (let y = vung.y; y < vung.y + vung.h; y++) {
      tron(vung.x + t, y); tron(vung.x + vung.w - 1 - t, y);
    }
  }
  for (let x = 0; x < vung.w; x++) {          // duong cheo
    const y = Math.round(vung.h - 6 - ((vung.h - 12) * x) / vung.w);
    for (let t = 0; t < 3; t++) tron(vung.x + x, vung.y + y + t);
  }
  for (let n = 0; n < 5; n++) {               // vai net doc kieu chu
    const x = vung.x + 8 + n * Math.floor(vung.w / 7);
    for (let y = vung.y + 6; y < vung.y + Math.floor(vung.h / 2); y++) {
      tron(x, y); tron(x + 1, y);
    }
  }
  return { rong, cao, du_lieu: d };
}

function sanhTrongVung(a, b, vung) {
  let tong = 0, dem = 0;
  for (let y = vung.y; y < vung.y + vung.h; y++) {
    for (let x = vung.x; x < vung.x + vung.w; x++) {
      const i = (y * a.rong + x) * 4;
      for (let c = 0; c < 3; c++) { tong += Math.abs(a.du_lieu[i + c] - b.du_lieu[i + c]); dem++; }
    }
  }
  return tong / Math.max(1, dem);
}

// ---------------------------------------------------------------------------
// 1. Doc chuoi vung
// ---------------------------------------------------------------------------

function chuoiVung(v) { return v ? `${v.x},${v.y},${v.w},${v.h}` : "null"; }

kiem(LOI.phanTichVung("tu-dong", 1920, 1080) === null, "'tu-dong' phai tra null");
kiem(chuoiVung(LOI.phanTichVung("100,50,200,80", 1920, 1080)) === "100,50,200,80",
     "doc sai toa do pixel");
kiem(chuoiVung(LOI.phanTichVung("50%,50%,25%,10%", 1000, 800)) === "500,400,250,80",
     "doc sai toa do phan tram");
kiem(LOI.phanTichVung("duoi-phai", 1000, 1000).x === 700, "goc duoi-phai sai vi tri x");
kiem(LOI.phanTichVung("duoi", 1000, 1000).w === 1000, "dai 'duoi' phai rong het anh");
kiem(chuoiVung(LOI.phanTichVung("900,900,500,500", 1000, 1000)) === "900,900,100,100",
     "phai cat khung cho nam gon trong anh");
try {
  LOI.phanTichVung("linh tinh", 100, 100);
  loi.push("chuoi vung sai phai bao loi");
} catch (e) { /* dung */ }

// ---------------------------------------------------------------------------
// 2. Tu do vi tri watermark
// ---------------------------------------------------------------------------

function thuDo(cacAnh, khung, ten) {
  const kq = LOI.timVungTuDong(cacAnh);
  if (!kq.vung) { loi.push(`[${ten}] khong tu do duoc vi tri (${kq.ghi_chu})`); return; }
  console.log(`   Tu do vi tri (${ten}): ${chuoiVung(kq.vung)} | that: ${chuoiVung(khung)}`);
  const tamX = khung.x + khung.w / 2, tamY = khung.y + khung.h / 2;
  const trum = kq.vung.x <= tamX && tamX <= kq.vung.x + kq.vung.w
            && kq.vung.y <= tamY && tamY <= kq.vung.y + kq.vung.h;
  kiem(trum, `[${ten}] vung tu do khong trum tam watermark`);
  kiem(kq.vung.w * kq.vung.h <= 6 * khung.w * khung.h, `[${ten}] vung tu do qua rong`);
}

const that = { x: 330, y: 200, w: 130, h: 55 };
const sach = [];
const ban = [];
for (let i = 0; i < 6; i++) {
  const a = anhGia(i);
  sach.push(a);
  ban.push(danWatermark(a, that));
}
thuDo(ban, that, "480x270");

const thatHd = { x: 700, y: 640, w: 240, h: 60 };
const banHd = [];
for (let i = 0; i < 5; i++) banHd.push(danWatermark(anhGia(50 + i, 1280, 720), thatHd));
thuDo(banHd, thatHd, "1280x720");

kiem(LOI.timVungTuDong(ban.slice(0, 2)).vung === null, "chi co 2 anh thi phai tu choi tu do");
kiem(LOI.timVungTuDong([sach[0], sach[0], sach[0], sach[0]]).vung === null,
     "4 anh y het nhau thi phai tu choi");

// ---------------------------------------------------------------------------
// 3. Mat na
// ---------------------------------------------------------------------------

const khung = LOI.noVung(that, 6, ban[0].rong, ban[0].cao);
const caKhung = LOI.taoMatNa(ban[0], khung, "tat", 0, 2);
let demKhung = 0;
for (let i = 0; i < caKhung.length; i++) demKhung += caKhung[i];
kiem(demKhung === khung.w * khung.h, "loc mau 'tat' phai lay tron ca khung");

const chiSang = LOI.taoMatNa(ban[0], khung, "sang", 25, 1);
let demSang = 0, tranRa = 0;
for (let i = 0; i < chiSang.length; i++) {
  demSang += chiSang[i];
  if (chiSang[i] && !caKhung[i]) tranRa++;
}
kiem(demSang > 0 && demSang < demKhung, "loc 'sang' phai bat it pixel hon ca khung");
kiem(tranRa === 0, "mat na tran ra ngoai khung");

// nen mau ruc + chu trang: 'sang' chi duoc bat chu trang
const nenDo = { rong: 90, cao: 60, du_lieu: new Uint8ClampedArray(90 * 60 * 4) };
for (let y = 0; y < 60; y++) {
  for (let x = 0; x < 90; x++) {
    const i = (y * 90 + x) * 4;
    const trang = y >= 20 && y < 30 && x >= 30 && x < 40;
    nenDo.du_lieu[i] = trang ? 255 : 220;
    nenDo.du_lieu[i + 1] = trang ? 255 : 30;
    nenDo.du_lieu[i + 2] = trang ? 255 : 30;
    nenDo.du_lieu[i + 3] = 255;
  }
}
const mnDo = LOI.taoMatNa(nenDo, { x: 0, y: 0, w: 90, h: 60 }, "sang", 25, 1);
let sotChu = 0, batNhamNen = 0;
for (let y = 20; y < 30; y++) for (let x = 30; x < 40; x++) if (!mnDo[y * 90 + x]) sotChu++;
for (let y = 0; y < 15; y++) for (let x = 0; x < 20; x++) if (mnDo[y * 90 + x]) batNhamNen++;
kiem(sotChu === 0, "'sang' bo sot chu trang");
kiem(batNhamNen === 0, "'sang' bat nham ca mang mau ruc lam nen");

// ---------------------------------------------------------------------------
// 4. Va lai
// ---------------------------------------------------------------------------

const truoc = sanhTrongVung(ban[0], sach[0], that);
const daVa = LOI.vaLai(ban[0], caKhung);
const sau = sanhTrongVung(daVa, sach[0], that);
console.log(`   Sai lech trong vung: truoc khi va ${truoc.toFixed(1)} -> sau khi va ${sau.toFixed(1)}`);
kiem(sau < truoc / 2, `va lai chua an thua: truoc ${truoc.toFixed(1)}, sau ${sau.toFixed(1)}`);
kiem(sau < 30, `va lai con lech qua nhieu (${sau.toFixed(1)}/255)`);

let doiNgoai = 0;
for (let y = 0; y < ban[0].cao; y++) {
  for (let x = 0; x < 100; x++) {
    const i = (y * ban[0].rong + x) * 4;
    for (let c = 0; c < 3; c++) if (daVa.du_lieu[i + c] !== ban[0].du_lieu[i + c]) doiNgoai++;
  }
}
kiem(doiNgoai === 0, "va lai lam thay doi ca phan ngoai vung watermark");

const toDe = LOI.toMauNen(ban[0], caKhung, khung);
const mauDau = [toDe.du_lieu[(khung.y * toDe.rong + khung.x) * 4],
                toDe.du_lieu[(khung.y * toDe.rong + khung.x) * 4 + 1]];
let khacMau = 0;
for (let y = khung.y; y < khung.y + khung.h; y++) {
  for (let x = khung.x; x < khung.x + khung.w; x++) {
    const i = (y * toDe.rong + x) * 4;
    if (toDe.du_lieu[i] !== mauDau[0] || toDe.du_lieu[i + 1] !== mauDau[1]) khacMau++;
  }
}
kiem(khacMau === 0, "to mau nen phai ra dung 1 mau trong vung");

const coKhung = LOI.veKhung(ban[0], khung);
const gocKhung = (khung.y * coKhung.rong + khung.x) * 4;
kiem(coKhung.du_lieu[gocKhung] === 255 && coKhung.du_lieu[gocKhung + 1] === 0,
     "ve khung phai to mau do");

// giu nguyen kenh trong suot
const coAlpha = { rong: 40, cao: 40, du_lieu: new Uint8ClampedArray(40 * 40 * 4) };
for (let i = 0; i < 40 * 40; i++) {
  coAlpha.du_lieu[i * 4] = 200; coAlpha.du_lieu[i * 4 + 1] = 100;
  coAlpha.du_lieu[i * 4 + 2] = 50; coAlpha.du_lieu[i * 4 + 3] = 128;
}
const vaAlpha = LOI.vaLai(coAlpha, LOI.taoMatNa(coAlpha, { x: 10, y: 10, w: 10, h: 10 }, "tat", 0, 0));
kiem(vaAlpha.du_lieu[(15 * 40 + 15) * 4 + 3] === 128, "va lai lam mat kenh trong suot");

// ---------------------------------------------------------------------------
// 4b. Va o cho co ranh gioi sac net (nen xanh / dai vang kieu Flow)
// ---------------------------------------------------------------------------

{
  const gocFlow = anhKieuFlow(7, 1376, 768);
  const banFlow = danSaoGoc(gocFlow);
  const vFlow = { x: 1243, y: Math.round(768 * 0.87) - 42, w: 72, h: 72 };
  const mnFlow = LOI.taoMatNa(banFlow, vFlow, "tat", 0, 2);
  const mem = LOI.vaLai(banFlow, mnFlow);
  const theoCauTruc = LOI.vaCauTruc(banFlow, mnFlow, mem);
  const lechMem = sanhTrongVung(mem, gocFlow, vFlow);
  const lechCau = sanhTrongVung(theoCauTruc, gocFlow, vFlow);
  console.log(`   Va o cho giap ranh xanh/vang: khuech tan ${lechMem.toFixed(1)}`
    + ` -> theo cau truc ${lechCau.toFixed(1)}`);
  kiem(lechCau < 3, `va theo cau truc con de lai vet o cho giap ranh (${lechCau.toFixed(1)}/255)`);
  kiem(lechCau < lechMem, "va theo cau truc phai hon han khuech tan o cho giap ranh sac net");
}

// Logo SAT MEP anh: huong ngang chi con mot ben, huong doc thi vat qua ranh
// gioi xanh/vang. Chon nham huong la ra dung vet toi o goc.
{
  const gocMep = anhKieuFlow(3, 1376, 768);
  const dat = Math.round(768 * 0.87);
  const d = new Uint8ClampedArray(gocMep.du_lieu);
  const banMep = { rong: 1376, cao: 768, du_lieu: d };
  const sx = 1376 - 24 - 30, sy = dat - 15;      // cach mep phai 24px, vat ranh gioi
  for (let y = sy; y < sy + 30; y++) {
    for (let x = sx; x < sx + 30; x++) {
      const dx = (x - sx - 15) / 15, dy = (y - sy - 15) / 15;
      if (Math.pow(Math.abs(dx), 0.55) + Math.pow(Math.abs(dy), 0.55) <= 1) {
        const i = (y * 1376 + x) * 4;
        for (let c = 0; c < 3; c++) d[i + c] = 255;
      }
    }
  }
  const cacKhung = [
    ["khung vua du", { x: sx - 6, y: sy - 6, w: 42, h: 42 }],
    ["cham mep phai", { x: sx - 6, y: sy - 6, w: 1376 - (sx - 6), h: 42 }],
    ["cham mep phai va day", { x: sx - 6, y: sy - 6, w: 1376 - (sx - 6), h: 768 - (sy - 6) }],
    ["preset logo-duoi-phai", LOI.phanTichVung("logo-duoi-phai", 1376, 768)],
  ];
  cacKhung.forEach(function (muc) {
    const ten = muc[0], v = muc[1];
    const mn = LOI.taoMatNa(banMep, v, "tat", 0, 2);
    const kq = sanhTrongVung(LOI.vaCauTruc(banMep, mn, LOI.vaLai(banMep, mn)), gocMep, v);
    console.log(`   Logo sat mep (${ten}): lech ${kq.toFixed(2)}`);
    kiem(kq < 1, `[${ten}] con de lai vet o goc anh (${kq.toFixed(2)}/255)`);
  });
}

// ---------------------------------------------------------------------------
// 4b-bis. O mac dinh phai trum DAU SAO THAT cua Flow
// ---------------------------------------------------------------------------
// Toa do do duoc tren anh that cua nguoi dung: 1314,706 co 42x42 tren anh
// 1376x768. O mac dinh tung bi thu qua tay, hut mat mep tren cua logo dung
// 1 pixel - anh ra van con mot mau dau sao.
{
  const THAT_1376 = { x: 1314, y: 706, w: 42, h: 42 };
  [[1376, 768], [1920, 1080], [1280, 720], [1024, 1024]].forEach(function (kt) {
    const rong = kt[0], cao = kt[1];
    const t = {
      x: Math.round(THAT_1376.x * rong / 1376), y: Math.round(THAT_1376.y * cao / 768),
      w: Math.round(THAT_1376.w * rong / 1376), h: Math.round(THAT_1376.h * cao / 768),
    };
    const v = LOI.phanTichVung("logo-duoi-phai", rong, cao);
    const trum = v.x <= t.x && v.y <= t.y && v.x + v.w >= t.x + t.w && v.y + v.h >= t.y + t.h;
    kiem(trum, `o mac dinh ${chuoiVung(v)} khong trum dau sao ${chuoiVung(t)} tren anh ${rong}x${cao}`);
    kiem(v.w * v.h < 0.012 * rong * cao,
         `o mac dinh qua to tren anh ${rong}x${cao}: ${chuoiVung(v)}`);
  });
  console.log(`   O mac dinh tren 1376x768: ${chuoiVung(LOI.phanTichVung("logo-duoi-phai", 1376, 768))}`
    + ` (dau sao that 1314,706,42,42)`);
}

// ---------------------------------------------------------------------------
// 4c. Tim logo chi tu MOT anh (dung cho trang thu 1 anh)
// ---------------------------------------------------------------------------

{
  function datSao(a, sx, sy, canh, dam) {
    const d = new Uint8ClampedArray(a.du_lieu);
    for (let y = sy; y < sy + canh; y++) {
      for (let x = sx; x < sx + canh; x++) {
        const dx = (x - sx - canh / 2) / (canh / 2), dy = (y - sy - canh / 2) / (canh / 2);
        if (Math.pow(Math.abs(dx), 0.55) + Math.pow(Math.abs(dy), 0.55) <= 1) {
          const i = (y * a.rong + x) * 4;
          for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * (1 - dam) + 255 * dam;
        }
      }
    }
    return { rong: a.rong, cao: a.cao, du_lieu: d };
  }
  function trumDuoc(v, sx, sy, canh) {
    return v && v.x <= sx && v.y <= sy && v.x + v.w >= sx + canh && v.y + v.h >= sy + canh;
  }

  // dau sao tren nen xanh dam
  const nenXanh = anhKieuFlow(9, 1376, 768);
  let sx = 1376 - 26 - 30, sy = 768 - 26 - 30;
  let kq = LOI.timLogoMotAnh(datSao(nenXanh, sx, sy, 30, 0.85));
  console.log(`   Tim logo tren 1 anh (nen xanh): ${chuoiVung(kq.vung)} | ${kq.ghi_chu}`);
  kiem(trumDuoc(kq.vung, sx, sy, 30), "khong trum dau sao tren nen xanh");
  kiem(kq.vung && kq.vung.w * kq.vung.h < 0.01 * 1376 * 768, "khung tim duoc qua to");

  // dau sao tren dai dat vang (nen sang)
  const nenVang = anhKieuFlow(4, 1376, 768);
  kq = LOI.timLogoMotAnh(datSao(nenVang, sx, sy, 30, 0.85));
  kiem(trumDuoc(kq.vung, sx, sy, 30), "khong trum dau sao tren nen vang");

  // goc duoi TRAI
  kq = LOI.timLogoMotAnh(datSao(anhKieuFlow(5, 1376, 768), 26, 768 - 26 - 30, 30, 0.85));
  kiem(kq.goc === "duoi-trai", `phai bao dung goc duoi-trai, dang bao ${kq.goc}`);

  // anh khong co logo -> phai tra null, khong duoc bia ra vung
  kiem(LOI.timLogoMotAnh(anhKieuFlow(11, 1376, 768)).vung === null,
       "anh khong co logo ma van bia ra mot vung");
}

// ---------------------------------------------------------------------------
// 4d. Hoc lop phu tu ca lo roi go nguoc ra
//
// Hai bo anh, hai ca kho khac han nhau:
//   "kenh" - vector phang, GOC DUOI PHAI CUA MOI ANH GIONG HET NHAU. Cach do
//            bang so nen giua cac anh chet ngay o day (khong co gi ma so), va
//            do la dung loai anh cua nguoi dung.
//   "anh"  - nen moi anh mot khac, co anh vat the nam ngay duoi logo.
// Ca hai deu phai ra sach, va deu phai hon han cach va o cho co vat the.
// ---------------------------------------------------------------------------

{
  const { danLopPhu, anhNenDoi, lechTrung } = require("./lop_phu.js");
  const { anhKieuKenh, danSaoMo } = require("./anh_kieu_kenh.js");

  function doMotBo(ten, gocLo, banLo, sao, nguongDe, nguongKho, soKho) {
    const oDo = { x: sao.x - 12, y: sao.y - 12, w: sao.w + 24, h: sao.h + 24 };
    const moHinh = LOI.hocLopPhu(banLo, sao);
    kiem(!!moHinh, `[${ten}] khong hoc duoc lop phu tu ${banLo.length} anh`);
    if (!moHinh) return;

    console.log(`   [${ten}] hoc tu ${moHinh.so_anh} anh: ${moHinh.so_diem} diem dinh logo, `
      + `mau logo ${moHinh.mau_logo.map((z) => Math.round(z)).join(",")}`);
    kiem(moHinh.so_diem > 100 && moHinh.so_diem < 400,
         `[${ten}] so diem hoc duoc (${moHinh.so_diem}) khong khop mot dau sao 30x30`);

    let teDe = 0, teKho = 0, teVaKho = 0;
    banLo.forEach((b, i) => {
      const raGo = LOI.goLopPhu(b, moHinh);
      const dGo = lechTrung(raGo, gocLo[i], oDo);
      const caAnh = lechTrung(raGo, gocLo[i], { x: 0, y: 0, w: b.rong, h: b.cao });
      kiem(caAnh < 0.05, `[${ten}] anh ${i}: go lop phu ma dung ca anh (${caAnh.toFixed(3)}/255)`);
      if (i >= banLo.length - soKho) {
        teKho = Math.max(teKho, dGo);
        teVaKho = Math.max(teVaKho, lechTrung(
          LOI.xoaWatermark(b, { vung_pixel: sao, cach: "va", no_rong: 2 }), gocLo[i], oDo));
      } else {
        teDe = Math.max(teDe, dGo);
      }
    });
    console.log(`   [${ten}] anh thuong con lech ${teDe.toFixed(2)}; anh logo de len vat the: `
      + `va ${teVaKho.toFixed(2)} -> go ${teKho.toFixed(2)} (thang 0-255)`);
    kiem(teDe < nguongDe, `[${ten}] anh thuong con lech ${teDe.toFixed(2)}/255`);
    kiem(teKho < nguongKho, `[${ten}] anh kho con lech ${teKho.toFixed(2)}/255`);
    kiem(teKho < teVaKho / 3,
         `[${ten}] go (${teKho.toFixed(2)}) phai hon han va (${teVaKho.toFixed(2)})`);
  }

  // --- bo "kenh": vector phang, goc duoi phai moi anh giong het nhau -------
  const gocKenh = [];
  for (let i = 0; i < 8; i++) gocKenh.push(anhKieuKenh(i * 7 + 3, i >= 6));
  const banKenh = gocKenh.map((g) => danSaoMo(g, { dam_giua: 0.55 }));
  doMotBo("kenh", gocKenh, banKenh, banKenh[0].sao, 0.5, 1.0, 2);

  // dau sao dac han giua - phan dac phai duoc va, khong duoc bo qua
  const banDac = gocKenh.map((g) => danSaoMo(g, { dam_giua: 1 }));
  doMotBo("kenh, logo dac", gocKenh, banDac, banDac[0].sao, 1.5, 2.5, 2);

  // --- bo "anh": nen moi anh mot khac -------------------------------------
  const gocAnh = [];
  for (let i = 0; i < 6; i++) gocAnh.push(anhNenDoi(i * 7 + 3, false));
  gocAnh.push(anhNenDoi(101, true));
  gocAnh.push(anhNenDoi(202, true));
  const banAnh = gocAnh.map((g) => danLopPhu(g, { dam_giua: 1 }));
  doMotBo("anh", gocAnh, banAnh, banAnh[0].sao, 1.0, 2.0, 2);

  // --- khong duoc bia ra lop phu khi khong co ------------------------------
  kiem(LOI.hocLopPhu(gocKenh, banKenh[0].sao) === null,
       "anh khong co watermark ma van hoc ra mot lop phu");
  kiem(LOI.hocLopPhu(banKenh.slice(0, LOI.SO_ANH_TOI_THIEU - 1), banKenh[0].sao) === null,
       `duoi ${LOI.SO_ANH_TOI_THIEU} anh thi phai tra null chu khong duoc hoc bua`);

  // khung lech han khoi logo -> tra null, khong duoc go bua mot mang nen
  kiem(LOI.hocLopPhu(banKenh, { x: banKenh[0].sao.x - 60, y: banKenh[0].sao.y, w: 30, h: 30 })
       === null, "khung lech han khoi logo ma van hoc ra lop phu");

  // --- TIM logo bang chinh lop phu ----------------------------------------
  // Bo do net sac chet o day: ban chan trang cua hinh que sang hon nen 160 muc,
  // con dau ✦ mo chi hon vai chuc -> no bam vao chan roi va nat cho do trong
  // khi watermark con nguyen. Dung loi nguoi dung gap.
  {
    const chanNham = LOI.timLogoMotAnh(banKenh[0]);
    console.log(`   [kenh] bo do net sac bao: ${chanNham.vung
      ? chanNham.vung.x + "," + chanNham.vung.y : "khong thay"} (${chanNham.ghi_chu})`);

    const kqTim = LOI.timLopPhu(banKenh);
    console.log(`   [kenh] tim bang lop phu: ${kqTim.vung
      ? chuoiVung(kqTim.vung) : "khong thay"} | ${kqTim.ghi_chu}`);
    kiem(!!kqTim.mo_hinh, "khong tim ra lop phu tren anh vector phang");
    if (kqTim.vung) {
      const s0 = banKenh[0].sao;
      kiem(Math.abs(kqTim.vung.x - s0.x) < 6 && Math.abs(kqTim.vung.y - s0.y) < 6
           && Math.abs(kqTim.vung.w - s0.w) < 12 && Math.abs(kqTim.vung.h - s0.h) < 12,
           `khung tim duoc ${chuoiVung(kqTim.vung)} khong khop dau sao that `
           + `${chuoiVung(s0)}`);
    }
    // anh khong co watermark -> khong duoc bia ra
    kiem(LOI.timLopPhu(gocKenh).mo_hinh === null,
         "anh khong co watermark ma tim lop phu van ra ket qua");
  }

  // khung to gap 3 van phai ra dung cai logo do
  const sao0 = banKenh[0].sao;
  const mhTo = LOI.hocLopPhu(banKenh, { x: sao0.x - 30, y: sao0.y - 30, w: 90, h: 90 });
  kiem(!!mhTo, "khung to gap 3 ma khong hoc duoc");
  if (mhTo) {
    console.log(`   [kenh] khung to gap 3: van ra ${mhTo.so_diem} diem`);
    kiem(Math.abs(mhTo.so_diem - 166) < 40,
         `khung to gap 3 ra ${mhTo.so_diem} diem, lech xa so voi khung sat (166)`);
  }
}

// ---------------------------------------------------------------------------
// 5. Zip: ghi -> doc lai, va doc duoc entry nen deflate
// ---------------------------------------------------------------------------

function batByte(n, hat) {
  const rnd = nhienNgau(hat);
  const u = new Uint8Array(n);
  for (let i = 0; i < n; i++) u[i] = Math.floor(rnd() * 256);
  return u;
}

function zipDeflateGia(cacMuc) {
  // Tu dung 1 file zip nen kieu deflate de kiem tra phan doc
  const manh = [], cd = [];
  let viTri = 0;
  for (const m of cacMuc) {
    const ten = Buffer.from(m.ten, "utf8");
    const nen = zlib.deflateRawSync(Buffer.from(m.du_lieu));
    const crc = ZIP.crc32(m.du_lieu);
    const local = Buffer.alloc(30 + ten.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);              // deflate
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(nen.length, 18);
    local.writeUInt32LE(m.du_lieu.length, 22);
    local.writeUInt16LE(ten.length, 26);
    ten.copy(local, 30);
    manh.push(local, nen);
    cd.push({ ten, crc, coNen: nen.length, goc: m.du_lieu.length, viTri });
    viTri += local.length + nen.length;
  }
  const dauCD = viTri;
  for (const c of cd) {
    const b = Buffer.alloc(46 + c.ten.length);
    b.writeUInt32LE(0x02014b50, 0);
    b.writeUInt16LE(20, 4); b.writeUInt16LE(20, 6); b.writeUInt16LE(0x0800, 8);
    b.writeUInt16LE(8, 10);
    b.writeUInt32LE(c.crc, 16);
    b.writeUInt32LE(c.coNen, 20);
    b.writeUInt32LE(c.goc, 24);
    b.writeUInt16LE(c.ten.length, 28);
    b.writeUInt32LE(c.viTri, 42);
    c.ten.copy(b, 46);
    manh.push(b);
    viTri += b.length;
  }
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(cd.length, 8); eocd.writeUInt16LE(cd.length, 10);
  eocd.writeUInt32LE(viTri - dauCD, 12); eocd.writeUInt32LE(dauCD, 16);
  manh.push(eocd);
  return new Blob(manh);
}

async function thuZip() {
  const a = batByte(5000, 7), b = batByte(120, 9);
  const zipTa = await ZIP.taoZip([
    { ten: "thu_muc/anh_01.png", du_lieu: a },
    { ten: "ghi_chu.txt", du_lieu: b },
  ]);
  const doc = await ZIP.docZip(zipTa);
  kiem(doc.length === 2, `zip tu ghi phai doc lai ra 2 muc, dang ra ${doc.length}`);
  kiem(doc[0].ten === "thu_muc/anh_01.png", "sai ten muc dau (mat duong dan?)");
  const d0 = await doc[0].doc();
  const d1 = await doc[1].doc();
  kiem(Buffer.compare(Buffer.from(d0), Buffer.from(a)) === 0, "noi dung muc 1 khong khop");
  kiem(Buffer.compare(Buffer.from(d1), Buffer.from(b)) === 0, "noi dung muc 2 khong khop");
  kiem(doc[0].crc === ZIP.crc32(a), "CRC ghi vao zip khong dung");

  // doc zip nen kieu deflate (kieu ma Flow/Google hay xuat ra)
  const zipNen = zipDeflateGia([{ ten: "anh/a.png", du_lieu: a }]);
  const docNen = await ZIP.docZip(zipNen);
  const dn = await docNen[0].doc();
  kiem(Buffer.compare(Buffer.from(dn), Buffer.from(a)) === 0, "giai nen deflate sai noi dung");

  // zip ghi ra phai mo duoc bang cong cu he thong (kiem cheo bang unzip -t neu co)
  return zipTa;
}

// ---------------------------------------------------------------------------

(async function () {
  console.log("=== TU KIEM TRA (loi xu ly + zip) ===");
  try {
    const zipTa = await thuZip();
    const fs = require("fs");
    const os = require("os");
    const path = require("path");
    const duongDan = path.join(os.tmpdir(), "xw_thu.zip");
    fs.writeFileSync(duongDan, Buffer.from(await zipTa.arrayBuffer()));
    console.log(`   Da ghi thu file zip: ${duongDan}`);
  } catch (e) {
    loi.push("zip: " + e.message);
  }

  console.log("-".repeat(70));
  if (loi.length) {
    loi.forEach((l) => console.error("  [HONG] " + l));
    console.error(`TU KIEM TRA: ${loi.length} loi.`);
    process.exit(1);
  }
  console.log("TU KIEM TRA: TAT CA DEU DAT.");
})();

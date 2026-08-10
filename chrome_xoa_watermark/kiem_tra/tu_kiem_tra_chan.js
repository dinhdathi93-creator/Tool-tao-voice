/* Kiem tra chan_trang.js tren mot DOM gia:
 *     node chrome_xoa_watermark/kiem_tra/tu_kiem_tra_chan.js
 *
 * Bai nay sinh ra tu mot loi that: tien ich xu ly xong roi bam the <a download>
 * de tra file ve, nhung chinh bo chan cua no lai tom cai bam do -> huy tai va
 * xu ly lai tu dau, quay vong mai khong ra ket qua.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const MA_NGUON = fs.readFileSync(path.join(__dirname, "..", "chan_trang.js"), "utf8");

const loi = [];
function kiem(dat, ghiChu) { if (!dat) loi.push(ghiChu); }

/** Dung mot moi truong trinh duyet toi gian roi nap chan_trang.js vao. */
function dungMoiTruong() {
  const nghe = { message: [], click: [] };
  const daGui = [];       // cac message chan_trang.js gui ra
  const daBamThat = [];   // cac the <a> duoc bam that (khong bi chan)

  const win = {
    addEventListener: (loai, ham) => { (nghe[loai] = nghe[loai] || []).push(ham); },
    postMessage: (d) => {
      daGui.push(d);
      (nghe.message || []).forEach((f) => f({ source: win, data: d }));
    },
    open: (url) => { daBamThat.push({ kieu: "window.open", url: url }); return "da-mo"; },
    fetch: undefined,
  };
  win.window = win;

  const doc = {
    addEventListener: (loai, ham) => { (nghe[loai] = nghe[loai] || []).push(ham); },
  };

  const bamGoc = function () { daBamThat.push({ kieu: "a.click", url: this.href }); };
  const HTMLAnchorElement = { prototype: { click: bamGoc } };

  const urlGia = {
    createObjectURL: (b) => "blob:gia/" + (b && b._ten ? b._ten : "x"),
    revokeObjectURL: () => {},
  };
  class BlobGia {}
  const XHR = { prototype: { open: function () {} } };

  const chay = new Function(
    "window", "document", "URL", "HTMLAnchorElement", "XMLHttpRequest", "Blob", "setTimeout",
    MA_NGUON
  );
  chay(win, doc, urlGia, HTMLAnchorElement, XHR, BlobGia, setTimeout);

  return { win, nghe, daGui, daBamThat, HTMLAnchorElement };
}

function theA(href, tuyChon) {
  tuyChon = tuyChon || {};
  const thuoc = Object.assign({}, tuyChon.thuoc || {});
  if (tuyChon.taiVe !== false) thuoc.download = tuyChon.ten || "du_an.zip";
  return {
    href: href,
    getAttribute: (t) => (t in thuoc ? thuoc[t] : null),
    hasAttribute: (t) => t in thuoc,
  };
}

function bamChuot(mt, the) {
  let daHuy = false;
  const su = {
    target: { closest: () => the },
    preventDefault: () => { daHuy = true; },
    stopImmediatePropagation: () => {},
  };
  (mt.nghe.click || []).forEach((f) => f(su));
  return daHuy;
}

function soTaiFile(mt) {
  return mt.daGui.filter((m) => m.viec === "tai_file").length;
}

// ---------------------------------------------------------------------------

// --- 1. Nut gat TAT: khong duoc dong vao gi ---------------------------------
{
  const mt = dungMoiTruong();
  kiem(bamChuot(mt, theA("https://x/du_an.zip")) === false, "nut gat tat ma van chan cu bam");
  kiem(soTaiFile(mt) === 0, "nut gat tat ma van doi xu ly file");
}

// --- 2. Nut gat BAT: chan link tai cua trang --------------------------------
{
  const mt = dungMoiTruong();
  mt.win.postMessage({ tu: "xw-trang", viec: "cai_dat", bat: true });
  kiem(bamChuot(mt, theA("https://x/du_an.zip")), "bat roi ma khong chan cu bam tai");
  kiem(soTaiFile(mt) === 1, "phai doi xu ly dung 1 file");

  const goi = mt.daGui.find((m) => m.viec === "tai_file");
  kiem(goi && goi.url === "https://x/du_an.zip", "gui sai duong dan file");
  kiem(goi && goi.ten === "du_an.zip", "gui sai ten file goi y");
}

// --- 3. Link khong phai file tai thi de yen ---------------------------------
{
  const mt = dungMoiTruong();
  mt.win.postMessage({ tu: "xw-trang", viec: "cai_dat", bat: true });
  kiem(bamChuot(mt, theA("https://labs.google/fx/vi/tools/flow", { taiVe: false })) === false,
       "chan nham link dieu huong binh thuong cua trang");
  kiem(soTaiFile(mt) === 0, "doi xu ly nham mot link khong phai file");
}

// --- 4. LOI CU: file do CHINH tien ich tra ve khong duoc chan lai -----------
{
  const mt = dungMoiTruong();
  mt.win.postMessage({ tu: "xw-trang", viec: "cai_dat", bat: true });

  // tien ich xu ly xong, danh dau roi bam the <a> de tra file ve
  const cuaMinh = theA("blob:gia/sach.zip", { thuoc: { "data-xw-bo-qua": "1" } });
  kiem(bamChuot(mt, cuaMinh) === false,
       "VONG LAP: file cua chinh tien ich bi chan lai (the co data-xw-bo-qua)");
  kiem(soTaiFile(mt) === 0, "VONG LAP: doi xu ly lai chinh file vua tra ve");

  // duong thu hai: bao truoc URL qua bo_qua_url
  mt.win.postMessage({ tu: "xw-trang", viec: "bo_qua_url", url: "blob:gia/sach2.zip" });
  kiem(bamChuot(mt, theA("blob:gia/sach2.zip")) === false,
       "VONG LAP: URL da bao bo qua van bi chan");
  kiem(soTaiFile(mt) === 0, "VONG LAP: doi xu ly lai URL da bao bo qua");

  // va van phai chan link that cua trang nhu thuong
  kiem(bamChuot(mt, theA("https://x/du_an_khac.zip")),
       "bo qua file cua minh xong thi quen chan link that");
  kiem(soTaiFile(mt) === 1, "phai chan link that cua trang");
}

// --- 5. Bam bang a.click() trong ma trang ------------------------------------
{
  const mt = dungMoiTruong();
  mt.win.postMessage({ tu: "xw-trang", viec: "cai_dat", bat: true });

  const cuaTrang = theA("https://x/du_an.zip");
  mt.HTMLAnchorElement.prototype.click.call(cuaTrang);
  kiem(soTaiFile(mt) === 1, "a.click() cua trang phai bi chan");
  kiem(mt.daBamThat.length === 0, "a.click() cua trang bi chan roi ma van tai that");

  const cuaMinh = theA("blob:gia/sach.zip", { thuoc: { "data-xw-bo-qua": "1" } });
  mt.HTMLAnchorElement.prototype.click.call(cuaMinh);
  kiem(soTaiFile(mt) === 1, "VONG LAP: a.click() file cua chinh tien ich bi chan");
  kiem(mt.daBamThat.length === 1 && mt.daBamThat[0].url === "blob:gia/sach.zip",
       "file cua chinh tien ich phai duoc tai that");
}

// --- 6. window.open cung theo dung luat --------------------------------------
{
  const mt = dungMoiTruong();
  mt.win.postMessage({ tu: "xw-trang", viec: "cai_dat", bat: true });
  mt.win.postMessage({ tu: "xw-trang", viec: "bo_qua_url", url: "blob:gia/sach.zip" });

  mt.win.open("https://x/du_an.zip");
  kiem(soTaiFile(mt) === 1, "window.open toi file zip phai bi chan");

  mt.win.open("blob:gia/sach.zip");
  kiem(soTaiFile(mt) === 1, "VONG LAP: window.open file cua chinh tien ich bi chan");
}

// --- 7. Che do chan doan --------------------------------------------------
{
  const mt = dungMoiTruong();
  mt.win.postMessage({ tu: "xw-trang", viec: "cai_dat", bat: true, chan_doan: true });
  bamChuot(mt, theA("https://x/du_an.zip"));
  kiem(mt.daGui.some((m) => m.viec === "chan_doan"), "bat chan doan ma khong ghi lai gi");

  const mt2 = dungMoiTruong();
  mt2.win.postMessage({ tu: "xw-trang", viec: "cai_dat", bat: true, chan_doan: false });
  bamChuot(mt2, theA("https://x/du_an.zip"));
  kiem(!mt2.daGui.some((m) => m.viec === "chan_doan"), "tat chan doan ma van ghi nhat ky");
}

// ---------------------------------------------------------------------------

console.log("=== TU KIEM TRA BO CHAN (chan_trang.js) ===");
console.log("-".repeat(70));
if (loi.length) {
  loi.forEach((l) => console.error("  [HONG] " + l));
  console.error(`TU KIEM TRA BO CHAN: ${loi.length} loi.`);
  process.exit(1);
}
console.log("TU KIEM TRA BO CHAN: TAT CA DEU DAT.");

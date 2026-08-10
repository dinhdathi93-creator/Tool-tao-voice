/* Chay ca tien ich that trong Chromium (Playwright): nap extension, tha 1 file
 * zip 6 anh co watermark vao trang xu ly, bam nut, roi do lai ket qua.
 *
 *     xvfb-run -a node chrome_xoa_watermark/kiem_tra/tu_kiem_tra_chrome.js
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const { anhGia, danWatermark, ghiPng } = require("./anh_gia.js");
const { anhKieuFlow, danSaoGoc } = require("./anh_kieu_flow.js");
const ZIP = require("../zip.js");

const GOC_EXT = path.resolve(__dirname, "..");
const THAT = { x: 940, y: 600, w: 300, h: 90 };   // vi tri watermark trong anh gia
const SO_ANH = 6;

const loi = [];
function kiem(dat, ghiChu) { if (!dat) loi.push(ghiChu); }

async function dungGoiKieuFlow(thuMuc) {
  const sach = [];
  const muc = [];
  let sao = null;
  for (let i = 0; i < 4; i++) {
    const goc = anhKieuFlow(i * 13 + 5);
    sach.push(ghiPng(goc));
    const ban = danSaoGoc(goc);
    sao = ban.sao;
    muc.push({
      ten: `flow/anh_${String(i + 1).padStart(3, "0")}.png`,
      du_lieu: new Uint8Array(ghiPng(ban)),
    });
  }
  const blob = await ZIP.taoZip(muc);
  const duongDan = path.join(thuMuc, "du_an_kieu_flow.zip");
  fs.writeFileSync(duongDan, Buffer.from(await blob.arrayBuffer()));
  return { duongDan, sach, sao };
}

/* Goi 8 anh DUNG KIEU KENH: vector phang, goc duoi phai cua moi anh giong het
 * nhau (nen navy + dai dat vang), hai anh cuoi co ban chan dung ngay duoi logo.
 * Day la dung loai anh cua nguoi dung - va vao la lo, phai go lop phu. */
async function dungGoiLopPhu(thuMuc) {
  const { anhKieuKenh, danSaoMo } = require("./anh_kieu_kenh.js");
  const sach = [];
  const muc = [];
  let sao = null;
  for (let i = 0; i < 8; i++) {
    const goc = anhKieuKenh(i * 7 + 3, i >= 6);
    sach.push(ghiPng(goc));
    const ban = danSaoMo(goc, { dam_giua: 0.55 });
    sao = ban.sao;
    muc.push({
      ten: `du_an/canh_${String(i + 1).padStart(3, "0")}.png`,
      du_lieu: new Uint8Array(ghiPng(ban)),
    });
  }
  const blob = await ZIP.taoZip(muc);
  const duongDan = path.join(thuMuc, "du_an_8_anh.zip");
  fs.writeFileSync(duongDan, Buffer.from(await blob.arrayBuffer()));
  return { duongDan, sach, sao };
}

async function dungGoiThu(thuMuc) {
  const sach = [];
  const muc = [];
  for (let i = 0; i < SO_ANH; i++) {
    const goc = anhGia(i * 7 + 3, 1280, 720);
    sach.push(ghiPng(goc));
    muc.push({
      ten: `du_an/anh_${String(i + 1).padStart(3, "0")}.png`,
      du_lieu: new Uint8Array(ghiPng(danWatermark(goc, THAT))),
    });
  }
  muc.push({ ten: "du_an/ghi_chu.txt", du_lieu: new TextEncoder().encode("file khac, phai giu nguyen") });

  const blob = await ZIP.taoZip(muc);
  const duongDan = path.join(thuMuc, "du_an_flow.zip");
  fs.writeFileSync(duongDan, Buffer.from(await blob.arrayBuffer()));
  return { duongDan, sach };
}

(async function () {
  console.log("=== TU KIEM TRA TRONG CHROMIUM ===");
  const thuMuc = fs.mkdtempSync(path.join(os.tmpdir(), "xw-"));
  const hoSo = path.join(thuMuc, "ho_so_chrome");
  const { duongDan, sach } = await dungGoiThu(thuMuc);
  console.log(`   Goi thu: ${duongDan} (${SO_ANH} anh 1280x720 + 1 file txt)`);

  const trinhDuyet = await chromium.launchPersistentContext(hoSo, {
    headless: false,
    executablePath: process.env.XW_CHROME || undefined,
    args: [
      `--disable-extensions-except=${GOC_EXT}`,
      `--load-extension=${GOC_EXT}`,
      "--no-sandbox",
    ],
  });

  try {
    // --- lay id cua tien ich ------------------------------------------------
    let sw = trinhDuyet.serviceWorkers()[0];
    if (!sw) sw = await trinhDuyet.waitForEvent("serviceworker", { timeout: 15000 });
    const maExt = new URL(sw.url()).host;
    console.log(`   Da nap tien ich, ma: ${maExt}`);

    const trang = await trinhDuyet.newPage();
    const loiTrang = [];
    trang.on("pageerror", (e) => loiTrang.push("pageerror: " + e.message));
    trang.on("console", (m) => {
      if (m.type() === "error") loiTrang.push("console: " + m.text());
    });

    // --- 1. Trang xu ly goi -------------------------------------------------
    await trang.goto(`chrome-extension://${maExt}/xu_ly_goi.html`);
    await trang.setInputFiles("#file", duongDan);

    await trang.waitForSelector("#xemTruoc:not(.an)", { timeout: 60000 });
    const moTa = await trang.textContent("#motaVung");
    console.log(`   ${moTa.trim()}`);

    const so = moTa.match(/x=(\d+), y=(\d+), rộng=(\d+), cao=(\d+)/);
    kiem(!!so, "khong doc duoc toa do vung tren man hinh");
    if (so) {
      const v = { x: +so[1], y: +so[2], w: +so[3], h: +so[4] };
      const tamX = THAT.x + THAT.w / 2, tamY = THAT.y + THAT.h / 2;
      kiem(v.x <= tamX && tamX <= v.x + v.w && v.y <= tamY && tamY <= v.y + v.h,
           `vung tu do (${JSON.stringify(v)}) khong trum tam watermark`);
      kiem(v.w * v.h <= 6 * THAT.w * THAT.h, "vung tu do qua rong");
    }
    kiem(moTa.includes(`Tổng ${SO_ANH} ảnh`), `phai dem dung ${SO_ANH} anh trong goi`);

    const coCanvas = await trang.evaluate(() => {
      const c = document.getElementById("canvasSach");
      return c.width > 0 && c.height > 0;
    });
    kiem(coCanvas, "khong ve duoc anh xem truoc");

    // --- 2. Chay that -------------------------------------------------------
    await trang.click("#chay");
    await trang.waitForSelector("#ketQua:not(.an)", { timeout: 180000 });
    const chuKq = await trang.textContent("#chuKetQua");
    console.log(`   ${chuKq.trim()}`);
    kiem(chuKq.includes(`Đã xử lý ${SO_ANH} ảnh`), "so anh bao xong khong dung");
    kiem(!chuKq.includes("lỗi"), "co anh bi loi khi xu ly: " + chuKq);

    // --- 3. Do ket qua ngay trong trinh duyet -------------------------------
    const sachB64 = sach.map((b) => b.toString("base64"));
    const doDac = await trang.evaluate(async ([b64, that, soAnh]) => {
      function tuB64(s) {
        const bin = atob(s);
        const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return u;
      }
      const url = document.getElementById("taiVe").href;
      const blob = await (await fetch(url)).blob();
      const muc = await window.XW_ZIP.docZip(blob);
      const anhMuc = muc.filter((m) => window.XW_ANH.laAnh(m.ten));
      const khac = muc.filter((m) => !window.XW_ANH.laAnh(m.ten));

      function sanh(a, b, v) {
        let tong = 0, dem = 0;
        for (let y = v.y; y < v.y + v.h; y++) {
          for (let x = v.x; x < v.x + v.w; x++) {
            const i = (y * a.rong + x) * 4;
            for (let c = 0; c < 3; c++) {
              tong += Math.abs(a.du_lieu[i + c] - b.du_lieu[i + c]);
              dem++;
            }
          }
        }
        return tong / Math.max(1, dem);
      }

      const lech = [];
      for (let i = 0; i < Math.min(3, anhMuc.length); i++) {
        const raSach = await window.XW_ANH.docAnh(await anhMuc[i].doc(), anhMuc[i].ten);
        const goc = await window.XW_ANH.docAnh(tuB64(b64[i]), "goc.png");
        lech.push({
          trong_vung: sanh(raSach, goc, that),
          ngoai_vung: sanh(raSach, goc, { x: 0, y: 0, w: 400, h: 400 }),
          rong: raSach.rong, cao: raSach.cao,
        });
      }
      return {
        so_anh: anhMuc.length, so_khac: khac.length,
        ten_khac: khac.map((m) => m.ten), lech, kich_thuoc_zip: blob.size,
      };
    }, [sachB64, THAT, SO_ANH]);

    console.log(`   Zip ket qua: ${(doDac.kich_thuoc_zip / 1024 / 1024).toFixed(1)} MB, `
      + `${doDac.so_anh} anh + ${doDac.so_khac} file khac (${doDac.ten_khac.join(", ")})`);
    doDac.lech.forEach((l, i) => {
      console.log(`   Anh ${i + 1}: lech trong vung watermark ${l.trong_vung.toFixed(1)}, `
        + `ngoai vung ${l.ngoai_vung.toFixed(1)} (thang 0-255), ${l.rong}x${l.cao}`);
    });

    kiem(doDac.so_anh === SO_ANH, `zip ra phai co du ${SO_ANH} anh`);
    kiem(doDac.so_khac === 1, "file khong phai anh phai duoc giu nguyen trong zip");
    doDac.lech.forEach((l, i) => {
      kiem(l.trong_vung < 22, `anh ${i + 1}: vung watermark con lech ${l.trong_vung.toFixed(1)}/255`);
      kiem(l.ngoai_vung < 1.5, `anh ${i + 1}: phan ngoai watermark bi doi (${l.ngoai_vung.toFixed(1)})`);
      kiem(l.rong === 1280 && l.cao === 720, `anh ${i + 1}: sai kich thuoc`);
    });

    // --- 4. Popup + nut gat -------------------------------------------------
    const popup = await trinhDuyet.newPage();
    const loiPopup = [];
    popup.on("pageerror", (e) => loiPopup.push(e.message));
    await popup.goto(`chrome-extension://${maExt}/popup.html`);
    await popup.waitForSelector("#gat");
    await popup.click("#gat");
    const daBat = await popup.evaluate(() => new Promise((xong) => {
      chrome.storage.local.get(["cai_dat"], (kq) => xong(!!(kq.cai_dat && kq.cai_dat.bat)));
    }));
    kiem(daBat, "bam nut gat trong popup khong luu duoc trang thai");
    kiem(loiPopup.length === 0, "popup co loi JS: " + loiPopup.join(" | "));

    // --- 5. Goi anh KIEU FLOW: logo chi la dau sao nho o goc ----------------
    const flow = await dungGoiKieuFlow(thuMuc);
    console.log(`   Goi kieu Flow: 4 anh 1376x768, dau sao that o `
      + `${JSON.stringify(flow.sao)}`);
    const t2 = await trinhDuyet.newPage();
    const loiT2 = [];
    t2.on("pageerror", (er) => loiT2.push(er.message));
    await t2.goto(`chrome-extension://${maExt}/xu_ly_goi.html`);
    await t2.setInputFiles("#file", flow.duongDan);
    await t2.waitForSelector("#xemTruoc:not(.an)", { timeout: 60000 });

    const moTa2 = await t2.textContent("#motaVung");
    console.log(`   ${moTa2.trim()}`);
    const so2 = moTa2.match(/x=(\d+), y=(\d+), rộng=(\d+), cao=(\d+)/);
    kiem(!!so2, "[kieu Flow] khong doc duoc toa do vung");
    if (so2) {
      const v = { x: +so2[1], y: +so2[2], w: +so2[3], h: +so2[4] };
      const tamX = flow.sao.x + flow.sao.w / 2, tamY = flow.sao.y + flow.sao.h / 2;
      kiem(v.x <= tamX && tamX <= v.x + v.w && v.y <= tamY && tamY <= v.y + v.h,
           `[kieu Flow] vung tu do (${JSON.stringify(v)}) khong trum dau sao`);
      kiem(v.w * v.h <= 8 * flow.sao.w * flow.sao.h,
           `[kieu Flow] khoanh qua rong: ${JSON.stringify(v)} - co ve bam nham duong ranh nen/dat`);
    }

    // keo chuot khoanh tay tren anh xem truoc -> vung phai doi theo
    await t2.locator("#canvasKhung").scrollIntoViewIfNeeded();
    const hop = await t2.locator("#canvasKhung").boundingBox();
    await t2.mouse.move(hop.x + hop.width * 0.10, hop.y + hop.height * 0.10);
    await t2.mouse.down();
    await t2.mouse.move(hop.x + hop.width * 0.30, hop.y + hop.height * 0.40, { steps: 8 });
    await t2.mouse.up();
    const moTa3 = await t2.textContent("#motaVung");
    kiem(moTa3.includes("bạn tự khoanh tay"), "keo chuot khoanh vung khong an");
    const so3 = moTa3.match(/x=(\d+), y=(\d+), rộng=(\d+), cao=(\d+)/);
    if (so3) {
      const v = { x: +so3[1], y: +so3[2], w: +so3[3], h: +so3[4] };
      console.log(`   Keo chuot 10%-30% ngang, 10%-40% doc -> vung ${JSON.stringify(v)}`);
      kiem(Math.abs(v.x - 0.10 * 1376) < 30 && Math.abs(v.y - 0.10 * 768) < 30,
           `[keo chuot] goc tren trai lech qua nhieu: ${JSON.stringify(v)}`);
      kiem(Math.abs(v.w - 0.20 * 1376) < 40 && Math.abs(v.h - 0.30 * 768) < 40,
           `[keo chuot] kich thuoc lech qua nhieu: ${JSON.stringify(v)}`);
    }
    // chay that va do lai: vung watermark phai sach, ranh gioi xanh/vang khong nhoe
    // doi lua chon trong menu phai TU BO khung keo tay, khong de no lang le thang
    await t2.selectOption("#vung", "logo-duoi-phai");
    kiem((await t2.inputValue("#vungTuGo")) === "",
         "doi menu ma khung keo tay van con trong o toa do");
    await t2.selectOption("#vung", "tu-dong");
    await t2.click("#lamLai");
    await t2.waitForSelector("#xemTruoc:not(.an)", { timeout: 60000 });
    const moTaChay = await t2.textContent("#motaVung");
    console.log(`   Truoc khi chay that: ${moTaChay.trim()}`);
    kiem(/rộng=\d{1,3}, cao=\d{1,3}\b/.test(moTaChay) && moTaChay.includes("do duoc tu"),
         "sau khi bo vung keo tay phai quay lai vung tu do: " + moTaChay);
    await t2.click("#chay");
    await t2.waitForSelector("#ketQua:not(.an)", { timeout: 180000 });

    const sachFlowB64 = flow.sach.map((b) => b.toString("base64"));
    const doFlow = await t2.evaluate(async ([b64, sao, dat]) => {
      function tuB64(s) {
        const bin = atob(s);
        const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return u;
      }
      function sanh(a, b, v) {
        let tong = 0, dem = 0;
        for (let y = v.y; y < v.y + v.h; y++) {
          for (let x = v.x; x < v.x + v.w; x++) {
            const i = (y * a.rong + x) * 4;
            for (let c = 0; c < 3; c++) { tong += Math.abs(a.du_lieu[i + c] - b.du_lieu[i + c]); dem++; }
          }
        }
        return tong / Math.max(1, dem);
      }
      const blob = await (await fetch(document.getElementById("taiVe").href)).blob();
      const muc = (await window.XW_ZIP.docZip(blob)).filter((m) => window.XW_ANH.laAnh(m.ten));
      const ra = [];
      for (let i = 0; i < Math.min(3, muc.length); i++) {
        const raSach = await window.XW_ANH.docAnh(await muc[i].doc(), muc[i].ten);
        const goc = await window.XW_ANH.docAnh(tuB64(b64[i]), "goc.png");
        const qx = Math.max(0, sao.x - 40), qy = Math.max(0, sao.y - 40);
        const quanh = {
          x: qx, y: qy,
          w: Math.min(sao.w + 80, raSach.rong - qx),
          h: Math.min(sao.h + 80, raSach.cao - qy),
        };
        ra.push({
          quanh_logo: sanh(raSach, goc, quanh),
          ranh_gioi: sanh(raSach, goc, { x: 0, y: dat - 3, w: 1376, h: 6 }),
        });
      }
      return ra;
    }, [sachFlowB64, flow.sao, Math.round(768 * 0.87)]);

    doFlow.forEach((l, i) => {
      console.log(`   Anh Flow ${i + 1}: quanh logo ${l.quanh_logo.toFixed(2)}, `
        + `duong ranh xanh/vang ${l.ranh_gioi.toFixed(2)} (thang 0-255)`);
      kiem(l.quanh_logo < 0.5, `[kieu Flow] con vet quanh cho logo (${l.quanh_logo.toFixed(2)}/255)`);
      kiem(l.ranh_gioi < 1, `[kieu Flow] duong ranh xanh/vang bi nhoe (${l.ranh_gioi.toFixed(2)}/255)`);
    });

    kiem(loiT2.length === 0, "trang kieu Flow co loi JS: " + loiT2.join(" | "));

    // --- 6. Ca lo du anh: tien ich phai HOC LOP PHU roi go, khong va nua ----
    const lo = await dungGoiLopPhu(thuMuc);
    console.log(`   Goi 8 anh kieu kenh (vector phang, goc anh giong het nhau, `
      + `2 anh co ban chan duoi logo), sao that ${JSON.stringify(lo.sao)}`);
    const t3 = await trinhDuyet.newPage();
    const loiT3 = [];
    t3.on("pageerror", (er) => loiT3.push(er.message));
    await t3.goto(`chrome-extension://${maExt}/xu_ly_goi.html`);
    await t3.setInputFiles("#file", lo.duongDan);
    await t3.waitForSelector("#xemTruoc:not(.an)", { timeout: 60000 });
    await t3.click("#chay");
    await t3.waitForSelector("#ketQua:not(.an)", { timeout: 300000 });

    const chuLo = await t3.textContent("#chuKetQua");
    console.log(`   ${chuLo.trim()}`);
    kiem(/Cách dùng: gỡ lớp phủ \(học từ \d+ ảnh\)/.test(chuLo),
         "ca lo 8 anh ma tien ich van va nen: " + chuLo);

    const doLo = await t3.evaluate(async ([b64, sao]) => {
      function tuB64(s) {
        const bin = atob(s); const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return u;
      }
      function sanh(a, b, v) {
        let tong = 0, dem = 0;
        for (let y = v.y; y < v.y + v.h; y++) {
          for (let x = v.x; x < v.x + v.w; x++) {
            const i = (y * a.rong + x) * 4;
            for (let c = 0; c < 3; c++) { tong += Math.abs(a.du_lieu[i + c] - b.du_lieu[i + c]); dem++; }
          }
        }
        return tong / Math.max(1, dem);
      }
      const blob = await (await fetch(document.getElementById("taiVe").href)).blob();
      const muc = (await window.XW_ZIP.docZip(blob)).filter((m) => window.XW_ANH.laAnh(m.ten));
      const ra = [];
      for (let i = 0; i < muc.length; i++) {
        const raSach = await window.XW_ANH.docAnh(await muc[i].doc(), muc[i].ten);
        const goc = await window.XW_ANH.docAnh(tuB64(b64[i]), "goc.png");
        ra.push({
          ten: muc[i].ten,
          quanh_logo: sanh(raSach, goc,
            { x: sao.x - 10, y: sao.y - 10, w: sao.w + 20, h: sao.h + 20 }),
          ca_anh: sanh(raSach, goc, { x: 0, y: 0, w: raSach.rong, h: raSach.cao }),
        });
      }
      return ra;
    }, [lo.sach.map((b) => b.toString("base64")), lo.sao]);

    let teNhat = 0;
    doLo.forEach((l) => { teNhat = Math.max(teNhat, l.quanh_logo);
      kiem(l.ca_anh < 0.05, `[ca lo] ${l.ten}: go lop phu ma dung ca anh (${l.ca_anh.toFixed(3)})`);
    });
    console.log(`   ${doLo.length} anh da go lop phu, cho te nhat con lech `
      + `${teNhat.toFixed(2)}/255`);
    kiem(teNhat < 1, `[ca lo] con lech ${teNhat.toFixed(2)}/255 quanh logo`);
    kiem(loiT3.length === 0, "trang ca lo co loi JS: " + loiT3.join(" | "));

    kiem(loiTrang.length === 0, "trang xu ly co loi JS: " + loiTrang.join(" | "));
  } catch (er) {
    loi.push("chay thu that bai: " + (er && er.message ? er.message : er));
  } finally {
    await trinhDuyet.close();
  }

  console.log("-".repeat(70));
  if (loi.length) {
    loi.forEach((l) => console.error("  [HONG] " + l));
    console.error(`TU KIEM TRA CHROMIUM: ${loi.length} loi.`);
    process.exit(1);
  }
  console.log("TU KIEM TRA CHROMIUM: TAT CA DEU DAT.");
})();

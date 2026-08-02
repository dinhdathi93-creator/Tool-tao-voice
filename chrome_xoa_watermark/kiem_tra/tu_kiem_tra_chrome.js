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
const ZIP = require("../zip.js");

const GOC_EXT = path.resolve(__dirname, "..");
const THAT = { x: 940, y: 600, w: 300, h: 90 };   // vi tri watermark trong anh gia
const SO_ANH = 6;

const loi = [];
function kiem(dat, ghiChu) { if (!dat) loi.push(ghiChu); }

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

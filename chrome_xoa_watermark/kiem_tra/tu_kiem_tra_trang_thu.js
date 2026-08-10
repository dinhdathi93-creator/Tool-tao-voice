/* Kiem tra trang doc lap THU_1_ANH.html trong Chromium:
 *     xvfb-run -a node chrome_xoa_watermark/kiem_tra/tu_kiem_tra_trang_thu.js
 *
 * Mo trang bang file:// (dung y het luc nguoi dung bam dup), nap mot anh kieu
 * Flow co dau sao o goc, roi do lai anh tai ve xem con vet khong.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const { anhKieuFlow, danSaoGoc } = require("./anh_kieu_flow.js");
const { ghiPng } = require("./anh_gia.js");

const TRANG = path.resolve(__dirname, "..", "..", "THU_1_ANH.html");

const loi = [];
function kiem(dat, ghiChu) { if (!dat) loi.push(ghiChu); }

(async function () {
  console.log("=== TU KIEM TRA TRANG THU 1 ANH ===");
  if (!fs.existsSync(TRANG)) {
    console.error("  [HONG] chua co THU_1_ANH.html - chay: node chrome_xoa_watermark/tao_trang_thu.js");
    process.exit(1);
  }

  const thuMuc = fs.mkdtempSync(path.join(os.tmpdir(), "xwt-"));
  const goc = anhKieuFlow(9, 1376, 768);
  const ban = danSaoGoc(goc);
  const duongDan = path.join(thuMuc, "anh_thu.png");
  fs.writeFileSync(duongDan, ghiPng(ban));
  console.log(`   Anh thu: 1376x768, dau sao that o ${JSON.stringify(ban.sao)}`);

  const trinhDuyet = await chromium.launch({ headless: false, args: ["--no-sandbox"] });
  try {
    const trang = await trinhDuyet.newPage({ viewport: { width: 1200, height: 1000 } });
    const loiTrang = [];
    trang.on("pageerror", (er) => loiTrang.push("pageerror: " + er.message));
    trang.on("console", (m) => { if (m.type() === "error") loiTrang.push("console: " + m.text()); });

    await trang.goto("file://" + TRANG);
    await trang.setInputFiles("#file", duongDan);
    await trang.waitForSelector("#banLam:not(.an)", { timeout: 30000 });

    const moTa = await trang.textContent("#mota");
    console.log(`   ${moTa.trim()}`);
    const so = moTa.match(/x=(\d+), y=(\d+), rộng=(\d+), cao=(\d+)/);
    kiem(!!so, "khong doc duoc toa do vung");
    if (so) {
      const v = { x: +so[1], y: +so[2], w: +so[3], h: +so[4] };
      const tamX = ban.sao.x + ban.sao.w / 2, tamY = ban.sao.y + ban.sao.h / 2;
      kiem(v.x <= tamX && tamX <= v.x + v.w && v.y <= tamY && tamY <= v.y + v.h,
           `khung mac dinh (${JSON.stringify(v)}) khong trum dau sao ${JSON.stringify(ban.sao)}`);
    }

    // anh tai ve phai sach: do lai ngay trong trang
    const gocB64 = ghiPng(goc).toString("base64");
    const doDac = await trang.evaluate(async ([b64, sao]) => {
      function tuB64(s) {
        const bin = atob(s);
        const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return u;
      }
      async function doc(nguon) {
        const bm = await createImageBitmap(nguon instanceof Blob ? nguon : new Blob([nguon]));
        const c = document.createElement("canvas");
        c.width = bm.width; c.height = bm.height;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(bm, 0, 0); bm.close();
        const id = ctx.getImageData(0, 0, c.width, c.height);
        return { rong: id.width, cao: id.height, du_lieu: id.data };
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
      const raSach = await doc(await (await fetch(document.getElementById("taiVe").href)).blob());
      const gocAnh = await doc(tuB64(b64));
      const qx = Math.max(0, sao.x - 40), qy = Math.max(0, sao.y - 40);
      return {
        rong: raSach.rong, cao: raSach.cao,
        quanh_logo: sanh(raSach, gocAnh, {
          x: qx, y: qy,
          w: Math.min(sao.w + 80, raSach.rong - qx),
          h: Math.min(sao.h + 80, raSach.cao - qy),
        }),
        ca_anh: sanh(raSach, gocAnh, { x: 0, y: 0, w: raSach.rong, h: raSach.cao }),
        ten_tai: document.getElementById("taiVe").getAttribute("download"),
      };
    }, [gocB64, ban.sao]);

    console.log(`   Anh tai ve: ${doDac.rong}x${doDac.cao}, ten "${doDac.ten_tai}"`);
    console.log(`   Lech quanh logo ${doDac.quanh_logo.toFixed(2)}, ca anh `
      + `${doDac.ca_anh.toFixed(3)} (thang 0-255)`);
    kiem(doDac.rong === 1376 && doDac.cao === 768, "anh tai ve sai kich thuoc");
    kiem(doDac.quanh_logo < 0.5, `con vet quanh logo (${doDac.quanh_logo.toFixed(2)}/255)`);
    kiem(doDac.ca_anh < 0.02, `phan con lai cua anh bi doi (${doDac.ca_anh.toFixed(3)}/255)`);
    kiem(/_da_xoa\.png$/.test(doDac.ten_tai || ""), "ten file tai ve khong dung quy uoc");

    // keo chuot khoanh tay -> vung phai doi theo
    await trang.locator("#cKhung").scrollIntoViewIfNeeded();
    const hop = await trang.locator("#cKhung").boundingBox();
    await trang.mouse.move(hop.x + hop.width * 0.15, hop.y + hop.height * 0.20);
    await trang.mouse.down();
    await trang.mouse.move(hop.x + hop.width * 0.35, hop.y + hop.height * 0.50, { steps: 8 });
    await trang.mouse.up();
    const moTa2 = await trang.textContent("#mota");
    kiem(moTa2.includes("bạn tự khoanh"), "keo chuot khoanh vung khong an");
    const so2 = moTa2.match(/x=(\d+), y=(\d+), rộng=(\d+), cao=(\d+)/);
    if (so2) {
      const v = { x: +so2[1], y: +so2[2], w: +so2[3], h: +so2[4] };
      console.log(`   Keo chuot -> vung ${JSON.stringify(v)}`);
      kiem(Math.abs(v.x - 0.15 * 1376) < 30 && Math.abs(v.w - 0.20 * 1376) < 40,
           `[keo chuot] khung lech qua nhieu: ${JSON.stringify(v)}`);
    }
    const oToaDo = await trang.inputValue("#vungTuGo");
    kiem(/^\d+,\d+,\d+,\d+$/.test(oToaDo), "keo xong phai dien toa do vao o de con chep di");

    kiem(loiTrang.length === 0, "trang co loi JS: " + loiTrang.join(" | "));
  } catch (er) {
    loi.push("chay thu that bai: " + (er && er.message ? er.message : er));
  } finally {
    await trinhDuyet.close();
  }

  console.log("-".repeat(70));
  if (loi.length) {
    loi.forEach((l) => console.error("  [HONG] " + l));
    console.error(`TU KIEM TRA TRANG THU: ${loi.length} loi.`);
    process.exit(1);
  }
  console.log("TU KIEM TRA TRANG THU: TAT CA DEU DAT.");
})();

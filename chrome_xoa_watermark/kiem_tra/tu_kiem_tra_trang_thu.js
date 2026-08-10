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
const { anhHangNguoi, danSaoDeLenChan } = require("./anh_co_vat_the.js");
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

  const trinhDuyet = await chromium.launch({
    headless: false, args: ["--no-sandbox"],
    executablePath: process.env.XW_CHROME || undefined,
  });
  try {
    const trang = await trinhDuyet.newPage({ viewport: { width: 1200, height: 1000 } });
    const loiTrang = [];
    trang.on("pageerror", (er) => loiTrang.push("pageerror: " + er.message));
    trang.on("console", (m) => { if (m.type() === "error") loiTrang.push("console: " + m.text()); });

    await trang.goto("file://" + TRANG);
    await trang.setInputFiles("#file", duongDan);
    await trang.waitForSelector("#banLam:not(.an)", { timeout: 30000 });
    await trang.waitForFunction(() => !/Đang mở/.test(document.getElementById("mota").textContent),
                                null, { timeout: 30000 });

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

    // --- Nhieu anh, trong do co ANH KHO: logo de len chan hinh que -----------
    // Day la tinh huong that: logo luon o mot cho, thinh thoang co vat the dung
    // ngay do. So ca bo se lay duoc khung dung tu nhung anh de.
    const nhieu = [];
    for (let i = 0; i < 3; i++) {
      const b = danSaoGoc(anhKieuFlow(i * 13 + 5, 1376, 768));
      const p = path.join(thuMuc, `de_${i + 1}.png`);
      fs.writeFileSync(p, ghiPng(b));
      nhieu.push(p);
    }
    const gocKho = anhHangNguoi(3);
    const banKho = danSaoDeLenChan(gocKho);
    const pKho = path.join(thuMuc, "kho_logo_de_len_chan.png");
    fs.writeFileSync(pKho, ghiPng(banKho));
    nhieu.push(pKho);
    console.log(`   Bo 4 anh: 3 anh de + 1 anh logo de len chan nguoi `
      + `(sao that ${JSON.stringify(banKho.sao)})`);

    const t2 = await trinhDuyet.newPage({ viewport: { width: 1200, height: 1000 } });
    const loiT2 = [];
    t2.on("pageerror", (er) => loiT2.push(er.message));
    await t2.goto("file://" + TRANG);
    await t2.setInputFiles("#file", nhieu);
    await t2.waitForSelector("#banLam:not(.an)", { timeout: 30000 });
    await t2.waitForFunction(() => !/Đang mở/.test(document.getElementById("mota").textContent),
                             null, { timeout: 30000 });

    const moTaBo = await t2.textContent("#mota");
    console.log(`   ${moTaBo.trim()}`);
    kiem(/so \d+ ảnh với nhau/.test(moTaBo), "co >=3 anh ma khong so ca bo: " + moTaBo);
    kiem((await t2.textContent("#soAnh")).includes("/ 4"), "khong dem du 4 anh");
    const khungBo = moTaBo.match(/x=(\d+), y=(\d+), rộng=(\d+), cao=(\d+)/);
    kiem(!!khungBo, "khong doc duoc khung do tu ca bo");
    if (khungBo) {
      const v = { x: +khungBo[1], y: +khungBo[2], w: +khungBo[3], h: +khungBo[4] };
      const s0 = banKho.sao;
      kiem(v.x <= s0.x && v.y <= s0.y && v.x + v.w >= s0.x + s0.w && v.y + v.h >= s0.y + s0.h,
           `khung do tu ca bo (${JSON.stringify(v)}) khong trum dau sao ${JSON.stringify(s0)}`);
      kiem(v.w * v.h < 0.01 * 1376 * 768, `khung do tu ca bo qua to: ${JSON.stringify(v)}`);
    }

    // lat sang anh KHO: khung phai giu nguyen, va anh ra phai dung lai duoc chan
    await t2.click("#anhSau"); await t2.click("#anhSau"); await t2.click("#anhSau");
    const moTaKho = (await t2.textContent("#mota"));
    const khungKho = moTaKho.match(/x=(\d+), y=(\d+), rộng=(\d+), cao=(\d+)/);
    kiem((await t2.textContent("#soAnh")).includes("Ảnh 4"), "lat khong toi anh thu 4");
    kiem(khungKho && khungBo && khungKho[1] === khungBo[1] && khungKho[3] === khungBo[3],
         "lat sang anh khac ma khung bi doi");

    const gocKhoB64 = ghiPng(gocKho).toString("base64");
    const doKho = await t2.evaluate(async ([b64, sao]) => {
      function tuB64(s) {
        const bin = atob(s); const u = new Uint8Array(bin.length);
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
      const qx = Math.max(0, sao.x - 50), qy = Math.max(0, sao.y - 50);
      return {
        quanh_logo: sanh(raSach, gocAnh, {
          x: qx, y: qy,
          w: Math.min(sao.w + 100, raSach.rong - qx),
          h: Math.min(sao.h + 100, raSach.cao - qy),
        }),
        ca_anh: sanh(raSach, gocAnh, { x: 0, y: 0, w: raSach.rong, h: raSach.cao }),
      };
    }, [gocKhoB64, banKho.sao]);

    console.log(`   Anh kho (logo de len chan): lech quanh logo `
      + `${doKho.quanh_logo.toFixed(2)}, ca anh ${doKho.ca_anh.toFixed(3)}`);
    kiem(doKho.quanh_logo < 3,
         `anh kho: con vet quanh logo (${doKho.quanh_logo.toFixed(2)}/255) - chan chua dung lai duoc`);
    kiem(doKho.ca_anh < 0.05, `anh kho: phan con lai bi doi (${doKho.ca_anh.toFixed(3)}/255)`);
    kiem(loiT2.length === 0, "trang nhieu anh co loi JS: " + loiT2.join(" | "));

    // --- Du anh -> trang phai HOC LOP PHU chu khong va nua -------------------
    // Bo 8 anh cung du an, hai anh cuoi co cot trang di ngay qua cho logo.
    const { danLopPhu, anhNenDoi } = require("./lop_phu.js");
    const gocLo = [];
    for (let i = 0; i < 6; i++) gocLo.push(anhNenDoi(i * 7 + 3, false));
    gocLo.push(anhNenDoi(101, true));
    gocLo.push(anhNenDoi(202, true));
    const duongDanLo = gocLo.map((g, i) => {
      const p = path.join(thuMuc, `lo_${i + 1}.png`);
      fs.writeFileSync(p, ghiPng(danLopPhu(g, { dam_giua: 1 })));
      return p;
    });
    const saoLo = danLopPhu(gocLo[0], { dam_giua: 1 }).sao;

    const t3 = await trinhDuyet.newPage({ viewport: { width: 1200, height: 1000 } });
    const loiT3 = [];
    t3.on("pageerror", (er) => loiT3.push(er.message));
    await t3.goto("file://" + TRANG);
    await t3.setInputFiles("#file", duongDanLo);
    await t3.waitForSelector("#banLam:not(.an)", { timeout: 60000 });
    await t3.waitForFunction(
      () => !/Đang mở|Đang học/.test(document.getElementById("mota").textContent),
      null, { timeout: 120000 });

    const moTaLo = await t3.textContent("#mota");
    console.log(`   ${moTaLo.trim()}`);
    kiem(/cách: gỡ lớp phủ, học từ \d+ ảnh/.test(moTaLo),
         "du 8 anh ma trang van khong go lop phu: " + moTaLo);

    // lat sang anh KHO (thu 8) roi do anh tai ve
    await t3.click("#anhTruoc");        // lui 1 tu anh 1 -> anh 8
    kiem((await t3.textContent("#soAnh")).includes("Ảnh 8"), "lat khong toi anh thu 8");
    const doLo = await t3.evaluate(async ([b64, sao]) => {
      function tuB64(s) {
        const bin = atob(s); const u = new Uint8Array(bin.length);
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
      return {
        quanh_logo: sanh(raSach, gocAnh, { x: sao.x - 10, y: sao.y - 10, w: sao.w + 20, h: sao.h + 20 }),
        ca_anh: sanh(raSach, gocAnh, { x: 0, y: 0, w: raSach.rong, h: raSach.cao }),
      };
    }, [ghiPng(gocLo[7]).toString("base64"), saoLo]);

    console.log(`   Anh 8 (cot trang di qua logo): lech quanh logo `
      + `${doLo.quanh_logo.toFixed(2)}, ca anh ${doLo.ca_anh.toFixed(3)}`);
    kiem(doLo.quanh_logo < 5,
         `go lop phu tren trang: con lech ${doLo.quanh_logo.toFixed(2)}/255`);
    kiem(doLo.ca_anh < 0.05, `go lop phu ma dung ca anh (${doLo.ca_anh.toFixed(3)}/255)`);
    kiem(loiT3.length === 0, "trang go lop phu co loi JS: " + loiT3.join(" | "));

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

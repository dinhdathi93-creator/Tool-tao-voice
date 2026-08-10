/* Dung file THU_1_ANH.html - mot trang HTML doc lap, bam dup la chay.
 *
 *     node chrome_xoa_watermark/tao_trang_thu.js
 *
 * Trang do nhung nguyen loi_xoa.js vao ben trong nen khong can cai tien ich,
 * khong can mang, khong can Python. Chay lai lenh nay moi khi sua loi_xoa.js.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const GOC = path.resolve(__dirname, "..");
const LOI_XOA = fs.readFileSync(path.join(__dirname, "loi_xoa.js"), "utf8");

const GIAO_DIEN = String.raw`
<div class="bao">
  <header>
    <h1>Thử xoá watermark trên 1 ảnh</h1>
    <p>Thả <b>một</b> ảnh vào đây để soi kỹ trước khi chạy cả dự án. Mọi thứ xử lý ngay
      trong trình duyệt của bạn — ảnh không đi đâu cả, không cần mạng.</p>
  </header>

  <div id="tha" class="tha">
    <div class="tha-chu">Kéo thả 1 ảnh vào đây</div>
    <div class="tha-phu">hoặc</div>
    <button id="chon" class="nut-chinh" type="button">Chọn ảnh…</button>
    <input id="file" type="file" accept="image/*" hidden>
  </div>

  <section id="banLam" class="the an">
    <h2>Cài đặt</h2>
    <div class="luoi">
      <div>
        <label for="vung">Watermark nằm ở đâu</label>
        <select id="vung">
          <option value="tu-tim">Tự tìm logo trên ảnh này (nên dùng)</option>
          <option value="logo-duoi-phai">Ô nhỏ góc dưới phải (dấu ✦ của Flow)</option>
          <option value="logo-duoi-trai">Logo nhỏ góc dưới trái</option>
          <option value="logo-tren-phai">Logo nhỏ góc trên phải</option>
          <option value="logo-tren-trai">Logo nhỏ góc trên trái</option>
          <option value="duoi-phai">Cả góc dưới bên phải</option>
          <option value="duoi">Cả dải dưới</option>
          <option value="giua">Chính giữa</option>
        </select>
        <input id="vungTuGo" type="text" placeholder="hoặc gõ x,y,rộng,cao — vd 1314,706,42,42">
      </div>
      <div>
        <label for="cach">Cách xử lý</label>
        <select id="cach">
          <option value="va">Vá theo cấu trúc nền (nên dùng)</option>
          <option value="va-mem">Vá mềm — khuếch tán</option>
          <option value="to">Tô màu nền</option>
        </select>
      </div>
      <div>
        <label for="locMau">Chỉ vá đúng nét chữ</label>
        <select id="locMau">
          <option value="tat">Vá cả ô (chắc ăn)</option>
          <option value="sang">Chỉ nét sáng / trắng</option>
          <option value="toi">Chỉ nét tối / đen</option>
        </select>
      </div>
      <div>
        <label for="noRong">Nở mặt nạ (pixel)</label>
        <input id="noRong" type="number" min="0" max="12" value="2">
      </div>
    </div>

    <p id="mota" class="mota"></p>

    <div class="canh-canh">
      <figure>
        <figcaption><b>Kéo chuột trên ảnh này để khoanh vùng</b></figcaption>
        <canvas id="cKhung"></canvas>
      </figure>
      <figure>
        <figcaption>Sau khi xoá</figcaption>
        <canvas id="cSach"></canvas>
      </figure>
    </div>

    <h2 class="cach-tren">Soi ở mức pixel (phóng to 4×)</h2>
    <div class="canh-canh">
      <figure><figcaption>Trước</figcaption><canvas id="zTruoc"></canvas></figure>
      <figure><figcaption>Sau</figcaption><canvas id="zSau"></canvas></figure>
    </div>

    <div class="hang-nut">
      <a id="taiVe" class="nut-chinh" download>⬇ Tải ảnh đã xoá</a>
      <button id="tuTim" class="nut-phu" type="button">Tự tìm lại logo</button>
      <button id="chepToaDo" class="nut-phu" type="button">Chép toạ độ vùng</button>
      <button id="anhKhac" class="nut-phu" type="button">Thử ảnh khác</button>
    </div>

    <div id="canhBao" class="canh-bao an"></div>
    <div class="ghi-chu" id="ghiChu"></div>
  </section>
</div>
`;

const KIEU = String.raw`
* { box-sizing: border-box; }
body { margin: 0; background: #14161a; color: #e8eaed;
  font: 14px/1.55 "Segoe UI", Roboto, -apple-system, system-ui, sans-serif; }
.bao { max-width: 1100px; margin: 0 auto; padding: 28px 20px 60px; }
h1 { font-size: 22px; margin: 0 0 6px; }
h2 { font-size: 15px; margin: 0 0 12px; color: #9aa0a6; text-transform: uppercase;
  letter-spacing: .5px; }
h2.cach-tren { margin-top: 26px; }
header p { margin: 0 0 22px; color: #9aa0a6; max-width: 660px; }
.tha { border: 2px dashed #3c4043; border-radius: 14px; padding: 34px 20px; text-align: center;
  transition: border-color .15s ease, background .15s ease; }
.tha.dang-keo { border-color: #8ab4f8; background: #1b2430; }
.tha-chu { font-size: 16px; font-weight: 600; }
.tha-phu { color: #9aa0a6; margin: 8px 0 12px; font-size: 12px; }
.the { margin-top: 22px; padding: 18px; border: 1px solid #2a2e35; border-radius: 12px;
  background: #1a1d22; }
.an { display: none !important; }
.luoi { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .4px;
  color: #9aa0a6; margin-bottom: 5px; }
select, input[type="text"], input[type="number"] { width: 100%; padding: 8px; border-radius: 7px;
  border: 1px solid #2a2e35; background: #1e2126; color: #e8eaed; font: inherit; }
input[type="text"] { margin-top: 6px; }
.nut-chinh { display: inline-block; padding: 10px 18px; border: none; border-radius: 8px;
  background: #8ab4f8; color: #14161a; font: inherit; font-weight: 600; cursor: pointer;
  text-decoration: none; }
.nut-chinh:hover { background: #a8c7fa; }
.nut-phu { padding: 10px 16px; border: 1px solid #3c4043; border-radius: 8px;
  background: transparent; color: #e8eaed; font: inherit; cursor: pointer; }
.hang-nut { display: flex; gap: 10px; align-items: center; margin-top: 18px; flex-wrap: wrap; }
.mota { color: #9aa0a6; margin: 16px 0 14px; }
.canh-canh { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
.canh-canh figure { margin: 0; }
.canh-canh figcaption { font-size: 12px; color: #9aa0a6; margin-bottom: 6px; }
.canh-canh canvas { width: 100%; height: auto; border-radius: 8px; border: 1px solid #2a2e35;
  background: #0d0f12; display: block; }
#cKhung { cursor: crosshair; }
#zTruoc, #zSau { image-rendering: pixelated; }
.ghi-chu { margin-top: 16px; font-size: 12px; color: #9aa0a6; }
.canh-bao { margin-top: 16px; padding: 10px 12px; border-radius: 8px; font-size: 13px;
  background: #2b2416; border: 1px solid #5c4a1e; color: #fdd663; }
.ghi-chu b { color: #e8eaed; }
`;

const DIEU_KHIEN = String.raw`
(function () {
  "use strict";
  var LOI = window.XW_LOI;
  var e = function (id) { return document.getElementById(id); };
  var anhGoc = null, anhSach = null, vung = null, tenFile = "anh.png";

  function doiKichThuoc(canvas, anh, rongToiDa) {
    var tiLe = Math.min(1, (rongToiDa || 500) / anh.rong);
    canvas.width = Math.round(anh.rong * tiLe);
    canvas.height = Math.round(anh.cao * tiLe);
    return tiLe;
  }

  function ve(canvas, anh, rongToiDa) {
    doiKichThuoc(canvas, anh, rongToiDa);
    var tam = document.createElement("canvas");
    tam.width = anh.rong; tam.height = anh.cao;
    tam.getContext("2d").putImageData(
      new ImageData(new Uint8ClampedArray(anh.du_lieu), anh.rong, anh.cao), 0, 0);
    canvas.getContext("2d").drawImage(tam, 0, 0, canvas.width, canvas.height);
    return tam;
  }

  function veMotO(canvas, anh, o, tiLe) {
    canvas.width = Math.round(o.w * tiLe);
    canvas.height = Math.round(o.h * tiLe);
    var tam = document.createElement("canvas");
    tam.width = anh.rong; tam.height = anh.cao;
    tam.getContext("2d").putImageData(
      new ImageData(new Uint8ClampedArray(anh.du_lieu), anh.rong, anh.cao), 0, 0);
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tam, o.x, o.y, o.w, o.h, 0, 0, canvas.width, canvas.height);
  }

  function docCaiDat() {
    var tuGo = e("vungTuGo").value.trim();
    return {
      vung: tuGo || e("vung").value,
      cach: e("cach").value,
      loc_mau: e("locMau").value,
      no_rong: Math.max(0, Math.min(12, parseInt(e("noRong").value, 10) || 0)),
    };
  }

  function tuTimLogo() {
    var kq = LOI.timLogoMotAnh(anhGoc);
    if (kq.vung) {
      vung = kq.vung;
      return kq.ghi_chu;
    }
    vung = LOI.phanTichVung("logo-duoi-phai", anhGoc.rong, anhGoc.cao);
    return "không tự tìm được logo — đang dùng ô nhỏ góc dưới phải, kéo chuột để chỉnh";
  }

  function lamLai(ghiChu) {
    if (!anhGoc) return;
    var cd = docCaiDat();
    if (!vung || ghiChu === "doi-cai-dat") {
      if (cd.vung === "tu-tim") {
        ghiChu = tuTimLogo();
      } else {
        vung = LOI.phanTichVung(cd.vung, anhGoc.rong, anhGoc.cao)
            || LOI.phanTichVung("logo-duoi-phai", anhGoc.rong, anhGoc.cao);
      }
    }
    vung = LOI.gioiHan(vung, anhGoc.rong, anhGoc.cao);

    anhSach = LOI.xoaWatermark(anhGoc, {
      vung_pixel: vung, cach: cd.cach, loc_mau: cd.loc_mau, no_rong: cd.no_rong,
    });

    e("mota").textContent = "Ảnh " + anhGoc.rong + "×" + anhGoc.cao
      + " — vùng vá: x=" + vung.x + ", y=" + vung.y + ", rộng=" + vung.w + ", cao=" + vung.h
      + (ghiChu === "keo-tay" ? " (bạn tự khoanh)"
         : (ghiChu && ghiChu !== "doi-cai-dat" ? " (" + ghiChu + ")" : ""));

    // Khung to bat thuong = dang trum ca noi dung that (bac thang, nguoi...).
    // Va cho do thi kieu gi cung lo, nen phai noi ngay chu khong de nguoi dung
    // chay ca lo roi moi phat hien.
    var tiLeKhung = (vung.w * vung.h) / (anhGoc.rong * anhGoc.cao);
    if (tiLeKhung > 0.03) {
      e("canhBao").textContent = "⚠ Khung này chiếm " + (tiLeKhung * 100).toFixed(1)
        + "% ảnh — to hơn nhiều so với một cái logo. Nếu trong khung có chi tiết thật "
        + "(bậc thang, người, chữ…) thì vá xong chắc chắn lộ. Hãy khoanh sát cái logo thôi.";
      e("canhBao").classList.remove("an");
    } else {
      e("canhBao").classList.add("an");
    }

    ve(e("cKhung"), LOI.veKhung(anhGoc, vung));
    ve(e("cSach"), anhSach);

    var le = Math.round(Math.max(vung.w, vung.h) * 0.6);
    var o = LOI.noVung(vung, le, anhGoc.rong, anhGoc.cao);
    var tiLe = Math.max(1, Math.min(8, 460 / Math.max(1, o.w)));
    veMotO(e("zTruoc"), anhGoc, o, tiLe);
    veMotO(e("zSau"), anhSach, o, tiLe);

    var canvasSach = document.createElement("canvas");
    canvasSach.width = anhSach.rong; canvasSach.height = anhSach.cao;
    canvasSach.getContext("2d").putImageData(
      new ImageData(new Uint8ClampedArray(anhSach.du_lieu), anhSach.rong, anhSach.cao), 0, 0);
    var kieu = /\.jpe?g$/i.test(tenFile) ? "image/jpeg" : "image/png";
    e("taiVe").href = canvasSach.toDataURL(kieu, 0.95);
    e("taiVe").download = tenFile.replace(/(\.[a-z0-9]+)$/i, "_da_xoa$1");

    e("ghiChu").innerHTML =
      "Ưng rồi thì bấm <b>Chép toạ độ vùng</b> — dán chuỗi <code>" + vung.x + "," + vung.y
      + "," + vung.w + "," + vung.h + "</code> vào ô <i>“hoặc gõ x,y,rộng,cao”</i> của tiện ích "
      + "để cả dự án dùng đúng khung này. Toạ độ chỉ đúng cho ảnh cùng kích thước "
      + anhGoc.rong + "×" + anhGoc.cao + ".";
  }

  function nhanFile(f) {
    if (!f) return;
    tenFile = f.name || "anh.png";
    createImageBitmap(f).then(function (bm) {
      var c = document.createElement("canvas");
      c.width = bm.width; c.height = bm.height;
      var ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bm, 0, 0);
      bm.close();
      var id = ctx.getImageData(0, 0, c.width, c.height);
      anhGoc = { rong: id.width, cao: id.height, du_lieu: id.data };
      vung = null;
      e("banLam").classList.remove("an");
      lamLai("doi-cai-dat");
    }).catch(function (er) {
      alert("Không mở được ảnh này: " + (er && er.message ? er.message : er));
    });
  }

  var tha = e("tha");
  ["dragenter", "dragover"].forEach(function (t) {
    tha.addEventListener(t, function (su) { su.preventDefault(); tha.classList.add("dang-keo"); });
  });
  ["dragleave", "drop"].forEach(function (t) {
    tha.addEventListener(t, function (su) { su.preventDefault(); tha.classList.remove("dang-keo"); });
  });
  tha.addEventListener("drop", function (su) { nhanFile(su.dataTransfer.files[0]); });
  e("chon").addEventListener("click", function () { e("file").click(); });
  e("file").addEventListener("change", function () { nhanFile(this.files[0]); });

  ["vung", "cach", "locMau", "noRong"].forEach(function (id) {
    e(id).addEventListener("change", function () {
      if (id === "vung") e("vungTuGo").value = "";
      lamLai("doi-cai-dat");
    });
  });
  e("vungTuGo").addEventListener("change", function () { lamLai("doi-cai-dat"); });

  e("tuTim").addEventListener("click", function () {
    if (!anhGoc) return;
    e("vung").value = "tu-tim";
    e("vungTuGo").value = "";
    lamLai("doi-cai-dat");
  });

  e("anhKhac").addEventListener("click", function () {
    e("banLam").classList.add("an");
    e("file").value = "";
    anhGoc = null; vung = null;
  });

  e("chepToaDo").addEventListener("click", function () {
    if (!vung) return;
    var chuoi = vung.x + "," + vung.y + "," + vung.w + "," + vung.h;
    var nut = this;
    function xong() { nut.textContent = "Đã chép: " + chuoi;
      setTimeout(function () { nut.textContent = "Chép toạ độ vùng"; }, 2500); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(chuoi).then(xong, function () { prompt("Toạ độ vùng:", chuoi); });
    } else {
      prompt("Toạ độ vùng:", chuoi);
    }
  });

  // keo chuot khoanh vung ngay tren anh
  (function () {
    var canvas = e("cKhung");
    var dangKeo = false, x0 = 0, y0 = 0, x1 = 0, y1 = 0;
    function toaDo(su) {
      var o = canvas.getBoundingClientRect();
      return {
        x: (su.clientX - o.left) / o.width * anhGoc.rong,
        y: (su.clientY - o.top) / o.height * anhGoc.cao,
      };
    }
    canvas.addEventListener("mousedown", function (su) {
      if (!anhGoc) return;
      su.preventDefault();
      dangKeo = true;
      var t = toaDo(su); x0 = x1 = t.x; y0 = y1 = t.y;
    });
    window.addEventListener("mousemove", function (su) {
      if (!dangKeo) return;
      var t = toaDo(su); x1 = t.x; y1 = t.y;
      var ti = ve(canvas, anhGoc) ;
      var ctx = canvas.getContext("2d");
      ctx.strokeStyle = "#ff3b30"; ctx.lineWidth = 2;
      ctx.strokeRect(Math.min(x0, x1) * ti, Math.min(y0, y1) * ti,
                     Math.abs(x1 - x0) * ti, Math.abs(y1 - y0) * ti);
    });
    window.addEventListener("mouseup", function () {
      if (!dangKeo) return;
      dangKeo = false;
      var w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
      if (w < 4 || h < 4) { lamLai(); return; }
      vung = LOI.gioiHan({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: w, h: h },
                         anhGoc.rong, anhGoc.cao);
      e("vungTuGo").value = vung.x + "," + vung.y + "," + vung.w + "," + vung.h;
      lamLai("keo-tay");
    });
  })();
})();
`;

const HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Thử xoá watermark 1 ảnh</title>
<style>${KIEU}</style>
</head>
<body>
${GIAO_DIEN}
<script>
${LOI_XOA}
</script>
<script>
${DIEU_KHIEN}
</script>
</body>
</html>
`;

const RA = path.join(GOC, "THU_1_ANH.html");
fs.writeFileSync(RA, HTML, "utf8");
console.log("Da tao " + RA + " (" + Math.round(HTML.length / 1024) + " KB)");

/* Chay trong "the gioi chinh" cua trang Flow (world: MAIN).
 *
 * Viec duy nhat cua file nay: nhin thay luc trang sap tai file ve, chan lai
 * roi day sang phan xu ly (trang.js). Khong doc, khong gui gi ra ngoai.
 *
 * Trang web moi lam moi kieu tai file, nen chan o 3 cho hay gap nhat:
 *   1. tao blob roi bam vao the <a download>   -> hook URL.createObjectURL + a.click
 *   2. bam thang vao link .zip cua server      -> hook a.click va window.open
 *   3. fetch/XHR ve roi moi tao blob           -> chi ghi lai de chan doan
 *
 * Neu Flow doi cach tai, bat "che do chan doan" trong popup: moi duong link
 * nhin thay se duoc ghi lai de sua cho dung.
 */
(function () {
  "use strict";

  var KHOA = "__xw_da_gan__";
  if (window[KHOA]) return;
  window[KHOA] = true;

  var BAT = false;                 // nut gat, trang.js cap nhat xuong
  var CHAN_DOAN = false;
  var kho = new Map();             // blob URL -> Blob
  var khoBoQua = new Set();        // URL do chinh tien ich tra ve - khong chan lai
  var soThuTu = 0;

  window.addEventListener("message", function (su) {
    if (su.source !== window || !su.data || su.data.tu !== "xw-trang") return;
    if (su.data.viec === "cai_dat") {
      BAT = !!su.data.bat;
      CHAN_DOAN = !!su.data.chan_doan;
    } else if (su.data.viec === "bo_qua_url") {
      khoBoQua.add(su.data.url);
      if (khoBoQua.size > 20) khoBoQua.delete(khoBoQua.values().next().value);
    } else if (su.data.viec === "xin_blob") {
      var b = kho.get(su.data.url);
      window.postMessage({ tu: "xw-chan", viec: "tra_blob", ma: su.data.ma, blob: b || null }, "*");
    }
  });

  function bao(viec, gui) {
    gui = gui || {};
    gui.tu = "xw-chan";
    gui.viec = viec;
    window.postMessage(gui, "*");
  }

  function ghiChanDoan(nguon, url, kieu) {
    if (!CHAN_DOAN) return;
    bao("chan_doan", { nguon: nguon, url: String(url).slice(0, 300), kieu: kieu || "" });
  }

  function laFileTai(url, coTheTaiVe) {
    var s = String(url || "");
    if (coTheTaiVe) return true;
    return /\.(zip|png|jpe?g|webp)(\?|#|$)/i.test(s);
  }

  // --- 1. Nho lai cac blob trang tu tao -------------------------------------
  var taoUrlGoc = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (doiTuong) {
    var url = taoUrlGoc(doiTuong);
    try {
      if (doiTuong instanceof Blob) {
        kho.set(url, doiTuong);
        if (kho.size > 40) kho.delete(kho.keys().next().value);
        ghiChanDoan("createObjectURL", url, doiTuong.type + " / " + doiTuong.size + " byte");
      }
    } catch (e) { /* khong lam phien trang */ }
    return url;
  };

  var xoaUrlGoc = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = function (url) {
    // giu blob lai them mot nhip de con kip xu ly
    setTimeout(function () { kho.delete(url); }, 60000);
    return xoaUrlGoc(url);
  };

  // --- 2. Chan cu bam vao the <a> -------------------------------------------
  function xuLyThe(the) {
    if (!BAT || !the || !the.href) return false;

    // File do CHINH tien ich tra ve thi khong duoc chan lai, khong thi thanh
    // vong lap: xu ly xong -> bam tai xuong -> bi chan -> xu ly lai...
    if (the.getAttribute && the.getAttribute("data-xw-bo-qua")) return false;
    if (khoBoQua.has(the.href)) return false;

    var tenGoiY = the.getAttribute("download") || "";
    if (!laFileTai(the.href, the.hasAttribute("download"))) {
      ghiChanDoan("a.click (bo qua)", the.href, tenGoiY);
      return false;
    }
    ghiChanDoan("a.click (chan)", the.href, tenGoiY);
    bao("tai_file", { url: the.href, ten: tenGoiY, ma: ++soThuTu });
    return true;
  }

  var bamGoc = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (xuLyThe(this)) return;
    return bamGoc.apply(this, arguments);
  };

  document.addEventListener("click", function (su) {
    if (!BAT) return;
    var the = su.target && su.target.closest ? su.target.closest("a[href]") : null;
    if (!the) return;
    if (xuLyThe(the)) {
      su.preventDefault();
      su.stopImmediatePropagation();
    }
  }, true);

  // --- 3. Chan window.open ---------------------------------------------------
  var moGoc = window.open;
  window.open = function (url) {
    if (BAT && url && !khoBoQua.has(String(url)) && laFileTai(url, false)) {
      ghiChanDoan("window.open (chan)", url);
      bao("tai_file", { url: String(url), ten: "", ma: ++soThuTu });
      return null;
    }
    return moGoc.apply(window, arguments);
  };

  // --- 4. Chi ghi lai fetch/XHR de con biet duong nao ra file ---------------
  var fetchGoc = window.fetch;
  if (typeof fetchGoc === "function") {
    window.fetch = function (yeuCau, tuyChon) {
      var kq = fetchGoc.apply(this, arguments);
      if (CHAN_DOAN) {
        var url = typeof yeuCau === "string" ? yeuCau : (yeuCau && yeuCau.url) || "";
        kq.then(function (tl) {
          var kieu = tl.headers ? tl.headers.get("content-type") || "" : "";
          if (/zip|octet-stream|image\//i.test(kieu)) ghiChanDoan("fetch", url, kieu);
        }).catch(function () {});
      }
      return kq;
    };
  }

  var moXhr = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (cach, url) {
    if (CHAN_DOAN && /\.zip(\?|#|$)/i.test(String(url))) ghiChanDoan("xhr", url, cach);
    return moXhr.apply(this, arguments);
  };

  bao("san_sang", {});
})();

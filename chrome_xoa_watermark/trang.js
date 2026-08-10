/* Chay trong trang Flow (the gioi rieng cua extension).
 * Ve nut gat o goc man hinh, nhan file bi chan tu chan_trang.js, xoa watermark
 * roi tra ve dung file do cho nguoi dung tai xuong.
 */
(function () {
  "use strict";

  var XULY = window.XW_XULY;
  var caiDat = null;
  var dangCho = new Map();     // ma -> resolve cho viec xin blob
  var maXin = 0;
  var dangChay = false;
  var daTraVe = new Set();     // URL cua file chinh minh vua tra ve
  var vuaXuLy = new Map();     // URL -> luc xu ly, de chan cu bam doi trong tich tac

  // --- Giao dien -------------------------------------------------------------
  var hop = document.createElement("div");
  hop.className = "xw-hop";
  hop.innerHTML =
    '<div class="xw-hang">' +
    '  <span class="xw-ten">Xoá watermark</span>' +
    '  <button class="xw-gat" type="button" aria-pressed="false"><span></span></button>' +
    "</div>" +
    '<div class="xw-trang-thai">Đang tắt — tải dự án về sẽ giữ nguyên watermark</div>' +
    '<div class="xw-tien"><div class="xw-thanh"></div></div>' +
    '<a class="xw-tai" download></a>';

  var nutGat = hop.querySelector(".xw-gat");
  var nutTai = hop.querySelector(".xw-tai");
  var dongTrangThai = hop.querySelector(".xw-trang-thai");
  var thanhTien = hop.querySelector(".xw-tien");
  var thanhTrong = hop.querySelector(".xw-thanh");

  function bao(chu, mau) {
    dongTrangThai.textContent = chu;
    dongTrangThai.className = "xw-trang-thai" + (mau ? " xw-" + mau : "");
  }

  function tien(xong, tong) {
    thanhTien.style.display = "block";
    thanhTrong.style.width = Math.round((xong / Math.max(1, tong)) * 100) + "%";
  }

  function xongTien() {
    thanhTien.style.display = "none";
    thanhTrong.style.width = "0%";
  }

  function veNut() {
    var bat = caiDat && caiDat.bat;
    nutGat.setAttribute("aria-pressed", bat ? "true" : "false");
    hop.classList.toggle("xw-dang-bat", !!bat);
    if (!dangChay) {
      bao(bat
        ? "Đang bật — bấm tải dự án như bình thường"
        : "Đang tắt — tải dự án về sẽ giữ nguyên watermark");
    }
    window.postMessage({
      tu: "xw-trang", viec: "cai_dat",
      bat: !!bat, chan_doan: !!(caiDat && caiDat.chan_doan),
    }, "*");
  }

  nutGat.addEventListener("click", function () {
    caiDat.bat = !caiDat.bat;
    chrome.storage.local.set({ cai_dat: caiDat });
    veNut();
  });

  chrome.storage.local.get(["cai_dat"], function (kq) {
    caiDat = Object.assign({}, XULY.CAI_DAT_MAC_DINH, kq.cai_dat || {});
    if (kq.cai_dat === undefined) caiDat.bat = false;   // lan dau: de tat cho an toan
    document.documentElement.appendChild(hop);
    veNut();
  });

  chrome.storage.onChanged.addListener(function (doi, kho) {
    if (kho !== "local" || !doi.cai_dat) return;
    caiDat = Object.assign({}, XULY.CAI_DAT_MAC_DINH, doi.cai_dat.newValue || {});
    veNut();
  });

  // --- Nhan tin tu the gioi chinh --------------------------------------------
  window.addEventListener("message", function (su) {
    if (su.source !== window || !su.data || su.data.tu !== "xw-chan") return;
    var d = su.data;
    if (d.viec === "tai_file") {
      nhanFile(d.url, d.ten);
    } else if (d.viec === "tra_blob") {
      var cho = dangCho.get(d.ma);
      if (cho) { dangCho.delete(d.ma); cho(d.blob); }
    } else if (d.viec === "chan_doan") {
      ghiChanDoan(d);
    }
  });

  function ghiChanDoan(d) {
    chrome.storage.local.get(["nhat_ky"], function (kq) {
      var nk = kq.nhat_ky || [];
      nk.unshift({ luc: Date.now(), nguon: d.nguon, url: d.url, kieu: d.kieu });
      chrome.storage.local.set({ nhat_ky: nk.slice(0, 60) });
    });
  }

  function xinBlob(url) {
    return new Promise(function (xong) {
      var ma = ++maXin;
      dangCho.set(ma, xong);
      window.postMessage({ tu: "xw-trang", viec: "xin_blob", url: url, ma: ma }, "*");
      setTimeout(function () {
        if (dangCho.has(ma)) { dangCho.delete(ma); xong(null); }
      }, 3000);
    });
  }

  function tenTuUrl(url, goiY) {
    if (goiY) return goiY;
    try {
      var duong = new URL(url, location.href).pathname;
      var ten = decodeURIComponent(duong.split("/").pop() || "");
      if (ten) return ten;
    } catch (e) { /* bo qua */ }
    return "flow_tai_ve.zip";
  }

  function taiXuong(blob, ten) {
    var url = URL.createObjectURL(blob);

    // Bao cho bo chan biet day la file cua CHINH tien ich - dung chan lai.
    // Khong co buoc nay thi thanh vong lap: xong -> bam tai -> bi chan -> xong...
    window.postMessage({ tu: "xw-trang", viec: "bo_qua_url", url: url }, "*");
    daTraVe.add(url);

    var a = document.createElement("a");
    a.href = url;
    a.download = ten;
    a.setAttribute("data-xw-bo-qua", "1");
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); }, 5000);

    // Chrome doi khi chan tai tu dong -> chua san mot nut de bam tay
    nutTai.href = url;
    nutTai.download = ten;
    nutTai.textContent = "⬇ Tải " + ten;
    nutTai.style.display = "block";

    // giu blob song lau lau de con bam tay duoc
    setTimeout(function () { URL.revokeObjectURL(url); daTraVe.delete(url); }, 10 * 60 * 1000);
  }

  function layFile(url) {
    if (url.slice(0, 5) === "blob:") {
      return xinBlob(url).then(function (b) {
        if (b) return b;
        return fetch(url).then(function (tl) { return tl.blob(); });
      });
    }
    return fetch(url, { credentials: "include" }).then(function (tl) {
      if (!tl.ok) throw new Error("máy chủ trả về " + tl.status);
      return tl.blob();
    });
  }

  function nhanFile(url, tenGoiY) {
    if (daTraVe.has(url)) return;                      // file cua chinh minh tra ve
    // cung mot URL bi bao hai lan trong tich tac (bam doi) thi chi lam mot lan,
    // nhung sau vai giay ma nguoi dung bam tai lai that thi van chay binh thuong
    var lucTruoc = vuaXuLy.get(url);
    if (lucTruoc && Date.now() - lucTruoc < 5000) return;
    if (dangChay) {
      bao("Đang bận xử lý file trước, thử lại sau", "vang");
      return;
    }
    vuaXuLy.set(url, Date.now());
    if (vuaXuLy.size > 20) vuaXuLy.delete(vuaXuLy.keys().next().value);
    dangChay = true;
    nutTai.style.display = "none";
    var ten = tenTuUrl(url, tenGoiY);
    bao("Đang lấy file: " + ten);

    layFile(url).then(function (blob) {
      var laZip = /\.zip$/i.test(ten) || /zip/i.test(blob.type);
      if (laZip) {
        bao("Đang mở gói và xoá watermark...");
        return XULY.xuLyZip(blob, caiDat, function (xong, tong, tenAnh) {
          tien(xong, tong);
          bao("Đang xoá watermark " + xong + "/" + tong + " — " + tenAnh);
        }).then(function (kq) {
          xongTien();
          taiXuong(kq.blob, ten);
          var thua = kq.loi.length ? " (" + kq.loi.length + " ảnh lỗi, giữ nguyên bản gốc)" : "";
          bao("Xong " + kq.so_anh + " ảnh" + thua
            + ". File đã tải xuống — chưa thấy thì bấm nút bên dưới.", "xanh");
        });
      }
      bao("Đang xoá watermark 1 ảnh...");
      return XULY.xuLyMotAnh(blob, ten, caiDat).then(function (sach) {
        taiXuong(sach, ten);
        bao("Xong. Ảnh đã tải xuống — chưa thấy thì bấm nút bên dưới.", "xanh");
      });
    }).catch(function (e) {
      xongTien();
      var chu = e && e.message ? e.message : String(e);
      bao("Không xử lý được (" + chu + "). Hãy tắt nút gạt, tải bình thường rồi thả "
        + "file zip vào cửa sổ tiện ích.", "do");
      console.warn("[Xoa watermark] khong xu ly duoc:", url, e);
    }).then(function () {
      dangChay = false;
    });
  }
})();

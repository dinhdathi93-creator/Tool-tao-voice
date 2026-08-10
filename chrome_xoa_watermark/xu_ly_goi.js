"use strict";

var LOI = window.XW_LOI, ZIP = window.XW_ZIP, ANH = window.XW_ANH, XULY = window.XW_XULY;

var e = function (id) { return document.getElementById(id); };
var trangThai = {
  cai_dat: Object.assign({}, XULY.CAI_DAT_MAC_DINH),
  nguon: null,        // { kieu: "zip"|"anh", blob, ten, muc: [...] }
  vung: null,         // khung pixel da chot cho ca lo
};

// ---------------------------------------------------------------------------
// Cai dat
// ---------------------------------------------------------------------------

function docCaiDatTuManHinh() {
  var cd = trangThai.cai_dat;
  var tuGo = e("vungTuGo").value.trim();
  cd.vung = tuGo || e("vung").value;
  cd.loc_mau = e("locMau").value;
  cd.cach = e("cach").value;
  cd.no_rong = Math.max(0, Math.min(12, parseInt(e("noRong").value, 10) || 0));
  return cd;
}

chrome.storage.local.get(["cai_dat"], function (kq) {
  trangThai.cai_dat = Object.assign({}, XULY.CAI_DAT_MAC_DINH, kq.cai_dat || {});
  var cd = trangThai.cai_dat;
  // lay thang danh sach tu menu de them mot muc moi la khong phai sua o hai noi
  var coTrongMenu = Array.prototype.some.call(e("vung").options, function (o) {
    return o.value === cd.vung;
  });
  if (coTrongMenu) e("vung").value = cd.vung;
  else e("vungTuGo").value = cd.vung;
  e("locMau").value = cd.loc_mau;
  e("cach").value = cd.cach;
  e("noRong").value = cd.no_rong;
});

// ---------------------------------------------------------------------------
// Nhan file
// ---------------------------------------------------------------------------

var vungTha = e("tha");
["dragenter", "dragover"].forEach(function (ten) {
  vungTha.addEventListener(ten, function (su) {
    su.preventDefault();
    vungTha.classList.add("dang-keo");
  });
});
["dragleave", "drop"].forEach(function (ten) {
  vungTha.addEventListener(ten, function (su) {
    su.preventDefault();
    vungTha.classList.remove("dang-keo");
  });
});
vungTha.addEventListener("drop", function (su) {
  nhanFile(Array.prototype.slice.call(su.dataTransfer.files));
});
e("chon").addEventListener("click", function () { e("file").click(); });
e("file").addEventListener("change", function () {
  nhanFile(Array.prototype.slice.call(this.files));
});

function nhanFile(cacFile) {
  if (!cacFile.length) return;
  var zip = cacFile.filter(function (f) { return /\.zip$/i.test(f.name); });
  if (zip.length) {
    trangThai.nguon = { kieu: "zip", blob: zip[0], ten: zip[0].name };
  } else {
    var anh = cacFile.filter(function (f) { return ANH.laAnh(f.name); });
    if (!anh.length) {
      baoLoi("Không thấy file .zip hay ảnh nào trong những gì bạn thả vào.");
      return;
    }
    trangThai.nguon = { kieu: "anh", cac_file: anh, ten: "anh_da_xoa_watermark.zip" };
  }
  soiTruoc();
}

// ---------------------------------------------------------------------------
// Soi truoc: do vung, ve khung do, va thu 1 anh
// ---------------------------------------------------------------------------

function veLenCanvas(canvas, anh, rongToiDa) {
  rongToiDa = rongToiDa || 460;
  var tiLe = Math.min(1, rongToiDa / anh.rong);
  canvas.width = Math.round(anh.rong * tiLe);
  canvas.height = Math.round(anh.cao * tiLe);
  var tam = document.createElement("canvas");
  tam.width = anh.rong; tam.height = anh.cao;
  tam.getContext("2d").putImageData(
    new ImageData(new Uint8ClampedArray(anh.du_lieu), anh.rong, anh.cao), 0, 0);
  var ctx = canvas.getContext("2d");
  ctx.drawImage(tam, 0, 0, canvas.width, canvas.height);
}

function layMucAnh() {
  if (trangThai.nguon.kieu === "anh") {
    return Promise.resolve(trangThai.nguon.cac_file.map(function (f) {
      return { ten: f.name, doc: function () { return Promise.resolve(f); } };
    }));
  }
  return ZIP.docZip(trangThai.nguon.blob).then(function (muc) {
    trangThai.nguon.muc = muc;
    return muc.filter(function (m) { return !m.thu_muc && ANH.laAnh(m.ten); });
  });
}

function veXemTruoc(ghiChu) {
  var cd = docCaiDatTuManHinh();
  var anh = trangThai.anh_dau, vung = trangThai.vung;
  e("motaVung").textContent =
    "Ảnh " + anh.rong + "×" + anh.cao + " — vùng vá: x=" + vung.x + ", y=" + vung.y
    + ", rộng=" + vung.w + ", cao=" + vung.h
    + (ghiChu ? " (" + ghiChu + ")" : "") + ". Tổng " + trangThai.so_anh + " ảnh.";
  veLenCanvas(e("canvasKhung"), LOI.veKhung(anh, vung));
  trangThai.anh_sach = LOI.xoaWatermark(anh, {
    vung_pixel: vung, cach: cd.cach, loc_mau: cd.loc_mau,
    dung_sai: cd.dung_sai, no_rong: cd.no_rong,
  });
  veLenCanvas(e("canvasSach"), trangThai.anh_sach);
  if (!e("hopPhongTo").classList.contains("an")) vePhongTo();
}

function soiTruoc() {
  var cd = docCaiDatTuManHinh();
  hienKhoi("xemTruoc", false);
  hienKhoi("ketQua", false);
  hienKhoi("tienDo", true);
  e("chuTien").textContent = "Đang mở gói và đo vùng watermark...";
  e("thanh").style.width = "10%";

  layMucAnh().then(function (anhMuc) {
    if (!anhMuc.length) throw new Error("Không thấy ảnh nào (png/jpg/webp) trong gói này.");
    trangThai.anh_muc = anhMuc;
    trangThai.so_anh = anhMuc.length;
    var tuDong = LOI.phanTichVung(cd.vung, 1000, 1000) === null;   // co the bi ha xuong false ben duoi
    var doVung = tuDong ? XULY.doVungChoLo(anhMuc) : Promise.resolve({ vung: null, ghi_chu: "" });

    return doVung.then(function (kq) {
      // It hon 3 anh thi khong the tu do duoc - lui ve o nho goc duoi phai
      // (dung cho dau sao cua Flow) roi de nguoi dung keo chuot chinh lai,
      // van hon la bao loi roi khong cho lam gi.
      if (tuDong && !kq.vung && anhMuc.length < 3) {
        kq = { vung: null, ghi_chu: "ít ảnh quá nên chưa tự dò được — đang dùng ô nhỏ "
          + "góc dưới phải, kéo chuột trên ảnh để chỉnh lại" };
        cd.vung = "logo-duoi-phai";
        tuDong = false;
      }
      if (tuDong && !kq.vung) {
        throw new Error("Không tự dò được vùng watermark (" + kq.ghi_chu
          + "). Hãy chọn góc cụ thể ở phần Cài đặt, hoặc thả lại file rồi kéo chuột "
          + "khoanh tay vùng watermark trên ảnh soi trước.");
      }
      return anhMuc[0].doc().then(function (d) { return ANH.docAnh(d, anhMuc[0].ten); })
        .then(function (anh) {
          trangThai.anh_dau = anh;
          trangThai.vung = kq.vung || LOI.phanTichVung(cd.vung, anh.rong, anh.cao);
          hienKhoi("tienDo", false);
          hienKhoi("xemTruoc", true);
          veXemTruoc(kq.ghi_chu);
        });
    });
  }).catch(function (er) {
    hienKhoi("tienDo", false);
    baoLoi(er && er.message ? er.message : String(er));
  });
}

e("lamLai").addEventListener("click", soiTruoc);

// Doi lua chon trong menu thi bo khung go tay / keo tay di, khong de no lang le
// thang lua chon moi (truoc day chon lai menu ma khung cu van duoc dung).
e("vung").addEventListener("change", function () {
  if (e("vungTuGo").value.trim()) {
    e("vungTuGo").value = "";
    if (trangThai.anh_dau) soiTruoc();
  }
});

// ---------------------------------------------------------------------------
// Keo chuot khoanh vung ngay tren anh - cach chac an nhat khi tu do sai
// ---------------------------------------------------------------------------

(function () {
  var canvas = e("canvasKhung");
  var dangKeo = false, x0 = 0, y0 = 0, x1 = 0, y1 = 0;

  function toaDo(su) {
    var o = canvas.getBoundingClientRect();
    return {
      x: (su.clientX - o.left) / o.width * trangThai.anh_dau.rong,
      y: (su.clientY - o.top) / o.height * trangThai.anh_dau.cao,
    };
  }

  function veTam() {
    var anh = trangThai.anh_dau;
    veLenCanvas(canvas, anh);
    var o = canvas.getBoundingClientRect();
    var ti = canvas.width / anh.rong;
    var ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#ff3b30";
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.min(x0, x1) * ti, Math.min(y0, y1) * ti,
                   Math.abs(x1 - x0) * ti, Math.abs(y1 - y0) * ti);
    void o;
  }

  canvas.addEventListener("mousedown", function (su) {
    if (!trangThai.anh_dau) return;
    su.preventDefault();
    dangKeo = true;
    var t = toaDo(su);
    x0 = x1 = t.x; y0 = y1 = t.y;
  });

  window.addEventListener("mousemove", function (su) {
    if (!dangKeo) return;
    var t = toaDo(su);
    x1 = t.x; y1 = t.y;
    veTam();
  });

  window.addEventListener("mouseup", function () {
    if (!dangKeo) return;
    dangKeo = false;
    var w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
    if (w < 4 || h < 4) { veXemTruoc("giữ nguyên vùng cũ"); return; }   // lỡ bấm nhầm
    trangThai.vung = LOI.gioiHan(
      { x: Math.min(x0, x1), y: Math.min(y0, y1), w: w, h: h },
      trangThai.anh_dau.rong, trangThai.anh_dau.cao
    );
    e("vungTuGo").value = trangThai.vung.x + "," + trangThai.vung.y + ","
      + trangThai.vung.w + "," + trangThai.vung.h;
    veXemTruoc("bạn tự khoanh tay");
  });
})();

// ---------------------------------------------------------------------------
// Phong to cho dang khoanh de soi ky
// ---------------------------------------------------------------------------

function veMotO(canvas, anh, vung, tiLe) {
  canvas.width = Math.round(vung.w * tiLe);
  canvas.height = Math.round(vung.h * tiLe);
  var tam = document.createElement("canvas");
  tam.width = anh.rong; tam.height = anh.cao;
  tam.getContext("2d").putImageData(
    new ImageData(new Uint8ClampedArray(anh.du_lieu), anh.rong, anh.cao), 0, 0);
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tam, vung.x, vung.y, vung.w, vung.h, 0, 0, canvas.width, canvas.height);
}

function vePhongTo() {
  var v = LOI.noVung(trangThai.vung, Math.round(Math.max(trangThai.vung.w, trangThai.vung.h) * 0.6),
                     trangThai.anh_dau.rong, trangThai.anh_dau.cao);
  var tiLe = Math.max(1, Math.min(8, 420 / Math.max(1, v.w)));
  veMotO(e("zoomTruoc"), trangThai.anh_dau, v, tiLe);
  veMotO(e("zoomSau"), trangThai.anh_sach, v, tiLe);
}

e("phongTo").addEventListener("click", function () {
  if (!trangThai.anh_dau) return;
  var hop = e("hopPhongTo");
  hop.classList.toggle("an");
  this.textContent = hop.classList.contains("an")
    ? "Phóng to chỗ đang khoanh" : "Ẩn phần phóng to";
  if (!hop.classList.contains("an")) vePhongTo();
});

// ---------------------------------------------------------------------------
// Chay that
// ---------------------------------------------------------------------------

e("chay").addEventListener("click", function () {
  var cd = docCaiDatTuManHinh();
  chrome.storage.local.set({ cai_dat: cd });
  hienKhoi("xemTruoc", false);
  hienKhoi("tienDo", true);
  e("thanh").style.width = "0%";
  e("chuTien").textContent = "Đang bắt đầu...";

  var batDau = Date.now();
  function baoTien(xong, tong, ten) {
    e("thanh").style.width = Math.round((xong / Math.max(1, tong)) * 100) + "%";
    var troi = (Date.now() - batDau) / 1000;
    var conLai = xong ? Math.round((troi / xong) * (tong - xong)) : 0;
    e("chuTien").textContent = "Ảnh " + xong + "/" + tong + " — " + ten
      + (conLai ? " — còn khoảng " + conLai + " giây" : "");
  }

  var caiDatChay = Object.assign({}, cd, { vung_pixel: trangThai.vung });
  var viec;
  if (trangThai.nguon.kieu === "zip") {
    viec = XULY.xuLyZip(trangThai.nguon.blob, caiDatChay, baoTien).then(function (kq) {
      return { blob: kq.blob, ten: doiTen(trangThai.nguon.ten), so: kq.so_anh,
               loi: kq.loi, cach: kq.cach_da_dung };
    });
  } else {
    viec = XULY.xuLyNhieuAnh(trangThai.nguon.cac_file, caiDatChay, baoTien)
      .then(function (kq) {
        return ZIP.taoZip(kq.cac_anh.map(function (a) {
          return { ten: a.ten, du_lieu: a.blob };
        })).then(function (blob) {
          return { blob: blob, ten: trangThai.nguon.ten, so: kq.cac_anh.length, loi: [] };
        });
      });
  }

  viec.then(function (kq) {
    hienKhoi("tienDo", false);
    hienKhoi("ketQua", true);
    var giay = Math.round((Date.now() - batDau) / 1000);
    e("chuKetQua").textContent = "Đã xử lý " + kq.so + " ảnh trong " + giay + " giây."
      + (kq.cach ? " Cách dùng: " + kq.cach + "." : "")
      + (kq.loi.length ? " " + kq.loi.length + " ảnh lỗi, giữ nguyên bản gốc." : "");
    var url = URL.createObjectURL(kq.blob);
    e("taiVe").href = url;
    e("taiVe").download = kq.ten;
    if (kq.loi.length) {
      e("loiChiTiet").textContent = kq.loi.join("\n");
      e("loiChiTiet").classList.remove("an");
    } else {
      e("loiChiTiet").classList.add("an");
    }
  }).catch(function (er) {
    hienKhoi("tienDo", false);
    baoLoi(er && er.message ? er.message : String(er));
  });
});

e("batDauLai").addEventListener("click", function () {
  hienKhoi("ketQua", false);
  trangThai.nguon = null;
  e("file").value = "";
});

// ---------------------------------------------------------------------------

function doiTen(ten) {
  return ten.replace(/\.zip$/i, "") + "_da_xoa_watermark.zip";
}

function hienKhoi(id, hien) {
  e(id).classList.toggle("an", !hien);
}

function baoLoi(chu) {
  hienKhoi("ketQua", true);
  e("chuKetQua").textContent = "Không xử lý được: " + chu;
  e("taiVe").removeAttribute("href");
  e("loiChiTiet").classList.add("an");
}

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
  var dsGoc = ["tu-dong", "duoi-phai", "duoi-trai", "tren-phai", "tren-trai", "duoi", "tren", "giua"];
  if (dsGoc.indexOf(cd.vung) >= 0) e("vung").value = cd.vung;
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
    var tuDong = LOI.phanTichVung(cd.vung, 1000, 1000) === null;
    var doVung = tuDong ? XULY.doVungChoLo(anhMuc) : Promise.resolve({ vung: null, ghi_chu: "" });

    return doVung.then(function (kq) {
      if (tuDong && !kq.vung) {
        throw new Error("Không tự dò được vùng watermark (" + kq.ghi_chu
          + "). Hãy chọn góc cụ thể ở phần Cài đặt rồi thả file lại.");
      }
      return anhMuc[0].doc().then(function (d) { return ANH.docAnh(d, anhMuc[0].ten); })
        .then(function (anh) {
          var vung = kq.vung || LOI.phanTichVung(cd.vung, anh.rong, anh.cao);
          trangThai.vung = vung;
          e("motaVung").textContent =
            "Ảnh " + anh.rong + "×" + anh.cao + " — vùng vá: x=" + vung.x + ", y=" + vung.y
            + ", rộng=" + vung.w + ", cao=" + vung.h
            + (kq.ghi_chu ? " (" + kq.ghi_chu + ")" : "") + ". Tổng " + anhMuc.length + " ảnh.";
          veLenCanvas(e("canvasKhung"), LOI.veKhung(anh, vung));
          veLenCanvas(e("canvasSach"), LOI.xoaWatermark(anh, {
            vung_pixel: vung, cach: cd.cach, loc_mau: cd.loc_mau,
            dung_sai: cd.dung_sai, no_rong: cd.no_rong,
          }));
          hienKhoi("tienDo", false);
          hienKhoi("xemTruoc", true);
        });
    });
  }).catch(function (er) {
    hienKhoi("tienDo", false);
    baoLoi(er && er.message ? er.message : String(er));
  });
}

e("lamLai").addEventListener("click", soiTruoc);

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
      return { blob: kq.blob, ten: doiTen(trangThai.nguon.ten), so: kq.so_anh, loi: kq.loi };
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

"use strict";

var MAC_DINH = {
  bat: false, vung: "tu-dong", cach: "tu-dong", loc_mau: "tat",
  dung_sai: 0, no_rong: 2, chat_luong: 0.95, xem_thu: false, chan_doan: false,
};

var caiDat = Object.assign({}, MAC_DINH);
var e = function (id) { return document.getElementById(id); };

function veGiaoDien() {
  e("gat").setAttribute("aria-pressed", caiDat.bat ? "true" : "false");
  e("gat").classList.toggle("dang-bat", !!caiDat.bat);
  e("trangThai").textContent = caiDat.bat
    ? "Đang bật — vào Flow, bấm tải dự án như bình thường."
    : "Nút gạt đang tắt. Bật lên để tự xử lý lúc tải dự án.";

  var la_goc = Array.prototype.some.call(e("vung").options, function (o) {
    return o.value === caiDat.vung;
  });
  e("vung").value = la_goc ? caiDat.vung : "tu-go";
  e("vungTuGo").classList.toggle("an", la_goc);
  if (!la_goc) e("vungTuGo").value = caiDat.vung;

  e("locMau").value = caiDat.loc_mau;
  e("cach").value = caiDat.cach;
  e("chanDoan").checked = !!caiDat.chan_doan;
}

function luu() {
  chrome.storage.local.set({ cai_dat: caiDat });
}

chrome.storage.local.get(["cai_dat"], function (kq) {
  caiDat = Object.assign({}, MAC_DINH, kq.cai_dat || {});
  veGiaoDien();
  veNhatKy();
});

e("gat").addEventListener("click", function () {
  caiDat.bat = !caiDat.bat;
  luu();
  veGiaoDien();
});

e("vung").addEventListener("change", function () {
  if (this.value === "tu-go") {
    e("vungTuGo").classList.remove("an");
    e("vungTuGo").focus();
    return;
  }
  caiDat.vung = this.value;
  e("vungTuGo").classList.add("an");
  luu();
});

e("vungTuGo").addEventListener("change", function () {
  var v = this.value.trim();
  if (v) { caiDat.vung = v; luu(); }
});

e("locMau").addEventListener("change", function () { caiDat.loc_mau = this.value; luu(); });
e("cach").addEventListener("change", function () { caiDat.cach = this.value; luu(); });

e("chanDoan").addEventListener("change", function () {
  caiDat.chan_doan = this.checked;
  luu();
});

e("moTrang").addEventListener("click", function () {
  chrome.tabs.create({ url: chrome.runtime.getURL("xu_ly_goi.html") });
});

function veNhatKy() {
  chrome.storage.local.get(["nhat_ky"], function (kq) {
    var nk = kq.nhat_ky || [];
    if (!nk.length) {
      e("nhatKy").textContent = "Chưa ghi được gì.";
      return;
    }
    e("nhatKy").textContent = nk.slice(0, 15).map(function (m) {
      var gio = new Date(m.luc).toLocaleTimeString("vi-VN");
      return gio + "  " + m.nguon + "\n    " + m.url + (m.kieu ? "\n    " + m.kieu : "");
    }).join("\n");
  });
}

e("xoaNhatKy").addEventListener("click", function () {
  chrome.storage.local.set({ nhat_ky: [] }, veNhatKy);
});

/* Service worker - chi lam vai viec lat vat:
 *  - lan dau cai thi ghi cai dat mac dinh
 *  - bam vao bieu tuong khi khong co popup thi mo trang xu ly goi
 */
"use strict";

var MAC_DINH = {
  bat: false, vung: "tu-dong", cach: "va", loc_mau: "tat",
  dung_sai: 0, no_rong: 2, chat_luong: 0.95, xem_thu: false, chan_doan: false,
};

chrome.runtime.onInstalled.addListener(function (chiTiet) {
  chrome.storage.local.get(["cai_dat"], function (kq) {
    if (!kq.cai_dat) chrome.storage.local.set({ cai_dat: MAC_DINH });
  });
  if (chiTiet.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("xu_ly_goi.html") });
  }
});

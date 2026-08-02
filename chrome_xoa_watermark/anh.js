/* Doc / ghi anh trong trinh duyet bang OffscreenCanvas.
 * File nay chi chay duoc trong Chrome (can createImageBitmap + canvas).
 */
(function (goc) {
  "use strict";

  var DUOI_ANH = ["png", "jpg", "jpeg", "webp", "bmp"];

  function duoiFile(ten) {
    var m = String(ten).toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : "";
  }

  function laAnh(ten) {
    return DUOI_ANH.indexOf(duoiFile(ten)) >= 0;
  }

  function kieuMime(ten) {
    var d = duoiFile(ten);
    if (d === "jpg" || d === "jpeg") return "image/jpeg";
    if (d === "webp") return "image/webp";
    return "image/png";  // bmp cung xuat ra png cho khoi phinh file
  }

  /** Blob/Uint8Array -> { rong, cao, du_lieu } */
  function docAnh(nguon, ten) {
    var blob = nguon instanceof Blob ? nguon : new Blob([nguon], { type: kieuMime(ten || "") });
    return createImageBitmap(blob).then(function (bm) {
      var canvas = new OffscreenCanvas(bm.width, bm.height);
      var ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bm, 0, 0);
      bm.close();
      var id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return { rong: id.width, cao: id.height, du_lieu: id.data };
    });
  }

  /** { rong, cao, du_lieu } -> Blob theo dung dinh dang file goc */
  function ghiAnh(anh, ten, chatLuong) {
    var canvas = new OffscreenCanvas(anh.rong, anh.cao);
    var ctx = canvas.getContext("2d");
    var id = new ImageData(
      anh.du_lieu instanceof Uint8ClampedArray ? anh.du_lieu : new Uint8ClampedArray(anh.du_lieu),
      anh.rong, anh.cao
    );
    ctx.putImageData(id, 0, 0);
    var kieu = kieuMime(ten);
    var tuyChon = { type: kieu };
    if (kieu !== "image/png") tuyChon.quality = chatLuong == null ? 0.95 : chatLuong;
    return canvas.convertToBlob(tuyChon);
  }

  var XW_ANH = {
    DUOI_ANH: DUOI_ANH,
    duoiFile: duoiFile,
    laAnh: laAnh,
    kieuMime: kieuMime,
    docAnh: docAnh,
    ghiAnh: ghiAnh,
  };
  goc.XW_ANH = XW_ANH;
  if (typeof module !== "undefined" && module.exports) module.exports = XW_ANH;
})(typeof globalThis !== "undefined" ? globalThis : this);

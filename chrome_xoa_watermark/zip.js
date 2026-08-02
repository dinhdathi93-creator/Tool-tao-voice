/* Doc va ghi file ZIP - khong dung thu vien ngoai.
 *
 * Doc: doc lay muc luc truoc, tung file chi doc ra khi can (blob.slice) nen mo
 *      zip 200 anh khong nuot het RAM. Ho tro nen kieu store (0) va deflate (8),
 *      giai nen bang DecompressionStream("deflate-raw") - co san trong Chrome
 *      va Node 18+.
 * Ghi: luon ghi kieu store (0). Anh PNG/JPG von da nen roi, nen lai chi ton
 *      thoi gian ma khong nho di bao nhieu. Noi dung nhan ca Blob de Chrome tu
 *      day xuong dia thay vi giu trong bo nho.
 */
(function (goc) {
  "use strict";

  // --- CRC32 ---------------------------------------------------------------
  var BANG_CRC = (function () {
    var bang = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      bang[i] = c >>> 0;
    }
    return bang;
  })();

  function crc32(duLieu) {
    var c = 0xffffffff;
    for (var i = 0; i < duLieu.length; i++) c = BANG_CRC[(c ^ duLieu[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  var BO_MA = new TextEncoder();
  var BO_GIAI = new TextDecoder("utf-8");

  function veBlob(nguon) {
    if (typeof Blob !== "undefined" && nguon instanceof Blob) return nguon;
    return new Blob([nguon]);
  }

  function giaiNen(duLieu) {
    if (typeof DecompressionStream === "undefined") {
      return Promise.reject(new Error("Trinh duyet khong ho tro DecompressionStream"));
    }
    var luong = new Blob([duLieu]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(luong).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  function docPhan(blob, tu, den) {
    return blob.slice(tu, den).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  /**
   * Doc muc luc cua zip. Tra ve Promise cua mang:
   *   [{ ten, thu_muc, kich_thuoc, doc() -> Promise<Uint8Array> }]
   * Giu nguyen thu tu va duong dan ben trong zip.
   */
  function docZip(nguon) {
    var blob = veBlob(nguon);
    var duoiCung = Math.min(blob.size, 66000);
    return docPhan(blob, blob.size - duoiCung, blob.size).then(function (duoi) {
      var dv = new DataView(duoi.buffer, duoi.byteOffset, duoi.byteLength);
      var eocd = -1;
      for (var i = duoi.length - 22; i >= 0; i--) {
        if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      }
      if (eocd < 0) throw new Error("Khong phai file ZIP hop le");

      var soEntry = dv.getUint16(eocd + 10, true);
      var daiCD = dv.getUint32(eocd + 12, true);
      var viTriCD = dv.getUint32(eocd + 16, true);
      if (viTriCD === 0xffffffff || soEntry === 0xffff) {
        throw new Error("ZIP64 (file qua lon) chua duoc ho tro");
      }

      return docPhan(blob, viTriCD, viTriCD + daiCD).then(function (cd) {
        var dvc = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
        var muc = [];
        var vt = 0;
        for (var e = 0; e < soEntry && vt + 46 <= cd.length; e++) {
          if (dvc.getUint32(vt, true) !== 0x02014b50) break;
          var cachNen = dvc.getUint16(vt + 10, true);
          var crc = dvc.getUint32(vt + 16, true);
          var coNen = dvc.getUint32(vt + 20, true);
          var goc0 = dvc.getUint32(vt + 24, true);
          var daiTen = dvc.getUint16(vt + 28, true);
          var daiExtra = dvc.getUint16(vt + 30, true);
          var daiChuThich = dvc.getUint16(vt + 32, true);
          var viTriLocal = dvc.getUint32(vt + 42, true);
          var ten = BO_GIAI.decode(cd.subarray(vt + 46, vt + 46 + daiTen));
          muc.push(taoMuc(blob, ten, cachNen, crc, coNen, goc0, viTriLocal));
          vt += 46 + daiTen + daiExtra + daiChuThich;
        }
        return muc;
      });
    });
  }

  function taoMuc(blob, ten, cachNen, crc, coNen, kichThuoc, viTriLocal) {
    var thuMuc = ten.slice(-1) === "/";
    return {
      ten: ten,
      thu_muc: thuMuc,
      kich_thuoc: kichThuoc,
      crc: crc,
      doc: function () {
        if (thuMuc) return Promise.resolve(new Uint8Array(0));
        // header cuc bo: 30 byte co dinh + ten + extra (do dai co the khac ban ghi CD)
        return docPhan(blob, viTriLocal, viTriLocal + 30).then(function (h) {
          var dv = new DataView(h.buffer, h.byteOffset, h.byteLength);
          if (dv.getUint32(0, true) !== 0x04034b50) throw new Error("Hong header cua " + ten);
          var dau = viTriLocal + 30 + dv.getUint16(26, true) + dv.getUint16(28, true);
          return docPhan(blob, dau, dau + coNen);
        }).then(function (tho) {
          if (cachNen === 0) return tho;
          if (cachNen === 8) return giaiNen(tho);
          throw new Error("Kieu nen " + cachNen + " chua ho tro (" + ten + ")");
        });
      },
    };
  }

  function gioDos(ngay) {
    var gio = ((ngay.getHours() & 31) << 11) | ((ngay.getMinutes() & 63) << 5)
            | ((ngay.getSeconds() / 2) & 31);
    var thang = (((ngay.getFullYear() - 1980) & 127) << 9) | (((ngay.getMonth() + 1) & 15) << 5)
              | (ngay.getDate() & 31);
    return { gio: gio, thang: thang };
  }

  /**
   * Tao zip moi. cacMuc = [{ ten, du_lieu, crc?, kich_thuoc? }]
   *   du_lieu: Uint8Array / ArrayBuffer / Blob
   *   crc + kich_thuoc: neu da tinh san (luc ma hoa anh) thi truyen vao de khoi
   *                     phai doc lai noi dung Blob mot lan nua.
   * Tra ve Promise<Blob>.
   */
  function taoZip(cacMuc, thoiDiem) {
    var t = gioDos(thoiDiem || new Date());
    var manh = [];
    var mucCD = [];
    var viTri = 0;

    var day = Promise.resolve();
    cacMuc.forEach(function (m) {
      day = day.then(function () {
        var laBlob = typeof Blob !== "undefined" && m.du_lieu instanceof Blob;
        var canTinh = m.crc == null || m.kich_thuoc == null;
        var chuanBi;
        if (!canTinh) {
          chuanBi = Promise.resolve({ noi_dung: m.du_lieu, crc: m.crc, dai: m.kich_thuoc });
        } else if (laBlob) {
          chuanBi = m.du_lieu.arrayBuffer().then(function (b) {
            var u = new Uint8Array(b);
            return { noi_dung: m.du_lieu, crc: crc32(u), dai: u.length };
          });
        } else {
          var u2 = m.du_lieu instanceof Uint8Array ? m.du_lieu : new Uint8Array(m.du_lieu);
          chuanBi = Promise.resolve({ noi_dung: u2, crc: crc32(u2), dai: u2.length });
        }

        return chuanBi.then(function (s) {
          var ten = BO_MA.encode(m.ten);
          var local = new Uint8Array(30 + ten.length);
          var dvL = new DataView(local.buffer);
          dvL.setUint32(0, 0x04034b50, true);
          dvL.setUint16(4, 20, true);       // can phien ban 2.0
          dvL.setUint16(6, 0x0800, true);   // co UTF-8 cho ten file
          dvL.setUint16(8, 0, true);        // cach nen: store
          dvL.setUint16(10, t.gio, true);
          dvL.setUint16(12, t.thang, true);
          dvL.setUint32(14, s.crc, true);
          dvL.setUint32(18, s.dai, true);
          dvL.setUint32(22, s.dai, true);
          dvL.setUint16(26, ten.length, true);
          dvL.setUint16(28, 0, true);
          local.set(ten, 30);

          manh.push(local, s.noi_dung);
          mucCD.push({ ten: ten, crc: s.crc, dai: s.dai, vi_tri: viTri });
          viTri += local.length + s.dai;
        });
      });
    });

    return day.then(function () {
      var dauCD = viTri;
      for (var k = 0; k < mucCD.length; k++) {
        var c = mucCD[k];
        var cd = new Uint8Array(46 + c.ten.length);
        var dvC = new DataView(cd.buffer);
        dvC.setUint32(0, 0x02014b50, true);
        dvC.setUint16(4, 20, true);
        dvC.setUint16(6, 20, true);
        dvC.setUint16(8, 0x0800, true);
        dvC.setUint16(10, 0, true);
        dvC.setUint16(12, t.gio, true);
        dvC.setUint16(14, t.thang, true);
        dvC.setUint32(16, c.crc, true);
        dvC.setUint32(20, c.dai, true);
        dvC.setUint32(24, c.dai, true);
        dvC.setUint16(28, c.ten.length, true);
        dvC.setUint32(42, c.vi_tri, true);
        cd.set(c.ten, 46);
        manh.push(cd);
        viTri += cd.length;
      }

      var eocd = new Uint8Array(22);
      var dvE = new DataView(eocd.buffer);
      dvE.setUint32(0, 0x06054b50, true);
      dvE.setUint16(8, mucCD.length, true);
      dvE.setUint16(10, mucCD.length, true);
      dvE.setUint32(12, viTri - dauCD, true);
      dvE.setUint32(16, dauCD, true);
      manh.push(eocd);

      if (viTri > 0xfffffffe) throw new Error("Zip ket qua vuot 4GB, chua ho tro ZIP64");
      return new Blob(manh, { type: "application/zip" });
    });
  }

  var XW_ZIP = { docZip: docZip, taoZip: taoZip, crc32: crc32 };
  goc.XW_ZIP = XW_ZIP;
  if (typeof module !== "undefined" && module.exports) module.exports = XW_ZIP;
})(typeof globalThis !== "undefined" ? globalThis : this);

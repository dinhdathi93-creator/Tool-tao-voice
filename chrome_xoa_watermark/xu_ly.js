/* Duong ong: zip vao -> anh sach -> zip ra.
 * Can loi_xoa.js, zip.js, anh.js nap truoc.
 */
(function (goc) {
  "use strict";

  var LOI = goc.XW_LOI, ZIP = goc.XW_ZIP, ANH = goc.XW_ANH;

  var CAI_DAT_MAC_DINH = {
    bat: true,
    vung: "tu-dong",        // tu-dong | duoi-phai | ... | x,y,w,h
    cach: "va",             // va (theo cau truc) | va-mem (khuech tan) | to
    loc_mau: "tat",         // tat | sang | toi | #RRGGBB
    dung_sai: 0,
    no_rong: 2,
    chat_luong: 0.95,
    xem_thu: false,
    chan_doan: false,
  };

  function gopCaiDat(caiDat) {
    var ra = {};
    Object.keys(CAI_DAT_MAC_DINH).forEach(function (k) { ra[k] = CAI_DAT_MAC_DINH[k]; });
    Object.keys(caiDat || {}).forEach(function (k) {
      if (caiDat[k] !== undefined && caiDat[k] !== null) ra[k] = caiDat[k];
    });
    return ra;
  }

  /**
   * Do vung watermark dung 1 lan cho ca lo, tu vai anh dau tien cung kich thuoc.
   * cacMuc: [{ ten, doc() -> Promise<Uint8Array|Blob> }]
   * Tra Promise<{ vung, ghi_chu, kich_thuoc }> - vung = null neu khong chac.
   */
  function doVungChoLo(cacMuc, soMau) {
    soMau = soMau || 8;
    var anhMau = [];
    var day = Promise.resolve();
    cacMuc.slice(0, soMau).forEach(function (m) {
      day = day.then(function () {
        return m.doc().then(function (d) { return ANH.docAnh(d, m.ten); })
          .then(function (a) { anhMau.push(a); })
          .catch(function () { /* anh hong thi bo qua, khong chan ca lo */ });
      });
    });
    return day.then(function () {
      var kichThuoc = anhMau.length
        ? { rong: anhMau[0].rong, cao: anhMau[0].cao } : null;

      // du anh thi so ca bo cho chac
      if (anhMau.length >= 3) {
        var kq = LOI.timVungTuDong(anhMau);
        if (kq.vung) return { vung: kq.vung, ghi_chu: kq.ghi_chu, kich_thuoc: kichThuoc };
      }
      // it anh, hoac so ca bo khong ra: tim dom sang nho o goc ngay tren 1 anh
      if (anhMau.length) {
        var mot = LOI.timLogoMotAnh(anhMau[0]);
        if (mot.vung) {
          return { vung: mot.vung, ghi_chu: mot.ghi_chu, kich_thuoc: kichThuoc };
        }
      }
      return {
        vung: null, kich_thuoc: kichThuoc,
        ghi_chu: anhMau.length < 3
          ? "it anh qua va khong thay dom sang nho nao o goc"
          : "khong thay net chung, cung khong thay dom sang nho nao o goc",
      };
    });
  }

  /** Xu ly 1 anh (Blob/Uint8Array) -> Blob da sach. */
  function xuLyMotAnh(duLieu, ten, caiDat) {
    var cd = gopCaiDat(caiDat);
    return ANH.docAnh(duLieu, ten).then(function (anh) {
      var vung = cd.vung_pixel || LOI.phanTichVung(cd.vung, anh.rong, anh.cao);
      if (!vung) throw new Error("chua xac dinh duoc vung watermark");

      // Da hoc duoc lop phu tu ca lo thi GO NGUOC no ra - khong dung vao nen,
      // nen chan nguoi / bac thang / duong ranh mau deu con nguyen.
      if (cd.mo_hinh && !cd.xem_thu
          && anh.rong === cd.mo_hinh.kich_thuoc.rong
          && anh.cao === cd.mo_hinh.kich_thuoc.cao) {
        return ANH.ghiAnh(LOI.goLopPhu(anh, cd.mo_hinh), ten, cd.chat_luong);
      }

      var sach = LOI.xoaWatermark(anh, {
        vung_pixel: vung, cach: cd.cach, loc_mau: cd.loc_mau,
        dung_sai: cd.dung_sai, no_rong: cd.no_rong, xem_thu: cd.xem_thu,
      });
      return ANH.ghiAnh(sach, ten, cd.chat_luong);
    });
  }

  /**
   * Hoc lop phu tu vai anh dau cua lo. Tra Promise<mo_hinh | null>.
   * Can it nhat LOI.SO_ANH_TOI_THIEU anh cung kich thuoc, va nen ben duoi logo
   * phai co doi giua cac anh. Khong du dieu kien thi tra null -> quay ve va nen.
   */
  function hocLopPhuChoLo(cacMuc, vung, soMau) {
    soMau = soMau || 14;
    var anhMau = [];
    var day = Promise.resolve();
    cacMuc.slice(0, soMau).forEach(function (m) {
      day = day.then(function () {
        return m.doc().then(function (d) { return ANH.docAnh(d, m.ten); })
          .then(function (a) { anhMau.push(a); })
          .catch(function () { /* anh hong thi bo qua */ });
      });
    });
    return day.then(function () {
      if (anhMau.length < LOI.SO_ANH_TOI_THIEU) return null;
      var mh = LOI.hocLopPhu(anhMau, vung);
      if (mh) mh.kich_thuoc = { rong: anhMau[0].rong, cao: anhMau[0].cao };
      return mh;
    });
  }

  /**
   * Xu ly ca file zip. Tra Promise<{ blob, so_anh, so_bo_qua, vung, ghi_chu, loi }>.
   * baoTien(xong, tong, ten) duoc goi sau moi anh.
   */
  function xuLyZip(nguon, caiDat, baoTien) {
    var cd = gopCaiDat(caiDat);
    var loi = [];
    return ZIP.docZip(nguon).then(function (muc) {
      var anhMuc = muc.filter(function (m) { return !m.thu_muc && ANH.laAnh(m.ten); });
      if (!anhMuc.length) throw new Error("Trong zip khong co anh nao (png/jpg/webp)");

      var doVung = LOI.phanTichVung(cd.vung, 1000, 1000) === null
        ? doVungChoLo(anhMuc)
        : Promise.resolve({ vung: null, ghi_chu: "vung do nguoi dung chon", kich_thuoc: null });

      return doVung.then(function (kq) {
        if (LOI.phanTichVung(cd.vung, 1000, 1000) === null && !kq.vung) {
          throw new Error("Khong tu do duoc vung watermark (" + kq.ghi_chu
            + "). Hay chon goc cu the trong phan cai dat.");
        }
        var vungPixel = kq.vung;   // null = dung chuoi cai dat cho tung anh
        var raMuc = [];
        var xong = 0;
        var moHinh = null;
        var day = Promise.resolve();

        // Hoc lop phu truoc: cach nay khong dung vao nen nen anh nao co nguoi /
        // do vat nam ngay duoi logo cung khong bi va nat.
        day = day.then(function () {
          var v0 = vungPixel;
          if (!v0) {
            try {
              v0 = LOI.phanTichVung(cd.vung, kq.kich_thuoc ? kq.kich_thuoc.rong : 1000,
                                    kq.kich_thuoc ? kq.kich_thuoc.cao : 1000);
            } catch (e) { v0 = null; }
          }
          if (!v0) return null;
          return hocLopPhuChoLo(anhMuc, v0).then(function (mh) { moHinh = mh; });
        });

        muc.forEach(function (m) {
          day = day.then(function () {
            if (m.thu_muc) return null;
            if (!ANH.laAnh(m.ten)) {
              // file khac (json, txt, video...) giu nguyen khong dung toi
              return m.doc().then(function (d) {
                raMuc.push({ ten: m.ten, du_lieu: d });
              });
            }
            return m.doc().then(function (d) {
              return xuLyMotAnh(d, m.ten, {
                vung: cd.vung, vung_pixel: vungPixel, cach: cd.cach, loc_mau: cd.loc_mau,
                dung_sai: cd.dung_sai, no_rong: cd.no_rong, chat_luong: cd.chat_luong,
                xem_thu: cd.xem_thu, mo_hinh: moHinh,
              }).then(function (blobSach) {
                raMuc.push({ ten: m.ten, du_lieu: blobSach });
              }).catch(function (e) {
                loi.push(m.ten + ": " + (e && e.message ? e.message : e));
                return m.doc().then(function (goc0) {   // hong thi giu anh goc
                  raMuc.push({ ten: m.ten, du_lieu: goc0 });
                });
              });
            }).then(function () {
              xong++;
              if (baoTien) baoTien(xong, anhMuc.length, m.ten);
            });
          });
        });

        return day.then(function () {
          return ZIP.taoZip(raMuc).then(function (blob) {
            return {
              blob: blob, so_anh: xong, so_bo_qua: muc.length - anhMuc.length,
              vung: vungPixel, ghi_chu: kq.ghi_chu, loi: loi,
              cach_da_dung: moHinh
                ? "gỡ lớp phủ (học từ " + moHinh.so_anh + " ảnh)"
                : "vá theo cấu trúc nền",
            };
          });
        });
      });
    });
  }

  /** Xu ly nhieu file roi (khong nam trong zip). */
  function xuLyNhieuAnh(cacFile, caiDat, baoTien) {
    var cd = gopCaiDat(caiDat);
    var muc = cacFile.map(function (f) {
      return { ten: f.name || "anh.png", doc: function () { return Promise.resolve(f); } };
    });
    var doVung = LOI.phanTichVung(cd.vung, 1000, 1000) === null
      ? doVungChoLo(muc)
      : Promise.resolve({ vung: null, ghi_chu: "vung do nguoi dung chon" });

    return doVung.then(function (kq) {
      if (LOI.phanTichVung(cd.vung, 1000, 1000) === null && !kq.vung) {
        throw new Error("Khong tu do duoc vung watermark (" + kq.ghi_chu
          + "). Hay chon goc cu the trong phan cai dat.");
      }
      var ra = [];
      var day = Promise.resolve();
      muc.forEach(function (m, vt) {
        day = day.then(function () {
          return m.doc().then(function (d) {
            return xuLyMotAnh(d, m.ten, {
              vung: cd.vung, vung_pixel: kq.vung, cach: cd.cach, loc_mau: cd.loc_mau,
              dung_sai: cd.dung_sai, no_rong: cd.no_rong, chat_luong: cd.chat_luong,
              xem_thu: cd.xem_thu,
            });
          }).then(function (blob) {
            ra.push({ ten: m.ten, blob: blob });
            if (baoTien) baoTien(vt + 1, muc.length, m.ten);
          });
        });
      });
      return day.then(function () { return { cac_anh: ra, vung: kq.vung, ghi_chu: kq.ghi_chu }; });
    });
  }

  var XW_XULY = {
    CAI_DAT_MAC_DINH: CAI_DAT_MAC_DINH,
    gopCaiDat: gopCaiDat,
    doVungChoLo: doVungChoLo,
    hocLopPhuChoLo: hocLopPhuChoLo,
    xuLyMotAnh: xuLyMotAnh,
    xuLyZip: xuLyZip,
    xuLyNhieuAnh: xuLyNhieuAnh,
  };
  goc.XW_XULY = XW_XULY;
  if (typeof module !== "undefined" && module.exports) module.exports = XW_XULY;
})(typeof globalThis !== "undefined" ? globalThis : this);

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
    return docVaiAnh(cacMuc, soMau || 8).then(doVungTuAnh);
  }

  /** Phan do vung, lam tren cac anh da giai ma san. */
  function doVungTuAnh(anhMau) {
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
  }

  /** Doc vai anh dau cua lo ra de hoc / de do vung. */
  function docVaiAnh(cacMuc, soMau) {
    var anhMau = [];
    var day = Promise.resolve();
    cacMuc.slice(0, soMau || 14).forEach(function (m) {
      day = day.then(function () {
        return m.doc().then(function (d) { return ANH.docAnh(d, m.ten); })
          .then(function (a) { anhMau.push(a); })
          .catch(function () { /* anh hong thi bo qua, khong chan ca lo */ });
      });
    });
    return day.then(function () { return anhMau; });
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
   * Chuan bi cho ca lo: tim cho logo va hoc lop phu, chi doc anh MOT lan.
   * Tra Promise<{ mo_hinh, vung, ghi_chu }>. mo_hinh = null -> se va nen.
   *
   * Thu tu:
   *   1. Nguoi dung da chi ro vung -> hoc dung trong vung do.
   *   2. Tu dong: de chinh lop phu tim ra cho logo (thu tung goc anh). Dang tin
   *      hon han bo do net sac - tren anh vector phang, ban chan trang cua hinh
   *      que sang hon nen nhieu hon ca watermark nen bo do cu bam nham vao chan
   *      roi va nat cho do, con logo thi con nguyen.
   *   3. Khong ra thi do vung theo net sac, roi thu hoc lop phu ngay trong vung
   *      vua do duoc (watermark dang chu dai khong lot vao o goc o buoc 2).
   *   4. Van khong ra thi va nen nhu cu.
   */
  function chuanBiChoLo(cacMuc, vungNguoiDung, soMau) {
    return docVaiAnh(cacMuc, soMau).then(function (anhMau) {
      var kt = anhMau.length ? { rong: anhMau[0].rong, cao: anhMau[0].cao } : null;
      function xong(mh, vung, ghiChu) {
        if (mh) mh.kich_thuoc = kt;
        return { mo_hinh: mh, vung: vung, ghi_chu: ghiChu, kich_thuoc: kt };
      }
      var duAnh = anhMau.length >= LOI.SO_ANH_TOI_THIEU;

      if (vungNguoiDung) {
        var mh0 = duAnh ? LOI.hocLopPhu(anhMau, vungNguoiDung) : null;
        return xong(mh0, vungNguoiDung, mh0
          ? "hoc lop phu tu " + mh0.so_anh + " anh trong vung ban chon"
          : "vung do nguoi dung chon");
      }

      if (duAnh) {
        var kq = LOI.timLopPhu(anhMau);
        if (kq.mo_hinh) return xong(kq.mo_hinh, kq.vung, kq.ghi_chu);
      }

      var kqNet = doVungTuAnh(anhMau);
      if (kqNet.vung && duAnh) {
        var mh2 = LOI.hocLopPhu(anhMau, kqNet.vung);
        if (mh2) {
          return xong(mh2, LOI.noVung(LOI.baoAlpha(mh2), 2, kt.rong, kt.cao),
                      "hoc lop phu tu " + mh2.so_anh + " anh (" + kqNet.ghi_chu + ")");
        }
      }
      return xong(null, kqNet.vung, kqNet.ghi_chu);
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

      var tuDong = LOI.phanTichVung(cd.vung, 1000, 1000) === null;

      return chuanBiChoLo(anhMuc, tuDong ? null : cd.vung_pixel || null).then(function (kq) {
        if (tuDong && !kq.vung) {
          throw new Error("Khong tu do duoc vung watermark (" + kq.ghi_chu
            + "). Hay chon goc cu the trong phan cai dat.");
        }
        var vungPixel = kq.vung;   // null = dung chuoi cai dat cho tung anh
        var raMuc = [];
        var xong = 0;
        var moHinh = kq.mo_hinh || null;
        var day = Promise.resolve();

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
    var tuDong = LOI.phanTichVung(cd.vung, 1000, 1000) === null;
    var doVung = chuanBiChoLo(muc, tuDong ? null : cd.vung_pixel || null);

    return doVung.then(function (kq) {
      if (tuDong && !kq.vung) {
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
              xem_thu: cd.xem_thu, mo_hinh: kq.mo_hinh,
            });
          }).then(function (blob) {
            ra.push({ ten: m.ten, blob: blob });
            if (baoTien) baoTien(vt + 1, muc.length, m.ten);
          });
        });
      });
      return day.then(function () {
        return { cac_anh: ra, vung: kq.vung, ghi_chu: kq.ghi_chu,
                 cach_da_dung: kq.mo_hinh
                   ? "gỡ lớp phủ (học từ " + kq.mo_hinh.so_anh + " ảnh)"
                   : "vá theo cấu trúc nền" };
      });
    });
  }

  var XW_XULY = {
    CAI_DAT_MAC_DINH: CAI_DAT_MAC_DINH,
    gopCaiDat: gopCaiDat,
    doVungChoLo: doVungChoLo,
    chuanBiChoLo: chuanBiChoLo,
    xuLyMotAnh: xuLyMotAnh,
    xuLyZip: xuLyZip,
    xuLyNhieuAnh: xuLyNhieuAnh,
  };
  goc.XW_XULY = XW_XULY;
  if (typeof module !== "undefined" && module.exports) module.exports = XW_XULY;
})(typeof globalThis !== "undefined" ? globalThis : this);

/* XOA_WATERMARK - loi xu ly anh.
 *
 * Ban JavaScript cua xoa_watermark.py, chay thang trong Chrome (va trong Node
 * de tu kiem tra). Khong dung thu vien ngoai nao.
 *
 * Anh o day luon la object:  { rong, cao, du_lieu }  voi du_lieu la RGBA
 * (Uint8ClampedArray dai rong*cao*4) - dung dang ImageData cua canvas.
 */
(function (goc) {
  "use strict";

  // -------------------------------------------------------------------------
  // 1. Khung vung
  // -------------------------------------------------------------------------

  var GOC_MAC_DINH = {
    "tu-dong": null,
    "logo-duoi-phai": [0.90, 0.88, 0.10, 0.12],
    "logo-duoi-trai": [0.00, 0.88, 0.10, 0.12],
    "logo-tren-phai": [0.90, 0.00, 0.10, 0.12],
    "logo-tren-trai": [0.00, 0.00, 0.10, 0.12],
    "duoi-phai": [0.70, 0.86, 0.30, 0.14],
    "duoi-trai": [0.00, 0.86, 0.30, 0.14],
    "tren-phai": [0.70, 0.00, 0.30, 0.14],
    "tren-trai": [0.00, 0.00, 0.30, 0.14],
    "duoi": [0.00, 0.86, 1.00, 0.14],
    "tren": [0.00, 0.00, 1.00, 0.14],
    "giua": [0.25, 0.40, 0.50, 0.20],
  };

  function gioiHan(vung, rong, cao) {
    var x = Math.max(0, Math.min(Math.round(vung.x), rong - 1));
    var y = Math.max(0, Math.min(Math.round(vung.y), cao - 1));
    var w = Math.max(1, Math.min(Math.round(vung.w), rong - x));
    var h = Math.max(1, Math.min(Math.round(vung.h), cao - y));
    return { x: x, y: y, w: w, h: h };
  }

  function noVung(vung, them, rong, cao) {
    return gioiHan(
      { x: vung.x - them, y: vung.y - them, w: vung.w + 2 * them, h: vung.h + 2 * them },
      rong, cao
    );
  }

  /** Doi ten goc ("duoi-phai") hoac "x,y,w,h" thanh khung pixel. */
  function phanTichVung(chuoi, rong, cao) {
    var ten = String(chuoi || "").trim().toLowerCase().replace(/_/g, "-");
    if (ten === "" || ten === "tu-dong" || ten === "auto") return null;

    if (Object.prototype.hasOwnProperty.call(GOC_MAC_DINH, ten)) {
      var t = GOC_MAC_DINH[ten];
      if (!t) return null;
      return gioiHan(
        { x: t[0] * rong, y: t[1] * cao, w: t[2] * rong, h: t[3] * cao }, rong, cao
      );
    }

    var manh = ten.split(/[,;]/).filter(function (m) { return m.trim() !== ""; });
    if (manh.length !== 4) throw new Error("Khong hieu vung '" + chuoi + "'");
    function so(m, chieu) {
      m = m.trim();
      if (m.slice(-1) === "%") return (parseFloat(m) / 100) * chieu;
      return parseFloat(m);
    }
    var v = {
      x: so(manh[0], rong), y: so(manh[1], cao),
      w: so(manh[2], rong), h: so(manh[3], cao),
    };
    if (!(v.w > 0) || !(v.h > 0)) throw new Error("Vung '" + chuoi + "' co rong/cao <= 0");
    return gioiHan(v, rong, cao);
  }

  // -------------------------------------------------------------------------
  // 2. Xam, do net, thu nho
  // -------------------------------------------------------------------------

  function anhXam(anh) {
    var n = anh.rong * anh.cao;
    var d = anh.du_lieu;
    var ra = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var j = i * 4;
      ra[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
    }
    return ra;
  }

  /** Thu nho anh xam bang phep noi suy song tuyen. */
  function thuNhoXam(xam, rong, cao, rongMoi, caoMoi) {
    var ra = new Float32Array(rongMoi * caoMoi);
    var tiX = rong / rongMoi, tiY = cao / caoMoi;
    for (var y = 0; y < caoMoi; y++) {
      var fy = (y + 0.5) * tiY - 0.5;
      var y0 = Math.floor(fy); var wy = fy - y0;
      if (y0 < 0) { y0 = 0; wy = 0; }
      var y1 = Math.min(cao - 1, y0 + 1);
      for (var x = 0; x < rongMoi; x++) {
        var fx = (x + 0.5) * tiX - 0.5;
        var x0 = Math.floor(fx); var wx = fx - x0;
        if (x0 < 0) { x0 = 0; wx = 0; }
        var x1 = Math.min(rong - 1, x0 + 1);
        var a = xam[y0 * rong + x0], b = xam[y0 * rong + x1];
        var c = xam[y1 * rong + x0], e = xam[y1 * rong + x1];
        ra[y * rongMoi + x] =
          a * (1 - wx) * (1 - wy) + b * wx * (1 - wy) + c * (1 - wx) * wy + e * wx * wy;
      }
    }
    return ra;
  }

  /** Do do net kieu Sobel - watermark bao gio cung co vien sac. */
  function doNet(xam, rong, cao) {
    var ra = new Float32Array(rong * cao);
    function lay(x, y) {
      if (x < 0) x = 0; else if (x >= rong) x = rong - 1;
      if (y < 0) y = 0; else if (y >= cao) y = cao - 1;
      return xam[y * rong + x];
    }
    for (var y = 0; y < cao; y++) {
      for (var x = 0; x < rong; x++) {
        var gx = lay(x + 1, y - 1) + 2 * lay(x + 1, y) + lay(x + 1, y + 1)
               - lay(x - 1, y - 1) - 2 * lay(x - 1, y) - lay(x - 1, y + 1);
        var gy = lay(x - 1, y + 1) + 2 * lay(x, y + 1) + lay(x + 1, y + 1)
               - lay(x - 1, y - 1) - 2 * lay(x, y - 1) - lay(x + 1, y - 1);
        ra[y * rong + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    return ra;
  }

  function phanVi(mang, phanTram) {
    var ban = Float32Array.from(mang);
    ban.sort();
    var vt = (phanTram / 100) * (ban.length - 1);
    var d = Math.floor(vt), t = Math.min(ban.length - 1, d + 1);
    return ban[d] + (ban[t] - ban[d]) * (vt - d);
  }

  // -------------------------------------------------------------------------
  // 3. Tu do vi tri watermark tu ca bo anh
  // -------------------------------------------------------------------------

  function noRongMatNa(matNa, rong, cao, soLan) {
    var ra = matNa;
    for (var lan = 0; lan < soLan; lan++) {
      var moi = new Uint8Array(ra);
      for (var y = 0; y < cao; y++) {
        for (var x = 0; x < rong; x++) {
          if (!ra[y * rong + x]) continue;
          if (y > 0) moi[(y - 1) * rong + x] = 1;
          if (y < cao - 1) moi[(y + 1) * rong + x] = 1;
          if (x > 0) moi[y * rong + x - 1] = 1;
          if (x < rong - 1) moi[y * rong + x + 1] = 1;
        }
      }
      ra = moi;
    }
    return ra;
  }

  /** Tach mat na thanh cac mang lien thong, to truoc nho sau. */
  function cacCum(co, rong, cao) {
    var daXet = new Uint8Array(rong * cao);
    var cum = [];
    var hangDoi = new Int32Array(rong * cao);
    for (var goc0 = 0; goc0 < co.length; goc0++) {
      if (!co[goc0] || daXet[goc0]) continue;
      var dau = 0, cuoi = 0;
      hangDoi[cuoi++] = goc0; daXet[goc0] = 1;
      var diem = [];
      while (dau < cuoi) {
        var i = hangDoi[dau++];
        diem.push(i);
        var y = (i / rong) | 0, x = i - y * rong;
        if (y > 0 && co[i - rong] && !daXet[i - rong]) { daXet[i - rong] = 1; hangDoi[cuoi++] = i - rong; }
        if (y < cao - 1 && co[i + rong] && !daXet[i + rong]) { daXet[i + rong] = 1; hangDoi[cuoi++] = i + rong; }
        if (x > 0 && co[i - 1] && !daXet[i - 1]) { daXet[i - 1] = 1; hangDoi[cuoi++] = i - 1; }
        if (x < rong - 1 && co[i + 1] && !daXet[i + 1]) { daXet[i + 1] = 1; hangDoi[cuoi++] = i + 1; }
      }
      cum.push(diem);
    }
    cum.sort(function (a, b) { return b.length - a.length; });
    return cum;
  }

  function baoQuanh(cacCumDiem, rong) {
    var xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
    for (var c = 0; c < cacCumDiem.length; c++) {
      var diem = cacCumDiem[c];
      for (var k = 0; k < diem.length; k++) {
        var i = diem[k];
        var y = (i / rong) | 0, x = i - y * rong;
        if (x < xMin) xMin = x; if (x > xMax) xMax = x;
        if (y < yMin) yMin = y; if (y > yMax) yMax = y;
      }
    }
    return { x: xMin, y: yMin, w: xMax - xMin + 1, h: yMax - yMin + 1 };
  }

  /**
   * So nhieu anh cung bo: net nao CO MAT O MOI ANH thi do la watermark.
   * Tra { vung, ghi_chu } - vung = null nghia la khong chac chan.
   */
  function timVungTuDong(cacAnh, toiDaTiLe) {
    toiDaTiLe = toiDaTiLe || 0.15;
    if (!cacAnh || cacAnh.length < 3) {
      return { vung: null, ghi_chu: "can it nhat 3 anh cung kich thuoc de tu do vi tri" };
    }
    var rong = cacAnh[0].rong, cao = cacAnh[0].cao;
    var tiLe = Math.min(1, 640 / Math.max(1, rong));
    var rNho = Math.max(32, Math.round(rong * tiLe));
    var cNho = Math.max(32, Math.round(cao * tiLe));

    var xam = [];
    for (var i = 0; i < Math.min(cacAnh.length, 16); i++) {
      if (cacAnh[i].rong !== rong || cacAnh[i].cao !== cao) continue;
      xam.push(thuNhoXam(anhXam(cacAnh[i]), rong, cao, rNho, cNho));
    }
    if (xam.length < 3) {
      return { vung: null, ghi_chu: "can it nhat 3 anh CUNG kich thuoc" };
    }

    // anh giong het nhau thi khong tach noi watermark khoi noi dung
    var n = rNho * cNho, tongLech = 0;
    for (var p = 0; p < n; p++) {
      var tb = 0;
      for (var a = 0; a < xam.length; a++) tb += xam[a][p];
      tb /= xam.length;
      var v2 = 0;
      for (var b = 0; b < xam.length; b++) { var d = xam[b][p] - tb; v2 += d * d; }
      tongLech += Math.sqrt(v2 / xam.length);
    }
    if (tongLech / n < 2.0) {
      return { vung: null, ghi_chu: "cac anh gan nhu giong het nhau, khong tach duoc watermark" };
    }

    var net = xam.map(function (x) { return doNet(x, rNho, cNho); });
    // lay muc 20% thap nhat: 1 anh le loi khong lam hong ket qua
    var chung = new Float32Array(n);
    var tam = new Float32Array(net.length);
    var viTri = Math.min(net.length - 1, Math.floor(0.2 * (net.length - 1)));
    for (var q = 0; q < n; q++) {
      for (var m = 0; m < net.length; m++) tam[m] = net[m][q];
      var sx = Float32Array.from(tam); sx.sort();
      chung[q] = sx[viTri];
    }

    var caoNhat = 0;
    for (var t = 0; t < n; t++) if (chung[t] > caoNhat) caoNhat = chung[t];
    var nguong = Math.max(15, 0.25 * caoNhat);
    var ungVien = new Uint8Array(n);
    var dem = 0;
    for (var u = 0; u < n; u++) if (chung[u] > nguong) { ungVien[u] = 1; dem++; }
    if (dem < 8) {
      return { vung: null, ghi_chu: "khong thay net nao xuat hien o tat ca cac anh" };
    }

    var cum = cacCum(noRongMatNa(ungVien, rNho, cNho, 2), rNho, cNho);
    if (!cum.length) return { vung: null, ghi_chu: "khong gom duoc thanh cum" };

    // Loc bo nhung thu "anh nao cung co" nhung KHONG phai watermark: duong ranh
    // giua nen va dat, khung vien, thanh mau chay het chieu ngang... Watermark
    // that la mot dom NHO, GON, thuong nam sat ria anh.
    var toiDa = toiDaTiLe * n;
    var ungVienCum = [];
    for (var c2 = 0; c2 < cum.length; c2++) {
      var diem = cum[c2];
      var bb = baoQuanh([diem], rNho);
      if (bb.w > 0.6 * rNho && bb.h < 0.08 * cNho) continue;   // duong ke ngang
      if (bb.h > 0.6 * cNho && bb.w < 0.08 * rNho) continue;   // duong ke doc
      if (bb.w > 0.5 * rNho || bb.h > 0.5 * cNho) continue;    // qua rong / qua cao
      if (bb.w * bb.h > toiDa) continue;                       // qua to so voi ca anh

      var tong = 0;
      for (var k = 0; k < diem.length; k++) tong += chung[diem[k]];
      var manh = tong / diem.length;                           // net cang manh cang chac
      var dac = diem.length / (bb.w * bb.h);                   // cang gon cang giong logo
      var riaX = Math.min(bb.x, rNho - (bb.x + bb.w));
      var riaY = Math.min(bb.y, cNho - (bb.y + bb.h));
      var sanRia = (riaX < 0.15 * rNho || riaY < 0.15 * cNho) ? 1.6 : 1.0;
      ungVienCum.push({
        diem: diem, bb: bb,
        diem_so: manh * Math.sqrt(diem.length) * (0.6 + 0.4 * dac) * sanRia,
      });
    }
    if (!ungVienCum.length) {
      return {
        vung: null,
        ghi_chu: "chi thay duong ke / mang lon giong nhau giua cac anh, khong thay logo nho nao",
      };
    }
    ungVienCum.sort(function (a, b) { return b.diem_so - a.diem_so; });

    // gop them cum ke ben (logo va chu thuong tach roi), khong voi ra xa
    var gom = [ungVienCum[0].diem];
    var khoangCach = 0.03 * rNho;
    for (var c3 = 1; c3 < ungVienCum.length; c3++) {
      if (ungVienCum[c3].diem_so < 0.25 * ungVienCum[0].diem_so) continue;
      var dang = baoQuanh(gom, rNho), b2 = ungVienCum[c3].bb;
      var cachX = Math.max(0, Math.max(dang.x - (b2.x + b2.w), b2.x - (dang.x + dang.w)));
      var cachY = Math.max(0, Math.max(dang.y - (b2.y + b2.h), b2.y - (dang.y + dang.h)));
      if (cachX > khoangCach || cachY > khoangCach) continue;
      var thu = baoQuanh(gom.concat([ungVienCum[c3].diem]), rNho);
      if (thu.w * thu.h <= toiDa) gom.push(ungVienCum[c3].diem);
    }

    var vNho = baoQuanh(gom, rNho);

    var hsX = rong / rNho, hsY = cao / cNho;
    var vung = noVung({
      x: Math.floor(vNho.x * hsX), y: Math.floor(vNho.y * hsY),
      w: Math.ceil(vNho.w * hsX), h: Math.ceil(vNho.h * hsY),
    }, Math.max(2, Math.round(0.006 * rong)), rong, cao);
    return { vung: vung, ghi_chu: "do duoc tu " + xam.length + " anh" };
  }

  // -------------------------------------------------------------------------
  // 4. Mat na - chon dung pixel can xoa
  // -------------------------------------------------------------------------

  /** locMau: "tat" | "sang" | "toi" | "#RRGGBB" */
  function taoMatNa(anh, vung, locMau, dungSai, noThem) {
    var rong = anh.rong, cao = anh.cao, d = anh.du_lieu;
    var v = gioiHan(vung, rong, cao);
    var trongKhung = new Uint8Array(rong * cao);
    for (var y = v.y; y < v.y + v.h; y++) {
      for (var x = v.x; x < v.x + v.w; x++) trongKhung[y * rong + x] = 1;
    }

    var cheDo = String(locMau || "tat").trim().toLowerCase();
    if (cheDo === "tat" || cheDo === "khong" || cheDo === "off") return trongKhung;

    var chon = new Uint8Array(rong * cao);
    var i, j;
    if (cheDo === "sang" || cheDo === "toi") {
      var sang = [];
      for (y = v.y; y < v.y + v.h; y++) {
        for (x = v.x; x < v.x + v.w; x++) {
          j = (y * rong + x) * 4;
          sang.push(0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]);
        }
      }
      var sx = Float64Array.from(sang); sx.sort();
      var moc = sx[Math.floor(sx.length / 2)];
      var nguong = dungSai > 0 ? dungSai : 25;
      for (y = v.y; y < v.y + v.h; y++) {
        for (x = v.x; x < v.x + v.w; x++) {
          i = y * rong + x; j = i * 4;
          var lum = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
          var hop = cheDo === "sang" ? lum > moc + nguong : lum < moc - nguong;
          // watermark kieu nay gan nhu luon trang / xam / den -> bo qua mang mau ruc
          var maxC = Math.max(d[j], d[j + 1], d[j + 2]);
          var minC = Math.min(d[j], d[j + 1], d[j + 2]);
          if (hop && maxC - minC < 60) chon[i] = 1;
        }
      }
    } else {
      var s = cheDo.replace("#", "");
      if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
      var r0 = parseInt(s.slice(0, 2), 16), g0 = parseInt(s.slice(2, 4), 16),
          b0 = parseInt(s.slice(4, 6), 16);
      var xa = dungSai > 0 ? dungSai : 60;
      for (y = v.y; y < v.y + v.h; y++) {
        for (x = v.x; x < v.x + v.w; x++) {
          i = y * rong + x; j = i * 4;
          var dr = d[j] - r0, dg = d[j + 1] - g0, db = d[j + 2] - b0;
          if (Math.sqrt(dr * dr + dg * dg + db * db) <= xa) chon[i] = 1;
        }
      }
    }

    var matNa = noRongMatNa(chon, rong, cao, noThem == null ? 2 : noThem);
    var soPixel = 0;
    for (i = 0; i < matNa.length; i++) {
      matNa[i] = matNa[i] && trongKhung[i] ? 1 : 0;
      soPixel += matNa[i];
    }
    var tiLe = soPixel / Math.max(1, v.w * v.h);
    if (tiLe < 0.002 || tiLe > 0.92) return trongKhung;  // loc chat/rong qua -> ca khung
    return matNa;
  }

  // -------------------------------------------------------------------------
  // 5. Va lai nen (khuech tan nhieu muc)
  // -------------------------------------------------------------------------

  function giamDoi(rgb, biet, rong, cao) {
    var r2 = rong >> 1, c2 = cao >> 1;
    var rgb2 = new Float32Array(r2 * c2 * 3);
    var biet2 = new Uint8Array(r2 * c2);
    for (var y = 0; y < c2; y++) {
      for (var x = 0; x < r2; x++) {
        var tong = [0, 0, 0], dem = 0;
        for (var dy = 0; dy < 2; dy++) {
          for (var dx = 0; dx < 2; dx++) {
            var i = (2 * y + dy) * rong + (2 * x + dx);
            if (!biet[i]) continue;
            dem++;
            tong[0] += rgb[i * 3]; tong[1] += rgb[i * 3 + 1]; tong[2] += rgb[i * 3 + 2];
          }
        }
        var k = y * r2 + x;
        if (dem) {
          biet2[k] = 1;
          rgb2[k * 3] = tong[0] / dem;
          rgb2[k * 3 + 1] = tong[1] / dem;
          rgb2[k * 3 + 2] = tong[2] / dem;
        }
      }
    }
    return { rgb: rgb2, biet: biet2, rong: r2, cao: c2 };
  }

  /** Lap Gauss-Seidel: moi pixel trong lo = trung binh 4 pixel ke ben. */
  function lamMin(rgb, danhSachLo, rong, cao, soVong) {
    for (var vong = 0; vong < soVong; vong++) {
      for (var k = 0; k < danhSachLo.length; k++) {
        var i = danhSachLo[k];
        var y = (i / rong) | 0, x = i - y * rong;
        var tren = y > 0 ? i - rong : i, duoi = y < cao - 1 ? i + rong : i;
        var trai = x > 0 ? i - 1 : i, phai = x < rong - 1 ? i + 1 : i;
        for (var c = 0; c < 3; c++) {
          rgb[i * 3 + c] = 0.25 * (
            rgb[tren * 3 + c] + rgb[duoi * 3 + c] + rgb[trai * 3 + c] + rgb[phai * 3 + c]
          );
        }
      }
    }
  }

  function danhSachChiSo(matNa) {
    var ds = [];
    for (var i = 0; i < matNa.length; i++) if (matNa[i]) ds.push(i);
    return Int32Array.from(ds);
  }

  /**
   * Va lai vung bi che. Thu nho dan cho den khi lo chi con vai pixel, to mau o
   * muc nho nhat roi phong nguoc len tung muc, moi muc lam min lai vien.
   */
  function vaLai(anh, matNa, soVong) {
    soVong = soVong || 40;
    var rong = anh.rong, cao = anh.cao, d = anh.du_lieu, n = rong * cao;

    var coLo = false;
    for (var i0 = 0; i0 < n; i0++) if (matNa[i0]) { coLo = true; break; }
    if (!coLo) return anh;

    var rgb = new Float32Array(n * 3);
    var biet = new Uint8Array(n);
    for (var i = 0; i < n; i++) {
      rgb[i * 3] = d[i * 4]; rgb[i * 3 + 1] = d[i * 4 + 1]; rgb[i * 3 + 2] = d[i * 4 + 2];
      biet[i] = matNa[i] ? 0 : 1;
    }

    var thap = [{ rgb: rgb, biet: biet, rong: rong, cao: cao }];
    while (thap.length < 12) {
      var cuoi = thap[thap.length - 1];
      if (Math.min(cuoi.rong, cuoi.cao) <= 16) break;
      var thieu = false;
      for (var b = 0; b < cuoi.biet.length; b++) if (!cuoi.biet[b]) { thieu = true; break; }
      if (!thieu) break;
      thap.push(giamDoi(cuoi.rgb, cuoi.biet, cuoi.rong, cuoi.cao));
    }

    // muc nho nhat: to mau trung binh cua nhung pixel con biet
    var muc = thap[thap.length - 1];
    var lo = [];
    var tb = [0, 0, 0], dem = 0;
    for (var p = 0; p < muc.biet.length; p++) {
      if (muc.biet[p]) {
        dem++;
        tb[0] += muc.rgb[p * 3]; tb[1] += muc.rgb[p * 3 + 1]; tb[2] += muc.rgb[p * 3 + 2];
      } else lo.push(p);
    }
    if (lo.length) {
      for (var c0 = 0; c0 < 3; c0++) tb[c0] = dem ? tb[c0] / dem : 128;
      for (var l = 0; l < lo.length; l++) {
        muc.rgb[lo[l] * 3] = tb[0];
        muc.rgb[lo[l] * 3 + 1] = tb[1];
        muc.rgb[lo[l] * 3 + 2] = tb[2];
      }
      lamMin(muc.rgb, Int32Array.from(lo), muc.rong, muc.cao, soVong);
    }

    for (var m = thap.length - 2; m >= 0; m--) {
      var duoi = thap[m + 1], nay = thap[m];
      var dsLo = [];
      for (var q = 0; q < nay.biet.length; q++) {
        if (nay.biet[q]) continue;
        dsLo.push(q);
        var y = (q / nay.rong) | 0, x = q - y * nay.rong;
        var yd = Math.min(duoi.cao - 1, y >> 1), xd = Math.min(duoi.rong - 1, x >> 1);
        var k = yd * duoi.rong + xd;
        nay.rgb[q * 3] = duoi.rgb[k * 3];
        nay.rgb[q * 3 + 1] = duoi.rgb[k * 3 + 1];
        nay.rgb[q * 3 + 2] = duoi.rgb[k * 3 + 2];
      }
      lamMin(nay.rgb, Int32Array.from(dsLo), nay.rong, nay.cao, soVong);
    }

    var ra = new Uint8ClampedArray(d);
    var ketQua = thap[0].rgb;
    for (var z = 0; z < n; z++) {
      if (!matNa[z]) continue;
      ra[z * 4] = ketQua[z * 3];
      ra[z * 4 + 1] = ketQua[z * 3 + 1];
      ra[z * 4 + 2] = ketQua[z * 3 + 2];
    }
    return { rong: rong, cao: cao, du_lieu: ra };
  }

  /**
   * Va theo CAU TRUC nen - cach nay giu duoc net sac cua nen phang / vector.
   *
   * Voi moi pixel trong lo, nhin sang 4 huong tim pixel con lanh gan nhat:
   * trai/phai cung hang, tren/duoi cung cot. Huong nao co HAI DAU GIONG MAU NHAU
   * thi huong do dang tin - noi thang mau giua hai dau. Nen la dai mau ngang
   * (xanh o tren, vang o duoi) thi hang nao cung dong mau, noi ngang la ra dung
   * mau cua chinh hang do => ranh gioi xanh/vang khong bi keo nhoe.
   *
   * Cho nao ca hai huong deu khong tin duoc (nen roi, anh chup that) thi tra ve
   * cach va khuech tan cho muot.
   */
  function vaCauTruc(anh, matNa, anhDuPhong) {
    var W = anh.rong, H = anh.cao, d = anh.du_lieu, n = W * H;
    var biet = new Uint8Array(n);
    var coLo = false;
    for (var i = 0; i < n; i++) {
      biet[i] = matNa[i] ? 0 : 1;
      if (matNa[i]) coLo = true;
    }
    if (!coLo) return anh;

    // pixel lanh gan nhat theo 4 huong (quet 4 luot, moi luot O(so pixel))
    var trai = new Int32Array(n), phai = new Int32Array(n);
    var tren = new Int32Array(n), duoi = new Int32Array(n);
    var y, x, k;
    for (y = 0; y < H; y++) {
      var cuoiT = -1;
      for (x = 0; x < W; x++) { k = y * W + x; if (biet[k]) cuoiT = k; trai[k] = cuoiT; }
      var cuoiP = -1;
      for (x = W - 1; x >= 0; x--) { k = y * W + x; if (biet[k]) cuoiP = k; phai[k] = cuoiP; }
    }
    for (x = 0; x < W; x++) {
      var cuoiTr = -1;
      for (y = 0; y < H; y++) { k = y * W + x; if (biet[k]) cuoiTr = k; tren[k] = cuoiTr; }
      var cuoiD = -1;
      for (y = H - 1; y >= 0; y--) { k = y * W + x; if (biet[k]) cuoiD = k; duoi[k] = cuoiD; }
    }

    function khacMau(a, b) {
      return (Math.abs(d[a * 4] - d[b * 4]) + Math.abs(d[a * 4 + 1] - d[b * 4 + 1])
            + Math.abs(d[a * 4 + 2] - d[b * 4 + 2])) / 3;
    }

    var ra = new Uint8ClampedArray(d);
    var duPhong = anhDuPhong ? anhDuPhong.du_lieu : null;

    for (var p = 0; p < n; p++) {
      if (!matNa[p]) continue;
      var py = (p / W) | 0, px = p - py * W;
      var tong = [0, 0, 0], tongW = 0, tinNhat = 0;

      // huong ngang
      var a1 = trai[p], b1 = phai[p];
      if (a1 >= 0 || b1 >= 0) {
        var kq = motHuong(a1, b1, px, a1 >= 0 ? a1 - py * W : 0, b1 >= 0 ? b1 - py * W : 0);
        tong[0] += kq.w * kq.c[0]; tong[1] += kq.w * kq.c[1]; tong[2] += kq.w * kq.c[2];
        tongW += kq.w;
        if (kq.tin > tinNhat) tinNhat = kq.tin;
      }
      // huong doc
      var a2 = tren[p], b2 = duoi[p];
      if (a2 >= 0 || b2 >= 0) {
        var kq2 = motHuong(a2, b2, py, a2 >= 0 ? (a2 / W) | 0 : 0, b2 >= 0 ? (b2 / W) | 0 : 0);
        tong[0] += kq2.w * kq2.c[0]; tong[1] += kq2.w * kq2.c[1]; tong[2] += kq2.w * kq2.c[2];
        tongW += kq2.w;
        if (kq2.tin > tinNhat) tinNhat = kq2.tin;
      }

      if (tongW <= 0) {
        if (duPhong) {
          ra[p * 4] = duPhong[p * 4];
          ra[p * 4 + 1] = duPhong[p * 4 + 1];
          ra[p * 4 + 2] = duPhong[p * 4 + 2];
        }
        continue;
      }

      var cauTruc = [tong[0] / tongW, tong[1] / tongW, tong[2] / tongW];
      if (duPhong && tinNhat < 1) {
        // nen roi -> pha them ban khuech tan cho khoi thay via
        for (var c = 0; c < 3; c++) {
          ra[p * 4 + c] = tinNhat * cauTruc[c] + (1 - tinNhat) * duPhong[p * 4 + c];
        }
      } else {
        ra[p * 4] = cauTruc[0]; ra[p * 4 + 1] = cauTruc[1]; ra[p * 4 + 2] = cauTruc[2];
      }
    }

    /** Tinh mau + do tin cay cua mot huong (2 dau a, b tren cung truc). */
    function motHuong(a, b, viTri, toaA, toaB) {
      if (a < 0 || b < 0) {           // chi mot dau co pixel lanh
        var chi = a >= 0 ? a : b;
        var xa = Math.abs(viTri - (a >= 0 ? toaA : toaB));
        return {
          c: [d[chi * 4], d[chi * 4 + 1], d[chi * 4 + 2]],
          w: 0.25 / (1 + xa / 40), tin: 0.3 / (1 + xa / 40),
        };
      }
      var dA = Math.max(1, Math.abs(viTri - toaA));
      var dB = Math.max(1, Math.abs(viTri - toaB));
      var t = dA / (dA + dB);          // noi thang giua hai dau
      var khac = khacMau(a, b);
      var tin = 1 / (1 + khac / 6);    // hai dau cang giong nhau cang dang tin
      return {
        c: [
          d[a * 4] * (1 - t) + d[b * 4] * t,
          d[a * 4 + 1] * (1 - t) + d[b * 4 + 1] * t,
          d[a * 4 + 2] * (1 - t) + d[b * 4 + 2] * t,
        ],
        w: tin * tin / (1 + (dA + dB) / 60),
        tin: tin,
      };
    }

    return { rong: W, cao: H, du_lieu: ra };
  }

  /** To de vung watermark bang mau lay tu vien xung quanh. */
  function toMauNen(anh, matNa, vung) {
    var rong = anh.rong, cao = anh.cao, d = anh.du_lieu;
    var ngoai = noVung(vung, Math.max(3, Math.floor(Math.min(vung.w, vung.h) / 8)), rong, cao);
    var mau = [[], [], []];
    for (var y = ngoai.y; y < ngoai.y + ngoai.h; y++) {
      for (var x = ngoai.x; x < ngoai.x + ngoai.w; x++) {
        var i = y * rong + x;
        if (matNa[i]) continue;
        mau[0].push(d[i * 4]); mau[1].push(d[i * 4 + 1]); mau[2].push(d[i * 4 + 2]);
      }
    }
    var giua = [128, 128, 128];
    for (var c = 0; c < 3; c++) {
      if (!mau[c].length) continue;
      mau[c].sort(function (a, b) { return a - b; });
      giua[c] = mau[c][Math.floor(mau[c].length / 2)];
    }
    var ra = new Uint8ClampedArray(d);
    for (var k = 0; k < matNa.length; k++) {
      if (!matNa[k]) continue;
      ra[k * 4] = giua[0]; ra[k * 4 + 1] = giua[1]; ra[k * 4 + 2] = giua[2];
    }
    return { rong: rong, cao: cao, du_lieu: ra };
  }

  /** Ve khung do de soi truoc khi chay ca lo. */
  function veKhung(anh, vung) {
    var rong = anh.rong, cao = anh.cao;
    var ra = new Uint8ClampedArray(anh.du_lieu);
    var v = gioiHan(vung, rong, cao);
    var day = Math.max(2, Math.round(Math.min(rong, cao) * 0.004));
    function cham(x, y) {
      if (x < 0 || y < 0 || x >= rong || y >= cao) return;
      var i = (y * rong + x) * 4;
      ra[i] = 255; ra[i + 1] = 0; ra[i + 2] = 0; ra[i + 3] = 255;
    }
    for (var t = 0; t < day; t++) {
      for (var x = v.x; x < v.x + v.w; x++) { cham(x, v.y + t); cham(x, v.y + v.h - 1 - t); }
      for (var y = v.y; y < v.y + v.h; y++) { cham(v.x + t, y); cham(v.x + v.w - 1 - t, y); }
    }
    return { rong: rong, cao: cao, du_lieu: ra };
  }

  /** Duong ong day du cho 1 anh. */
  function xoaWatermark(anh, caiDat) {
    caiDat = caiDat || {};
    var vung = caiDat.vung_pixel || phanTichVung(caiDat.vung || "duoi-phai", anh.rong, anh.cao);
    if (!vung) throw new Error("Chua xac dinh duoc vung watermark");
    vung = gioiHan(vung, anh.rong, anh.cao);
    if (caiDat.xem_thu) return veKhung(anh, vung);

    var matNa = taoMatNa(anh, vung, caiDat.loc_mau || "tat", caiDat.dung_sai || 0,
                         caiDat.no_rong == null ? 2 : caiDat.no_rong);
    if (caiDat.cach === "to") return toMauNen(anh, matNa, vung);
    if (caiDat.cach === "va-mem") return vaLai(anh, matNa);
    // mac dinh: va theo cau truc, lay ban khuech tan lam nen du phong
    return vaCauTruc(anh, matNa, vaLai(anh, matNa));
  }

  var XW = {
    GOC_MAC_DINH: GOC_MAC_DINH,
    gioiHan: gioiHan,
    noVung: noVung,
    phanTichVung: phanTichVung,
    anhXam: anhXam,
    thuNhoXam: thuNhoXam,
    doNet: doNet,
    phanVi: phanVi,
    noRongMatNa: noRongMatNa,
    timVungTuDong: timVungTuDong,
    taoMatNa: taoMatNa,
    vaLai: vaLai,
    vaCauTruc: vaCauTruc,
    toMauNen: toMauNen,
    veKhung: veKhung,
    xoaWatermark: xoaWatermark,
    danhSachChiSo: danhSachChiSo,
  };

  goc.XW_LOI = XW;
  if (typeof module !== "undefined" && module.exports) module.exports = XW;
})(typeof globalThis !== "undefined" ? globalThis : this);

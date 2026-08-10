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
    // O sat goc, do theo dau sao THAT cua Flow: tren anh 1376x768 no nam o
    // 1314,706 co 42x42 - tuc la cach mep phai 1.5%..4.5% be rong va cach day
    // 2.6%..8.1% chieu cao. O nay phai trum het khoang do va con chua le.
    "logo-duoi-phai": [0.93, 0.88, 0.07, 0.12],
    "logo-duoi-trai": [0.00, 0.88, 0.07, 0.12],
    "logo-tren-phai": [0.93, 0.00, 0.07, 0.12],
    "logo-tren-trai": [0.00, 0.00, 0.07, 0.12],
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
      // Watermark gan nhu luon nam sat ria anh. Cang vao giua cang dang ngo -
      // do thuong la noi dung lap lai (dau nguoi, cai bang) chu khong phai logo.
      var riaX = Math.min(bb.x, rNho - (bb.x + bb.w)) / rNho;
      var riaY = Math.min(bb.y, cNho - (bb.y + bb.h)) / cNho;
      var ria = Math.min(riaX, riaY);
      var sanRia = ria < 0.15 ? 1.8 : (ria < 0.35 ? 1.0 : 0.35);
      // KHONG thuong theo do to: mot cai dau nguoi lap lai o nhieu anh cung to
      // hon cai logo nhieu lan. Chi cham theo do sac net, do gon va sat ria.
      ungVienCum.push({
        diem: diem, bb: bb,
        diem_so: manh * (0.5 + 0.5 * dac) * sanRia,
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

  /**
   * Tim logo nho SANG MAU o cac goc, chi can MOT anh.
   *
   * Watermark kieu Flow / Gemini la dau sao trang nho nam sat mot goc anh. Tren
   * mot anh don khong so duoc voi anh khac, nhung van nhan ra duoc: no sang han
   * han nen quanh no, gan nhu khong mau (trang / xam), gon, va nam sat goc.
   *
   * Tra { vung, goc, ghi_chu } - vung = null neu khong chac.
   */
  function timLogoMotAnh(anh, tuyChon) {
    tuyChon = tuyChon || {};
    var W = anh.rong, H = anh.cao, d = anh.du_lieu;
    var cacGoc = tuyChon.goc
      ? [tuyChon.goc]
      : ["duoi-phai", "duoi-trai", "tren-phai", "tren-trai"];
    var tiRong = 0.18, tiCao = 0.22;
    var tot = null;

    for (var g = 0; g < cacGoc.length; g++) {
      var ten = cacGoc[g];
      var oW = Math.max(40, Math.round(W * tiRong));
      var oH = Math.max(40, Math.round(H * tiCao));
      var oX = ten.indexOf("phai") >= 0 ? W - oW : 0;
      var oY = ten.indexOf("duoi") >= 0 ? H - oH : 0;

      // nen cua o: lay trung vi do sang
      var sang = [];
      var x, y, i, j;
      for (y = oY; y < oY + oH; y++) {
        for (x = oX; x < oX + oW; x++) {
          j = (y * W + x) * 4;
          sang.push(0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]);
        }
      }
      var sx = Float64Array.from(sang); sx.sort();
      var nen = sx[Math.floor(sx.length / 2)];
      var nguong = Math.max(18, (sx[Math.floor(sx.length * 0.995)] - nen) * 0.45);

      var co = new Uint8Array(oW * oH);
      var demCo = 0;
      for (y = 0; y < oH; y++) {
        for (x = 0; x < oW; x++) {
          j = ((oY + y) * W + (oX + x)) * 4;
          var lum = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
          var ruc = Math.max(d[j], d[j + 1], d[j + 2]) - Math.min(d[j], d[j + 1], d[j + 2]);
          if (lum > nen + nguong && ruc < 60) { co[y * oW + x] = 1; demCo++; }
        }
      }
      if (demCo < 12 || demCo > 0.25 * oW * oH) continue;

      var cum = cacCum(noRongMatNa(co, oW, oH, 2), oW, oH);
      for (var c = 0; c < Math.min(cum.length, 6); c++) {
        var diem = cum[c];
        if (diem.length < 12) continue;
        var bb = baoQuanh([diem], oW);
        var canh = Math.max(bb.w, bb.h);
        if (canh < 8 || canh > 0.55 * Math.min(oW, oH)) continue;   // khong phai logo nho
        if (bb.w > 0.07 * W || bb.h > 0.07 * H) continue;           // dinh vao vat the
        if (bb.w > 4 * bb.h || bb.h > 4 * bb.w) continue;           // dai ngoang -> bo
        var dac = diem.length / (bb.w * bb.h);
        if (dac < 0.15) continue;

        // trung binh do sang vuot nen, va khoang cach toi goc anh
        var tong = 0;
        for (var k = 0; k < diem.length; k++) {
          var ii = diem[k];
          var yy = (ii / oW) | 0, xx = ii - yy * oW;
          var jj = ((oY + yy) * W + (oX + xx)) * 4;
          tong += 0.299 * d[jj] + 0.587 * d[jj + 1] + 0.114 * d[jj + 2] - nen;
        }
        var vuot = tong / diem.length;
        var gocX = ten.indexOf("phai") >= 0 ? oW : 0;
        var gocY = ten.indexOf("duoi") >= 0 ? oH : 0;
        var cach = Math.sqrt(
          Math.pow(bb.x + bb.w / 2 - gocX, 2) + Math.pow(bb.y + bb.h / 2 - gocY, 2)
        ) / Math.max(1, Math.min(oW, oH));
        var diemSo = vuot * dac / (0.25 + cach);

        if (!tot || diemSo > tot.diem_so) {
          tot = {
            diem_so: diemSo, goc: ten,
            vung: noVung({ x: oX + bb.x, y: oY + bb.y, w: bb.w, h: bb.h },
                         Math.max(3, Math.min(12, Math.round(canh * 0.25))), W, H),
            vuot: vuot,
          };
        }
      }
    }

    if (!tot) {
      return { vung: null, goc: null, ghi_chu: "khong thay dom sang nho nao o cac goc anh" };
    }
    // Dom tim duoc to bat thuong = dang dinh ca vat the (chan nguoi, bac thang)
    // chu khong phai rieng cai logo. Tha bao khong biet con hon khoanh bua roi
    // va nat mot mang anh.
    if (tot.vung.w * tot.vung.h > 0.015 * W * H) {
      return {
        vung: null, goc: null,
        ghi_chu: "dom sang o goc dinh lien vao vat the khac nen khong tach rieng duoc logo",
      };
    }
    return {
      vung: tot.vung, goc: tot.goc,
      ghi_chu: "tu tim thay o goc " + tot.goc.replace("-", " ")
        + " (sang hon nen " + Math.round(tot.vuot) + " muc)",
    };
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

    // Do "van" cua nen quanh lo: anh soc ngang (nen tren mot mau, dai duoi mot
    // mau) thi mau doi nhieu theo chieu DOC va gan nhu khong doi theo chieu
    // NGANG. Luc do phai uu tien noi ngang, nhat la khi lo nam sat goc anh -
    // khong co cai nay thi noi doc se keo mau nen tren xuong dai duoi.
    var uuTienNgang = 1, uuTienDoc = 1;
    (function () {
      var xMin = W, yMin = H, xMax = -1, yMax = -1;
      for (var q = 0; q < n; q++) {
        if (!matNa[q]) continue;
        var qy = (q / W) | 0, qx = q - qy * W;
        if (qx < xMin) xMin = qx; if (qx > xMax) xMax = qx;
        if (qy < yMin) yMin = qy; if (qy > yMax) yMax = qy;
      }
      if (xMax < 0) return;
      var le = Math.max(12, Math.min(60, Math.round(Math.max(xMax - xMin, yMax - yMin) * 0.5)));
      var x0 = Math.max(0, xMin - le), x1 = Math.min(W - 2, xMax + le);
      var y0 = Math.max(0, yMin - le), y1 = Math.min(H - 2, yMax + le);
      var tongX = 0, demX = 0, tongY = 0, demY = 0;
      for (var y = y0; y <= y1; y++) {
        for (var x = x0; x <= x1; x++) {
          var i = y * W + x;
          if (!biet[i]) continue;
          if (biet[i + 1]) { tongX += khacMau(i, i + 1); demX++; }
          if (biet[i + W]) { tongY += khacMau(i, i + W); demY++; }
        }
      }
      if (demX < 20 || demY < 20) return;
      var gx = tongX / demX, gy = tongY / demY;
      if (gy > 2 * gx + 0.05) uuTienNgang = 3;       // van ngang -> noi ngang
      else if (gx > 2 * gy + 0.05) uuTienDoc = 3;    // van doc  -> noi doc
    })();

    var ra = new Uint8ClampedArray(d);
    var duPhong = anhDuPhong ? anhDuPhong.du_lieu : null;

    for (var p = 0; p < n; p++) {
      if (!matNa[p]) continue;
      var py = (p / W) | 0, px = p - py * W;

      var a1 = trai[p], b1 = phai[p];
      var ngang = (a1 >= 0 || b1 >= 0)
        ? motHuong(a1, b1, px, a1 >= 0 ? a1 - py * W : 0, b1 >= 0 ? b1 - py * W : 0, 1)
        : null;

      var a2 = tren[p], b2 = duoi[p];
      var doc = (a2 >= 0 || b2 >= 0)
        ? motHuong(a2, b2, py, a2 >= 0 ? (a2 / W) | 0 : 0, b2 >= 0 ? (b2 / W) | 0 : 0, W)
        : null;

      // Hai huong hay cai nhau o goc anh: ngang bao "mau dai duoi", doc bao
      // "mau nen tren". Trung binh hai cai la ra vet toi. Nen chon dut khoat
      // huong nao co diem lanh GAN hon va dang tin hon; chi khi xap xi nhau
      // moi tron - anh gan nhau thi giong nhau, chon gan la an toan nhat.
      var tong = [0, 0, 0], tongW = 0, tinNhat = 0;
      var chon = [];
      if (ngang) ngang.diem *= uuTienNgang;
      if (doc) doc.diem *= uuTienDoc;
      if (ngang && doc) {
        if (ngang.diem >= 1.2 * doc.diem) chon = [ngang];
        else if (doc.diem >= 1.2 * ngang.diem) chon = [doc];
        else chon = [ngang, doc];
      } else if (ngang) chon = [ngang];
      else if (doc) chon = [doc];

      for (var ci = 0; ci < chon.length; ci++) {
        var kq = chon[ci];
        tong[0] += kq.diem * kq.c[0];
        tong[1] += kq.diem * kq.c[1];
        tong[2] += kq.diem * kq.c[2];
        tongW += kq.diem;
        if (kq.tin > tinNhat) tinNhat = kq.tin;
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
      tinNhat = Math.min(1, tinNhat / 0.8);   // tin >= 0.8 la dung han cau truc
      if (duPhong && tinNhat < 1) {
        // nen roi -> pha them ban khuech tan cho khoi thay via
        for (var c = 0; c < 3; c++) {
          ra[p * 4 + c] = tinNhat * cauTruc[c] + (1 - tinNhat) * duPhong[p * 4 + c];
        }
      } else {
        ra[p * 4] = cauTruc[0]; ra[p * 4 + 1] = cauTruc[1]; ra[p * 4 + 2] = cauTruc[2];
      }
    }

    /**
     * Tinh mau + do tin cay cua mot huong (2 dau a, b tren cung truc).
     * buoc = khoang cach 1 buoc theo truc do trong mang du_lieu (1 hoac W).
     */
    function motHuong(a, b, viTri, toaA, toaB, buoc) {
      if (a < 0 || b < 0) {
        // Chi mot dau co pixel lanh - hay gap khi watermark nam sat mep anh.
        // Luc do do DO PHANG ngay tren phia con dung duoc: lay them mot pixel
        // lui vao 3 buoc, hai cai giong nhau nghia la vung do dong mau nen keo
        // thang mau do ra la dung. Khong co buoc nay thi no bo sang huong doc
        // va keo mau tu ben kia ranh gioi sang - dung vet lo hoi truoc.
        var chi = a >= 0 ? a : b;
        var xa = Math.max(1, Math.abs(viTri - (a >= 0 ? toaA : toaB)));
        var lui = a >= 0 ? chi - 3 * buoc : chi + 3 * buoc;
        var phang = (lui >= 0 && lui < n && biet[lui]) ? khacMau(chi, lui) : 0;
        var tinMot = 0.85 / (1 + phang / 6);
        return {
          c: [d[chi * 4], d[chi * 4 + 1], d[chi * 4 + 2]],
          tin: tinMot,
          diem: tinMot / (1 + xa / 40),
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
        tin: tin,
        diem: tin / (1 + Math.min(dA, dB) / 40),
      };
    }

    return { rong: W, cao: H, du_lieu: ra };
  }

  /**
   * HOC LOP PHU tu ca bo anh roi GO NGUOC no ra - khong va, khong dung vao nen.
   *
   * Watermark la mot lop phu mo dap len anh:
   *     nhin_thay = (1 - alpha) * nen + alpha * mau_logo
   * alpha va mau_logo GIONG NHAU o moi anh (logo luon mot cho, mot kieu), chi
   * "nen" la moi anh mot khac. Voi moi diem ta co N cap (nen, nhin_thay) tu N
   * anh; khop duong thang  nhin_thay = a * nen + b  thi a = 1 - alpha va
   * b = alpha * mau_logo. Co a, b roi thi lay lai nen that:
   *     nen = (nhin_thay - b) / a
   *
   * Cai hay: cho nao khong co logo thi a = 1, b = 0 -> giu nguyen tung pixel.
   * Chan nguoi, bac thang, duong ranh mau khong bi dong toi - khac han cach va
   * (von xoa sach ca o roi dung lai tu doan, gap vat the la lo ngay).
   *
   * Cho nao logo dac hoan toan (alpha = 1, a = 0) thi nen bi che het, tru kieu
   * gi cung khong ra - nhung ta biet chac cho do CO logo, nen danh dau lai
   * (dat_cung) de goLopPhu va rieng may diem do bang cach cau truc. Ranh giua
   * "dac" va "khong co logo" phai tach cho ro: lan truoc gop lam mot nen loi
   * dac bi coi la khong co logo va watermark con nguyen tren anh.
   *
   * Lam 3 vong: vong dau lay nen doan tu cach va, vong sau lay chinh ket qua da
   * go lam nen doan - cang lam cang sat.
   *
   * Tra { a, b, alpha, dat_cung, vung, so_anh, so_diem, so_diem_dac } hoac null.
   */

  /**
   * Khop  o = a*r + b  nhung BO QUA vai anh lech nhat.
   *
   * Nen doan cua mot vai anh co the sai han (cho do co cai cot, chan nguoi... bi
   * va nham). Khop thang tuot thi may anh do keo he so lech di, ca mang canh
   * logo bi tuong nham la co lop phu roi bi "go" -> lo ra mot vet vuong. Bo 1/4
   * so anh lech nhat roi khop lai thi may anh do khong con noi gi nua.
   *
   * Tra a, hoac null neu khong ket luan duoc.
   */
  /* Duoi 6 anh thi khong du cho phep khop bo bot anh lech - do lai kem han ca
   * cach va. Thieu anh thi tra null de ben ngoai quay ve cach va. */
  var SO_ANH_TOI_THIEU = 6;

  /**
   * Va lai nhung chi tinh tren mot mieng quanh o.
   *
   * Phep va chi nhin ra vai chuc pixel quanh lo, nen cat mieng ra lam roi dan
   * ve cho ket qua y het ma nhanh hon nhieu lan - quan trong khi ca du an 200
   * anh deu phai va mot cai logo be ti o goc.
   */
  function vaQuanhO(anh, matNa, vung) {
    var W = anh.rong, H = anh.cao;
    var le = Math.max(64, 2 * Math.max(vung.w, vung.h));
    var o = noVung(gioiHan(vung, W, H), le, W, H);
    var mieng = new Uint8ClampedArray(o.w * o.h * 4);
    var mn = new Uint8Array(o.w * o.h);
    var y, x, co = 0;
    for (y = 0; y < o.h; y++) {
      for (x = 0; x < o.w; x++) {
        var g = (o.y + y) * W + (o.x + x), k = y * o.w + x;
        mieng[k * 4] = anh.du_lieu[g * 4];
        mieng[k * 4 + 1] = anh.du_lieu[g * 4 + 1];
        mieng[k * 4 + 2] = anh.du_lieu[g * 4 + 2];
        mieng[k * 4 + 3] = anh.du_lieu[g * 4 + 3];
        mn[k] = matNa[g];
        if (mn[k]) co++;
      }
    }
    var ra = new Uint8ClampedArray(anh.du_lieu);
    if (!co) return { rong: W, cao: H, du_lieu: ra };
    var nho = { rong: o.w, cao: o.h, du_lieu: mieng };
    var sach = vaCauTruc(nho, mn, vaLai(nho, mn)).du_lieu;
    for (y = 0; y < o.h; y++) {
      for (x = 0; x < o.w; x++) {
        var gg = ((o.y + y) * W + (o.x + x)) * 4, kk = (y * o.w + x) * 4;
        ra[gg] = sach[kk]; ra[gg + 1] = sach[kk + 1]; ra[gg + 2] = sach[kk + 2];
      }
    }
    return { rong: W, cao: H, du_lieu: ra };
  }

  function trungVi(mang, N) {
    var t = Array.prototype.slice.call(mang, 0, N);
    t.sort(function (x, y) { return x - y; });
    return N % 2 ? t[(N - 1) / 2] : (t[N / 2 - 1] + t[N / 2]) / 2;
  }

  function khopBenVung(r, o, N) {
    var q, sR = 0, sO = 0, sRR = 0, sRO = 0, dem = N;
    for (q = 0; q < N; q++) { sR += r[q]; sO += o[q]; sRR += r[q] * r[q]; sRO += r[q] * o[q]; }

    var bo = N >= 6 ? Math.min(N - 4, Math.max(1, Math.round(N / 4))) : 0;
    for (var lan = 0; lan < bo; lan++) {
      var mauSo = dem * sRR - sR * sR;
      if (mauSo < 1e-6) return null;
      var a1 = (dem * sRO - sR * sO) / mauSo;
      var b1 = (sO - a1 * sR) / dem;
      var teNhat = -1, duNhat = -1;
      for (q = 0; q < N; q++) {
        if (r[q] !== r[q]) continue;                   // da bo roi
        var du = Math.abs(o[q] - (a1 * r[q] + b1));
        if (du > duNhat) { duNhat = du; teNhat = q; }
      }
      if (teNhat < 0 || duNhat < 1.5) break;           // khop dep roi, khoi bo
      sR -= r[teNhat]; sO -= o[teNhat];
      sRR -= r[teNhat] * r[teNhat]; sRO -= r[teNhat] * o[teNhat];
      dem--;
      r[teNhat] = NaN;                                  // danh dau da bo
    }

    if (dem < 4) return null;
    var lech = sRR / dem - (sR / dem) * (sR / dem);
    if (lech < 9) return null;                          // nen gan nhu dung yen
    var aa = (dem * sRO - sR * sO) / (dem * sRR - sR * sR);
    if (!(aa > -0.05 && aa <= 1.05)) return null;
    return aa;
  }
  function hocLopPhu(cacAnh, vung, tuyChon) {
    tuyChon = tuyChon || {};
    if (!cacAnh || cacAnh.length < SO_ANH_TOI_THIEU) return null;

    var W = cacAnh[0].rong, H = cacAnh[0].cao;
    var le = Math.max(6, Math.round(Math.max(vung.w, vung.h) * 0.35));
    var v = noVung(gioiHan(vung, W, H), le, W, H);
    var n = v.w * v.h;

    var quan = [];
    for (var i = 0; i < cacAnh.length && quan.length < 24; i++) {
      var a0 = cacAnh[i];
      if (a0.rong !== W || a0.cao !== H) continue;
      quan.push({ anh: a0, nhin: a0.du_lieu });
    }
    var N = quan.length;
    if (N < SO_ANH_TOI_THIEU) return null;

    var A = new Float32Array(n * 3), B = new Float32Array(n * 3);
    var alpha = new Float32Array(n);
    var datCung = new Uint8Array(n);
    var nenMau = new Float64Array(N), nhinMau = new Float64Array(N);
    var NGUONG_DAC = 0.22;      // a duoi muc nay coi nhu logo dac, khong tru duoc

    /* Nen doan cua tung anh = va lai cho bi che.
     *
     * Vong dau chua biet logo o dau nen phai va CA O - nghia la va nham ca noi
     * dung that trong o (cai cot, chan nguoi...). Cho nao va nham thi obs khac
     * han nen doan, phep khop lai tuong nham la "co lop phu" - dung la cai loi
     * lam hong ca vung ben canh logo.
     *
     * Nen tu vong hai tro di ta thu hep mat na lai dung cho vua tim ra co logo.
     * Ngoai cho do nen doan = chinh anh goc -> a = 1 -> khong dung toi. Cai cot,
     * chan nguoi trong o duoc tra lai nguyen ven.
     */
    function veNenDoan(matNa) {
      return quan.map(function (q) { return vaQuanhO(q.anh, matNa, v).du_lieu; });
    }
    function matNaTuAlpha() {
      var mn = new Uint8Array(W * H), co = 0;
      for (var yy = 0; yy < v.h; yy++) {
        for (var xx = 0; xx < v.w; xx++) {
          var kk = yy * v.w + xx;
          if (alpha[kk] > 0.05 || datCung[kk]) { mn[(v.y + yy) * W + (v.x + xx)] = 1; co++; }
        }
      }
      return co >= 12 ? noRongMatNa(mn, W, H, 2) : null;
    }

    /* Don ban do alpha sau moi vong khop.
     *
     * Hai thu luon bi nham thanh "co lop phu":
     *   - vien ngoai o: o hoc rong hon o nguoi dung khoanh de co cho ta dua,
     *     nhung logo chi nam trong o duoc khoanh -> ngoai do cat het.
     *   - lom dom vai pixel: la nhieu, khong phai net logo -> bo cum nho.
     * Phai don NGAY TRONG vong lap: mat na vong sau dung tu ban do nay, don
     * som thi vong sau va dung cho, tra lai duoc cai cot / chan nguoi trong o.
     */
    var vGoc = gioiHan(vung, W, H);
    function donAlpha() {
      var k, x, y;
      for (y = 0; y < v.h; y++) {
        for (x = 0; x < v.w; x++) {
          var gx = v.x + x, gy = v.y + y;
          if (gx >= vGoc.x - 3 && gx < vGoc.x + vGoc.w + 3
              && gy >= vGoc.y - 3 && gy < vGoc.y + vGoc.h + 3) continue;
          k = y * v.w + x;
          alpha[k] = 0; datCung[k] = 0;
          A[k * 3] = A[k * 3 + 1] = A[k * 3 + 2] = 1;
          B[k * 3] = B[k * 3 + 1] = B[k * 3 + 2] = 0;
        }
      }
      var co = new Uint8Array(n);
      for (k = 0; k < n; k++) co[k] = (alpha[k] > 0.05 || datCung[k]) ? 1 : 0;
      var cum = cacCum(co, v.w, v.h);
      for (var c0 = 0; c0 < cum.length; c0++) {
        if (cum[c0].length >= 8) continue;           // cum du to -> giu
        for (var d0 = 0; d0 < cum[c0].length; d0++) {
          k = cum[c0][d0];
          alpha[k] = 0; datCung[k] = 0;
          A[k * 3] = A[k * 3 + 1] = A[k * 3 + 2] = 1;
          B[k * 3] = B[k * 3 + 1] = B[k * 3 + 2] = 0;
        }
      }
      donDatCung(datCung, alpha, v.w, v.h);
    }

    var nenDoan = veNenDoan(taoMatNa(cacAnh[0], v, "tat", 0, 0));

    for (var vong = 0; vong < 3; vong++) {
      for (var y = 0; y < v.h; y++) {
        for (var x = 0; x < v.w; x++) {
          var k = y * v.w + x;
          var g4 = ((v.y + y) * W + (v.x + x)) * 4;
          var tongA = 0, demA = 0, c, q;

          for (c = 0; c < 3; c++) {
            for (q = 0; q < N; q++) {
              nenMau[q] = nenDoan[q][g4 + c];
              nhinMau[q] = quan[q].nhin[g4 + c];
            }
            var aa = khopBenVung(nenMau, nhinMau, N);
            if (aa == null) continue;
            tongA += Math.max(0, aa); demA++;
          }

          // Logo trang thi alpha giong nhau ca 3 kenh -> lay trung binh cho do
          // nhieu, roi tinh lai b theo a do.
          var aChung = demA >= 2 ? tongA / demA : 1;
          if (aChung > 0.985) aChung = 1;
          if (aChung < NGUONG_DAC) {
            // Logo dac: nen bi che sach, tru ngu?c ra chi con nhieu. Danh dau
            // de va lai, va giu a = 1 de cong thuc go khong dung vao no.
            datCung[k] = 1;
            alpha[k] = 1;
            for (c = 0; c < 3; c++) { A[k * 3 + c] = 1; B[k * 3 + c] = 0; }
            continue;
          }
          datCung[k] = 0;
          for (c = 0; c < 3; c++) {
            // b = trung vi chu khong phai trung binh: mot hai anh va nham cung
            // khong keo duoc mau logo lech di.
            for (q = 0; q < N; q++) {
              nenMau[q] = quan[q].nhin[g4 + c] - aChung * nenDoan[q][g4 + c];
            }
            var giua = trungVi(nenMau, N);
            A[k * 3 + c] = aChung;
            B[k * 3 + c] = aChung >= 1 ? 0 : giua;
          }
          alpha[k] = 1 - aChung;
        }
      }
      donAlpha();

      if (vong === 2) break;
      var matNaHep = matNaTuAlpha();
      if (!matNaHep) break;                 // chua thay gi -> hoc them cung vo ich
      var nenVa = veNenDoan(matNaHep);
      // Trong cho co logo: neu tru duoc thi ban tru sat hon ban va nhieu.
      nenDoan = nenVa.map(function (buf, q) {
        var ra = Float32Array.from(buf);
        for (var yy = 0; yy < v.h; yy++) {
          for (var xx = 0; xx < v.w; xx++) {
            var kk = yy * v.w + xx;
            if (alpha[kk] <= 0.02 || datCung[kk]) continue;
            var gg = ((v.y + yy) * W + (v.x + xx)) * 4;
            for (var cc = 0; cc < 3; cc++) {
              var aA = A[kk * 3 + cc];
              if (aA >= 1 || aA <= 0.3) continue;   // a nho thi tru ra toan nhieu
              ra[gg + cc] = Math.max(0, Math.min(255,
                (quan[q].nhin[gg + cc] - B[kk * 3 + cc]) / aA));
            }
          }
        }
        return ra;
      });
    }

    // Diem le loi ra mot minh giua vung sach thuong la nhieu chu khong phai
    // logo - don cho gon truoc khi dem.
    donDatCung(datCung, alpha, v.w, v.h);

    var demCo = 0, demDac = 0;
    for (var z = 0; z < n; z++) {
      if (datCung[z]) demDac++;
      else if (alpha[z] > 0.05) demCo++;
    }
    if (demCo + demDac < 20) return null;

    return { a: A, b: B, alpha: alpha, dat_cung: datCung, vung: v,
             so_anh: N, so_diem: demCo + demDac, so_diem_dac: demDac };
  }

  /** Bo diem dac le loi, va vun lai cho dac lien mach (dong hinh mo roi dong). */
  function donDatCung(datCung, alpha, w, h) {
    function demQuanh(nguon, k, x, y) {
      var dem = 0;
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          var xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          if (nguon[yy * w + xx]) dem++;
        }
      }
      return dem;
    }
    var tam = Uint8Array.from(datCung);
    var x, y, k;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        k = y * w + x;
        if (tam[k] && demQuanh(tam, k, x, y) < 2) datCung[k] = 0;   // le loi -> bo
      }
    }
    tam = Uint8Array.from(datCung);
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        k = y * w + x;
        // lo thung giua vung dac (do nen tinh co giong mau logo) -> lap lai
        if (!tam[k] && demQuanh(tam, k, x, y) >= 6) datCung[k] = 1;
      }
    }
    for (k = 0; k < datCung.length; k++) if (datCung[k]) alpha[k] = 1;
  }

  /**
   * Go lop phu da hoc ra khoi mot anh.
   *   - alpha = 0      : giu nguyen tung pixel, khong dung toi.
   *   - alpha vua      : tru ngu?c lai -> lay lai dung nen that.
   *   - alpha gan 1    : tru ngu?c thi phong dai sai so len 1/a lan (a = 0.2 la
   *                      phong 5 lan) nen cang gan dac cang phai nga sang ban
   *                      va. Tron hai ban theo do tin cay:
   *                          w = a^2 * TAU^2 / (a^2 * TAU^2 + XICH_MA^2)
   *                      TAU = sai so uoc luong cua ban va, XICH_MA = nhieu con
   *                      lai cua phep tru. Cho dac han (dat_cung) thi w = 0.
   * Nho vay khong co buoc nhay nao giua "tru" va "va" - khong thay duong vien.
   */
  var TAU_VA = 18;        // ban va thuong lech chung nay muc mau
  var XICH_MA = 2.5;      // nhieu con lai sau khi tru lop phu

  function goLopPhu(anh, moHinh) {
    if (!moHinh) return anh;
    var W = anh.rong, H = anh.cao, v = moHinh.vung;
    var ra = new Uint8ClampedArray(anh.du_lieu);
    var x, y, k, c, g4;

    // 1. Ban va: lam trong tren ANH GOC, mat na trum ca cho co logo - vien xung
    //    quanh con nguyen nen va bam dung cau truc nen.
    var matNa = new Uint8Array(W * H);
    var coDac = 0;
    for (y = 0; y < v.h; y++) {
      for (x = 0; x < v.w; x++) {
        k = y * v.w + x;
        if (moHinh.alpha[k] > 0.02) matNa[(v.y + y) * W + (v.x + x)] = 1;
        if (moHinh.dat_cung && moHinh.dat_cung[k]) coDac++;
      }
    }
    matNa = noRongMatNa(matNa, W, H, 1);   // an ra 1 pixel cho het vien ram
    var banVa = vaQuanhO(anh, matNa, v).du_lieu;

    // 2. Tru lop phu roi tron voi ban va theo do tin cay.
    for (y = 0; y < v.h; y++) {
      for (x = 0; x < v.w; x++) {
        k = y * v.w + x;
        if (moHinh.alpha[k] <= 0.02) continue;
        g4 = ((v.y + y) * W + (v.x + x)) * 4;
        var dac = moHinh.dat_cung && moHinh.dat_cung[k];
        for (c = 0; c < 3; c++) {
          var aa = moHinh.a[k * 3 + c];
          if (dac || !(aa > 0) || aa >= 1) {
            if (dac) ra[g4 + c] = banVa[g4 + c];
            continue;
          }
          var tru = (anh.du_lieu[g4 + c] - moHinh.b[k * 3 + c]) / aa;
          var w = (aa * aa * TAU_VA * TAU_VA)
                / (aa * aa * TAU_VA * TAU_VA + XICH_MA * XICH_MA);
          ra[g4 + c] = w * tru + (1 - w) * banVa[g4 + c];
        }
      }
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
    timLogoMotAnh: timLogoMotAnh,
    taoMatNa: taoMatNa,
    vaLai: vaLai,
    vaCauTruc: vaCauTruc,
    SO_ANH_TOI_THIEU: SO_ANH_TOI_THIEU,
    hocLopPhu: hocLopPhu,
    goLopPhu: goLopPhu,
    toMauNen: toMauNen,
    veKhung: veKhung,
    xoaWatermark: xoaWatermark,
    danhSachChiSo: danhSachChiSo,
  };

  goc.XW_LOI = XW;
  if (typeof module !== "undefined" && module.exports) module.exports = XW;
})(typeof globalThis !== "undefined" ? globalThis : this);

# -*- coding: utf-8 -*-
"""
XOA_WATERMARK - Xoa logo / chu chim (watermark) tren anh va video cua ban.

Dung cho anh MINH TU TAO (Gemini, Pollinations, anh tu chup, anh da mua ban quyen)
bi dinh logo goc hoac chu chim. Khong dung de go watermark tren anh cua nguoi khac.

Cach chay nhanh nhat: keo tha anh (hoac ca thu muc) vao XOA_WATERMARK.bat
Hoac:
  python xoa_watermark.py                        -> chay het WM_CHO/, vung tu dong
  python xoa_watermark.py anh.png --vung duoi-phai
  python xoa_watermark.py D:\\ANH --vung 1520,980,380,80 --cach va
  python xoa_watermark.py anh.png --xem-thu      -> chi ve khung do de soi, khong sua
  python xoa_watermark.py --tu-kiem-tra          -> tu test, khong can anh that

Chon VUNG (--vung):
  tu-dong                 tu do vi tri watermark bang cach so nhieu anh cung bo
                          (can it nhat 3 anh cung kich thuoc, watermark dung yen)
  logo-duoi-phai | logo-duoi-trai | logo-tren-phai | logo-tren-trai
                          o vuong nho o goc - dung cho logo nho kieu dau sao
                          cua Flow / Gemini
  duoi-phai | duoi-trai | tren-phai | tren-trai | duoi | tren | giua
  x,y,w,h                 toa do pixel, vi du 1520,980,380,80
  x%,y%,w%,h%             theo phan tram, vi du 78%,88%,21%,10%

Chon CACH xu ly (--cach):
  va      va theo cau truc nen (mac dinh) - giu nguyen ranh gioi sac net, hop
          nhat voi anh vector / nen phang / nen chuyen mau
  va-mem  va kieu khuech tan - muot hon nhung lam nhoe ranh gioi sac net
  to      to de mau nen lay tu vien vung (nen mot mau)
  cat     cat bo dai co watermark (--giu-kich-thuoc de phong to lai nhu cu)
  nhoe    lam nhoe / vo pixel (chi che, khong phai xoa - dung khi nen qua roi)

Loc dung net chu (--loc-mau): tat | sang | toi | #RRGGBB
  Watermark la chu trang -> --loc-mau sang  (chi va dung net chu, nen giu nguyen)
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import shutil
import subprocess
import sys
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

try:
    import numpy as np
except ImportError:  # bao loi tu te thay vi do stack trace
    print("[LOI] Thieu thu vien numpy. Chay:  pip install numpy pillow")
    raise SystemExit(3)

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("[LOI] Thieu thu vien Pillow. Chay:  pip install numpy pillow")
    raise SystemExit(3)

# ---------------------------------------------------------------------------
# 0. Thiet lap co ban
# ---------------------------------------------------------------------------

APP_NAME = "XOA_WATERMARK"
APP_VERSION = "1.0.0"

GOC = Path(__file__).resolve().parent
THU_MUC_VAO = GOC / "WM_CHO"
THU_MUC_RA = GOC / "WM_XONG"
THU_MUC_LOG = GOC / "logs"

DUOI_ANH = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}
DUOI_VIDEO = {".mp4", ".mov", ".mkv", ".avi", ".webm"}

# khung mac dinh cho tung goc: (x, y, rong, cao) theo ti le anh
GOC_MAC_DINH = {
    # logo nho xiu o goc (kieu dau sao cua Flow / Gemini)
    "logo-duoi-phai": (0.90, 0.88, 0.10, 0.12),
    "logo-duoi-trai": (0.00, 0.88, 0.10, 0.12),
    "logo-tren-phai": (0.90, 0.00, 0.10, 0.12),
    "logo-tren-trai": (0.00, 0.00, 0.10, 0.12),
    # ca goc anh (watermark chu, dai hon)
    "duoi-phai": (0.70, 0.86, 0.30, 0.14),
    "duoi-trai": (0.00, 0.86, 0.30, 0.14),
    "tren-phai": (0.70, 0.00, 0.30, 0.14),
    "tren-trai": (0.00, 0.00, 0.30, 0.14),
    "duoi": (0.00, 0.86, 1.00, 0.14),
    "tren": (0.00, 0.00, 1.00, 0.14),
    "giua": (0.25, 0.40, 0.50, 0.20),
    "tat-ca": (0.00, 0.00, 1.00, 1.00),
}

log = logging.getLogger(APP_NAME)


def cai_dat_log(muc: int = logging.INFO) -> Path:
    THU_MUC_LOG.mkdir(parents=True, exist_ok=True)
    duong_dan = THU_MUC_LOG / f"xoa_watermark_{time.strftime('%Y-%m-%d')}.log"

    log.setLevel(logging.DEBUG)
    log.handlers.clear()
    log.propagate = False

    ra_man_hinh = logging.StreamHandler(sys.stdout)
    ra_man_hinh.setLevel(muc)
    ra_man_hinh.setFormatter(logging.Formatter("%(asctime)s | %(message)s", "%H:%M:%S"))
    log.addHandler(ra_man_hinh)

    ra_file = logging.FileHandler(duong_dan, encoding="utf-8")
    ra_file.setLevel(logging.DEBUG)
    ra_file.setFormatter(
        logging.Formatter("%(asctime)s | %(levelname)-7s | %(message)s", "%Y-%m-%d %H:%M:%S")
    )
    log.addHandler(ra_file)
    return duong_dan


def ep_utf8() -> None:
    for luong in (sys.stdout, sys.stderr):
        try:
            luong.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
        except Exception:
            pass


# ---------------------------------------------------------------------------
# 1. Vung xu ly
# ---------------------------------------------------------------------------


@dataclass
class Vung:
    """Khung chu nhat tinh bang pixel, goc trai tren la (0, 0)."""

    x: int
    y: int
    w: int
    h: int

    def gioi_han(self, rong: int, cao: int) -> "Vung":
        x = max(0, min(int(self.x), rong - 1))
        y = max(0, min(int(self.y), cao - 1))
        w = max(1, min(int(self.w), rong - x))
        h = max(1, min(int(self.h), cao - y))
        return Vung(x, y, w, h)

    def no(self, them: int, rong: int, cao: int) -> "Vung":
        return Vung(self.x - them, self.y - them, self.w + 2 * them, self.h + 2 * them).gioi_han(
            rong, cao
        )

    @property
    def dien_tich(self) -> int:
        return self.w * self.h

    def __str__(self) -> str:  # de doc trong log
        return f"{self.x},{self.y},{self.w},{self.h}"


def _so_theo_chieu(manh: str, chieu: int) -> int:
    manh = manh.strip().lower().replace(" ", "")
    if manh.endswith("%"):
        return int(round(float(manh[:-1]) / 100.0 * chieu))
    if manh.endswith("px"):
        manh = manh[:-2]
    return int(round(float(manh)))


def phan_tich_vung(chuoi: str, rong: int, cao: int) -> Vung | None:
    """Doi chuoi --vung thanh khung pixel. Tra None neu la 'tu-dong'."""
    ten = (chuoi or "").strip().lower().replace("_", "-")
    if ten in ("", "tu-dong", "auto"):
        return None

    if ten in GOC_MAC_DINH:
        tx, ty, tw, th = GOC_MAC_DINH[ten]
        return Vung(
            int(round(tx * rong)), int(round(ty * cao)), int(round(tw * rong)), int(round(th * cao))
        ).gioi_han(rong, cao)

    manh = [m for m in ten.replace(";", ",").split(",") if m.strip() != ""]
    if len(manh) != 4:
        raise ValueError(
            f"Khong hieu --vung '{chuoi}'. Dung ten goc (duoi-phai...), "
            "hoac 4 so x,y,w,h (pixel hoac %)."
        )
    x = _so_theo_chieu(manh[0], rong)
    y = _so_theo_chieu(manh[1], cao)
    w = _so_theo_chieu(manh[2], rong)
    h = _so_theo_chieu(manh[3], cao)
    if w <= 0 or h <= 0:
        raise ValueError(f"--vung '{chuoi}' co chieu rong/cao <= 0.")
    return Vung(x, y, w, h).gioi_han(rong, cao)


# ---------------------------------------------------------------------------
# 2. Doc / ghi anh
# ---------------------------------------------------------------------------


def doc_anh(duong_dan: Path) -> tuple[np.ndarray, np.ndarray | None]:
    """Tra ve (RGB uint8 HxWx3, alpha uint8 HxW hoac None)."""
    with Image.open(duong_dan) as im:
        im.load()
        alpha = None
        if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
            im = im.convert("RGBA")
            alpha = np.array(im.getchannel("A"), dtype=np.uint8)
            im = im.convert("RGB")
        else:
            im = im.convert("RGB")
        return np.array(im, dtype=np.uint8), alpha


def luu_anh(anh: np.ndarray, alpha: np.ndarray | None, duong_dan: Path, chat_luong: int = 95) -> None:
    duong_dan.parent.mkdir(parents=True, exist_ok=True)
    im = Image.fromarray(np.clip(anh, 0, 255).astype(np.uint8), mode="RGB")
    duoi = duong_dan.suffix.lower()

    if alpha is not None and duoi in (".png", ".webp", ".tif", ".tiff"):
        if alpha.shape != anh.shape[:2]:  # da cat bot -> bo alpha cho an toan
            alpha = None
        else:
            im = im.convert("RGBA")
            im.putalpha(Image.fromarray(alpha, mode="L"))

    if duoi in (".jpg", ".jpeg"):
        im.convert("RGB").save(duong_dan, quality=chat_luong, subsampling=0)
    elif duoi == ".webp":
        im.save(duong_dan, quality=chat_luong, method=6)
    else:
        im.save(duong_dan)


def anh_xam(anh: np.ndarray) -> np.ndarray:
    a = anh.astype(np.float32)
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


# ---------------------------------------------------------------------------
# 3. Mat na - chon dung nhung pixel can xoa
# ---------------------------------------------------------------------------


def _no_rong(mat_na: np.ndarray, so_pixel: int) -> np.ndarray:
    """Phinh mat na ra vai pixel (thay cho phep gian no cua OpenCV)."""
    ra = mat_na.copy()
    for _ in range(max(0, int(so_pixel))):
        tam = ra.copy()
        tam[1:, :] |= ra[:-1, :]
        tam[:-1, :] |= ra[1:, :]
        tam[:, 1:] |= ra[:, :-1]
        tam[:, :-1] |= ra[:, 1:]
        ra = tam
    return ra


def _mau_hex(chuoi: str) -> tuple[int, int, int]:
    s = chuoi.strip().lstrip("#")
    if len(s) == 3:
        s = "".join(c * 2 for c in s)
    if len(s) != 6:
        raise ValueError(f"Mau '{chuoi}' khong dung dang #RRGGBB.")
    return int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)


def tao_mat_na(
    anh: np.ndarray,
    vung: Vung,
    loc_mau: str = "tat",
    dung_sai: float = 0.0,
    no_them: int = 2,
) -> np.ndarray:
    """Mat na True = pixel se bi xoa. Luon nam gon trong khung 'vung'."""
    cao, rong = anh.shape[:2]
    v = vung.gioi_han(rong, cao)
    trong_khung = np.zeros((cao, rong), dtype=bool)
    trong_khung[v.y : v.y + v.h, v.x : v.x + v.w] = True

    che_do = (loc_mau or "tat").strip().lower()
    if che_do in ("tat", "khong", "off", "none"):
        return trong_khung

    o = anh[v.y : v.y + v.h, v.x : v.x + v.w]
    if che_do in ("sang", "toi"):
        sang = anh_xam(o)
        moc = float(np.median(sang))
        nguong = dung_sai if dung_sai > 0 else 25.0
        chon = sang > moc + nguong if che_do == "sang" else sang < moc - nguong
        # watermark kieu nay gan nhu luon trang / xam / den. Bo qua nhung mang
        # mau ruc (nen do, la cay xanh...) de khong va nham ca noi dung anh.
        do_ruc = o.max(axis=2).astype(np.int16) - o.min(axis=2).astype(np.int16)
        chon &= do_ruc < 60
    else:
        r, g, b = _mau_hex(che_do)
        khoang = np.sqrt(
            (o[..., 0].astype(np.float32) - r) ** 2
            + (o[..., 1].astype(np.float32) - g) ** 2
            + (o[..., 2].astype(np.float32) - b) ** 2
        )
        chon = khoang <= (dung_sai if dung_sai > 0 else 60.0)

    mat_na = np.zeros((cao, rong), dtype=bool)
    mat_na[v.y : v.y + v.h, v.x : v.x + v.w] = chon
    mat_na = _no_rong(mat_na, no_them) & trong_khung

    ti_le = float(mat_na.sum()) / max(1, v.dien_tich)
    if ti_le < 0.002:  # loc qua chat, khong bat duoc gi -> quay ve ca khung
        log.warning("   --loc-mau %s khong bat duoc net nao, dung ca khung.", che_do)
        return trong_khung
    if ti_le > 0.92:  # loc qua rong, coi nhu ca khung
        return trong_khung
    return mat_na


# ---------------------------------------------------------------------------
# 4. Va lai nen (inpaint)
# ---------------------------------------------------------------------------


def _co_opencv() -> bool:
    try:
        import cv2  # noqa: F401
    except Exception:
        return False
    return True


def _va_bang_opencv(anh: np.ndarray, mat_na: np.ndarray, ban_kinh: int = 4) -> np.ndarray:
    import cv2

    bgr = cv2.cvtColor(anh.astype(np.uint8), cv2.COLOR_RGB2BGR)
    mn = (mat_na.astype(np.uint8)) * 255
    ra = cv2.inpaint(bgr, mn, ban_kinh, cv2.INPAINT_TELEA)
    return cv2.cvtColor(ra, cv2.COLOR_BGR2RGB)


def _giam_doi(anh: np.ndarray, biet: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Thu nho 1/2, chi lay trung binh cac pixel CON BIET (ngoai vung watermark)."""
    cao, rong = biet.shape
    c2, r2 = cao // 2, rong // 2
    b = biet[: c2 * 2, : r2 * 2].astype(np.float32).reshape(c2, 2, r2, 2).sum(axis=(1, 3))
    tong = (
        (anh[: c2 * 2, : r2 * 2] * biet[: c2 * 2, : r2 * 2, None])
        .reshape(c2, 2, r2, 2, 3)
        .sum(axis=(1, 3))
    )
    con_biet = b > 0
    nho = np.zeros_like(tong)
    nho[con_biet] = tong[con_biet] / b[con_biet][:, None]
    return nho, con_biet


def _lam_min(anh: np.ndarray, lo: np.ndarray, so_vong: int) -> None:
    """Lap Jacobi: moi pixel trong lo = trung binh 4 pixel ke ben."""
    if not lo.any():
        return
    for _ in range(so_vong):
        p = np.pad(anh, ((1, 1), (1, 1), (0, 0)), mode="edge")
        tb = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) * 0.25
        anh[lo] = tb[lo]


def _va_bang_numpy(anh: np.ndarray, mat_na: np.ndarray, so_vong: int = 48) -> np.ndarray:
    """Va lai bang khuech tan nhieu muc - khong can OpenCV.

    Thu nho dan anh cho den khi lo watermark chi con vai pixel, to mau o muc nho
    nhat roi phong nguoc len tung muc, moi muc lam min lai vien. Nen phang, nen
    chuyen mau (kieu anh vector) va lai gan nhu khong thay vet.
    """
    goc = anh.astype(np.float32)
    lo = mat_na.astype(bool)
    if not lo.any():
        return anh.copy()

    thap: list[tuple[np.ndarray, np.ndarray]] = [(goc.copy(), ~lo)]
    while True:
        a, biet = thap[-1]
        if min(a.shape[0], a.shape[1]) <= 16 or biet.all():
            break
        thap.append(_giam_doi(a, biet))
        if len(thap) > 12:
            break

    # muc nho nhat: to tam bang mau trung binh cua nhung pixel con biet
    a, biet = thap[-1]
    if not biet.all():
        nen = a[biet].mean(axis=0) if biet.any() else np.array([128.0, 128.0, 128.0])
        a[~biet] = nen
        _lam_min(a, ~biet, so_vong)

    ket_qua = a
    for muc in range(len(thap) - 2, -1, -1):
        a, biet = thap[muc]
        a = a.copy()
        phong = np.repeat(np.repeat(ket_qua, 2, axis=0), 2, axis=1)
        c, r = a.shape[0], a.shape[1]
        if phong.shape[0] < c or phong.shape[1] < r:  # kich thuoc le
            phong = np.pad(
                phong,
                ((0, max(0, c - phong.shape[0])), (0, max(0, r - phong.shape[1])), (0, 0)),
                mode="edge",
            )
        phong = phong[:c, :r]
        chua_biet = ~biet
        a[chua_biet] = phong[chua_biet]
        _lam_min(a, chua_biet, so_vong)
        ket_qua = a

    ra = goc.copy()
    ra[lo] = ket_qua[lo]
    return np.clip(ra, 0, 255).astype(np.uint8)


def va_lai(anh: np.ndarray, mat_na: np.ndarray, dung_opencv: bool = True) -> np.ndarray:
    if dung_opencv and _co_opencv():
        try:
            return _va_bang_opencv(anh, mat_na)
        except Exception as loi:  # pragma: no cover - phong ho
            log.debug("OpenCV inpaint loi (%s), quay ve cach numpy.", loi)
    return _va_bang_numpy(anh, mat_na)


def _mot_huong(
    A: np.ndarray, B: np.ndarray, co_a: np.ndarray, co_b: np.ndarray,
    d_a: np.ndarray, d_b: np.ndarray, A_lui: np.ndarray, B_lui: np.ndarray,
    co_a_lui: np.ndarray, co_b_lui: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Mau + do tin cay + diem cua mot huong (2 dau A, B tren cung mot truc).

    A_lui / B_lui la pixel lui vao them 3 buoc sau A / B - dung de do DO PHANG
    khi chi mot dau co pixel lanh (watermark nam sat mep anh).
    """
    khac = np.abs(A - B).mean(axis=2)
    tin2 = 1.0 / (1.0 + khac / 6.0)          # hai dau cang giong nhau cang dang tin
    t = (d_a / np.maximum(1.0, d_a + d_b))[..., None]
    c2 = A * (1.0 - t) + B * t
    diem2 = tin2 / (1.0 + np.minimum(d_a, d_b) / 40.0)

    chi_a = co_a & ~co_b
    chi_b = co_b & ~co_a
    mot_dau = chi_a | chi_b
    xa = np.maximum(1.0, np.where(chi_a, d_a, d_b))
    c1 = np.where(chi_a[..., None], A, B)
    phang = np.where(
        chi_a, np.where(co_a_lui, np.abs(A - A_lui).mean(axis=2), 0.0),
        np.where(co_b_lui, np.abs(B - B_lui).mean(axis=2), 0.0),
    )
    tin1 = 0.85 / (1.0 + phang / 6.0)
    diem1 = tin1 / (1.0 + xa / 40.0)

    ca_hai = co_a & co_b
    mau = np.where(ca_hai[..., None], c2, c1)
    tin = np.where(ca_hai, tin2, np.where(mot_dau, tin1, 0.0))
    diem = np.where(ca_hai, diem2, np.where(mot_dau, diem1, 0.0))
    return mau, tin, diem


def _van_quanh_lo(a: np.ndarray, biet: np.ndarray, mat_na: np.ndarray) -> tuple[float, float]:
    """Do 'van' cua nen quanh lo -> (uu_tien_ngang, uu_tien_doc).

    Anh soc ngang (nen tren mot mau, dai duoi mot mau) thi mau doi nhieu theo
    chieu DOC va gan nhu khong doi theo chieu NGANG. Luc do phai uu tien noi
    ngang - nhat la khi lo nam sat goc anh, khong thi noi doc se keo mau nen
    tren xuong dai duoi thanh vet.
    """
    cao, rong = biet.shape
    ys, xs = np.nonzero(mat_na)
    if ys.size == 0:
        return 1.0, 1.0
    le = max(12, min(60, int(0.5 * max(xs.max() - xs.min(), ys.max() - ys.min()))))
    x0, x1 = max(0, int(xs.min()) - le), min(rong - 1, int(xs.max()) + le)
    y0, y1 = max(0, int(ys.min()) - le), min(cao - 1, int(ys.max()) + le)

    o = a[y0 : y1 + 1, x0 : x1 + 1]
    b = biet[y0 : y1 + 1, x0 : x1 + 1]
    if o.shape[0] < 3 or o.shape[1] < 3:
        return 1.0, 1.0

    cap_x = b[:, :-1] & b[:, 1:]
    cap_y = b[:-1, :] & b[1:, :]
    if cap_x.sum() < 20 or cap_y.sum() < 20:
        return 1.0, 1.0
    gx = float(np.abs(o[:, 1:] - o[:, :-1]).mean(axis=2)[cap_x].mean())
    gy = float(np.abs(o[1:, :] - o[:-1, :]).mean(axis=2)[cap_y].mean())

    if gy > 2 * gx + 0.05:
        return 3.0, 1.0
    if gx > 2 * gy + 0.05:
        return 1.0, 3.0
    return 1.0, 1.0


def va_cau_truc(
    anh: np.ndarray, mat_na: np.ndarray, du_phong: np.ndarray | None = None
) -> np.ndarray:
    """Va theo CAU TRUC nen - giu duoc net sac cua nen phang / vector.

    Voi moi pixel trong lo, nhin sang 4 huong tim pixel con lanh gan nhat:
    trai/phai cung hang, tren/duoi cung cot. Moi huong duoc cham diem theo do
    giong nhau cua hai dau (hoac do phang cua phia con dung duoc, khi lo nam sat
    mep anh) va theo khoang cach. Huong nao an dut thi lay han huong do - trung
    binh hai huong dang cai nhau chinh la thu tao ra vet lo o goc anh.

    Cho nao ca hai huong deu khong dang tin (nen roi, anh chup that) thi lay ban
    'du_phong' (va khuech tan) cho muot.
    """
    if not mat_na.any():
        return anh.copy()

    cao, rong = anh.shape[:2]
    a = anh.astype(np.float32)
    biet = ~mat_na

    cot = np.tile(np.arange(rong, dtype=np.int32), (cao, 1))
    hang = np.tile(np.arange(cao, dtype=np.int32)[:, None], (1, rong))

    trai = np.maximum.accumulate(np.where(biet, cot, -1), axis=1)
    phai = np.minimum.accumulate(np.where(biet, cot, rong)[:, ::-1], axis=1)[:, ::-1]
    tren = np.maximum.accumulate(np.where(biet, hang, -1), axis=0)
    duoi = np.minimum.accumulate(np.where(biet, hang, cao)[::-1], axis=0)[::-1]

    def mau_tai(x_idx: np.ndarray, y_idx: np.ndarray) -> np.ndarray:
        return a[np.clip(y_idx, 0, cao - 1), np.clip(x_idx, 0, rong - 1)]

    def lanh_tai(x_idx: np.ndarray, y_idx: np.ndarray) -> np.ndarray:
        return biet[np.clip(y_idx, 0, cao - 1), np.clip(x_idx, 0, rong - 1)]

    # huong ngang: hai dau la trai / phai, lui them 3 cot de do do phang
    trai_lui, phai_lui = trai - 3, phai + 3
    mau_n, tin_n, diem_n = _mot_huong(
        mau_tai(trai, hang), mau_tai(phai, hang),
        trai >= 0, phai < rong,
        np.maximum(1, cot - trai).astype(np.float32),
        np.maximum(1, phai - cot).astype(np.float32),
        mau_tai(trai_lui, hang), mau_tai(phai_lui, hang),
        (trai_lui >= 0) & lanh_tai(trai_lui, hang),
        (phai_lui < rong) & lanh_tai(phai_lui, hang),
    )
    # huong doc
    tren_lui, duoi_lui = tren - 3, duoi + 3
    mau_d, tin_d, diem_d = _mot_huong(
        mau_tai(cot, tren), mau_tai(cot, duoi),
        tren >= 0, duoi < cao,
        np.maximum(1, hang - tren).astype(np.float32),
        np.maximum(1, duoi - hang).astype(np.float32),
        mau_tai(cot, tren_lui), mau_tai(cot, duoi_lui),
        (tren_lui >= 0) & lanh_tai(cot, tren_lui),
        (duoi_lui < cao) & lanh_tai(cot, duoi_lui),
    )

    uu_ngang, uu_doc = _van_quanh_lo(a, biet, mat_na)
    diem_n = diem_n * uu_ngang
    diem_d = diem_d * uu_doc

    co_n, co_d = diem_n > 0, diem_d > 0
    chon_n = co_n & (~co_d | (diem_n >= 1.2 * diem_d))
    chon_d = co_d & (~co_n | (diem_d >= 1.2 * diem_n))
    tron = co_n & co_d & ~chon_n & ~chon_d
    w_n = np.where(chon_n | tron, diem_n, 0.0)
    w_d = np.where(chon_d | tron, diem_d, 0.0)

    tong_w = w_n + w_d
    cau_truc = (mau_n * w_n[..., None] + mau_d * w_d[..., None]) / np.maximum(
        1e-6, tong_w
    )[..., None]

    nen = du_phong.astype(np.float32) if du_phong is not None else a
    tin_nhat = np.clip(np.maximum(tin_n, tin_d) / 0.8, 0.0, 1.0)[..., None]
    ket = tin_nhat * cau_truc + (1.0 - tin_nhat) * nen
    ket = np.where((tong_w > 0)[..., None], ket, nen)

    ra = a.copy()
    ra[mat_na] = ket[mat_na]
    return np.clip(ra, 0, 255).astype(np.uint8)


def to_mau_nen(anh: np.ndarray, mat_na: np.ndarray, vung: Vung) -> np.ndarray:
    """To de vung watermark bang mau lay tu vien xung quanh."""
    cao, rong = anh.shape[:2]
    ngoai = vung.no(max(3, min(vung.w, vung.h) // 8), rong, cao)
    khung_ngoai = np.zeros((cao, rong), dtype=bool)
    khung_ngoai[ngoai.y : ngoai.y + ngoai.h, ngoai.x : ngoai.x + ngoai.w] = True
    vien = khung_ngoai & ~mat_na
    if not vien.any():
        vien = ~mat_na
    mau = np.median(anh[vien].astype(np.float32), axis=0)
    ra = anh.copy()
    ra[mat_na] = mau.astype(np.uint8)
    return ra


def lam_nhoe(anh: np.ndarray, vung: Vung, muc: int = 12) -> np.ndarray:
    """Vo pixel vung watermark - chi che di, khong phai xoa that."""
    cao, rong = anh.shape[:2]
    v = vung.gioi_han(rong, cao)
    o = anh[v.y : v.y + v.h, v.x : v.x + v.w]
    nho_r = max(1, v.w // max(1, muc))
    nho_c = max(1, v.h // max(1, muc))
    im = Image.fromarray(o)
    im = im.resize((nho_r, nho_c), Image.BILINEAR).resize((v.w, v.h), Image.NEAREST)
    ra = anh.copy()
    ra[v.y : v.y + v.h, v.x : v.x + v.w] = np.array(im, dtype=np.uint8)
    return ra


def cat_bo(anh: np.ndarray, vung: Vung, giu_kich_thuoc: bool = False) -> np.ndarray:
    """Cat bo dai ngang (hoac doc) chua watermark."""
    cao, rong = anh.shape[:2]
    v = vung.gioi_han(rong, cao)

    # cat ve phia canh gan watermark nhat, de mat it anh nhat
    lua_chon = {
        "tren": (v.y + v.h) * rong,   # bo tu dinh anh xuong het watermark
        "duoi": (cao - v.y) * rong,   # bo tu dau watermark xuong day
        "trai": (v.x + v.w) * cao,
        "phai": (rong - v.x) * cao,
    }
    canh = min(lua_chon, key=lambda k: lua_chon[k])

    if canh == "tren":
        ra = anh[v.y + v.h :, :]
    elif canh == "duoi":
        ra = anh[: v.y, :]
    elif canh == "trai":
        ra = anh[:, v.x + v.w :]
    else:
        ra = anh[:, : v.x]

    if ra.size == 0:
        raise ValueError("Cat xong khong con gi - vung watermark phu ca anh.")
    if giu_kich_thuoc:
        im = Image.fromarray(ra).resize((rong, cao), Image.LANCZOS)
        ra = np.array(im, dtype=np.uint8)
    return np.ascontiguousarray(ra)


# ---------------------------------------------------------------------------
# 5. Tu do vi tri watermark tu ca bo anh
# ---------------------------------------------------------------------------


def _do_net(xam: np.ndarray) -> np.ndarray:
    """Do do net (Sobel) - watermark bao gio cung co vien sac."""
    p = np.pad(xam, 1, mode="edge")
    gx = (
        p[:-2, 2:] + 2 * p[1:-1, 2:] + p[2:, 2:] - p[:-2, :-2] - 2 * p[1:-1, :-2] - p[2:, :-2]
    )
    gy = (
        p[2:, :-2] + 2 * p[2:, 1:-1] + p[2:, 2:] - p[:-2, :-2] - 2 * p[:-2, 1:-1] - p[:-2, 2:]
    )
    return np.sqrt(gx * gx + gy * gy)


def _cac_cum(co: np.ndarray) -> list[np.ndarray]:
    """Tach mat na thanh cac mang lien thong (4 huong), sap xep to truoc."""
    cao, rong = co.shape
    da_xet = np.zeros_like(co, dtype=bool)
    cum: list[np.ndarray] = []
    for y0, x0 in zip(*np.nonzero(co)):  # chi duyet pixel co, khong quet ca anh
        if da_xet[y0, x0]:
            continue
        hang_doi = deque([(int(y0), int(x0))])
        da_xet[y0, x0] = True
        diem: list[tuple[int, int]] = []
        while hang_doi:
            y, x = hang_doi.popleft()
            diem.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < cao and 0 <= nx < rong and co[ny, nx] and not da_xet[ny, nx]:
                    da_xet[ny, nx] = True
                    hang_doi.append((ny, nx))
        cum.append(np.array(diem, dtype=np.int32))
    cum.sort(key=len, reverse=True)
    return cum


def _bao_quanh(cac_diem: Sequence[np.ndarray]) -> Vung:
    gop = np.concatenate(cac_diem, axis=0)
    ys, xs = gop[:, 0], gop[:, 1]
    return Vung(int(xs.min()), int(ys.min()),
                int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1))


def tim_vung_tu_dong(
    cac_anh: Sequence[np.ndarray], toi_da_ti_le: float = 0.15
) -> tuple[Vung | None, str]:
    """So nhieu anh cung bo: net nao CO MAT O MOI ANH thi do la watermark.

    Nen anh moi anh moi khac, chi rieng logo/chu chim la dung yen -> lay do net
    (Sobel) cua tung anh roi chong len nhau, cho nao anh NAO CUNG co net manh
    thi gan nhu chac chan la watermark. Cach nay an hon so pixel dung yen vi
    watermark thuong trong mo, mau bi nen phia sau keo di.

    Tra ve (vung theo pixel goc, ghi chu). Vung None nghia la khong chac chan.
    """
    if len(cac_anh) < 3:
        return None, "can it nhat 3 anh cung kich thuoc de tu do vi tri"

    cao, rong = cac_anh[0].shape[:2]
    ti_le = min(1.0, 640.0 / max(1, rong))
    r_nho, c_nho = max(32, int(rong * ti_le)), max(32, int(cao * ti_le))

    xam = []
    for a in cac_anh[:16]:
        im = Image.fromarray(a).resize((r_nho, c_nho), Image.BILINEAR)
        xam.append(anh_xam(np.array(im, dtype=np.uint8)))
    khoi_xam = np.stack(xam, axis=0)

    # cac anh giong het nhau (hoac gan nhu) thi khong the tach watermark
    # ra khoi noi dung duoc - phai de nguoi dung chi ro khung
    if float(khoi_xam.std(axis=0).mean()) < 2.0:
        return None, "cac anh gan nhu giong het nhau, khong tach duoc watermark khoi noi dung"

    khoi = np.stack([_do_net(x) for x in xam], axis=0)

    # lay muc 20% thap nhat: 1 anh le loi khong lam hong ket qua,
    # nhung net chi co o vai anh thi bi loai
    net_chung = np.percentile(khoi, 20, axis=0)
    nguong = max(15.0, 0.25 * float(net_chung.max()))
    ung_vien = net_chung > nguong
    if ung_vien.sum() < 8:
        return None, "khong thay net nao xuat hien o tat ca cac anh"

    cum = _cac_cum(_no_rong(ung_vien, 2))
    if not cum:
        return None, "khong gom duoc thanh cum"

    # Loc bo nhung thu "anh nao cung co" nhung KHONG phai watermark: duong ranh
    # giua nen va dat, khung vien, thanh mau chay het chieu ngang... Watermark
    # that la mot dom NHO, GON, thuong nam sat ria anh.
    toi_da = toi_da_ti_le * r_nho * c_nho
    ung_cu: list[tuple[float, np.ndarray, Vung]] = []
    for diem in cum:
        bb = _bao_quanh([diem])
        if bb.w > 0.6 * r_nho and bb.h < 0.08 * c_nho:   # duong ke ngang
            continue
        if bb.h > 0.6 * c_nho and bb.w < 0.08 * r_nho:   # duong ke doc
            continue
        if bb.w > 0.5 * r_nho or bb.h > 0.5 * c_nho:     # qua rong / qua cao
            continue
        if bb.dien_tich > toi_da:                        # qua to so voi ca anh
            continue

        manh = float(net_chung[diem[:, 0], diem[:, 1]].mean())  # net cang manh cang chac
        dac = len(diem) / max(1, bb.dien_tich)                  # cang gon cang giong logo
        ria_x = min(bb.x, r_nho - (bb.x + bb.w))
        ria_y = min(bb.y, c_nho - (bb.y + bb.h))
        sat_ria = 1.6 if (ria_x < 0.15 * r_nho or ria_y < 0.15 * c_nho) else 1.0
        ung_cu.append((manh * math.sqrt(len(diem)) * (0.6 + 0.4 * dac) * sat_ria, diem, bb))

    if not ung_cu:
        return None, ("chi thay duong ke / mang lon giong nhau giua cac anh,"
                      " khong thay logo nho nao")
    ung_cu.sort(key=lambda m: m[0], reverse=True)

    # gop them cum ke ben (logo va chu thuong tach roi), khong voi ra xa
    gom = [ung_cu[0][1]]
    khoang_cach = 0.03 * r_nho
    for diem_so, diem, bb in ung_cu[1:]:
        if diem_so < 0.25 * ung_cu[0][0]:
            continue
        dang = _bao_quanh(gom)
        cach_x = max(0, max(dang.x - (bb.x + bb.w), bb.x - (dang.x + dang.w)))
        cach_y = max(0, max(dang.y - (bb.y + bb.h), bb.y - (dang.y + dang.h)))
        if cach_x > khoang_cach or cach_y > khoang_cach:
            continue
        if _bao_quanh(gom + [diem]).dien_tich <= toi_da:
            gom.append(diem)

    v_nho = _bao_quanh(gom)

    he_so_x, he_so_y = rong / r_nho, cao / c_nho
    vung = Vung(
        int(math.floor(v_nho.x * he_so_x)),
        int(math.floor(v_nho.y * he_so_y)),
        int(math.ceil(v_nho.w * he_so_x)),
        int(math.ceil(v_nho.h * he_so_y)),
    ).no(max(2, int(0.006 * rong)), rong, cao)
    return vung, f"do duoc tu {len(xam)} anh"


# ---------------------------------------------------------------------------
# 6. Xu ly tung file
# ---------------------------------------------------------------------------


def ve_khung_xem_thu(anh: np.ndarray, vung: Vung) -> np.ndarray:
    im = Image.fromarray(anh.copy())
    but = ImageDraw.Draw(im)
    day = max(2, int(min(anh.shape[:2]) * 0.004))
    but.rectangle(
        [vung.x, vung.y, vung.x + vung.w - 1, vung.y + vung.h - 1], outline=(255, 0, 0), width=day
    )
    return np.array(im, dtype=np.uint8)


def xu_ly_anh(
    duong_dan: Path, ra: Path, vung_yeu_cau: str, tuy_chon: argparse.Namespace,
    vung_san: Vung | None = None,
) -> bool:
    anh, alpha = doc_anh(duong_dan)
    cao, rong = anh.shape[:2]

    vung = vung_san if vung_san is not None else phan_tich_vung(vung_yeu_cau, rong, cao)
    if vung is None:
        log.error("   [BO QUA] %s: chua xac dinh duoc vung watermark.", duong_dan.name)
        return False
    vung = vung.gioi_han(rong, cao)

    if tuy_chon.xem_thu:
        dich = ra.with_name(ra.stem + "_xem_truoc.png")
        luu_anh(ve_khung_xem_thu(anh, vung), None, dich)
        log.info("   [XEM THU] %s  vung %s -> %s", duong_dan.name, vung, dich.name)
        return True

    cach = tuy_chon.cach
    if cach == "cat":
        moi = cat_bo(anh, vung, tuy_chon.giu_kich_thuoc)
    elif cach == "nhoe":
        moi = lam_nhoe(anh, vung)
    else:
        mat_na = tao_mat_na(anh, vung, tuy_chon.loc_mau, tuy_chon.dung_sai, tuy_chon.no_rong)
        if cach == "to":
            moi = to_mau_nen(anh, mat_na, vung)
        elif cach == "va-mem":
            moi = va_lai(anh, mat_na, dung_opencv=not tuy_chon.khong_opencv)
        else:
            # mac dinh: va theo cau truc, lay ban khuech tan lam nen du phong
            moi = va_cau_truc(
                anh, mat_na, va_lai(anh, mat_na, dung_opencv=not tuy_chon.khong_opencv)
            )

    luu_anh(moi, alpha, ra, tuy_chon.chat_luong)
    log.info("   [XONG] %s  vung %s  cach %s -> %s", duong_dan.name, vung, cach, ra.name)
    return True


def co_ffmpeg() -> str | None:
    return shutil.which("ffmpeg")


def xu_ly_video(duong_dan: Path, ra: Path, vung_yeu_cau: str, tuy_chon: argparse.Namespace) -> bool:
    ffmpeg = co_ffmpeg()
    if not ffmpeg:
        log.error("   [BO QUA] %s: video can ffmpeg. Tai tai https://ffmpeg.org/download.html",
                  duong_dan.name)
        return False

    kich_thuoc = _kich_thuoc_video(ffmpeg, duong_dan)
    if not kich_thuoc:
        log.error("   [BO QUA] %s: khong doc duoc kich thuoc video.", duong_dan.name)
        return False
    rong, cao = kich_thuoc

    vung = phan_tich_vung(vung_yeu_cau, rong, cao)
    if vung is None:
        log.error("   [BO QUA] %s: video khong tu do vung duoc, hay chi ro --vung.",
                  duong_dan.name)
        return False
    # delogo doi khung nam han trong anh, khong cham vien
    vung = Vung(max(1, vung.x), max(1, vung.y), vung.w, vung.h).gioi_han(rong - 1, cao - 1)
    vung = Vung(vung.x, vung.y, min(vung.w, rong - vung.x - 1), min(vung.h, cao - vung.y - 1))

    ra.parent.mkdir(parents=True, exist_ok=True)
    lenh = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(duong_dan),
        "-vf", f"delogo=x={vung.x}:y={vung.y}:w={vung.w}:h={vung.h}",
        "-c:a", "copy",
        str(ra),
    ]
    log.info("   [VIDEO] %s  vung %s ...", duong_dan.name, vung)
    tien_trinh = subprocess.run(lenh, capture_output=True, text=True)
    if tien_trinh.returncode != 0:
        log.error("   [LOI] ffmpeg: %s", (tien_trinh.stderr or "").strip()[:400])
        return False
    log.info("   [XONG] %s -> %s", duong_dan.name, ra.name)
    return True


def _kich_thuoc_video(ffmpeg: str, duong_dan: Path) -> tuple[int, int] | None:
    ffprobe = shutil.which("ffprobe") or str(Path(ffmpeg).with_name("ffprobe"))
    try:
        kq = subprocess.run(
            [ffprobe, "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height", "-of", "json", str(duong_dan)],
            capture_output=True, text=True,
        )
        if kq.returncode == 0:
            luong = json.loads(kq.stdout)["streams"][0]
            return int(luong["width"]), int(luong["height"])
    except Exception as loi:
        log.debug("ffprobe loi: %s", loi)
    return None


# ---------------------------------------------------------------------------
# 7. Hang doi
# ---------------------------------------------------------------------------


def gom_hang_doi(dau_vao: Sequence[str]) -> list[Path]:
    muc: list[Path] = []
    nguon: list[Path] = [Path(d) for d in dau_vao] if dau_vao else [THU_MUC_VAO]
    for n in nguon:
        if n.is_dir():
            for f in sorted(n.rglob("*")):
                if f.is_file() and f.suffix.lower() in (DUOI_ANH | DUOI_VIDEO):
                    muc.append(f)
        elif n.is_file():
            muc.append(n)
        else:
            log.warning("Khong thay: %s", n)
    return muc


def _nhom_theo_kich_thuoc(cac_anh: Sequence[Path]) -> dict[tuple[int, int], list[Path]]:
    nhom: dict[tuple[int, int], list[Path]] = {}
    for f in cac_anh:
        try:
            with Image.open(f) as im:
                kt = im.size
        except Exception as loi:
            log.warning("Khong mo duoc %s (%s)", f.name, loi)
            continue
        nhom.setdefault(kt, []).append(f)
    return nhom


def chay(tuy_chon: argparse.Namespace) -> int:
    hang_doi = gom_hang_doi(tuy_chon.dau_vao)
    if not hang_doi:
        log.error("Khong thay anh/video nao. Bo file vao %s roi chay lai.", THU_MUC_VAO)
        return 2

    anh_vao = [f for f in hang_doi if f.suffix.lower() in DUOI_ANH]
    video_vao = [f for f in hang_doi if f.suffix.lower() in DUOI_VIDEO]
    log.info("Hang doi: %d anh, %d video", len(anh_vao), len(video_vao))
    log.info("Cach xu ly: %s | vung: %s | loc mau: %s",
             tuy_chon.cach, tuy_chon.vung, tuy_chon.loc_mau)
    if tuy_chon.cach == "va":
        log.info("Bo va lai: %s", "OpenCV (Telea)"
                 if (_co_opencv() and not tuy_chon.khong_opencv) else "numpy (khong can OpenCV)")

    thu_muc_ra = Path(tuy_chon.ra) if tuy_chon.ra else THU_MUC_RA
    thu_muc_ra.mkdir(parents=True, exist_ok=True)

    # vung tu dong: do 1 lan cho ca nhom anh cung kich thuoc
    vung_theo_kich_thuoc: dict[tuple[int, int], Vung | None] = {}
    if phan_tich_vung(tuy_chon.vung, 100, 100) is None and anh_vao:
        for kt, ds in _nhom_theo_kich_thuoc(anh_vao).items():
            mau = []
            for f in ds[:16]:
                try:
                    mau.append(doc_anh(f)[0])
                except Exception as loi:
                    log.warning("Khong doc duoc %s (%s)", f.name, loi)
            vung, ghi_chu = tim_vung_tu_dong(mau) if len(mau) >= 3 else (None, "it hon 3 anh")
            vung_theo_kich_thuoc[kt] = vung
            if vung:
                log.info("Tu do vi tri watermark cho anh %dx%d: %s (%s)",
                         kt[0], kt[1], vung, ghi_chu)
            else:
                log.warning("Anh %dx%d: khong tu do duoc vung (%s).", kt[0], kt[1], ghi_chu)
                log.warning("  -> Chay lai va chi ro, vi du:  --vung duoi-phai")

    xong = hong = bo_qua = 0
    for f in hang_doi:
        ten_ra = f.stem + tuy_chon.hau_to + f.suffix
        dich = thu_muc_ra / ten_ra
        if dich.resolve() == f.resolve() and not tuy_chon.ghi_de:
            dich = thu_muc_ra / (f.stem + "_sach" + f.suffix)
        if dich.exists() and not (tuy_chon.lam_lai or tuy_chon.ghi_de or tuy_chon.xem_thu):
            log.info("   [BO QUA] %s da co trong %s (dung --lam-lai de lam lai)",
                     dich.name, thu_muc_ra.name)
            bo_qua += 1
            continue
        try:
            if f.suffix.lower() in DUOI_VIDEO:
                tam = dich.with_name(dich.stem + "_tam" + dich.suffix) if tuy_chon.ghi_de else dich
                ok = xu_ly_video(f, tam, tuy_chon.vung, tuy_chon)
                if ok and tuy_chon.ghi_de and tam != f:
                    shutil.move(str(tam), str(f))
            else:
                with Image.open(f) as im:
                    kt = im.size
                ok = xu_ly_anh(f, dich, tuy_chon.vung, tuy_chon,
                               vung_san=vung_theo_kich_thuoc.get(kt))
                if ok and tuy_chon.ghi_de and not tuy_chon.xem_thu and dich != f:
                    shutil.move(str(dich), str(f))
        except Exception as loi:
            log.error("   [LOI] %s: %s", f.name, loi)
            log.debug("chi tiet", exc_info=True)
            ok = False
        xong += 1 if ok else 0
        hong += 0 if ok else 1

    log.info("=" * 70)
    them = f", {bo_qua} bo qua vi da co san (them --lam-lai de lam lai)" if bo_qua else ""
    log.info("Tong ket: %d xong, %d hong%s. Ket qua trong %s",
             xong, hong, them, f.parent if tuy_chon.ghi_de else thu_muc_ra)
    return 0 if hong == 0 else 1


# ---------------------------------------------------------------------------
# 8. Tu kiem tra (khong can anh that)
# ---------------------------------------------------------------------------


def _anh_gia(hat: int, rong: int = 480, cao: int = 270) -> np.ndarray:
    """Tao anh nen kieu vector phang: chuyen mau + vai mang mau + it hat nhieu."""
    rng = np.random.default_rng(hat)
    y = np.linspace(0, 1, cao, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, rong, dtype=np.float32)[None, :]
    tren = rng.integers(60, 200, size=3).astype(np.float32)
    duoi = rng.integers(60, 200, size=3).astype(np.float32)
    anh = tren[None, None, :] * (1 - y[..., None]) + duoi[None, None, :] * y[..., None]
    anh = anh + 0 * x[..., None]
    for _ in range(3):
        x0 = int(rng.integers(0, rong - 60))
        y0 = int(rng.integers(0, cao - 40))
        w = int(rng.integers(40, 120))
        h = int(rng.integers(20, 60))
        mau = rng.integers(40, 220, size=3).astype(np.float32)
        anh[y0 : y0 + h, x0 : x0 + w] = mau
    return np.clip(anh, 0, 255).astype(np.uint8)


def _anh_kieu_flow(hat: int, rong: int = 1376, cao: int = 768) -> np.ndarray:
    """Anh dung kieu Flow cua kenh: nen xanh dam, dai dat vang o duoi, hinh que.

    Cai bay o day: dai dat vang tao ra mot duong ranh NGANG dai het anh, nam dung
    mot cho o moi anh - y het watermark ve mat "net nao cung co". Bo do vung phai
    phan biet duoc no voi cai logo nho o goc.
    """
    rng = np.random.default_rng(hat)
    anh = np.zeros((cao, rong, 3), dtype=np.uint8)
    anh[:, :] = (26, 42, 74)
    dat = int(cao * 0.87)
    anh[dat:, :] = (247, 196, 39)

    im = Image.fromarray(anh)
    but = ImageDraw.Draw(im)
    for _ in range(int(rng.integers(2, 5))):  # vai hinh que, moi anh moi cho
        x = int(rng.integers(80, rong - 220))
        y = int(rng.integers(int(cao * 0.25), dat - 120))
        c = int(rng.integers(70, 160))
        but.line([x, y, x, y + c * 0.55], fill=(255, 255, 255), width=max(3, c // 22))
        but.ellipse([x - 12, y - 26, x + 12, y - 2], outline=(255, 255, 255), width=3)
        but.line([x, y + c * 0.55, x - c * 0.3, y + c], fill=(255, 255, 255), width=3)
        but.line([x, y + c * 0.55, x + c * 0.3, y + c], fill=(255, 255, 255), width=3)
    if rng.random() > 0.3:
        x0 = int(rng.integers(0, rong - 260))
        y0 = int(rng.integers(dat - 320, dat - 120))
        but.rectangle([x0, y0, x0 + int(rng.integers(90, 240)), y0 + int(rng.integers(70, 160))],
                      fill=(247, 196, 39))
    return np.array(im, dtype=np.uint8)


def _dan_sao_goc(anh: np.ndarray, le: int = 26, canh: int = 30) -> tuple[np.ndarray, Vung]:
    """Dan dau sao trang nho o goc duoi ben phai - dung kieu Flow / Gemini dan vao."""
    cao, rong = anh.shape[:2]
    v = Vung(rong - le - canh, cao - le - canh, canh, canh)
    im = Image.fromarray(anh.copy())
    but = ImageDraw.Draw(im)
    tam_x, tam_y, r = v.x + canh / 2, v.y + canh / 2, canh / 2
    for i in range(4):  # 4 canh sao
        goc_x = [tam_x, tam_x + r, tam_x, tam_x - r][i]
        goc_y = [tam_y - r, tam_y, tam_y + r, tam_y][i]
        ke_x = [tam_x + r * 0.28, tam_x + r * 0.28, tam_x - r * 0.28, tam_x - r * 0.28][i]
        ke_y = [tam_y - r * 0.28, tam_y + r * 0.28, tam_y + r * 0.28, tam_y - r * 0.28][i]
        but.polygon([(tam_x, tam_y), (goc_x, goc_y), (ke_x, ke_y)], fill=(255, 255, 255))
    return np.array(im, dtype=np.uint8), v


def _dan_watermark(anh: np.ndarray, vung: Vung, dam: float = 0.85) -> np.ndarray:
    """Dan chu trang mo mo vao dung khung 'vung' - gia lam watermark."""
    im = Image.fromarray(anh.copy())
    lop = Image.new("RGBA", im.size, (0, 0, 0, 0))
    but = ImageDraw.Draw(lop)
    but.text((vung.x + 4, vung.y + 4), "SAMPLE", fill=(255, 255, 255, int(255 * dam)))
    but.rectangle(
        [vung.x, vung.y, vung.x + vung.w - 1, vung.y + vung.h - 1],
        outline=(255, 255, 255, int(255 * dam)),
        width=2,
    )
    but.line([vung.x, vung.y + vung.h - 6, vung.x + vung.w - 1, vung.y + 6],
             fill=(255, 255, 255, int(255 * dam)), width=3)
    im = Image.alpha_composite(im.convert("RGBA"), lop).convert("RGB")
    return np.array(im, dtype=np.uint8)


def tu_kiem_tra() -> int:
    """Tu dung anh gia, dan watermark, xoa roi do lai voi ban goc."""
    log.info("=== TU KIEM TRA (dung anh tu tao, khong can file that) ===")
    loi: list[str] = []

    # --- 1. Doc chuoi --vung ---------------------------------------------
    kiem = [
        (phan_tich_vung("tu-dong", 1920, 1080) is None, "'tu-dong' phai tra None"),
        (str(phan_tich_vung("100,50,200,80", 1920, 1080)) == "100,50,200,80", "doc sai toa do px"),
        (str(phan_tich_vung("50%,50%,25%,10%", 1000, 800)) == "500,400,250,80", "doc sai toa do %"),
        (phan_tich_vung("duoi-phai", 1000, 1000).x == 700, "goc duoi-phai sai vi tri x"),
        (phan_tich_vung("duoi", 1000, 1000).w == 1000, "dai 'duoi' phai rong het anh"),
        (str(phan_tich_vung("900,900,500,500", 1000, 1000)) == "900,900,100,100",
         "phai cat khung cho nam gon trong anh"),
    ]
    loi.extend(ghi_chu for dat, ghi_chu in kiem if not dat)
    try:
        phan_tich_vung("linh tinh", 100, 100)
        loi.append("chuoi --vung sai phai bao loi")
    except ValueError:
        pass

    # --- 2. Bo anh gia co cung 1 watermark --------------------------------
    that = Vung(330, 200, 130, 55)
    sach = [_anh_gia(h) for h in range(6)]
    ban = [_dan_watermark(a, that) for a in sach]

    # --- 3. Tu do vi tri (ca anh nho lan anh 1280x720 nhu that) -----------
    def _thu_do(cac_anh: list[np.ndarray], khung: Vung, ten: str) -> None:
        do_duoc, ghi_chu = tim_vung_tu_dong(cac_anh)
        if do_duoc is None:
            loi.append(f"[{ten}] khong tu do duoc vi tri watermark ({ghi_chu})")
            return
        log.info("   Tu do vi tri (%s): %s | that: %s", ten, do_duoc, khung)
        tam_x, tam_y = khung.x + khung.w / 2, khung.y + khung.h / 2
        if not (do_duoc.x <= tam_x <= do_duoc.x + do_duoc.w
                and do_duoc.y <= tam_y <= do_duoc.y + do_duoc.h):
            loi.append(f"[{ten}] vung tu do ({do_duoc}) khong trum tam watermark ({khung})")
        if do_duoc.dien_tich > 6 * khung.dien_tich:
            loi.append(f"[{ten}] vung tu do qua rong: {do_duoc} so voi that {khung}")

    _thu_do(ban, that, "480x270")

    that_hd = Vung(700, 640, 240, 60)
    ban_hd = [_dan_watermark(_anh_gia(50 + i, 1280, 720), that_hd) for i in range(5)]
    _thu_do(ban_hd, that_hd, "1280x720")

    # anh kieu Flow: logo chi la dau sao nho o goc, nhung anh nao cung co mot
    # duong ranh nen/dat chay het chieu ngang - khong duoc bam nham vao do
    flow = []
    sao = Vung(0, 0, 1, 1)
    for i in range(3):
        a, sao = _dan_sao_goc(_anh_kieu_flow(200 + i))
        flow.append(a)
    do_sao, ghi_chu_sao = tim_vung_tu_dong(flow)
    if do_sao is None:
        loi.append(f"[kieu Flow] khong do duoc dau sao goc ({ghi_chu_sao})")
    else:
        log.info("   Tu do vi tri (kieu Flow): %s | that: %s", do_sao, sao)
        if do_sao.dien_tich > 8 * sao.dien_tich:
            loi.append(f"[kieu Flow] khoanh qua rong: {do_sao} trong khi logo chi la {sao}"
                       " (co ve bam nham duong ranh nen/dat)")
        tam_x, tam_y = sao.x + sao.w / 2, sao.y + sao.h / 2
        if not (do_sao.x <= tam_x <= do_sao.x + do_sao.w
                and do_sao.y <= tam_y <= do_sao.y + do_sao.h):
            loi.append(f"[kieu Flow] vung tu do ({do_sao}) khong trum dau sao ({sao})")

    if tim_vung_tu_dong(ban[:2])[0] is not None:
        loi.append("chi co 2 anh thi phai tu choi tu do vi tri")
    if tim_vung_tu_dong([sach[0]] * 4)[0] is not None:
        loi.append("4 anh y het nhau thi phai tu choi (khong phan biet duoc watermark)")

    # --- 4. Mat na loc mau ------------------------------------------------
    khung = that.no(6, ban[0].shape[1], ban[0].shape[0])
    ca_khung = tao_mat_na(ban[0], khung, "tat")
    if int(ca_khung.sum()) != khung.dien_tich:
        loi.append("loc-mau 'tat' phai lay tron ca khung")
    chi_sang = tao_mat_na(ban[0], khung, "sang", 25.0, 1)
    if not (0 < chi_sang.sum() < ca_khung.sum()):
        loi.append("loc-mau 'sang' phai bat it pixel hon ca khung")
    if chi_sang.sum() and (chi_sang & ~ca_khung).any():
        loi.append("mat na tran ra ngoai khung")

    # nen mau ruc + chu trang: 'sang' chi duoc bat chu trang
    nen_do = np.zeros((60, 90, 3), dtype=np.uint8)
    nen_do[:, :] = (220, 30, 30)
    nen_do[20:30, 30:40] = 255
    mn = tao_mat_na(nen_do, Vung(0, 0, 90, 60), "sang", 25.0, 1)
    if not mn[20:30, 30:40].all():
        loi.append("'sang' bo sot chu trang")
    if mn[:15, :20].any():
        loi.append("'sang' bat nham ca mang mau ruc lam nen")

    # --- 4b. Va o cho co ranh gioi sac net (nen xanh / dai vang kieu Flow) --
    goc_flow = _anh_kieu_flow(7)
    ban_flow, _ = _dan_sao_goc(goc_flow)
    v_flow = Vung(1243, int(768 * 0.87) - 42, 72, 72)   # khung trum ca ranh gioi
    mn_flow = tao_mat_na(ban_flow, v_flow, "tat", 0, 2)
    o_flow = (slice(v_flow.y, v_flow.y + v_flow.h), slice(v_flow.x, v_flow.x + v_flow.w))

    def _lech_flow(a: np.ndarray) -> float:
        return float(np.abs(a[o_flow].astype(np.float32)
                            - goc_flow[o_flow].astype(np.float32)).mean())

    mem = va_lai(ban_flow, mn_flow, dung_opencv=False)
    theo_cau_truc = va_cau_truc(ban_flow, mn_flow, mem)
    log.info("   Va o cho giap ranh xanh/vang: khuech tan %.1f -> theo cau truc %.1f",
             _lech_flow(mem), _lech_flow(theo_cau_truc))
    if _lech_flow(theo_cau_truc) > 3.0:
        loi.append(f"va theo cau truc con de lai vet o cho giap ranh"
                   f" ({_lech_flow(theo_cau_truc):.1f}/255)")
    if _lech_flow(theo_cau_truc) > _lech_flow(mem):
        loi.append("va theo cau truc phai hon han khuech tan o cho giap ranh sac net")

    # --- 4c. Logo SAT MEP anh: huong ngang chi con mot ben, huong doc thi vat
    # qua ranh gioi xanh/vang. Chon nham huong la ra dung vet toi o goc.
    goc_mep = _anh_kieu_flow(3)
    ban_mep = goc_mep.copy()
    dat_y = int(768 * 0.87)
    sx, sy = 1376 - 24 - 30, dat_y - 15        # cach mep phai 24px, vat ranh gioi
    for yy in range(sy, sy + 30):
        for xx in range(sx, sx + 30):
            dx, dy = (xx - sx - 15) / 15, (yy - sy - 15) / 15
            if abs(dx) ** 0.55 + abs(dy) ** 0.55 <= 1:
                ban_mep[yy, xx] = 255

    for ten_khung, v_mep in [
        ("khung vua du", Vung(sx - 6, sy - 6, 42, 42)),
        ("cham mep phai", Vung(sx - 6, sy - 6, 1376 - (sx - 6), 42)),
        ("cham mep phai va day", Vung(sx - 6, sy - 6, 1376 - (sx - 6), 768 - (sy - 6))),
        ("preset logo-duoi-phai", phan_tich_vung("logo-duoi-phai", 1376, 768)),
    ]:
        mn_mep = tao_mat_na(ban_mep, v_mep, "tat", 0, 2)
        ra_mep = va_cau_truc(ban_mep, mn_mep, va_lai(ban_mep, mn_mep, dung_opencv=False))
        o_mep = (slice(v_mep.y, v_mep.y + v_mep.h), slice(v_mep.x, v_mep.x + v_mep.w))
        lech_mep = float(np.abs(ra_mep[o_mep].astype(np.float32)
                                - goc_mep[o_mep].astype(np.float32)).mean())
        log.info("   Logo sat mep (%s): lech %.2f", ten_khung, lech_mep)
        if lech_mep > 1.0:
            loi.append(f"[{ten_khung}] con de lai vet o goc anh ({lech_mep:.2f}/255)")

    # --- 5. Va lai co that su sach khong ----------------------------------
    o = (slice(that.y, that.y + that.h), slice(that.x, that.x + that.w))
    truoc = float(np.abs(ban[0][o].astype(np.float32) - sach[0][o].astype(np.float32)).mean())
    da_va = _va_bang_numpy(ban[0], tao_mat_na(ban[0], khung, "tat"))
    sau = float(np.abs(da_va[o].astype(np.float32) - sach[0][o].astype(np.float32)).mean())
    log.info("   Sai lech trong vung: truoc khi va %.1f -> sau khi va %.1f (thang 0-255)",
             truoc, sau)
    if sau > truoc / 2:
        loi.append(f"va lai chua an thua: truoc {truoc:.1f}, sau {sau:.1f}")
    if sau > 30:
        loi.append(f"va lai con lech qua nhieu ({sau:.1f}/255)")
    if (da_va[:, :100] != ban[0][:, :100]).any():
        loi.append("va lai lam thay doi ca phan ngoai vung watermark")

    if _co_opencv():
        cv_va = _va_bang_opencv(ban[0], tao_mat_na(ban[0], khung, "tat"))
        cv_sau = float(np.abs(cv_va[o].astype(np.float32) - sach[0][o].astype(np.float32)).mean())
        log.info("   Co OpenCV: sai lech sau khi va = %.1f", cv_sau)
        if cv_sau > truoc:
            loi.append("ban OpenCV va con te hon anh goc")
    else:
        log.info("   Khong co OpenCV -> dung cach numpy (van chay tot).")

    # --- 6. To mau / nhoe / cat -------------------------------------------
    to = to_mau_nen(ban[0], tao_mat_na(ban[0], khung, "tat"), khung)
    if len(np.unique(to[o].reshape(-1, 3), axis=0)) != 1:
        loi.append("to mau nen phai ra dung 1 mau trong vung")
    nhoe = lam_nhoe(ban[0], khung)
    if nhoe.shape != ban[0].shape:
        loi.append("lam nhoe khong duoc doi kich thuoc anh")
    da_cat = cat_bo(ban[0], Vung(0, 220, 480, 50), giu_kich_thuoc=False)
    if da_cat.shape[0] != 220:
        loi.append(f"cat bo dai duoi phai con cao 220, dang ra {da_cat.shape[0]}")
    if cat_bo(ban[0], Vung(0, 220, 480, 50), giu_kich_thuoc=True).shape != ban[0].shape:
        loi.append("--giu-kich-thuoc phai tra ve anh dung kich thuoc cu")

    # --- 7. Doc / ghi file, giu kenh trong suot ---------------------------
    thu_muc = GOC / "WM_XONG" / "_TU_KIEM_TRA"
    shutil.rmtree(thu_muc, ignore_errors=True)
    thu_muc.mkdir(parents=True, exist_ok=True)
    f_png = thu_muc / "thu.png"
    im = Image.fromarray(ban[0]).convert("RGBA")
    im.putalpha(Image.fromarray(np.full(ban[0].shape[:2], 128, dtype=np.uint8), mode="L"))
    im.save(f_png)
    doc_lai, alpha = doc_anh(f_png)
    if alpha is None or int(alpha[0, 0]) != 128:
        loi.append("doc file PNG lam mat kenh trong suot")
    luu_anh(doc_lai, alpha, thu_muc / "ghi_lai.png")
    _, alpha2 = doc_anh(thu_muc / "ghi_lai.png")
    if alpha2 is None or int(alpha2[0, 0]) != 128:
        loi.append("ghi file PNG lam mat kenh trong suot")

    tuy_chon = argparse.Namespace(
        cach="va", vung="duoi-phai", loc_mau="tat", dung_sai=0.0, no_rong=2,
        giu_kich_thuoc=False, khong_opencv=False, chat_luong=95, xem_thu=False,
    )
    if not xu_ly_anh(f_png, thu_muc / "da_xoa.png", "duoi-phai", tuy_chon):
        loi.append("xu_ly_anh chay that bai")
    if not (thu_muc / "da_xoa.png").exists():
        loi.append("khong thay file ket qua")
    tuy_chon.xem_thu = True
    xu_ly_anh(f_png, thu_muc / "soi.png", "duoi-phai", tuy_chon)
    if not (thu_muc / "soi_xem_truoc.png").exists():
        loi.append("--xem-thu khong tao duoc anh co khung do")

    # --- 8. Ket luan ------------------------------------------------------
    log.info("-" * 70)
    if loi:
        for l in loi:
            log.error("  [HONG] %s", l)
        log.error("TU KIEM TRA: %d loi.", len(loi))
        return 1
    log.info("TU KIEM TRA: TAT CA DEU DAT.")
    log.info("File thu nam trong %s", thu_muc)
    return 0


# ---------------------------------------------------------------------------
# 9. Tham so + main
# ---------------------------------------------------------------------------


def phan_tich_tham_so(argv: Sequence[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="xoa_watermark.py",
        description=f"{APP_NAME} v{APP_VERSION} - xoa logo/chu chim tren anh va video cua ban.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Vi du:\n"
            "  python xoa_watermark.py                       (chay het WM_CHO, tu do vung)\n"
            "  python xoa_watermark.py anh.png --vung duoi-phai\n"
            "  python xoa_watermark.py D:\\ANH --vung 1520,980,380,80 --loc-mau sang\n"
            "  python xoa_watermark.py anh.png --xem-thu     (chi ve khung do de soi)\n"
            "  python xoa_watermark.py --tu-kiem-tra\n"
        ),
    )
    p.add_argument("dau_vao", nargs="*", help="Anh/video hoac thu muc (mac dinh: WM_CHO)")
    p.add_argument("--vung", default="tu-dong",
                   help="tu-dong | logo-duoi-phai (logo nho o goc) | duoi-phai | duoi-trai "
                        "| tren-phai | tren-trai | duoi | tren | giua | x,y,w,h (pixel hoac %%)")
    p.add_argument("--cach", default="va", choices=["va", "va-mem", "to", "cat", "nhoe"],
                   help="va (mac dinh, giu net nen) | va-mem (khuech tan) | to | cat | nhoe")
    p.add_argument("--loc-mau", dest="loc_mau", default="tat",
                   help="tat | sang | toi | #RRGGBB - chi xoa dung net watermark")
    p.add_argument("--dung-sai", dest="dung_sai", type=float, default=0.0,
                   help="Do rong tay khi loc mau (mac dinh 25 cho sang/toi, 60 cho ma mau)")
    p.add_argument("--no-rong", dest="no_rong", type=int, default=2,
                   help="Phinh mat na them may pixel de an vien mo (mac dinh 2)")
    p.add_argument("--giu-kich-thuoc", dest="giu_kich_thuoc", action="store_true",
                   help="Voi --cach cat: phong to lai ve dung kich thuoc cu")
    p.add_argument("--ra", default="", help="Thu muc ket qua (mac dinh: WM_XONG)")
    p.add_argument("--hau-to", dest="hau_to", default="", help="Them duoi vao ten file ket qua")
    p.add_argument("--ghi-de", dest="ghi_de", action="store_true",
                   help="Ghi de len chinh file goc (khong con ban luu)")
    p.add_argument("--lam-lai", dest="lam_lai", action="store_true",
                   help="Lam lai ca nhung file da co ket qua")
    p.add_argument("--xem-thu", dest="xem_thu", action="store_true",
                   help="Chi xuat anh co khung do danh dau vung, khong sua gi")
    p.add_argument("--chat-luong", dest="chat_luong", type=int, default=95,
                   help="Chat luong khi luu JPG/WEBP (mac dinh 95)")
    p.add_argument("--khong-opencv", dest="khong_opencv", action="store_true",
                   help="Ep dung cach va bang numpy du may co OpenCV")
    p.add_argument("--chi-tiet", dest="chi_tiet", action="store_true", help="In them log go roi")
    p.add_argument("--tu-kiem-tra", dest="tu_kiem_tra", action="store_true",
                   help="Tu test toan bo duong ong, khong can anh that")
    return p.parse_args(list(argv))


def main(argv: Sequence[str] | None = None) -> int:
    ep_utf8()
    tuy_chon = phan_tich_tham_so(sys.argv[1:] if argv is None else argv)
    file_log = cai_dat_log(logging.DEBUG if tuy_chon.chi_tiet else logging.INFO)

    log.info("=" * 70)
    log.info("%s v%s  |  xoa watermark tren anh & video", APP_NAME, APP_VERSION)
    log.info("Log: %s", file_log)

    if tuy_chon.tu_kiem_tra:
        return tu_kiem_tra()

    for thu_muc in (THU_MUC_VAO, THU_MUC_RA):
        thu_muc.mkdir(parents=True, exist_ok=True)

    if tuy_chon.ghi_de:
        log.warning("Che do --ghi-de: file goc se bi ghi de, khong con ban luu.")

    try:
        return chay(tuy_chon)
    except KeyboardInterrupt:
        log.warning("Nguoi dung dung giua chung.")
        return 130
    except ValueError as loi:
        log.error("%s", loi)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

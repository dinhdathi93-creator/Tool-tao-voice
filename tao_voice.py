# -*- coding: utf-8 -*-
"""
TAO_VOICE - Tool doc kich ban thanh giong noi (Windows, CPU-only).

Dua tren pocket-tts cua Kyutai (https://github.com/kyutai-labs/pocket-tts)
va faster-whisper de xuat phu de SRT.

Cach chay nhanh nhat: keo tha file/thu muc vao TAO_VOICE.bat
Hoac:  python tao_voice.py                  -> chay het hang doi trong KB_CHO/
       python tao_voice.py KB_CHO\\a.txt     -> chay 1 file
       python tao_voice.py --tu-kiem-tra    -> test duong ong, khong can model

Quy uoc trong file kich ban (.txt):
  - Dau cham/cham than/cham hoi ket cau  -> nghi NGAN
  - Cau ket doan + 1 dong trong o duoi   -> nghi DAI
  - Dong chi co "---"                    -> nghi RAT DAI
  - [nghi=2.5] hoac [pause=2.5]          -> nghi dung 2.5 giay
  - Dong bat dau bang "#" hoac "//"      -> ghi chu, khong doc
  - Dong dang [INTRO], [HOOK]...         -> chi dan san xuat, khong doc
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import shutil
import sys
import time
import unicodedata
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

# ---------------------------------------------------------------------------
# 0. Thiet lap co ban
# ---------------------------------------------------------------------------

APP_NAME = "TAO_VOICE"
APP_VERSION = "1.0.0"

GOC = Path(__file__).resolve().parent
THU_MUC_VAO = GOC / "KB_CHO"
THU_MUC_GIONG = GOC / "voices"
THU_MUC_RA = GOC / "XONG"
THU_MUC_LOG = GOC / "logs"
THU_MUC_CACHE = GOC / ".cache_voice"
FILE_CAU_HINH = GOC / "channels.json"

# pocket-tts luon xuat 24 kHz mono; van doc lai tu model khi co the.
SAMPLE_RATE_MAC_DINH = 24000

# Ten config hop le cua pocket-tts (xem pocket_tts/config/*.yaml).
MODEL_HOP_LE = [
    "english",
    "english_2026-01",
    "english_2026-04",
    "portuguese",
    "portuguese_24l",
    "french",
    "french_24l",
    "german",
    "german_24l",
    "italian",
    "italian_24l",
    "spanish",
    "spanish_24l",
]

# model pocket-tts -> ma ngon ngu cho faster-whisper
MA_WHISPER = {
    "english": "en",
    "portuguese": "pt",
    "french": "fr",
    "german": "de",
    "italian": "it",
    "spanish": "es",
}

CAU_HINH_MAU = {
    "_doc": [
        "mac_dinh = cau hinh dung chung; kenh = cau hinh rieng theo tien to ten file.",
        "Ten file KB_CHO/TERCO1_video01.txt -> tien to TERCO1 -> lay muc kenh.TERCO1.",
        "model: ten config pocket-tts (english, portuguese, italian, spanish, french, german...).",
        "voice: ten file giong mau nam trong thu muc voices/ (WAV 10-30 giay la dep nhat).",
        "nghi_ngan / nghi_dai / nghi_doan_dai: do dai khoang lang, tinh bang giay.",
    ],
    "mac_dinh": {
        "model": "english",
        "voice": "",
        "nghi_ngan": 0.30,
        "nghi_dai": 0.85,
        "nghi_doan_dai": 1.60,
        "duoi_file": 0.50,
        "temperature": None,
        "whisper_lang": None,
    },
    "kenh": {
        "TERCO1": {"model": "portuguese", "voice": "TERCO1.wav"},
        "GODSAYS": {"model": "english", "voice": "GODSAYS.wav"},
    },
}

log = logging.getLogger(APP_NAME)


# ---------------------------------------------------------------------------
# 1. Log
# ---------------------------------------------------------------------------


def cai_dat_log(muc: int = logging.INFO) -> Path:
    """Bat log ra man hinh + ra file logs/tao_voice_YYYY-MM-DD.log."""
    THU_MUC_LOG.mkdir(parents=True, exist_ok=True)
    duong_dan = THU_MUC_LOG / f"tao_voice_{time.strftime('%Y-%m-%d')}.log"

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

    # pocket-tts noi rat nhieu, chi cho no ghi xuong file.
    for ten in ("pocket_tts", "faster_whisper"):
        con = logging.getLogger(ten)
        con.setLevel(logging.INFO)
        con.handlers.clear()
        con.propagate = False
        con.addHandler(ra_file)

    return duong_dan


def ep_utf8() -> None:
    """Console Windows hay la cp1252/cp437 -> ep UTF-8 cho khoi loi tieng Viet."""
    for luong in (sys.stdout, sys.stderr):
        try:
            luong.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
        except Exception:
            pass


# ---------------------------------------------------------------------------
# 2. Cau hinh kenh
# ---------------------------------------------------------------------------


@dataclass
class CauHinhKenh:
    ten: str
    model: str
    giong: Path | None
    nghi_ngan: float
    nghi_dai: float
    nghi_doan_dai: float
    duoi_file: float
    temperature: float | None
    whisper_lang: str | None

    @property
    def ma_whisper(self) -> str | None:
        if self.whisper_lang:
            return self.whisper_lang
        for khoa, ma in MA_WHISPER.items():
            if self.model.startswith(khoa):
                return ma
        return None


def doc_cau_hinh() -> dict:
    """Doc channels.json, tu tao file mau neu chua co."""
    if not FILE_CAU_HINH.exists():
        FILE_CAU_HINH.write_text(
            json.dumps(CAU_HINH_MAU, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        log.info("Da tao file cau hinh mau: %s", FILE_CAU_HINH.name)
        return json.loads(json.dumps(CAU_HINH_MAU))

    try:
        return json.loads(FILE_CAU_HINH.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as loi:
        log.error("channels.json bi loi cu phap JSON (dong %s): %s", loi.lineno, loi.msg)
        log.error("Tam dung cau hinh mac dinh. Sua lai file roi chay lai.")
        return json.loads(json.dumps(CAU_HINH_MAU))


def lay_tien_to(ten_file: str) -> str:
    """TERCO1_video_01.txt -> TERCO1 ; godsays-05.txt -> GODSAYS."""
    goc = Path(ten_file).stem
    khop = re.match(r"^([A-Za-z0-9]+)\s*[_\-. ]", goc)
    return (khop.group(1) if khop else goc).upper()


def tim_file_giong(tien_to: str, ten_khai_bao: str | None) -> Path | None:
    """Tim file giong mau: uu tien khai bao trong channels.json, sau do theo ten file."""
    duoi_am_thanh = (".wav", ".safetensors", ".mp3", ".flac", ".ogg", ".m4a")

    if ten_khai_bao:
        ung_vien = Path(ten_khai_bao)
        for duong_dan in (ung_vien, THU_MUC_GIONG / ung_vien, GOC / ung_vien):
            if duong_dan.is_file():
                return duong_dan.resolve()
        log.warning("Khong thay file giong '%s' trong voices/ -> tim theo ten kenh.", ten_khai_bao)

    if THU_MUC_GIONG.is_dir():
        # voices/TERCO1.wav, voices/TERCO1_v2.wav, voices/terco1.safetensors ...
        for duong_dan in sorted(THU_MUC_GIONG.iterdir()):
            if duong_dan.suffix.lower() not in duoi_am_thanh:
                continue
            if duong_dan.stem.upper() == tien_to or duong_dan.stem.upper().startswith(tien_to + "_"):
                return duong_dan.resolve()
    return None


def lay_cau_hinh_kenh(ten_file: str, cau_hinh: dict, im_lang: bool = False) -> CauHinhKenh:
    mac_dinh = dict(CAU_HINH_MAU["mac_dinh"])
    mac_dinh.update(cau_hinh.get("mac_dinh") or {})

    tien_to = lay_tien_to(ten_file)
    bang_kenh = {str(k).upper(): v for k, v in (cau_hinh.get("kenh") or {}).items()}
    rieng = bang_kenh.get(tien_to)

    if rieng is None:
        if not im_lang:
            log.warning(
                "Tien to '%s' chua khai bao trong channels.json -> dung cau hinh mac dinh (%s).",
                tien_to,
                mac_dinh.get("model"),
            )
        rieng = {}

    gop = {**mac_dinh, **rieng}
    model = str(gop.get("model") or "english").strip()
    if model not in MODEL_HOP_LE and not im_lang:
        log.warning("Model '%s' khong nam trong danh sach pocket-tts, van thu nap.", model)

    return CauHinhKenh(
        ten=tien_to,
        model=model,
        giong=None if im_lang else tim_file_giong(tien_to, gop.get("voice") or None),
        nghi_ngan=float(gop.get("nghi_ngan", 0.30)),
        nghi_dai=float(gop.get("nghi_dai", 0.85)),
        nghi_doan_dai=float(gop.get("nghi_doan_dai", 1.60)),
        duoi_file=float(gop.get("duoi_file", 0.50)),
        temperature=(None if gop.get("temperature") in (None, "") else float(gop["temperature"])),
        whisper_lang=(gop.get("whisper_lang") or None),
    )


# ---------------------------------------------------------------------------
# 3. Doc kich ban -> danh sach doan noi + do dai nghi
# ---------------------------------------------------------------------------

# Nhung tu ma dau cham dang sau chi la viet tat, khong phai het cau.
# Co y KHONG dua vao: no, co, al, ex, est... vi chung cung la tu binh thuong.
VIET_TAT = {
    "mr", "mrs", "ms", "dr", "prof", "st", "jr", "sr", "sra", "srta", "vs", "etc",
    "inc", "ltd", "corp", "dept", "fig", "vol", "approx", "ave", "rd", "mt",
    "eg", "ie", "pp", "u.s", "u.k", "dept", "phd",
}

RE_NGHI = re.compile(r"\[\s*(?:nghi|nghỉ|pause)\s*[=:]?\s*([0-9]+(?:[.,][0-9]+)?)\s*s?\s*\]", re.I)
RE_CHI_DAN = re.compile(r"^\[[^\]]{0,60}\]$")
RE_KET_CAU = re.compile(r"[.!?…]+[\"'”’)\]]*")


@dataclass
class DoanNoi:
    """Mot cau se duoc doc, kem khoang lang chen ngay sau no."""

    text: str
    nghi_sau: float
    # duoc dien sau khi tao xong am thanh (tinh bang mau)
    bat_dau: int = 0
    ket_thuc: int = 0


def _bo_dau(chuoi: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", chuoi) if unicodedata.category(c) != "Mn"
    )


def tach_cau(khoi: str) -> list[str]:
    """Tach mot khoi van ban thanh cac cau, tranh cat nham o viet tat va so thap phan."""
    cau: list[str] = []
    vi_tri = 0
    for khop in RE_KET_CAU.finditer(khoi):
        cuoi = khop.end()
        sau = khoi[cuoi : cuoi + 2]
        # phai co khoang trang / xuong dong / het chuoi ngay sau dau cau
        if sau and not sau[0].isspace():
            continue

        # chi xet dau cham / cham lung; "?" va "!" thi luon la het cau
        chi_dau_cham = re.fullmatch(r"[.…]+[\"'”’)\]]*", khop.group(0)) is not None

        if chi_dau_cham:
            truoc = khoi[vi_tri:cuoi].strip().rstrip(".!?…\"'”’)]")
            manh_truoc = [x for x in re.split(r"[\s(\[\"'“‘]", truoc) if x]
            tu_cuoi = _bo_dau(manh_truoc[-1].lower()) if manh_truoc else ""

            # "Mr." , "U.S." , mot chu cai don ("J. Smith")
            if tu_cuoi in VIET_TAT or len(tu_cuoi) <= 1:
                continue
            # "1. 500" -> so, khong phai het cau
            if (
                tu_cuoi.isdigit()
                and khoi[cuoi : cuoi + 1] == " "
                and khoi[cuoi + 1 : cuoi + 2].isdigit()
            ):
                continue
            # chu thuong ngay sau dau cham thi thuong van la cung mot cau
            if khoi[cuoi:].lstrip()[:1].islower():
                continue

        manh = khoi[vi_tri:cuoi].strip()
        if manh:
            cau.append(manh)
        vi_tri = cuoi

    con_lai = khoi[vi_tri:].strip()
    if con_lai:
        cau.append(con_lai)
    return cau


def doc_kich_ban(duong_dan: Path, cfg: CauHinhKenh) -> list[DoanNoi]:
    """Doc file .txt -> danh sach DoanNoi theo dung quy uoc ngat."""
    raw = duong_dan.read_text(encoding="utf-8-sig", errors="replace")
    raw = raw.replace("\r\n", "\n").replace("\r", "\n")
    raw = raw.replace("\u00a0", " ").replace("\u200b", "")

    khoi_hien_tai: list[str] = []
    khoi: list[tuple[list[str], float]] = []  # (cac dong, nghi sau khoi)

    def chot_khoi(nghi: float, ep: bool = False) -> None:
        """Dong khoi dang go.

        Neu khoi dang go rong (vi du '---' hoac '[nghi=2]' dat sau mot dong trong)
        thi ap do dai nghi len khoi ngay truoc do, khong de marker bi mat tac dung.
        """
        nonlocal khoi_hien_tai
        if khoi_hien_tai:
            khoi.append((khoi_hien_tai, nghi))
            khoi_hien_tai = []
        elif khoi:
            cac_dong, nghi_cu = khoi[-1]
            khoi[-1] = (cac_dong, nghi if ep else max(nghi_cu, nghi))

    for dong_goc in raw.split("\n"):
        dong = dong_goc.strip()

        if not dong:
            chot_khoi(cfg.nghi_dai)
            continue

        if dong.startswith("#") or dong.startswith("//"):
            continue

        if re.fullmatch(r"[-=_*~]{3,}", dong):
            chot_khoi(cfg.nghi_doan_dai)
            continue

        # [nghi=2.5] dung mot minh tren dong -> ep do dai khoang lang cua khoi trc
        chi_nghi = RE_NGHI.fullmatch(dong)
        if chi_nghi:
            chot_khoi(float(chi_nghi.group(1).replace(",", ".")), ep=True)
            continue

        # [INTRO], [B-ROLL: ...] -> chi dan san xuat, khong doc
        if RE_CHI_DAN.match(dong) and not RE_NGHI.search(dong):
            continue

        khoi_hien_tai.append(dong)

    chot_khoi(cfg.duoi_file)

    doan: list[DoanNoi] = []
    for cac_dong, nghi_cuoi_khoi in khoi:
        van_ban = " ".join(cac_dong)
        van_ban = RE_NGHI.sub(" ", van_ban)  # marker con sot lai giua dong -> bo
        van_ban = re.sub(r"\s+", " ", van_ban).strip()
        if not van_ban:
            continue
        cau = tach_cau(van_ban)
        for i, mot_cau in enumerate(cau):
            cuoi_khoi = i == len(cau) - 1
            doan.append(DoanNoi(mot_cau, nghi_cuoi_khoi if cuoi_khoi else cfg.nghi_ngan))

    if doan:
        doan[-1].nghi_sau = cfg.duoi_file
    return doan


# ---------------------------------------------------------------------------
# 4. Xu ly am thanh
# ---------------------------------------------------------------------------


def _np():
    import numpy as np

    return np


def cat_lang(am: "object", sample_rate: int, nguong_db: float = -42.0, le: float = 0.04):
    """Cat bot khoang lang o dau/cuoi doan de tu minh kiem soat do dai nghi."""
    np = _np()
    if am.size == 0:
        return am
    khung = max(1, int(sample_rate * 0.01))
    so_khung = am.size // khung
    if so_khung < 2:
        return am
    nang_luong = np.abs(am[: so_khung * khung].reshape(so_khung, khung)).max(axis=1)
    nguong = max(10.0 ** (nguong_db / 20.0), float(nang_luong.max()) * 0.02)
    co_tieng = np.nonzero(nang_luong > nguong)[0]
    if co_tieng.size == 0:
        return am
    dau = max(0, int(co_tieng[0] * khung - le * sample_rate))
    cuoi = min(am.size, int((co_tieng[-1] + 1) * khung + le * sample_rate))
    return am[dau:cuoi]


def vuot_bien(am: "object", sample_rate: int, ms: float = 8.0):
    """Fade in/out cuc ngan cho khoi 'tach' khi noi cac doan."""
    np = _np()
    n = min(int(sample_rate * ms / 1000.0), am.size // 2)
    if n <= 1:
        return am
    duong = np.linspace(0.0, 1.0, n, dtype=np.float32)
    am = am.copy()
    am[:n] *= duong
    am[-n:] *= duong[::-1]
    return am


def chuan_bien_do(am: "object", dinh_db: float = -1.0):
    np = _np()
    dinh = float(np.max(np.abs(am))) if am.size else 0.0
    if dinh < 1e-6:
        return am
    return am * (10.0 ** (dinh_db / 20.0) / dinh)


def ghi_wav(duong_dan: Path, am: "object", sample_rate: int) -> None:
    """Ghi WAV mono 16-bit PCM (dinh dang an toan nhat cho moi phan mem dung)."""
    np = _np()
    du_lieu = np.clip(am, -1.0, 1.0)
    pcm = (du_lieu * 32767.0).astype("<i2")
    duong_dan.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(duong_dan), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sample_rate)
        f.writeframes(pcm.tobytes())


# ---------------------------------------------------------------------------
# 5. Boc pocket-tts
# ---------------------------------------------------------------------------


class MayDocGiong:
    """Nap va giu lai model pocket-tts + trang thai giong, dung chung cho ca hang doi."""

    def __init__(self, so_luong: int, temperature_ep: float | None = None, luong: int | None = None):
        self._model: dict[str, object] = {}
        self._giong: dict[tuple[str, str], object] = {}
        self.so_luong = so_luong
        self.temperature_ep = temperature_ep
        self.luong = luong
        self.sample_rate = SAMPLE_RATE_MAC_DINH

    # -- nap model ---------------------------------------------------------
    def model(self, ten_model: str, temperature: float | None):
        if ten_model in self._model:
            return self._model[ten_model]

        try:
            import torch
            from pocket_tts import TTSModel
        except ImportError as loi:
            raise SystemExit(
                "Thieu thu vien pocket-tts/torch.\n"
                "Chay CAI_DAT.bat, hoac:  pip install pocket-tts soundfile faster-whisper\n"
                f"(chi tiet: {loi})"
            ) from loi

        if self.luong:
            torch.set_num_threads(max(1, self.luong))
        log.info("Nap model pocket-tts '%s' (lan dau se tai ve, hoi lau)...", ten_model)
        t0 = time.time()
        nhiet = self.temperature_ep if self.temperature_ep is not None else temperature
        model = TTSModel.load_model(language=ten_model, temp=nhiet)
        model.to("cpu")
        self._model[ten_model] = model
        self.sample_rate = int(model.sample_rate)
        log.info("Nap xong '%s' sau %.1f giay (CPU, %d Hz).", ten_model, time.time() - t0, self.sample_rate)
        return model

    # -- trang thai giong --------------------------------------------------
    def trang_thai_giong(self, ten_model: str, file_giong: Path | None, temperature: float | None):
        khoa = (ten_model, str(file_giong) if file_giong else "__mac_dinh__")
        if khoa in self._giong:
            return self._giong[khoa]

        model = self.model(ten_model, temperature)

        if file_giong is None:
            from pocket_tts.default_parameters import get_default_voice_for_language

            ten_giong = get_default_voice_for_language(ten_model)
            log.warning("Khong co file giong mau -> dung giong san co '%s'.", ten_giong)
            trang_thai = model.get_state_for_audio_prompt(ten_giong)
        elif file_giong.suffix.lower() == ".safetensors":
            trang_thai = model.get_state_for_audio_prompt(file_giong)
        else:
            trang_thai = self._nap_giong_co_cache(model, ten_model, file_giong)

        self._giong[khoa] = trang_thai
        return trang_thai

    def _nap_giong_co_cache(self, model, ten_model: str, file_giong: Path):
        """Ma hoa giong mau 1 lan roi cache ra .safetensors cho nhung lan sau."""
        from pocket_tts import export_model_state

        thong_tin = file_giong.stat()
        dau_van = f"{file_giong.stem}_{ten_model}_{int(thong_tin.st_mtime)}_{thong_tin.st_size}"
        cache = THU_MUC_CACHE / f"{re.sub(r'[^A-Za-z0-9_.-]', '_', dau_van)}.safetensors"

        if cache.exists():
            log.info("Dung giong da ma hoa san: %s", cache.name)
            try:
                return model.get_state_for_audio_prompt(cache)
            except Exception as loi:
                log.warning("Cache giong hong (%s), ma hoa lai.", loi)

        nguon = self._bao_dam_wav_doc_duoc(file_giong)
        log.info("Ma hoa giong mau: %s", file_giong.name)
        trang_thai = model.get_state_for_audio_prompt(nguon, truncate=True)
        try:
            THU_MUC_CACHE.mkdir(parents=True, exist_ok=True)
            export_model_state(trang_thai, cache)
        except Exception as loi:  # cache chi la toi uu, hong thi bo qua
            log.debug("Khong luu duoc cache giong: %s", loi)
        return trang_thai

    @staticmethod
    def _bao_dam_wav_doc_duoc(file_giong: Path) -> Path:
        """pocket-tts doc WAV bang module `wave` va gia dinh 16-bit PCM.

        WAV 24/32-bit hoac 32-bit float se ra tieng nhieu -> chuyen ve 16-bit truoc.
        """
        if file_giong.suffix.lower() != ".wav":
            return file_giong  # cac dinh dang khac di qua soundfile, khong sao
        try:
            with wave.open(str(file_giong), "rb") as f:
                if f.getsampwidth() == 2:
                    return file_giong
        except Exception:
            pass  # WAV la (24/32-bit, float, hong header...) -> de soundfile lo

        try:
            import numpy as np
            import soundfile as sf
        except ImportError:
            log.warning(
                "File giong %s khong phai WAV 16-bit va thieu soundfile de chuyen doi. "
                "Hay xuat lai giong mau o dang WAV 16-bit PCM mono.",
                file_giong.name,
            )
            return file_giong

        try:
            du_lieu, sr = sf.read(str(file_giong), dtype="float32", always_2d=True)
            mono = du_lieu.mean(axis=1).astype(np.float32)
            THU_MUC_CACHE.mkdir(parents=True, exist_ok=True)
            dich = THU_MUC_CACHE / f"{file_giong.stem}_16bit.wav"
            ghi_wav(dich, mono, int(sr))
            log.info("Da chuyen giong mau sang WAV 16-bit: %s", dich.name)
            return dich
        except Exception as loi:
            log.warning("Khong chuyen doi duoc %s (%s), thu dung truc tiep.", file_giong.name, loi)
            return file_giong

    # -- sinh am thanh -----------------------------------------------------
    def doc_voi_model(self, ten_model: str, trang_thai, van_ban: str, temperature: float | None):
        np = _np()
        model = self.model(ten_model, temperature)
        am = model.generate_audio(trang_thai, van_ban)
        return am.detach().to("cpu").numpy().reshape(-1).astype(np.float32)


class MayDocGia(MayDocGiong):
    """Engine gia cho che do --tu-kiem-tra: khong can model, khong can mang."""

    def __init__(self):
        super().__init__(so_luong=0)
        self.sample_rate = SAMPLE_RATE_MAC_DINH

    def trang_thai_giong(self, ten_model, file_giong, temperature):
        return {"gia": True}

    def doc_voi_model(self, ten_model, trang_thai, van_ban, temperature):
        np = _np()
        giay = max(0.4, len(van_ban) / 15.0)
        t = np.arange(int(giay * self.sample_rate), dtype=np.float32) / self.sample_rate
        am = 0.25 * np.sin(2 * np.pi * 150.0 * t).astype(np.float32)
        bao = np.minimum(1.0, np.minimum(t * 20, (giay - t) * 20)).astype(np.float32)
        return am * bao


# ---------------------------------------------------------------------------
# 6. Phu de SRT
# ---------------------------------------------------------------------------

MAX_KY_TU_DONG = 42
MAX_KY_TU_CUE = 84
MAX_GIAY_CUE = 6.0
MIN_GIAY_CUE = 0.9


@dataclass
class Tu:
    text: str
    bat_dau: float
    ket_thuc: float


@dataclass
class Cue:
    bat_dau: float
    ket_thuc: float
    text: str


def _chuan_hoa_tu(tu: str) -> str:
    return re.sub(r"[^0-9a-z]", "", _bo_dau(tu.lower()))


def nhan_dang_bang_whisper(
    duong_dan_wav: Path, ma_ngon_ngu: str | None, ten_model: str, so_luong_thread: int | None
) -> list[Tu]:
    """Chay faster-whisper de lay moc thoi gian tung tu. Loi thi tra ve rong."""
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        log.warning("Chua cai faster-whisper -> SRT se uoc luong moc thoi gian theo do dai cau.")
        return []

    try:
        log.info("Nhan dang bang faster-whisper (%s, CPU int8)...", ten_model)
        t0 = time.time()
        model = _whisper_cache(ten_model, so_luong_thread)
        cac_doan, _ = model.transcribe(
            str(duong_dan_wav),
            language=ma_ngon_ngu,
            word_timestamps=True,
            vad_filter=True,
            beam_size=1,
        )
        tu: list[Tu] = []
        for doan in cac_doan:
            for w in doan.words or []:
                if w.word.strip():
                    tu.append(Tu(w.word.strip(), float(w.start), float(w.end)))
        log.info("Nhan dang xong: %d tu trong %.1f giay.", len(tu), time.time() - t0)
        return tu
    except Exception as loi:
        log.warning("faster-whisper loi (%s) -> chuyen sang uoc luong moc thoi gian.", loi)
        return []


_BO_NHO_WHISPER: dict[tuple[str, int | None], object] = {}


def _whisper_cache(ten_model: str, so_luong_thread: int | None):
    khoa = (ten_model, so_luong_thread)
    if khoa not in _BO_NHO_WHISPER:
        from faster_whisper import WhisperModel

        _BO_NHO_WHISPER[khoa] = WhisperModel(
            ten_model,
            device="cpu",
            compute_type="int8",
            cpu_threads=so_luong_thread or 0,
            download_root=str(THU_MUC_CACHE / "whisper"),
        )
    return _BO_NHO_WHISPER[khoa]


def gan_moc_thoi_gian(
    tu_kich_ban: Sequence[str], tu_nhan_dang: Sequence[Tu], dau: float, cuoi: float
) -> list[Tu]:
    """Khop tu cua kich ban voi tu whisper nhan dang duoc (Needleman-Wunsch).

    Giu nguyen chu viet cua kich ban, chi muon moc thoi gian cua whisper.
    Tu nao khong khop thi noi suy tuyen tinh giua hai moc gan nhat.
    """
    n, m = len(tu_kich_ban), len(tu_nhan_dang)
    ket_qua: list[Tu | None] = [None] * n

    if n and m:
        a = [_chuan_hoa_tu(t) for t in tu_kich_ban]
        b = [_chuan_hoa_tu(t.text) for t in tu_nhan_dang]

        TRU = -1.0
        bang = [[0.0] * (m + 1) for _ in range(n + 1)]
        for i in range(1, n + 1):
            bang[i][0] = bang[i - 1][0] + TRU
        for j in range(1, m + 1):
            bang[0][j] = bang[0][j - 1] + TRU
        for i in range(1, n + 1):
            for j in range(1, m + 1):
                if a[i - 1] and a[i - 1] == b[j - 1]:
                    diem = 2.0
                elif a[i - 1] and b[j - 1] and (a[i - 1][:3] == b[j - 1][:3]):
                    diem = 0.6
                else:
                    diem = -1.2
                bang[i][j] = max(
                    bang[i - 1][j - 1] + diem, bang[i - 1][j] + TRU, bang[i][j - 1] + TRU
                )

        i, j = n, m
        while i > 0 and j > 0:
            if a[i - 1] and a[i - 1] == b[j - 1]:
                diem = 2.0
            elif a[i - 1] and b[j - 1] and (a[i - 1][:3] == b[j - 1][:3]):
                diem = 0.6
            else:
                diem = -1.2
            if bang[i][j] == bang[i - 1][j - 1] + diem:
                if diem > 0:
                    ket_qua[i - 1] = Tu(tu_kich_ban[i - 1], tu_nhan_dang[j - 1].bat_dau, tu_nhan_dang[j - 1].ket_thuc)
                i -= 1
                j -= 1
            elif bang[i][j] == bang[i - 1][j] + TRU:
                i -= 1
            else:
                j -= 1

    # noi suy cho cac tu chua co moc
    do_dai = [max(1, len(t)) for t in tu_kich_ban]
    day_du: list[Tu] = []
    vi_tri = 0
    while vi_tri < n:
        if ket_qua[vi_tri] is not None:
            day_du.append(ket_qua[vi_tri])  # type: ignore[arg-type]
            vi_tri += 1
            continue
        ke = vi_tri
        while ke < n and ket_qua[ke] is None:
            ke += 1
        t_dau = day_du[-1].ket_thuc if day_du else dau
        t_cuoi = ket_qua[ke].bat_dau if ke < n else cuoi  # type: ignore[union-attr]
        if t_cuoi <= t_dau:
            t_cuoi = t_dau + 0.12 * (ke - vi_tri)
        tong = sum(do_dai[vi_tri:ke]) or 1
        moc = t_dau
        for k in range(vi_tri, ke):
            phan = (t_cuoi - t_dau) * do_dai[k] / tong
            day_du.append(Tu(tu_kich_ban[k], moc, moc + phan))
            moc += phan
        vi_tri = ke

    # bao dam thoi gian tang dan va nam trong khung cua doan
    truoc = dau
    for t in day_du:
        t.bat_dau = min(max(t.bat_dau, truoc), cuoi)
        t.ket_thuc = min(max(t.ket_thuc, t.bat_dau + 0.05), cuoi)
        truoc = t.ket_thuc
    return day_du


def gap_dong(van_ban: str, rong: int = MAX_KY_TU_DONG) -> str:
    """Be cau thanh toi da 2 dong cho de doc."""
    if len(van_ban) <= rong:
        return van_ban
    tu = van_ban.split()
    giua = len(van_ban) / 2
    dong1: list[str] = []
    dai = 0
    for t in tu:
        if dai and dai + 1 + len(t) > giua:
            break
        dai += (1 if dong1 else 0) + len(t)
        dong1.append(t)
    dong2 = tu[len(dong1) :]
    if not dong1 or not dong2:
        return van_ban
    return " ".join(dong1) + "\n" + " ".join(dong2)


def tao_cue(tu_theo_doan: Sequence[list[Tu]]) -> list[Cue]:
    cue: list[Cue] = []
    for cac_tu in tu_theo_doan:
        if not cac_tu:
            continue
        hien_tai: list[Tu] = []
        for tu in cac_tu:
            du_kien = sum(len(t.text) + 1 for t in hien_tai) + len(tu.text)
            qua_dai = du_kien > MAX_KY_TU_CUE
            qua_lau = hien_tai and (tu.ket_thuc - hien_tai[0].bat_dau) > MAX_GIAY_CUE
            if hien_tai and (qua_dai or qua_lau):
                cue.append(_dong_cue(hien_tai))
                hien_tai = []
            hien_tai.append(tu)
            # nghi hoi trong cau: cat cho gon neu da du dai
            if hien_tai and re.search(r"[,;:—–]$", tu.text) and du_kien > MAX_KY_TU_CUE * 0.6:
                cue.append(_dong_cue(hien_tai))
                hien_tai = []
        if hien_tai:
            cue.append(_dong_cue(hien_tai))

    # keo dai cue qua ngan, tranh chong lan
    for i, c in enumerate(cue):
        if c.ket_thuc - c.bat_dau < MIN_GIAY_CUE:
            gioi_han = cue[i + 1].bat_dau - 0.04 if i + 1 < len(cue) else c.ket_thuc + MIN_GIAY_CUE
            c.ket_thuc = max(c.ket_thuc, min(c.bat_dau + MIN_GIAY_CUE, gioi_han))
    return cue


def _dong_cue(cac_tu: list[Tu]) -> Cue:
    van_ban = " ".join(t.text for t in cac_tu).strip()
    return Cue(cac_tu[0].bat_dau, cac_tu[-1].ket_thuc, gap_dong(van_ban))


def dinh_dang_thoi_gian(giay: float) -> str:
    giay = max(0.0, giay)
    gio, con = divmod(int(giay), 3600)
    phut, s = divmod(con, 60)
    ms = int(round((giay - int(giay)) * 1000))
    if ms == 1000:
        ms, s = 0, s + 1
    return f"{gio:02d}:{phut:02d}:{s:02d},{ms:03d}"


def ghi_srt(duong_dan: Path, cue: Sequence[Cue]) -> None:
    khoi = []
    for i, c in enumerate(cue, 1):
        khoi.append(
            f"{i}\n{dinh_dang_thoi_gian(c.bat_dau)} --> {dinh_dang_thoi_gian(c.ket_thuc)}\n{c.text}\n"
        )
    duong_dan.parent.mkdir(parents=True, exist_ok=True)
    duong_dan.write_text("\n".join(khoi), encoding="utf-8")


# ---------------------------------------------------------------------------
# 7. Xu ly 1 file kich ban
# ---------------------------------------------------------------------------


@dataclass
class KetQua:
    file: Path
    ok: bool
    ghi_chu: str = ""
    wav: Path | None = None
    srt: Path | None = None
    giay: float = 0.0


def xu_ly_mot_file(
    duong_dan: Path,
    cau_hinh: dict,
    engine: MayDocGiong,
    tuy_chon: argparse.Namespace,
) -> KetQua:
    t_bat_dau = time.time()
    cfg = lay_cau_hinh_kenh(duong_dan.name, cau_hinh)

    thu_muc_ra = THU_MUC_RA / cfg.ten if tuy_chon.chia_thu_muc else THU_MUC_RA
    file_wav = thu_muc_ra / (duong_dan.stem + ".wav")
    file_srt = thu_muc_ra / (duong_dan.stem + ".srt")

    if file_wav.exists() and not tuy_chon.lam_lai:
        log.info("BO QUA (da co ban ghi): %s", file_wav.name)
        return KetQua(duong_dan, True, "bo qua", file_wav, file_srt if file_srt.exists() else None)

    log.info("-" * 68)
    log.info("KICH BAN : %s", duong_dan.name)
    log.info("KENH     : %s | model: %s | giong: %s",
             cfg.ten, cfg.model, cfg.giong.name if cfg.giong else "(giong san cua model)")

    doan = doc_kich_ban(duong_dan, cfg)
    if not doan:
        log.error("File khong co noi dung doc duoc -> bo qua.")
        return KetQua(duong_dan, False, "file rong")

    tong_chu = sum(len(d.text.split()) for d in doan)
    log.info("NOI DUNG : %d cau, %d tu | nghi ngan %.2fs / nghi dai %.2fs",
             len(doan), tong_chu, cfg.nghi_ngan, cfg.nghi_dai)

    np = _np()
    trang_thai = engine.trang_thai_giong(cfg.model, cfg.giong, cfg.temperature)
    sample_rate = engine.sample_rate

    manh: list[object] = []
    tong_mau = 0
    for i, mot_doan in enumerate(doan, 1):
        t0 = time.time()
        try:
            am = engine.doc_voi_model(cfg.model, trang_thai, mot_doan.text, cfg.temperature)
        except Exception as loi:
            log.error("Loi khi doc cau %d/%d (%s) -> bo qua cau nay.", i, len(doan), loi)
            log.debug("Cau loi: %s", mot_doan.text)
            continue

        if tuy_chon.cat_lang:
            am = cat_lang(am, sample_rate)
        am = vuot_bien(am, sample_rate)

        mot_doan.bat_dau = tong_mau
        tong_mau += am.size
        mot_doan.ket_thuc = tong_mau
        manh.append(am)

        so_mau_nghi = int(mot_doan.nghi_sau * sample_rate)
        if so_mau_nghi > 0:
            manh.append(np.zeros(so_mau_nghi, dtype=np.float32))
            tong_mau += so_mau_nghi

        giay_am = am.size / sample_rate
        log.info(
            "  [%3d/%3d] %5.1fs am | %4.1fs xu ly | %.1fx | %s",
            i, len(doan), giay_am, time.time() - t0,
            giay_am / max(1e-6, time.time() - t0),
            (mot_doan.text[:56] + "...") if len(mot_doan.text) > 56 else mot_doan.text,
        )

    if not manh:
        return KetQua(duong_dan, False, "khong sinh duoc am thanh")

    toan_bo = np.concatenate(manh).astype(np.float32)
    if tuy_chon.chuan_am_luong:
        toan_bo = chuan_bien_do(toan_bo)

    ghi_wav(file_wav, toan_bo, sample_rate)
    tong_giay = toan_bo.size / sample_rate
    log.info("WAV      : %s (%.1f giay)", file_wav.name, tong_giay)

    duong_dan_srt = None
    if not tuy_chon.khong_srt:
        cac_tu = nhan_dang_bang_whisper(file_wav, cfg.ma_whisper, tuy_chon.whisper_model, tuy_chon.luong)
        tu_theo_doan = []
        for mot_doan in doan:
            if mot_doan.ket_thuc <= mot_doan.bat_dau:
                continue
            t_dau = mot_doan.bat_dau / sample_rate
            t_cuoi = mot_doan.ket_thuc / sample_rate
            trong_khung = [
                t for t in cac_tu if t.ket_thuc > t_dau - 0.25 and t.bat_dau < t_cuoi + 0.25
            ]
            tu_theo_doan.append(
                gan_moc_thoi_gian(mot_doan.text.split(), trong_khung, t_dau, t_cuoi)
            )
        cue = tao_cue(tu_theo_doan)
        ghi_srt(file_srt, cue)
        duong_dan_srt = file_srt
        log.info("SRT      : %s (%d phu de)", file_srt.name, len(cue))

    if tuy_chon.chuyen_kich_ban:
        xong = THU_MUC_RA / "KB_DA_CHAY"
        xong.mkdir(parents=True, exist_ok=True)
        shutil.move(str(duong_dan), str(xong / duong_dan.name))
        log.info("Da chuyen kich ban sang %s", xong.name)

    return KetQua(duong_dan, True, "", file_wav, duong_dan_srt, time.time() - t_bat_dau)


# ---------------------------------------------------------------------------
# 8. Hang doi
# ---------------------------------------------------------------------------


def gom_hang_doi(dau_vao: Iterable[str]) -> list[Path]:
    danh_sach: list[Path] = []
    muc = [Path(x) for x in dau_vao] or [THU_MUC_VAO]
    for m in muc:
        if m.is_dir():
            danh_sach.extend(sorted(p for p in m.rglob("*.txt") if p.is_file()))
        elif m.is_file() and m.suffix.lower() == ".txt":
            danh_sach.append(m)
        else:
            log.warning("Bo qua '%s' (khong phai file .txt hoac thu muc).", m)

    # bo trung, giu thu tu
    da_thay: set[Path] = set()
    ket_qua = []
    for p in danh_sach:
        q = p.resolve()
        if q not in da_thay:
            da_thay.add(q)
            ket_qua.append(q)
    return ket_qua


def sap_xep_theo_kenh(hang_doi: list[Path], cau_hinh: dict) -> list[Path]:
    """Gom cac file cung model lai gan nhau de chi phai nap model 1 lan."""
    return sorted(
        hang_doi, key=lambda p: (lay_cau_hinh_kenh(p.name, cau_hinh, im_lang=True).model, p.name)
    )


# ---------------------------------------------------------------------------
# 9. Tu kiem tra
# ---------------------------------------------------------------------------


def tu_kiem_tra() -> int:
    """Chay thu toan bo duong ong voi engine gia - khong can model, khong can mang."""
    log.info("=== TU KIEM TRA (khong dung model that) ===")
    cfg = CauHinhKenh("TEST", "english", None, 0.30, 0.85, 1.60, 0.5, None, "en")

    mau = (
        "# ghi chu se bi bo qua\n"
        "[INTRO]\n"
        "Hello there. This is line two of the same paragraph.\n"
        "Mr. Smith paid 3.5 million dollars.\n"
        "\n"
        "New paragraph after a blank line.\n"
        "---\n"
        "Block three ends with an explicit pause.\n"
        "\n"
        "[nghi=2.5]\n"
        "\n"
        "Final block here.\n"
    )
    thu_muc = THU_MUC_RA / "_TU_KIEM_TRA"
    thu_muc.mkdir(parents=True, exist_ok=True)
    file_txt = thu_muc / "TEST_kich_ban.txt"
    file_txt.write_text(mau, encoding="utf-8")

    doan = doc_kich_ban(file_txt, cfg)
    for d in doan:
        log.info("  nghi %.2fs sau: %s", d.nghi_sau, d.text)

    gia_dinh = [
        (len(doan) == 6, f"phai co 6 cau, dang co {len(doan)}"),
        (doan[1].text.startswith("This is line two"), "gop dong trong cung doan"),
        ("Mr. Smith paid 3.5 million dollars." == doan[2].text, "khong cat o 'Mr.' va '3.5'"),
        (abs(doan[2].nghi_sau - cfg.nghi_dai) < 1e-6, "cuoi doan phai nghi dai"),
        (abs(doan[0].nghi_sau - cfg.nghi_ngan) < 1e-6, "giua doan phai nghi ngan"),
        (abs(doan[3].nghi_sau - cfg.nghi_doan_dai) < 1e-6, "truoc '---' phai nghi rat dai"),
        (abs(doan[4].nghi_sau - 2.5) < 1e-6, "[nghi=2.5] sau dong trong van phai an"),
        (abs(doan[5].nghi_sau - cfg.duoi_file) < 1e-6, "cau cuoi file dung 'duoi_file'"),
    ]
    loi = [ghi_chu for dung, ghi_chu in gia_dinh if not dung]

    engine = MayDocGia()
    tuy_chon = argparse.Namespace(
        lam_lai=True, chia_thu_muc=False, cat_lang=False, chuan_am_luong=True,
        khong_srt=False, whisper_model="small", luong=None, chuyen_kich_ban=False,
    )
    goc_ra = globals()["THU_MUC_RA"]
    globals()["THU_MUC_RA"] = thu_muc
    try:
        ket_qua = xu_ly_mot_file(file_txt, {"kenh": {}}, engine, tuy_chon)
    finally:
        globals()["THU_MUC_RA"] = goc_ra

    if not ket_qua.ok or not ket_qua.wav or not ket_qua.wav.exists():
        loi.append("khong tao duoc file WAV")
    else:
        with wave.open(str(ket_qua.wav), "rb") as f:
            log.info("WAV: %d kenh, %d bit, %d Hz, %.2f giay",
                     f.getnchannels(), f.getsampwidth() * 8, f.getframerate(),
                     f.getnframes() / f.getframerate())
    if not ket_qua.srt or not ket_qua.srt.exists():
        loi.append("khong tao duoc file SRT")
    else:
        noi_dung = ket_qua.srt.read_text(encoding="utf-8")
        so_cue = len(re.findall(r"-->", noi_dung))
        log.info("SRT: %d phu de", so_cue)
        log.info("\n%s", "\n".join(noi_dung.splitlines()[:12]))
        if so_cue < len(doan):
            loi.append(f"SRT chi co {so_cue} phu de cho {len(doan)} cau")
        if re.search(r"(\d\d:\d\d:\d\d,\d\d\d) --> \1", noi_dung):
            loi.append("SRT co phu de dai 0 giay")

    if loi:
        for x in loi:
            log.error("  THAT BAI: %s", x)
        log.error("=== TU KIEM TRA: HONG ===")
        return 1
    log.info("=== TU KIEM TRA: TAT CA DEU DAT ===")
    return 0


# ---------------------------------------------------------------------------
# 10. CLI
# ---------------------------------------------------------------------------


def phan_tich_tham_so(argv: Sequence[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="tao_voice.py",
        description=f"{APP_NAME} v{APP_VERSION} - doc kich ban .txt thanh WAV + SRT (CPU-only).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Vi du:\n"
            "  python tao_voice.py\n"
            "  python tao_voice.py KB_CHO\\TERCO1_video01.txt\n"
            "  python tao_voice.py --lam-lai --whisper-model medium\n"
        ),
    )
    p.add_argument("dau_vao", nargs="*", help="File .txt hoac thu muc (mac dinh: KB_CHO)")
    p.add_argument("--lam-lai", action="store_true", help="Lam lai ca nhung file da co trong XONG")
    p.add_argument("--khong-srt", action="store_true", help="Chi xuat WAV, khong chay whisper")
    p.add_argument("--whisper-model", default=os.environ.get("TAO_VOICE_WHISPER", "small"),
                   help="tiny/base/small/medium/large-v3 (mac dinh: small)")
    p.add_argument("--luong", type=int, default=None, help="So luong CPU thread (mac dinh: tu chon)")
    p.add_argument("--temperature", type=float, default=None, help="Ep temperature cho moi kenh")
    p.add_argument("--khong-cat-lang", dest="cat_lang", action="store_false",
                   help="Giu nguyen khoang lang model tu sinh o dau/cuoi cau")
    p.add_argument("--khong-chuan-am-luong", dest="chuan_am_luong", action="store_false",
                   help="Khong chuan hoa bien do ve -1 dBFS")
    p.add_argument("--chia-thu-muc", action="store_true", help="Xuat vao XONG/<TEN_KENH>/")
    p.add_argument("--chuyen-kich-ban", action="store_true",
                   help="Chuyen file .txt da chay sang XONG/KB_DA_CHAY/")
    p.add_argument("--theo-thu-tu-ten", action="store_true",
                   help="Chay dung thu tu ten file (mac dinh gom theo model cho nhanh)")
    p.add_argument("--chi-tiet", action="store_true", help="In them log go roi")
    p.add_argument("--tu-kiem-tra", action="store_true", help="Chay thu duong ong, khong can model")
    return p.parse_args(list(argv))


def main(argv: Sequence[str] | None = None) -> int:
    ep_utf8()
    tuy_chon = phan_tich_tham_so(sys.argv[1:] if argv is None else argv)
    file_log = cai_dat_log(logging.DEBUG if tuy_chon.chi_tiet else logging.INFO)

    log.info("=" * 68)
    log.info("%s v%s  |  pocket-tts + faster-whisper  |  CPU-only", APP_NAME, APP_VERSION)
    log.info("Log: %s", file_log)

    if tuy_chon.tu_kiem_tra:
        return tu_kiem_tra()

    for thu_muc in (THU_MUC_VAO, THU_MUC_GIONG, THU_MUC_RA):
        thu_muc.mkdir(parents=True, exist_ok=True)

    cau_hinh = doc_cau_hinh()
    hang_doi = gom_hang_doi(tuy_chon.dau_vao)
    if not hang_doi:
        log.error("Khong tim thay file .txt nao. Bo kich ban vao thu muc %s roi chay lai.", THU_MUC_VAO.name)
        return 2

    if not tuy_chon.theo_thu_tu_ten:
        hang_doi = sap_xep_theo_kenh(hang_doi, cau_hinh)

    log.info("HANG DOI : %d file", len(hang_doi))
    for i, p in enumerate(hang_doi, 1):
        cfg = lay_cau_hinh_kenh(p.name, cau_hinh, im_lang=True)
        log.info("  %2d. %-44s [%s / %s]", i, p.name, cfg.ten, cfg.model)

    engine = MayDocGiong(len(hang_doi), tuy_chon.temperature, tuy_chon.luong)
    ket_qua: list[KetQua] = []
    t_tong = time.time()

    for i, duong_dan in enumerate(hang_doi, 1):
        log.info("")
        log.info(">>> [%d/%d] %s", i, len(hang_doi), duong_dan.name)
        try:
            ket_qua.append(xu_ly_mot_file(duong_dan, cau_hinh, engine, tuy_chon))
        except KeyboardInterrupt:
            log.warning("Nguoi dung dung giua chung. Cac file da xong van con trong XONG/.")
            break
        except Exception as loi:  # mot file hong khong duoc lam chet ca hang doi
            log.exception("LOI khi xu ly %s: %s", duong_dan.name, loi)
            ket_qua.append(KetQua(duong_dan, False, str(loi)))

    log.info("")
    log.info("=" * 68)
    log.info("TONG KET sau %.1f phut", (time.time() - t_tong) / 60)
    thanh_cong = 0
    for kq in ket_qua:
        if kq.ok:
            thanh_cong += 1
            log.info("  OK    %-44s %s", kq.file.name, kq.ghi_chu or f"{kq.giay:.0f}s")
        else:
            log.error("  HONG  %-44s %s", kq.file.name, kq.ghi_chu)
    log.info("Thanh cong %d/%d. Ket qua nam trong: %s", thanh_cong, len(ket_qua), THU_MUC_RA)
    log.info("=" * 68)
    return 0 if thanh_cong == len(ket_qua) and ket_qua else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nDa dung.")
        sys.exit(130)

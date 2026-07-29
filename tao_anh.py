# -*- coding: utf-8 -*-
"""
TAO_ANH - Tao anh AI hang loat cho nhieu kenh YouTube (Windows, Python 3).

Hai nguon anh:
  - Gemini image ("nano banana") qua API key  -> anh co NGUOI, chat luong cao
  - Pollinations (flux), khong can key        -> anh phong canh / vat / nen

Cach chay nhanh nhat: keo tha file .txt (hoac ca thu muc) vao TAO_ANH.bat
Hoac:  python tao_anh.py                  -> chay het hang doi trong PROMPT_CHO/
       python tao_anh.py PROMPT_CHO\\a.txt -> chay 1 file
       python tao_anh.py --tu-kiem-tra    -> test duong ong, khong goi API

Quy uoc trong file prompt (.txt):
  - Moi dong 1 prompt, HOAC moi khoi cach nhau dong trong 1 prompt
  - Dau dong co [P]      -> ep di Gemini (tag bi go truoc khi goi API)
  - Dau dong co [#7]     -> ep so thu tu = 7 (file loi_*.txt dung cai nay
                            de anh chay bu van dung so, khong lech beat)
  - Dong bat dau bang "#" hoac "//" -> ghi chu, khong tao anh
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import os
import re
import shutil
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Sequence

# ---------------------------------------------------------------------------
# 0. Thiet lap co ban
# ---------------------------------------------------------------------------

APP_NAME = "TAO_ANH"
APP_VERSION = "1.0.0"

GOC = Path(__file__).resolve().parent
THU_MUC_VAO = GOC / "PROMPT_CHO"
THU_MUC_XONG = GOC / "PROMPT_XONG"
THU_MUC_LOG = GOC / "logs"
FILE_CAU_HINH = GOC / "config.json"

URL_GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
URL_POLLINATIONS = "https://image.pollinations.ai/prompt/"

CAU_HINH_MAU = {
    "_doc": [
        "gemini.api_keys: dan nhieu key vao day, tool tu xoay vong key khi het quota.",
        "gemini.model: gemini-2.5-flash-image (nano banana) | gemini-3-pro-image-preview (ban Pro).",
        "kenh.<TEN>.thu_muc_ra: anh luu THANG vao day. Trong JSON nho viet 2 gach nguoc,"
        " vi du D:\\KHO_ANH_TERCO1",
        "kenh.<TEN>.model: auto = tu chon theo tag [P] va tu khoa; gemini / pollinations = ep cung.",
        "kenh.<TEN>.cam_du_phong: true = cam roi xuong Pollinations, het quota thi cho chay bu.",
        "chung.uu_tien: cac kenh chay truoc trong hang doi.",
        "pollinations.cach_nhau_giay: tai khoan an danh bi gioi han 1 anh / 15 giay.",
    ],
    "gemini": {
        "api_keys": [
            "DAN_API_KEY_1_VAO_DAY",
            "DAN_API_KEY_2_VAO_DAY",
        ],
        "model": "gemini-2.5-flash-image",
        "aspect_ratio": "16:9",
        "image_size": "2K",
        "timeout_giay": 180,
        "nghi_giua_anh": 2.0,
        "backoff_dau_giay": 60,
        "backoff_toi_da_giay": 900,
    },
    "pollinations": {
        "model": "flux",
        "token": "",
        "referrer": "",
        "nologo": True,
        "enhance": False,
        "timeout_giay": 180,
        "cach_nhau_giay": 15,
    },
    "anh": {
        "rong": 1920,
        "cao": 1080,
        "dinh_dang": "png",
        "chat_luong_jpg": 95,
        "toi_thieu_kb": 20,
    },
    "chung": {
        "so_lan_thu": 3,
        "cho_thu_lai_giay": 5,
        "uu_tien": ["RUNGWORK"],
    },
    "kenh": {
        "RUNGWORK": {
            "thu_muc_ra": "D:\\KHO_ANH_RUNGWORK",
            "model": "gemini",
            "cam_du_phong": True,
        },
        "TERCO1": {"thu_muc_ra": "D:\\KHO_ANH_TERCO1", "model": "auto"},
        "TERCO2": {"thu_muc_ra": "D:\\KHO_ANH_TERCO2", "model": "auto"},
        "TERCO3": {"thu_muc_ra": "D:\\KHO_ANH_TERCO3", "model": "auto"},
        "GODSAYS": {"thu_muc_ra": "D:\\KHO_ANH_GODSAYS", "model": "auto"},
    },
}

log = logging.getLogger(APP_NAME)


# ---------------------------------------------------------------------------
# 1. Log
# ---------------------------------------------------------------------------


def cai_dat_log(muc: int = logging.INFO) -> Path:
    THU_MUC_LOG.mkdir(parents=True, exist_ok=True)
    duong_dan = THU_MUC_LOG / f"tao_anh_{time.strftime('%Y-%m-%d')}.log"

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


def _bo_dau(chuoi: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", chuoi) if unicodedata.category(c) != "Mn"
    )


# ---------------------------------------------------------------------------
# 2. Cau hinh + kenh
# ---------------------------------------------------------------------------


@dataclass
class CauHinhKenh:
    ten: str
    thu_muc_ra: Path
    model: str  # auto | gemini | pollinations
    cam_du_phong: bool


def doc_cau_hinh() -> dict:
    if not FILE_CAU_HINH.exists():
        mau = GOC / "config.mau.json"
        if mau.exists():
            shutil.copyfile(mau, FILE_CAU_HINH)
        else:
            FILE_CAU_HINH.write_text(
                json.dumps(CAU_HINH_MAU, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
        log.info("Da tao file cau hinh mau: %s", FILE_CAU_HINH.name)
        log.info("Mo config.json dan API key Gemini va sua duong dan thu muc anh.")
        return json.loads(json.dumps(CAU_HINH_MAU))

    try:
        nguoi_dung = json.loads(FILE_CAU_HINH.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as loi:
        log.error("config.json bi loi cu phap JSON (dong %s): %s", loi.lineno, loi.msg)
        log.error("Sua lai file roi chay lai.")
        raise SystemExit(2) from loi

    # gop voi mac dinh de thieu khoa nao van co gia tri khoa do
    gop = json.loads(json.dumps(CAU_HINH_MAU))
    for muc, gia_tri in nguoi_dung.items():
        if isinstance(gia_tri, dict) and isinstance(gop.get(muc), dict):
            if muc == "kenh":
                gop[muc] = gia_tri  # danh sach kenh lay nguyen cua nguoi dung
            else:
                gop[muc].update(gia_tri)
        else:
            gop[muc] = gia_tri
    return gop


def lay_tien_to(ten_file: str) -> str:
    """TERCO1_beat.txt -> TERCO1 ; loi_TERCO1_beat.txt -> TERCO1 (bo tien to loi_)."""
    goc = Path(ten_file).stem
    goc = re.sub(r"^(loi|LOI|Loi)[_\-]", "", goc)
    khop = re.match(r"^([A-Za-z0-9]+)\s*[_\-. ]", goc)
    return (khop.group(1) if khop else goc).upper()


def lay_cau_hinh_kenh(ten_file: str, cau_hinh: dict, im_lang: bool = False) -> CauHinhKenh:
    tien_to = lay_tien_to(ten_file)
    bang = {str(k).upper(): v for k, v in (cau_hinh.get("kenh") or {}).items()}
    muc = bang.get(tien_to)

    if muc is None:
        if not im_lang:
            log.warning(
                "Kenh '%s' chua khai bao trong config.json -> anh se luu vao ANH_RA\\%s.",
                tien_to,
                tien_to,
            )
        muc = {}

    thu_muc = str(muc.get("thu_muc_ra") or "").strip()
    duong_dan = Path(thu_muc) if thu_muc else (GOC / "ANH_RA" / tien_to)
    if not duong_dan.is_absolute():
        duong_dan = GOC / duong_dan

    model = str(muc.get("model") or "auto").strip().lower()
    if model not in ("auto", "gemini", "pollinations"):
        if not im_lang:
            log.warning("Kenh %s: model '%s' khong hieu -> dung 'auto'.", tien_to, model)
        model = "auto"

    return CauHinhKenh(
        ten=tien_to,
        thu_muc_ra=duong_dan,
        model=model,
        cam_du_phong=bool(muc.get("cam_du_phong", model == "gemini")),
    )


# ---------------------------------------------------------------------------
# 3. Doc file prompt
# ---------------------------------------------------------------------------

RE_TAG_P = re.compile(r"^\s*\[\s*[Pp]\s*\]\s*")
RE_SO_EP = re.compile(r"^\s*\[\s*#\s*(\d+)\s*\]\s*")
RE_SO_DAU_DONG = re.compile(r"^\s*\d{1,4}\s*[.)\-:]\s+")
RE_GACH_DAU_DONG = re.compile(r"^\s*[-*•]\s+")


@dataclass
class Prompt:
    so: int              # so thu tu -> quyet dinh ten file anh
    goc: str             # nguyen van (con tag) de ghi lai vao file loi
    text: str            # da go tag, danh cho API
    co_tag_p: bool
    engine: str = ""
    ly_do: str = ""


def _lam_sach_dong(dong: str) -> tuple[str, bool, int | None]:
    """Go tag [P], [#7], so thu tu va gach dau dong -> (text, co_tag_p, so_ep)."""
    co_tag_p = False
    so_ep: int | None = None

    for _ in range(4):  # tag co the dung lan lon thu tu: "[P] 1. ..." hay "1. [P] ..."
        truoc = dong
        khop_so = RE_SO_EP.match(dong)
        if khop_so:
            so_ep = int(khop_so.group(1))
            dong = dong[khop_so.end() :]
        if RE_TAG_P.match(dong):
            co_tag_p = True
            dong = RE_TAG_P.sub("", dong)
        dong = RE_SO_DAU_DONG.sub("", dong)
        dong = RE_GACH_DAU_DONG.sub("", dong)
        if dong == truoc:
            break

    return dong.strip(), co_tag_p, so_ep


def doc_file_prompt(duong_dan: Path) -> list[Prompt]:
    """Doc file .txt -> danh sach Prompt, tu nhan ra kieu 'moi dong' hay 'moi khoi'."""
    raw = duong_dan.read_text(encoding="utf-8-sig", errors="replace")
    raw = raw.replace("\r\n", "\n").replace("\r", "\n")

    khoi_tho = [k for k in re.split(r"\n\s*\n", raw) if k.strip()]
    khoi: list[list[str]] = []
    for k in khoi_tho:
        cac_dong = [
            d.strip()
            for d in k.split("\n")
            if d.strip() and not d.strip().startswith("#") and not d.strip().startswith("//")
        ]
        if cac_dong:
            khoi.append(cac_dong)

    if not khoi:
        return []

    tong_dong = sum(len(k) for k in khoi)
    theo_khoi = len(khoi) >= 2 and tong_dong / len(khoi) > 1.3
    log.info(
        "Kieu file: %s",
        "moi KHOI cach nhau dong trong = 1 prompt" if theo_khoi else "moi DONG = 1 prompt",
    )

    tho: list[str] = []
    if theo_khoi:
        tho = [" ".join(k) for k in khoi]
    else:
        for k in khoi:
            tho.extend(k)

    ket_qua: list[Prompt] = []
    dem = 0
    for dong in tho:
        text, co_tag, so_ep = _lam_sach_dong(dong)
        if not text:
            continue
        dem += 1
        ket_qua.append(
            Prompt(so=so_ep if so_ep else dem, goc=dong.strip(), text=text, co_tag_p=co_tag)
        )
    return ket_qua


# ---------------------------------------------------------------------------
# 4. Chon engine cho tung prompt
# ---------------------------------------------------------------------------

# Tu khoa chac chan co nguoi -> Gemini
TU_KHOA_NGUOI = [
    # English
    "woman", "women", "man", "men", "person", "people", "human", "humans",
    "face", "faces", "hand", "hands", "child", "children", "kid", "kids",
    "boy", "boys", "girl", "girls", "baby", "monk", "monks", "priest", "nun",
    "pastor", "preacher", "figure", "figures", "crowd", "crowds", "praying",
    "prayer", "kneeling", "portrait", "family", "couple", "worker", "workers",
    "employee", "doctor", "nurse", "engineer", "teacher", "student", "soldier",
    "elderly", "grandmother", "grandfather", "jesus", "christ", "mary",
    "stickman", "stick figure", "businessman", "businesswoman", "ceo",
    "manager", "chef", "farmer", "pilot", "lawyer", "athlete", "singer",
    # Portugues / Espanol (kenh TERCO, GODSAYS)
    "mulher", "mulheres", "homem", "homens", "pessoa", "pessoas", "rosto",
    "maos", "mao", "crianca", "criancas", "monge", "padre", "freira", "fiel",
    "fieis", "multidao", "rezando", "orando", "ajoelhado", "ajoelhada",
    "familia", "senhora", "senhor", "povo", "devoto", "devota", "sacerdote",
]

# Tu khoa nua nac nua mo -> van cho di Gemini ("phan van thi chon Gemini")
TU_KHOA_NGHI_NGO = [
    "silhouette", "shadow", "shadows", "statue", "sculpture", "mannequin",
    "reflection", "eyes", "eye", "body", "skin", "arm", "arms", "leg", "legs",
    "shoulder", "congregation", "audience", "team", "group", "wedding",
    "funeral", "procession", "pilgrim", "angel", "angels", "saint", "santa",
    "santo", "anjo", "anjos", "estatua", "sombra", "silhueta", "olhos",
    "corpo", "grupo", "casamento", "procissao", "peregrino",
]


# "no people", "sem pessoas", "without a person"... la prompt canh vat,
# dung de tu khoa nguoi keo nham sang Gemini cho ton quota.
PHU_DINH = [
    "no", "not", "non", "without", "sans", "minus", "devoid of", "free of",
    "empty of", "absent", "avoid", "exclude", "zero",
    "sem", "nenhum", "nenhuma", "nem", "sin", "ningun", "ninguna",
]
RE_PHU_DINH = re.compile(
    r"(?:" + "|".join(re.escape(t) for t in PHU_DINH) + r")"
    r"(?:\s+(?:a|an|the|any|other|um|uma|el|la)){0,2}\s*$"
)


def _bi_phu_dinh(chuoi: str, vi_tri: int) -> bool:
    """Ngay truoc tu khoa co tu phu dinh khong? ('no people' -> co)."""
    return RE_PHU_DINH.search(chuoi[max(0, vi_tri - 24) : vi_tri]) is not None


def _dung_tu(chuoi_da_chuan: str, tu: str) -> bool:
    """Co tu khoa nay khong, va it nhat mot lan xuat hien KHONG bi phu dinh."""
    mau = re.compile(r"(?<![a-z0-9])" + re.escape(tu) + r"(?![a-z0-9])")
    for khop in mau.finditer(chuoi_da_chuan):
        if not _bi_phu_dinh(chuoi_da_chuan, khop.start()):
            return True
    return False


def chon_engine(p: Prompt, kenh: CauHinhKenh) -> tuple[str, str]:
    """Tra ve (engine, ly_do). Thu tu: ep theo kenh > tag [P] > tu khoa > mac dinh."""
    if kenh.model == "gemini":
        return "gemini", "kenh ep gemini"
    if kenh.model == "pollinations":
        return "pollinations", "kenh ep pollinations"

    if p.co_tag_p:
        return "gemini", "co tag [P]"

    chuan = _bo_dau(p.text.lower())
    for tu in TU_KHOA_NGUOI:
        if _dung_tu(chuan, tu):
            return "gemini", f"tu khoa nguoi '{tu}'"
    for tu in TU_KHOA_NGHI_NGO:
        if _dung_tu(chuan, tu):
            return "gemini", f"phan van vi '{tu}' -> chon gemini"

    return "pollinations", "khong thay nguoi"


# ---------------------------------------------------------------------------
# 5. Ten file anh
# ---------------------------------------------------------------------------

CAM_TRONG_TEN = r'[\\/:*?"<>|]'


def mo_ta_ngan(text: str, toi_da: int = 46) -> str:
    """Lay vai tu dau cua prompt lam mo ta, bo het ky tu Windows cam."""
    chuan = _bo_dau(text)
    chuan = re.sub(CAM_TRONG_TEN, " ", chuan)
    chuan = re.sub(r"[^A-Za-z0-9]+", "_", chuan).strip("_")
    if not chuan:
        return "anh"
    if len(chuan) > toi_da:
        chuan = chuan[:toi_da].rstrip("_")
        # khong cat giua tu neu con du dai
        if "_" in chuan[int(toi_da * 0.6) :]:
            chuan = chuan.rsplit("_", 1)[0]
    return chuan.lower()


def ten_file_anh(p: Prompt, duoi: str) -> str:
    return f"{p.so:03d}_{mo_ta_ngan(p.text)}.{duoi}"


def tim_anh_da_co(thu_muc: Path, so: int, toi_thieu_kb: int) -> Path | None:
    """Da co anh cho so thu tu nay chua (ke ca ten mo ta khac)?"""
    if not thu_muc.is_dir():
        return None
    for duong_dan in sorted(thu_muc.glob(f"{so:03d}_*")):
        if duong_dan.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
            if duong_dan.stat().st_size >= toi_thieu_kb * 1024:
                return duong_dan
    return None


# ---------------------------------------------------------------------------
# 6. Kiem tra + luu anh
# ---------------------------------------------------------------------------


class LoiAnh(Exception):
    """Du lieu tai ve khong phai anh dung."""


class LoiTamThoi(Exception):
    """Loi mang / 5xx -> thu lai duoc."""


class LoiVinhVien(Exception):
    """Prompt bi chan hoac sai -> thu lai cung the."""


class LoiQuota(Exception):
    """429 / het quota -> doi key hoac ngu cho."""

    def __init__(self, giay_cho: float = 60.0, thong_diep: str = ""):
        super().__init__(thong_diep or f"het quota, cho {giay_cho:.0f}s")
        self.giay_cho = giay_cho


class LoiKeyHong(Exception):
    """API key sai / bi thu hoi -> bo key nay."""


CHU_KY_ANH = {
    b"\x89PNG\r\n\x1a\n": "png",
    b"\xff\xd8\xff": "jpg",
    b"RIFF": "webp",
    b"GIF8": "gif",
}


def nhan_dang_anh(du_lieu: bytes) -> str | None:
    for chu_ky, ten in CHU_KY_ANH.items():
        if du_lieu.startswith(chu_ky):
            return ten
    return None


def luu_anh(du_lieu: bytes, dich: Path, cfg_anh: dict) -> tuple[int, int]:
    """Kiem tra, ep ve dung kich thuoc roi ghi ra dia. Tra ve (rong, cao) that."""
    toi_thieu = int(cfg_anh.get("toi_thieu_kb", 20)) * 1024
    if len(du_lieu) < toi_thieu:
        raise LoiAnh(f"anh chi {len(du_lieu) / 1024:.0f} KB (can > {toi_thieu / 1024:.0f} KB)")

    loai = nhan_dang_anh(du_lieu)
    if loai is None:
        dau = du_lieu[:80].decode("utf-8", "replace").strip()
        raise LoiAnh(f"du lieu tra ve khong phai anh: {dau[:70]}")

    rong = int(cfg_anh.get("rong", 1920))
    cao = int(cfg_anh.get("cao", 1080))
    duoi = str(cfg_anh.get("dinh_dang", "png")).lower().lstrip(".")
    if duoi not in ("png", "jpg", "jpeg"):
        duoi = "png"

    dich.parent.mkdir(parents=True, exist_ok=True)

    try:
        import io

        from PIL import Image
    except ImportError:
        log.warning(
            "Chua cai Pillow -> ghi nguyen anh goc, khong ep duoc ve %dx%d. "
            "Cai bang: pip install pillow",
            rong,
            cao,
        )
        dich.write_bytes(du_lieu)
        return (0, 0)

    anh = Image.open(io.BytesIO(du_lieu))
    anh.load()
    if anh.mode not in ("RGB", "L"):
        anh = anh.convert("RGB")
    elif anh.mode == "L":
        anh = anh.convert("RGB")

    if anh.size != (rong, cao):
        # phong theo canh thieu roi cat giua -> khong bao gio bi keo meo hinh
        ty_le = max(rong / anh.width, cao / anh.height)
        moi = (max(rong, int(round(anh.width * ty_le))), max(cao, int(round(anh.height * ty_le))))
        anh = anh.resize(moi, Image.LANCZOS)
        trai = (anh.width - rong) // 2
        tren = (anh.height - cao) // 2
        anh = anh.crop((trai, tren, trai + rong, tren + cao))

    if duoi == "png":
        anh.save(dich, "PNG", optimize=True)
    else:
        anh.save(dich, "JPEG", quality=int(cfg_anh.get("chat_luong_jpg", 95)), subsampling=0)

    if not dich.exists() or dich.stat().st_size < toi_thieu:
        co = dich.stat().st_size / 1024 if dich.exists() else 0
        raise LoiAnh(f"file ghi ra chi {co:.0f} KB")
    return anh.size


# ---------------------------------------------------------------------------
# 7. Gemini
# ---------------------------------------------------------------------------

# Field bi API tu choi -> go ra khoi than request cho nhung lan sau
_FIELD_BO_QUA: set[str] = set()


@dataclass
class VongKey:
    """Xoay vong nhieu API key: het quota thi sang key khac, het sach thi ngu cho."""

    keys: list[str]
    backoff_dau: float = 60.0
    backoff_toi_da: float = 900.0
    cho_den: dict[int, float] = field(default_factory=dict)
    hong: set[int] = field(default_factory=set)
    _lan_cho: int = 0
    _ke_tiep: int = 0

    def con_key_song(self) -> bool:
        return any(i not in self.hong for i in range(len(self.keys)))

    def lay(self) -> tuple[int, str] | None:
        """Key dung duoc ngay bay gio, hoac None neu tat ca dang nghi quota."""
        bay_gio = time.time()
        for buoc in range(len(self.keys)):
            i = (self._ke_tiep + buoc) % len(self.keys)
            if i in self.hong or self.cho_den.get(i, 0) > bay_gio:
                continue
            self._ke_tiep = (i + 1) % len(self.keys)
            return i, self.keys[i]
        return None

    def bao_quota(self, i: int, giay: float) -> None:
        self.cho_den[i] = time.time() + max(5.0, giay)

    def bao_hong(self, i: int) -> None:
        self.hong.add(i)

    def giay_cho(self) -> float:
        """Bao lau nua thi co key dung duoc (backoff tang dan neu cho nhieu lan)."""
        con_song = [i for i in range(len(self.keys)) if i not in self.hong]
        som_nhat = min((self.cho_den.get(i, 0) for i in con_song), default=0)
        theo_api = max(0.0, som_nhat - time.time())
        theo_backoff = min(self.backoff_dau * (2 ** self._lan_cho), self.backoff_toi_da)
        self._lan_cho += 1
        return max(theo_api, theo_backoff)

    def thanh_cong(self) -> None:
        self._lan_cho = 0


def _than_request_gemini(prompt: str, cfg: dict) -> dict:
    than: dict = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
    sinh: dict = {}

    if "responseModalities" not in _FIELD_BO_QUA:
        sinh["responseModalities"] = ["IMAGE"]

    if "imageConfig" not in _FIELD_BO_QUA:
        anh: dict = {}
        if cfg.get("aspect_ratio") and "aspectRatio" not in _FIELD_BO_QUA:
            anh["aspectRatio"] = cfg["aspect_ratio"]
        if cfg.get("image_size") and "imageSize" not in _FIELD_BO_QUA:
            anh["imageSize"] = cfg["image_size"]
        if anh:
            sinh["imageConfig"] = anh

    if sinh:
        than["generationConfig"] = sinh
    return than


def _giay_cho_tu_loi(chi_tiet: list) -> float:
    """Google tra ve RetryInfo.retryDelay kieu '27s' khi dinh quota."""
    for muc in chi_tiet or []:
        if str(muc.get("@type", "")).endswith("RetryInfo"):
            khop = re.match(r"([0-9.]+)s", str(muc.get("retryDelay", "")))
            if khop:
                return float(khop.group(1)) + 2.0
    return 60.0


def goi_gemini(prompt: str, key: str, cfg: dict) -> bytes:
    """Goi Gemini image, tra ve bytes anh. Nem LoiQuota / LoiKeyHong / Loi*."""
    url = URL_GEMINI.format(model=cfg.get("model", "gemini-2.5-flash-image"))
    than = json.dumps(_than_request_gemini(prompt, cfg)).encode("utf-8")
    yeu_cau = urllib.request.Request(
        url,
        data=than,
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        method="POST",
    )

    try:
        with urllib.request.urlopen(yeu_cau, timeout=float(cfg.get("timeout_giay", 180))) as tra_ve:
            du_lieu = json.loads(tra_ve.read().decode("utf-8"))
    except urllib.error.HTTPError as loi:
        _xu_ly_loi_http_gemini(loi)
        raise  # _xu_ly_loi_http_gemini luon nem, dong nay chi de yen tam
    except urllib.error.URLError as loi:
        raise LoiTamThoi(f"loi mang: {loi.reason}") from loi
    except TimeoutError as loi:
        raise LoiTamThoi("qua thoi gian cho") from loi

    return _lay_anh_tu_tra_ve(du_lieu)


def _xu_ly_loi_http_gemini(loi: urllib.error.HTTPError) -> None:
    try:
        goi = json.loads(loi.read().decode("utf-8"))
        chi_tiet_loi = goi.get("error", {})
    except Exception:
        chi_tiet_loi = {}
    thong_diep = str(chi_tiet_loi.get("message") or loi.reason or "")
    ly_do = ""
    for muc in chi_tiet_loi.get("details", []) or []:
        if str(muc.get("@type", "")).endswith("ErrorInfo"):
            ly_do = str(muc.get("reason", ""))

    if loi.code == 429 or ly_do in ("RATE_LIMIT_EXCEEDED", "RESOURCE_EXHAUSTED"):
        raise LoiQuota(_giay_cho_tu_loi(chi_tiet_loi.get("details", [])), thong_diep)

    if loi.code in (401, 403) or ly_do in ("API_KEY_INVALID", "PERMISSION_DENIED"):
        raise LoiKeyHong(thong_diep or f"HTTP {loi.code}")

    if loi.code == 400:
        if ly_do == "API_KEY_INVALID" or "API key not valid" in thong_diep:
            raise LoiKeyHong(thong_diep)
        # Body co field model khong nhan -> go field do ra roi thu lai
        bo_di = _tim_field_bi_tu_choi(chi_tiet_loi, thong_diep)
        if bo_di:
            _FIELD_BO_QUA.add(bo_di)
            raise LoiTamThoi(f"API khong nhan '{bo_di}', bo field do roi thu lai")
        raise LoiVinhVien(f"HTTP 400: {thong_diep}")

    if loi.code in (404,):
        raise LoiVinhVien(f"khong thay model (kiem tra gemini.model trong config.json): {thong_diep}")

    if loi.code >= 500:
        raise LoiTamThoi(f"HTTP {loi.code}: {thong_diep}")

    raise LoiVinhVien(f"HTTP {loi.code}: {thong_diep}")


def _tim_field_bi_tu_choi(chi_tiet_loi: dict, thong_diep: str) -> str | None:
    ung_vien = ("imageSize", "aspectRatio", "imageConfig", "responseModalities")
    van_ban = thong_diep
    for muc in chi_tiet_loi.get("details", []) or []:
        for vi_pham in muc.get("fieldViolations", []) or []:
            van_ban += " " + str(vi_pham.get("description", ""))
    for ten in ung_vien:  # thu tu uu tien: go field nho truoc, giu lai field lon
        if ten in van_ban:
            return ten
    return None


def _lay_anh_tu_tra_ve(du_lieu: dict) -> bytes:
    ung_vien = du_lieu.get("candidates") or []
    for cand in ung_vien:
        for phan in (cand.get("content") or {}).get("parts", []) or []:
            trong = phan.get("inlineData") or phan.get("inline_data")
            if trong and str(trong.get("mimeType", trong.get("mime_type", ""))).startswith("image/"):
                return base64.b64decode(trong["data"])

    # Khong co anh -> tim ly do
    chan = (du_lieu.get("promptFeedback") or {}).get("blockReason")
    if chan:
        raise LoiVinhVien(f"prompt bi chan ({chan})")
    if ung_vien:
        ket = ung_vien[0].get("finishReason") or ""
        chu = " ".join(
            p.get("text", "") for p in (ung_vien[0].get("content") or {}).get("parts", []) or []
        ).strip()
        if ket in ("IMAGE_SAFETY", "PROHIBITED_CONTENT", "SAFETY", "BLOCKLIST", "RECITATION"):
            raise LoiVinhVien(f"bi chan boi bo loc ({ket}) {chu[:80]}".strip())
        raise LoiTamThoi(f"khong co anh trong tra ve (finishReason={ket or 'khong ro'}) {chu[:80]}")
    raise LoiTamThoi("tra ve rong")


# ---------------------------------------------------------------------------
# 8. Pollinations
# ---------------------------------------------------------------------------

_LAN_GOI_POLL = 0.0


def goi_pollinations(prompt: str, cfg: dict, cfg_anh: dict, seed: int) -> bytes:
    """Goi Pollinations (flux). Tai khoan an danh bi chan 1 anh / 15 giay."""
    global _LAN_GOI_POLL

    cach_nhau = float(cfg.get("cach_nhau_giay", 15))
    con_thieu = cach_nhau - (time.time() - _LAN_GOI_POLL)
    if con_thieu > 0:
        log.info("    Cho %.0fs cho dung nhip Pollinations...", con_thieu)
        time.sleep(con_thieu)

    tham_so = {
        "width": int(cfg_anh.get("rong", 1920)),
        "height": int(cfg_anh.get("cao", 1080)),
        "model": cfg.get("model", "flux"),
        "seed": seed,
    }
    if cfg.get("nologo"):
        tham_so["nologo"] = "true"
    if cfg.get("enhance"):
        tham_so["enhance"] = "true"
    if cfg.get("referrer"):
        tham_so["referrer"] = cfg["referrer"]

    url = (
        URL_POLLINATIONS
        + urllib.parse.quote(prompt[:1800], safe="")
        + "?"
        + urllib.parse.urlencode(tham_so)
    )
    dau = {"User-Agent": f"{APP_NAME}/{APP_VERSION}"}
    if cfg.get("token"):
        dau["Authorization"] = f"Bearer {cfg['token']}"

    _LAN_GOI_POLL = time.time()
    try:
        with urllib.request.urlopen(
            urllib.request.Request(url, headers=dau), timeout=float(cfg.get("timeout_giay", 180))
        ) as tra_ve:
            kieu = tra_ve.headers.get("Content-Type", "")
            noi_dung = tra_ve.read()
    except urllib.error.HTTPError as loi:
        if loi.code == 429:
            raise LoiQuota(cach_nhau * 2, "Pollinations chan vi goi qua nhanh") from loi
        if loi.code >= 500:
            raise LoiTamThoi(f"Pollinations HTTP {loi.code}") from loi
        raise LoiVinhVien(f"Pollinations HTTP {loi.code}") from loi
    except urllib.error.URLError as loi:
        raise LoiTamThoi(f"loi mang: {loi.reason}") from loi
    except TimeoutError as loi:
        raise LoiTamThoi("qua thoi gian cho") from loi

    if not kieu.startswith("image/") and nhan_dang_anh(noi_dung) is None:
        raise LoiTamThoi(f"Pollinations tra ve '{kieu}' chu khong phai anh")
    return noi_dung


# ---------------------------------------------------------------------------
# 9. Tao 1 anh / 1 file / ca hang doi
# ---------------------------------------------------------------------------


@dataclass
class ThongKe:
    gemini: int = 0
    pollinations: int = 0
    loi: int = 0
    bo_qua: int = 0

    def cong(self, khac: "ThongKe") -> None:
        self.gemini += khac.gemini
        self.pollinations += khac.pollinations
        self.loi += khac.loi
        self.bo_qua += khac.bo_qua


def tao_mot_anh(
    p: Prompt, kenh: CauHinhKenh, cau_hinh: dict, vong_key: VongKey, tuy_chon: argparse.Namespace
) -> tuple[bool, str, str]:
    """Tao 1 anh, tu thu lai. Tra ve (thanh_cong, engine_da_dung, thong_bao_loi)."""
    cfg_anh = cau_hinh["anh"]
    so_lan = max(1, int(cau_hinh["chung"].get("so_lan_thu", 3)))
    duoi = str(cfg_anh.get("dinh_dang", "png")).lower().lstrip(".")
    dich = kenh.thu_muc_ra / ten_file_anh(p, "jpg" if duoi in ("jpg", "jpeg") else "png")

    engine = p.engine
    loi_cuoi = ""

    lan = 0
    while lan < so_lan:
        lan += 1
        try:
            if engine == "gemini":
                du_lieu = _thu_gemini(p, cau_hinh, vong_key, kenh)
            else:
                du_lieu = goi_pollinations(
                    p.text, cau_hinh["pollinations"], cfg_anh, seed=p.so * 7919
                )

            kich_thuoc = luu_anh(du_lieu, dich, cfg_anh)
            log.info(
                "    -> %s (%s%s)",
                dich.name,
                engine,
                f", {kich_thuoc[0]}x{kich_thuoc[1]}" if kich_thuoc[0] else "",
            )
            if engine == "gemini":
                vong_key.thanh_cong()
                time.sleep(float(cau_hinh["gemini"].get("nghi_giua_anh", 2.0)))
            return True, engine, ""

        except LoiVinhVien as loi:
            loi_cuoi = str(loi)
            log.warning("    [x] %s", loi_cuoi)
            if engine == "gemini" and not kenh.cam_du_phong and not tuy_chon.chi_gemini:
                log.info("    Chuyen sang Pollinations cho prompt nay.")
                engine = "pollinations"
                lan = 0
                continue
            break  # khong thu lai duoc nua

        except (LoiTamThoi, LoiAnh, LoiQuota) as loi:
            loi_cuoi = str(loi)
            if lan >= so_lan:
                log.warning("    [x] lan %d/%d: %s", lan, so_lan, loi_cuoi)
                break
            cho = float(cau_hinh["chung"].get("cho_thu_lai_giay", 5)) * lan
            if isinstance(loi, LoiQuota) and engine == "pollinations":
                cho = max(cho, loi.giay_cho)
            log.warning("    [!] lan %d/%d: %s -> thu lai sau %.0fs", lan, so_lan, loi_cuoi, cho)
            time.sleep(cho)

    # het cach: neu dang la gemini va duoc phep, ha xuong Pollinations lan cuoi
    if engine == "gemini" and not kenh.cam_du_phong and not tuy_chon.chi_gemini:
        log.info("    Gemini khong xong, ha xuong Pollinations.")
        try:
            du_lieu = goi_pollinations(p.text, cau_hinh["pollinations"], cfg_anh, seed=p.so * 7919)
            luu_anh(du_lieu, dich, cfg_anh)
            log.info("    -> %s (pollinations, du phong)", dich.name)
            return True, "pollinations", ""
        except Exception as loi:
            loi_cuoi = f"{loi_cuoi} | du phong cung hong: {loi}"

    return False, engine, loi_cuoi


def _thu_gemini(p: Prompt, cau_hinh: dict, vong_key: VongKey, kenh: CauHinhKenh) -> bytes:
    """Goi Gemini, tu xoay key. Het quota het key thi ngu cho roi chay bu."""
    cfg = cau_hinh["gemini"]

    while True:
        if not vong_key.con_key_song():
            raise LoiVinhVien(
                "khong con API key Gemini nao dung duoc (kiem tra gemini.api_keys trong config.json)"
            )

        cap = vong_key.lay()
        if cap is None:
            cho = vong_key.giay_cho()
            log.warning(
                "    Het quota tat ca %d key -> ngu %s roi chay bu (Ctrl+C de dung).",
                len(vong_key.keys),
                f"{cho:.0f} giay" if cho < 90 else f"{cho / 60:.1f} phut",
            )
            time.sleep(cho)
            continue

        chi_so, key = cap
        try:
            return goi_gemini(p.text, key, cfg)
        except LoiQuota as loi:
            log.warning("    Key #%d het quota (cho %.0fs), doi key khac.", chi_so + 1, loi.giay_cho)
            vong_key.bao_quota(chi_so, loi.giay_cho)
        except LoiKeyHong as loi:
            log.error("    Key #%d hong, bo han: %s", chi_so + 1, loi)
            vong_key.bao_hong(chi_so)


def xu_ly_mot_file(
    duong_dan: Path, cau_hinh: dict, vong_key: VongKey, tuy_chon: argparse.Namespace
) -> ThongKe:
    tk = ThongKe()
    kenh = lay_cau_hinh_kenh(duong_dan.name, cau_hinh)

    log.info("-" * 70)
    log.info("FILE   : %s", duong_dan.name)
    log.info("KENH   : %s | model: %s%s", kenh.ten, kenh.model,
             " (cam du phong)" if kenh.cam_du_phong else "")
    log.info("LUU VAO: %s", kenh.thu_muc_ra)

    prompts = doc_file_prompt(duong_dan)
    if not prompts:
        log.error("File khong co prompt nao doc duoc -> bo qua.")
        return tk

    try:
        kenh.thu_muc_ra.mkdir(parents=True, exist_ok=True)
    except OSError as loi:
        log.error("Khong tao duoc thu muc %s: %s", kenh.thu_muc_ra, loi)
        log.error("Kiem tra lai 'thu_muc_ra' trong config.json (o dia da gan chua?).")
        tk.loi += len(prompts)
        return tk

    for p in prompts:
        p.engine, p.ly_do = chon_engine(p, kenh)
    so_gem = sum(1 for p in prompts if p.engine == "gemini")
    log.info("PROMPT : %d (gemini %d / pollinations %d)", len(prompts), so_gem, len(prompts) - so_gem)

    that_bai: list[tuple[Prompt, str]] = []
    for i, p in enumerate(prompts, 1):
        da_co = tim_anh_da_co(kenh.thu_muc_ra, p.so, int(cau_hinh["anh"].get("toi_thieu_kb", 20)))
        if da_co and not tuy_chon.lam_lai:
            log.info("  [%3d/%3d] #%03d BO QUA (da co %s)", i, len(prompts), p.so, da_co.name)
            tk.bo_qua += 1
            continue

        log.info(
            "  [%3d/%3d] #%03d %s | %s",
            i, len(prompts), p.so, p.engine.upper(),
            (p.text[:58] + "...") if len(p.text) > 58 else p.text,
        )
        log.debug("           ly do chon engine: %s", p.ly_do)

        t0 = time.time()
        ok, engine_da_dung, loi = tao_mot_anh(p, kenh, cau_hinh, vong_key, tuy_chon)
        if ok:
            if engine_da_dung == "gemini":
                tk.gemini += 1
            else:
                tk.pollinations += 1
            log.debug("           xong sau %.1fs", time.time() - t0)
        else:
            tk.loi += 1
            that_bai.append((p, loi))
            log.error("  [%3d/%3d] #%03d HONG: %s", i, len(prompts), p.so, loi)

    ghi_file_loi(duong_dan, that_bai)

    if tuy_chon.giu_file:
        return tk
    THU_MUC_XONG.mkdir(parents=True, exist_ok=True)
    dich = THU_MUC_XONG / duong_dan.name
    if dich.exists():
        dich = THU_MUC_XONG / f"{duong_dan.stem}_{time.strftime('%Y%m%d_%H%M%S')}.txt"
    shutil.move(str(duong_dan), str(dich))
    log.info("Da chuyen %s sang %s\\", duong_dan.name, THU_MUC_XONG.name)
    return tk


def ghi_file_loi(nguon: Path, that_bai: Sequence[tuple[Prompt, str]]) -> None:
    """Ghi cac prompt hong ra loi_<ten>.txt de tha lai chay bu (giu nguyen so thu tu)."""
    ten = nguon.name if nguon.name.lower().startswith("loi_") else f"loi_{nguon.name}"
    dich = THU_MUC_VAO / ten

    if not that_bai:
        if dich.exists() and dich != nguon:
            dich.unlink()  # lan truoc hong, lan nay xong het -> xoa file loi cu
        return

    dong = [
        f"# {len(that_bai)} prompt hong tu {nguon.name} luc {time.strftime('%Y-%m-%d %H:%M')}",
        "# Tha lai file nay vao TAO_ANH.bat de chay bu. [#so] giu dung so thu tu anh.",
        "",
    ]
    for p, loi in that_bai:
        dong.append(f"# loi: {loi}")
        goc = RE_SO_EP.sub("", p.goc).strip()
        dong.append(f"[#{p.so}] {goc}")
        dong.append("")

    dich.parent.mkdir(parents=True, exist_ok=True)
    dich.write_text("\n".join(dong), encoding="utf-8")
    log.warning("Da ghi %d prompt hong vao %s", len(that_bai), dich.name)


def gom_hang_doi(dau_vao: Iterable[str]) -> list[Path]:
    danh_sach: list[Path] = []
    for m in [Path(x) for x in dau_vao] or [THU_MUC_VAO]:
        if m.is_dir():
            danh_sach.extend(sorted(p for p in m.rglob("*.txt") if p.is_file()))
        elif m.is_file() and m.suffix.lower() == ".txt":
            danh_sach.append(m)
        else:
            log.warning("Bo qua '%s' (khong phai file .txt hoac thu muc).", m)

    da_thay: set[Path] = set()
    ket_qua = []
    for p in danh_sach:
        q = p.resolve()
        if q not in da_thay:
            da_thay.add(q)
            ket_qua.append(q)
    return ket_qua


def sap_xep_uu_tien(hang_doi: list[Path], cau_hinh: dict) -> list[Path]:
    """Kenh trong chung.uu_tien chay truoc (RUNGWORK nang Gemini nhat)."""
    uu_tien = [str(x).upper() for x in (cau_hinh["chung"].get("uu_tien") or [])]

    def khoa(p: Path):
        ten_kenh = lay_cau_hinh_kenh(p.name, cau_hinh, im_lang=True).ten
        return (uu_tien.index(ten_kenh) if ten_kenh in uu_tien else len(uu_tien), p.name)

    return sorted(hang_doi, key=khoa)


# ---------------------------------------------------------------------------
# 10. Tu kiem tra
# ---------------------------------------------------------------------------


def tu_kiem_tra() -> int:
    """Chay thu ca duong ong voi API gia - khong goi mang, khong ton quota."""
    log.info("=== TU KIEM TRA (khong goi API that) ===")
    loi: list[str] = []

    # --- 1. Doc file, tach prompt, go tag ---------------------------------
    thu_muc = GOC / "XONG" / "_TU_KIEM_TRA"
    shutil.rmtree(thu_muc, ignore_errors=True)
    thu_muc.mkdir(parents=True, exist_ok=True)

    f_dong = thu_muc / "TERCO1_moi_dong.txt"
    f_dong.write_text(
        "# ghi chu, khong tao anh\n"
        "1. A quiet mountain lake at sunrise, wide shot\n"
        "[P] 2. An elderly woman praying in a small chapel\n"
        "3. Uma multidao rezando na igreja\n"
        "4. Golden wheat field, cinematic lighting\n"
        "5. A statue in the fog\n",
        encoding="utf-8",
    )
    p_dong = doc_file_prompt(f_dong)

    f_khoi = thu_muc / "GODSAYS_moi_khoi.txt"
    f_khoi.write_text(
        "[P] A single candle burning in the dark,\n"
        "warm golden light, close up\n"
        "\n"
        "Empty wooden church pews at dawn,\n"
        "soft light through stained glass\n",
        encoding="utf-8",
    )
    p_khoi = doc_file_prompt(f_khoi)

    kenh_auto = CauHinhKenh("TERCO1", thu_muc / "ra_terco1", "auto", False)
    kenh_ep = CauHinhKenh("RUNGWORK", thu_muc / "ra_rungwork", "gemini", True)
    for p in p_dong:
        p.engine, p.ly_do = chon_engine(p, kenh_auto)

    kiem = [
        (len(p_dong) == 5, f"file moi-dong phai ra 5 prompt, dang ra {len(p_dong)}"),
        (len(p_khoi) == 2, f"file moi-khoi phai ra 2 prompt, dang ra {len(p_khoi)}"),
        (p_dong[0].text.startswith("A quiet mountain"), "phai go '1.' o dau dong"),
        (p_dong[1].text.startswith("An elderly woman"), "phai go ca '[P]' lan '2.'"),
        (p_dong[1].co_tag_p, "phai nho la co tag [P]"),
        (p_khoi[0].text.count("\n") == 0, "khoi nhieu dong phai gop thanh 1 dong"),
        (p_khoi[0].co_tag_p, "tag [P] dau khoi phai nhan ra"),
        (p_dong[0].engine == "pollinations", "canh ho khong nguoi -> pollinations"),
        (p_dong[1].engine == "gemini", "co tag [P] -> gemini"),
        (p_dong[2].engine == "gemini", "'multidao rezando' (tieng Bo) -> gemini"),
        (p_dong[3].engine == "pollinations", "canh dong lua -> pollinations"),
        (p_dong[4].engine == "gemini", "'statue' phan van -> gemini"),
        (chon_engine(p_dong[0], kenh_ep)[0] == "gemini", "kenh ep gemini phai thang tu khoa"),
        (ten_file_anh(p_dong[1], "png").startswith("002_"), "ten file phai co so thu tu 3 chu so"),
        (not re.search(CAM_TRONG_TEN, ten_file_anh(p_dong[2], "png")), "ten file con ky tu cam"),
        (lay_tien_to("loi_TERCO1_beat.txt") == "TERCO1", "file loi_ phai ra dung kenh"),
        (doc_file_prompt(f_dong)[1].so == 2, "so thu tu phai theo vi tri trong file"),
    ]
    loi.extend(ghi_chu for dat, ghi_chu in kiem if not dat)

    # --- 2. So thu tu ep bang [#N] ----------------------------------------
    f_bu = thu_muc / "loi_RUNGWORK_beat.txt"
    f_bu.write_text("# chay bu\n[#7] A stickman engineer at a desk\n\n[#12] A stickman pilot\n",
                    encoding="utf-8")
    p_bu = doc_file_prompt(f_bu)
    if [p.so for p in p_bu] != [7, 12]:
        loi.append(f"[#N] phai giu so thu tu, dang ra {[p.so for p in p_bu]}")
    if p_bu and not p_bu[0].text.startswith("A stickman engineer"):
        loi.append("phai go marker [#7] khoi prompt")

    # --- 3. Than request Gemini -------------------------------------------
    than = _than_request_gemini("test", CAU_HINH_MAU["gemini"])
    duong = than.get("generationConfig", {})
    if duong.get("responseModalities") != ["IMAGE"]:
        loi.append("than request thieu responseModalities")
    if duong.get("imageConfig", {}).get("aspectRatio") != "16:9":
        loi.append("than request thieu aspectRatio 16:9")

    _FIELD_BO_QUA.add("imageSize")
    if "imageSize" in _than_request_gemini("test", CAU_HINH_MAU["gemini"]).get(
        "generationConfig", {}
    ).get("imageConfig", {}):
        loi.append("khong go duoc field bi API tu choi")
    _FIELD_BO_QUA.discard("imageSize")

    # --- 4. Xoay key ------------------------------------------------------
    vk = VongKey(["k1", "k2"], backoff_dau=1, backoff_toi_da=2)
    if vk.lay()[1] != "k1" or vk.lay()[1] != "k2":
        loi.append("phai xoay vong lan luot cac key")
    vk.bao_quota(0, 30)
    vk.bao_quota(1, 30)
    if vk.lay() is not None:
        loi.append("het quota het key thi phai tra ve None de di ngu")
    if not vk.con_key_song():
        loi.append("het quota khong phai la key hong")
    vk.bao_hong(0)
    vk.bao_hong(1)
    if vk.con_key_song():
        loi.append("bao hong het key thi con_key_song phai False")

    # --- 5. Ca duong ong voi API gia --------------------------------------
    goc_gemini = globals()["goi_gemini"]
    goc_poll = globals()["goi_pollinations"]
    da_goi = {"gemini": 0, "pollinations": 0}

    def gemini_gia(prompt, key, cfg):
        da_goi["gemini"] += 1
        if da_goi["gemini"] == 2:  # gia lap het quota mot lan
            raise LoiQuota(1, "gia lap quota")
        if "chapel" in prompt:  # gia lap loi tam thoi roi lan sau thanh cong
            if da_goi["gemini"] < 4:
                raise LoiTamThoi("gia lap loi mang")
        return _anh_gia(1280, 720)

    def poll_gia(prompt, cfg, cfg_anh, seed):
        da_goi["pollinations"] += 1
        if "wheat" in prompt:
            raise LoiVinhVien("gia lap prompt bi tu choi")
        return _anh_gia(1024, 1024)

    globals()["goi_gemini"] = gemini_gia
    globals()["goi_pollinations"] = poll_gia
    cau_hinh = json.loads(json.dumps(CAU_HINH_MAU))
    cau_hinh["gemini"]["nghi_giua_anh"] = 0
    cau_hinh["chung"]["cho_thu_lai_giay"] = 0
    cau_hinh["pollinations"]["cach_nhau_giay"] = 0
    cau_hinh["kenh"] = {"TERCO1": {"thu_muc_ra": str(thu_muc / "ra_terco1"), "model": "auto"}}
    tuy_chon = argparse.Namespace(lam_lai=False, giu_file=True, chi_gemini=False)
    vk2 = VongKey(["k1", "k2"], backoff_dau=1, backoff_toi_da=1)

    try:
        tk = xu_ly_mot_file(f_dong, cau_hinh, vk2, tuy_chon)
    finally:
        globals()["goi_gemini"] = goc_gemini
        globals()["goi_pollinations"] = goc_poll

    ra = thu_muc / "ra_terco1"
    co_anh = sorted(p.name for p in ra.glob("*.png")) if ra.is_dir() else []
    log.info("Anh tao duoc: %s", co_anh)
    log.info("Thong ke: gemini=%d pollinations=%d loi=%d bo_qua=%d",
             tk.gemini, tk.pollinations, tk.loi, tk.bo_qua)

    if len(co_anh) != 4:
        loi.append(f"phai ra 4 anh (1 prompt co loi vinh vien), dang ra {len(co_anh)}")
    if tk.loi != 1:
        loi.append(f"phai dem dung 1 loi, dang dem {tk.loi}")
    if tk.gemini != 3:
        loi.append(f"phai co 3 anh gemini, dang co {tk.gemini}")

    try:
        from PIL import Image

        for ten in co_anh:
            with Image.open(ra / ten) as im:
                if im.size != (1920, 1080):
                    loi.append(f"{ten} khong phai 1920x1080 ma la {im.size}")
                    break
        log.info("Kich thuoc anh: 1920x1080 - dat")
    except ImportError:
        log.warning("Chua cai Pillow -> khong kiem tra duoc kich thuoc anh.")

    f_loi = THU_MUC_VAO / "loi_TERCO1_moi_dong.txt"
    if not f_loi.exists():
        loi.append("phai ghi file loi_*.txt cho prompt hong")
    else:
        lai = doc_file_prompt(f_loi)
        if len(lai) != 1 or lai[0].so != 4:
            loi.append(f"file loi phai giu dung so thu tu 4, dang ra {[p.so for p in lai]}")
        f_loi.unlink()

    shutil.rmtree(thu_muc, ignore_errors=True)

    if loi:
        for x in loi:
            log.error("  THAT BAI: %s", x)
        log.error("=== TU KIEM TRA: HONG (%d loi) ===", len(loi))
        return 1
    log.info("=== TU KIEM TRA: TAT CA DEU DAT ===")
    return 0


def _anh_gia(rong: int, cao: int) -> bytes:
    """Sinh mot anh that (bytes PNG) de test khoi phai goi mang."""
    import io

    try:
        from PIL import Image
    except ImportError:
        # PNG 1x1 nhoi them byte cho qua nguong 20KB
        return (
            base64.b64decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmM"
                "IQAAAABJRU5ErkJggg=="
            )
            + b"\x00" * 30000
        )

    # Nhieu ngau nhien cho PNG khong nen duoc -> file du lon de qua nguong 20 KB
    anh = Image.frombytes("RGB", (rong, cao), os.urandom(rong * cao * 3))
    dem = io.BytesIO()
    anh.save(dem, "PNG")
    return dem.getvalue()


# ---------------------------------------------------------------------------
# 11. CLI
# ---------------------------------------------------------------------------


def phan_tich_tham_so(argv: Sequence[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="tao_anh.py",
        description=f"{APP_NAME} v{APP_VERSION} - tao anh AI hang loat cho nhieu kenh.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Vi du:\n"
            "  python tao_anh.py\n"
            "  python tao_anh.py PROMPT_CHO\\RUNGWORK_11.txt\n"
            "  python tao_anh.py --chi-gemini --lam-lai\n"
        ),
    )
    p.add_argument("dau_vao", nargs="*", help="File .txt hoac thu muc (mac dinh: PROMPT_CHO)")
    p.add_argument("--lam-lai", action="store_true", help="Tao lai ca nhung anh da co")
    p.add_argument("--chi-gemini", action="store_true",
                   help="Ep tat ca di Gemini, cam roi xuong Pollinations")
    p.add_argument("--chi-pollinations", action="store_true",
                   help="Ep tat ca di Pollinations (khong ton quota Gemini)")
    p.add_argument("--giu-file", action="store_true",
                   help="Khong chuyen file .txt sang PROMPT_XONG khi chay xong")
    p.add_argument("--chi-tiet", action="store_true", help="In them log go roi")
    p.add_argument("--tu-kiem-tra", action="store_true", help="Chay thu duong ong, khong goi API")
    return p.parse_args(list(argv))


def main(argv: Sequence[str] | None = None) -> int:
    ep_utf8()
    tuy_chon = phan_tich_tham_so(sys.argv[1:] if argv is None else argv)
    file_log = cai_dat_log(logging.DEBUG if tuy_chon.chi_tiet else logging.INFO)

    log.info("=" * 70)
    log.info("%s v%s  |  Gemini image + Pollinations flux", APP_NAME, APP_VERSION)
    log.info("Log: %s", file_log)

    if tuy_chon.tu_kiem_tra:
        return tu_kiem_tra()

    for thu_muc in (THU_MUC_VAO, THU_MUC_XONG):
        thu_muc.mkdir(parents=True, exist_ok=True)

    cau_hinh = doc_cau_hinh()

    if tuy_chon.chi_pollinations:
        for muc in (cau_hinh.get("kenh") or {}).values():
            muc["model"] = "pollinations"
            muc["cam_du_phong"] = False
        log.warning("Che do --chi-pollinations: bo qua Gemini cho toan bo hang doi.")
    elif tuy_chon.chi_gemini:
        for muc in (cau_hinh.get("kenh") or {}).values():
            muc["model"] = "gemini"
            muc["cam_du_phong"] = True
        log.warning("Che do --chi-gemini: tat ca di Gemini, khong ha xuong Pollinations.")

    hang_doi = sap_xep_uu_tien(gom_hang_doi(tuy_chon.dau_vao), cau_hinh)
    if not hang_doi:
        log.error("Khong tim thay file .txt nao. Bo file prompt vao %s roi chay lai.",
                  THU_MUC_VAO.name)
        return 2

    keys = [k for k in (cau_hinh["gemini"].get("api_keys") or []) if k and "DAN_API_KEY" not in k]
    if not keys:
        log.warning("Chua dan API key Gemini vao config.json -> chi chay duoc Pollinations.")
    vong_key = VongKey(
        keys,
        backoff_dau=float(cau_hinh["gemini"].get("backoff_dau_giay", 60)),
        backoff_toi_da=float(cau_hinh["gemini"].get("backoff_toi_da_giay", 900)),
    )

    log.info("HANG DOI : %d file (uu tien: %s)",
             len(hang_doi), ", ".join(cau_hinh["chung"].get("uu_tien") or []) or "khong")
    for i, p in enumerate(hang_doi, 1):
        kenh = lay_cau_hinh_kenh(p.name, cau_hinh, im_lang=True)
        log.info("  %2d. %-46s [%s]", i, p.name, kenh.ten)

    tong = ThongKe()
    t_bat_dau = time.time()
    for i, duong_dan in enumerate(hang_doi, 1):
        log.info("")
        log.info(">>> [%d/%d] %s", i, len(hang_doi), duong_dan.name)
        try:
            tong.cong(xu_ly_mot_file(duong_dan, cau_hinh, vong_key, tuy_chon))
        except KeyboardInterrupt:
            log.warning("Nguoi dung dung giua chung. Anh da tao van con nguyen.")
            break
        except Exception as loi:
            log.exception("LOI khi xu ly %s: %s", duong_dan.name, loi)

    phut = (time.time() - t_bat_dau) / 60
    log.info("")
    log.info("=" * 70)
    log.info("TONG KET sau %.1f phut", phut)
    log.info("  Gemini       : %d anh", tong.gemini)
    log.info("  Pollinations : %d anh", tong.pollinations)
    log.info("  Bo qua (da co): %d", tong.bo_qua)
    log.info("  Loi          : %d", tong.loi)
    if tong.loi:
        log.warning("  Cac prompt hong nam trong PROMPT_CHO\\loi_*.txt - tha lai de chay bu.")
    log.info("=" * 70)
    return 0 if tong.loi == 0 else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nDa dung.")
        sys.exit(130)

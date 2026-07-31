# -*- coding: utf-8 -*-
"""
GIAO DIEN WEB cho tao_voice - chay tren may minh, mo bang trinh duyet.

Bam dup GIAO_DIEN.bat roi mo http://localhost:8777
Khong gui gi len mang: model, giong mau, ban thu deu nam tren may ban.

Ba thu tieng: English, Portugues (Brasil), Espanol. Clone giong tu file mau.
"""

from __future__ import annotations

import io
import json
import threading
import time
import uuid
import wave
from dataclasses import dataclass, field
from pathlib import Path

import tao_voice as tv

# Phai import o cap module: co `from __future__ import annotations` nen chu thich
# kieu bi bien thanh chuoi, pydantic chi giai duoc neu ten nam trong globals().
try:
    from fastapi import FastAPI, File, Form, HTTPException, UploadFile
    from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

    CO_FASTAPI = True
except ImportError:  # bao loi tu te trong main() thay vi chet luc import
    CO_FASTAPI = False

# ---------------------------------------------------------------------------
# 1. Thiet lap
# ---------------------------------------------------------------------------

CONG = 8777
THU_MUC_RA_WEB = tv.GOC / "XONG" / "web"

NGON_NGU = [
    {"ma": "english", "ten": "English", "co": "US"},
    {"ma": "portuguese", "ten": "Portugues (Brasil)", "co": "BR"},
    {"ma": "spanish", "ten": "Espanol", "co": "ES"},
]
MA_HOP_LE = {n["ma"] for n in NGON_NGU}

log = tv.log


@dataclass
class CongViec:
    """Mot lan bam nut Tao giong."""

    ma: str
    tong: int = 0
    xong: int = 0
    trang_thai: str = "dang_cho"  # dang_cho | dang_chay | xong | hong
    thong_bao: str = ""
    file_wav: str = ""
    file_srt: str = ""
    giay: float = 0.0
    cau_dang_doc: str = ""
    bat_dau: float = field(default_factory=time.time)


CAC_VIEC: dict[str, CongViec] = {}
_KHOA = threading.Lock()
_ENGINE: tv.MayDocGiong | None = None
_KHOA_ENGINE = threading.Lock()


def lay_engine() -> tv.MayDocGiong:
    """Mot engine dung chung, nap model mot lan roi giu lai."""
    global _ENGINE
    with _KHOA_ENGINE:
        if _ENGINE is None:
            cau_hinh = tv.doc_cau_hinh()
            mac_dinh = cau_hinh.get("mac_dinh") or {}
            _ENGINE = tv.MayDocGiong(
                1, None, None, quantize=bool(mac_dinh.get("quantize", False))
            )
        return _ENGINE


def danh_sach_giong() -> list[dict]:
    """Cac file giong mau dang co trong voices/."""
    duoi = (".wav", ".mp3", ".flac", ".ogg", ".m4a", ".safetensors")
    ra = []
    if tv.THU_MUC_GIONG.is_dir():
        for p in sorted(tv.THU_MUC_GIONG.iterdir()):
            if p.suffix.lower() in duoi and not p.name.startswith("."):
                giay = 0.0
                if p.suffix.lower() == ".wav":
                    try:
                        with wave.open(str(p), "rb") as f:
                            giay = f.getnframes() / f.getframerate()
                    except Exception:
                        pass
                ra.append({"ten": p.name, "nhan": p.stem, "giay": round(giay, 1)})
    return ra


# ---------------------------------------------------------------------------
# 2. Chay mot cong viec
# ---------------------------------------------------------------------------


def chay_cong_viec(viec: CongViec, van_ban: str, tuy_chon: dict) -> None:
    try:
        viec.trang_thai = "dang_chay"
        import numpy as np

        cfg = tv.CauHinhKenh(
            ten=tuy_chon.get("ten_ra") or "web",
            model=tuy_chon["model"],
            giong=(tv.THU_MUC_GIONG / tuy_chon["giong"]) if tuy_chon.get("giong") else None,
            nghi_ngan=float(tuy_chon.get("nghi_ngan", 0.30)),
            nghi_dai=float(tuy_chon.get("nghi_dai", 0.85)),
            nghi_doan_dai=float(tuy_chon.get("nghi_doan_dai", 1.60)),
            duoi_file=0.4,
            temperature=tuy_chon.get("temperature"),
            whisper_lang=None,
            toc_do=float(tuy_chon.get("toc_do", 1.0)),
            cao_do=float(tuy_chon.get("cao_do", 0.0)),
            hau_ky=str(tuy_chon.get("hau_ky", "chuan")),
        )

        doan = tv.tach_kich_ban(van_ban, cfg)
        if not doan:
            viec.trang_thai = "hong"
            viec.thong_bao = "Chua nhap chu nao de doc."
            return
        viec.tong = len(doan)

        engine = lay_engine()
        viec.cau_dang_doc = "Dang nap model, lan dau hoi lau..."
        trang_thai_giong = engine.trang_thai_giong(cfg.model, cfg.giong, cfg.temperature)
        sample_rate = engine.sample_rate

        cac_am: list = []
        for i, mot_doan in enumerate(doan, 1):
            viec.cau_dang_doc = mot_doan.text[:70]
            am = engine.doc_voi_model(cfg.model, trang_thai_giong, mot_doan.text, cfg.temperature)
            am = tv.cat_lang(am, sample_rate)
            if abs(cfg.toc_do - 1.0) >= 0.01:
                am = tv.doi_toc_do(am, sample_rate, cfg.toc_do)
            if abs(cfg.cao_do) >= 0.05:
                am = tv.doi_cao_do(am, sample_rate, cfg.cao_do)
            am = tv.vuot_bien(am, sample_rate)

            cac_am.append(am)
            viec.xong = i

        viec.cau_dang_doc = "Dang lam sach va can am luong..."
        toan_bo = tv.ghep_cac_doan(doan, cac_am, sample_rate)
        toan_bo = tv.xu_ly_hau_ky(toan_bo, sample_rate, cfg.hau_ky)
        THU_MUC_RA_WEB.mkdir(parents=True, exist_ok=True)
        ten_goc = f"{time.strftime('%Y%m%d_%H%M%S')}_{cfg.ten}"
        wav = THU_MUC_RA_WEB / f"{ten_goc}.wav"
        tv.ghi_wav(wav, toan_bo, sample_rate)
        viec.file_wav = wav.name
        viec.giay = toan_bo.size / sample_rate

        if tuy_chon.get("srt"):
            viec.cau_dang_doc = "Dang lam phu de..."
            cau_hinh = tv.doc_cau_hinh()
            ten_whisper = (cau_hinh.get("mac_dinh") or {}).get("whisper_model") or "base"
            cac_tu = tv.nhan_dang_bang_whisper(wav, cfg.ma_whisper, ten_whisper, None)
            tu_theo_doan = []
            for mot_doan in doan:
                if mot_doan.ket_thuc <= mot_doan.bat_dau:
                    continue
                t0 = mot_doan.bat_dau / sample_rate
                t1 = mot_doan.ket_thuc / sample_rate
                trong = [t for t in cac_tu if t.ket_thuc > t0 - 0.25 and t.bat_dau < t1 + 0.25]
                tu_theo_doan.append(tv.gan_moc_thoi_gian(mot_doan.text.split(), trong, t0, t1))
            srt = THU_MUC_RA_WEB / f"{ten_goc}.srt"
            tv.ghi_srt(srt, tv.tao_cue(tu_theo_doan))
            viec.file_srt = srt.name

        viec.cau_dang_doc = ""
        viec.trang_thai = "xong"
        log.info("Web: xong %s (%.1f giay am thanh)", viec.file_wav, viec.giay)

    except Exception as loi:  # bao loi ra giao dien thay vi chet am tham
        log.exception("Web: cong viec %s hong", viec.ma)
        viec.trang_thai = "hong"
        viec.thong_bao = str(loi)


# ---------------------------------------------------------------------------
# 3. Trang web
# ---------------------------------------------------------------------------


def tao_app():
    app = FastAPI(title="TAO VOICE", docs_url=None, redoc_url=None)

    @app.get("/", response_class=HTMLResponse)
    def trang_chu():
        return TRANG_HTML

    @app.get("/api/giong")
    def api_giong():
        cau_hinh = tv.doc_cau_hinh()
        cau_hinh.pop("_vua_tao", None)
        mac_dinh = cau_hinh.get("mac_dinh") or {}
        cac_kenh = {}
        for ten, muc in (cau_hinh.get("kenh") or {}).items():
            gop = {**mac_dinh, **(muc or {})}
            cac_kenh[str(ten).upper()] = {
                "model": gop.get("model", "english"),
                "voice": gop.get("voice", ""),
                "hau_ky": gop.get("hau_ky", "chuan"),
                "toc_do": float(gop.get("toc_do", 1.0)),
                "cao_do": float(gop.get("cao_do", 0.0)),
                "nghi_ngan": float(gop.get("nghi_ngan", 0.30)),
                "nghi_dai": float(gop.get("nghi_dai", 0.85)),
            }
        return {"giong": danh_sach_giong(), "ngon_ngu": NGON_NGU, "kenh": cac_kenh}

    @app.post("/api/luu-kenh")
    def api_luu_kenh(
        ten_kenh: str = Form(...),
        model: str = Form("english"),
        giong: str = Form(""),
        hau_ky: str = Form("chuan"),
        toc_do: float = Form(1.0),
        cao_do: float = Form(0.0),
        nghi_ngan: float = Form(0.30),
        nghi_dai: float = Form(0.85),
    ):
        """Ghi cai dat dang thu nghiem vao channels.json de TAO_VOICE.bat dung lai."""
        import re

        ten_kenh = ten_kenh.strip().upper()
        if not re.fullmatch(r"[A-Z0-9]+", ten_kenh or ""):
            raise HTTPException(400, "Ten kenh chi dung chu va so khong dau.")
        if model not in MA_HOP_LE:
            raise HTTPException(400, f"Ngon ngu '{model}' khong dung.")
        if hau_ky not in tv.MUC_HAU_KY:
            raise HTTPException(400, f"Muc xu ly '{hau_ky}' khong dung.")

        cau_hinh = tv.doc_cau_hinh()
        cau_hinh.pop("_vua_tao", None)
        cac_kenh = cau_hinh.setdefault("kenh", {})
        khoa = next((k for k in cac_kenh if str(k).upper() == ten_kenh), ten_kenh)
        muc = dict(cac_kenh.get(khoa) or {})
        muc.update({
            "model": model,
            "voice": giong or muc.get("voice", ""),
            "hau_ky": hau_ky,
            "toc_do": round(float(toc_do), 3),
            "cao_do": round(float(cao_do), 2),
            "nghi_ngan": round(float(nghi_ngan), 3),
            "nghi_dai": round(float(nghi_dai), 3),
        })
        cac_kenh[khoa] = muc

        tv.FILE_CAU_HINH.write_text(
            json.dumps(cau_hinh, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        log.info("Web: da luu cai dat cho kenh %s -> %s", khoa, json.dumps(muc, ensure_ascii=False))
        return {"ok": True, "ten": khoa, "muc": muc}

    @app.post("/api/doc")
    def api_doc(
        van_ban: str = Form(...),
        model: str = Form("english"),
        giong: str = Form(""),
        nghi_ngan: float = Form(0.30),
        nghi_dai: float = Form(0.85),
        toc_do: float = Form(1.0),
        cao_do: float = Form(0.0),
        hau_ky: str = Form("chuan"),
        srt: bool = Form(False),
        ten_ra: str = Form(""),
    ):
        if model not in MA_HOP_LE:
            raise HTTPException(400, f"Ngon ngu '{model}' khong dung.")
        if not van_ban.strip():
            raise HTTPException(400, "Chua nhap chu nao.")

        viec = CongViec(ma=uuid.uuid4().hex[:12])
        with _KHOA:
            CAC_VIEC[viec.ma] = viec
        threading.Thread(
            target=chay_cong_viec,
            args=(viec, van_ban, {
                "model": model, "giong": giong, "nghi_ngan": nghi_ngan,
                "nghi_dai": nghi_dai, "toc_do": toc_do, "cao_do": cao_do,
                "hau_ky": hau_ky,
                "srt": srt, "ten_ra": ten_ra,
            }),
            daemon=True,
        ).start()
        return {"ma": viec.ma}

    @app.get("/api/trang-thai/{ma}")
    def api_trang_thai(ma: str):
        viec = CAC_VIEC.get(ma)
        if not viec:
            raise HTTPException(404, "Khong thay cong viec")
        return {
            "trang_thai": viec.trang_thai,
            "xong": viec.xong,
            "tong": viec.tong,
            "cau": viec.cau_dang_doc,
            "thong_bao": viec.thong_bao,
            "wav": viec.file_wav,
            "srt": viec.file_srt,
            "giay": round(viec.giay, 1),
            "da_chay": round(time.time() - viec.bat_dau, 1),
        }

    @app.get("/api/tai/{ten}")
    def api_tai(ten: str):
        duong_dan = (THU_MUC_RA_WEB / ten).resolve()
        if not duong_dan.is_file() or THU_MUC_RA_WEB.resolve() not in duong_dan.parents:
            raise HTTPException(404, "Khong thay file")
        kieu = "audio/wav" if duong_dan.suffix == ".wav" else "text/plain; charset=utf-8"
        return FileResponse(duong_dan, media_type=kieu, filename=ten)

    @app.post("/api/nap-giong")
    async def api_nap_giong(file: UploadFile = File(...), ten_kenh: str = Form(...)):
        import re

        ten_kenh = ten_kenh.strip().upper()
        if not re.fullmatch(r"[A-Z0-9]+", ten_kenh or ""):
            raise HTTPException(400, "Ten giong chi dung chu va so khong dau.")

        tam = tv.THU_MUC_CACHE / "tai_len"
        tam.mkdir(parents=True, exist_ok=True)
        goc = tam / (file.filename or "mau.wav")
        goc.write_bytes(await file.read())

        try:
            am, sr = tv.doc_am_thanh(goc)
        except Exception as loi:
            raise HTTPException(400, f"Khong doc duoc file am thanh: {loi}") from loi

        nhan_xet = tv.kiem_tra_giong(am, sr)
        if any(m == "LOI" for m, _ in nhan_xet):
            return JSONResponse(
                {"ok": False, "nhan_xet": [{"muc": m, "chu": t} for m, t in nhan_xet]},
                status_code=400,
            )

        xu_ly = tv.chuan_bi_giong(am, sr, None, None)
        tv.THU_MUC_GIONG.mkdir(parents=True, exist_ok=True)
        dich = tv.THU_MUC_GIONG / f"{ten_kenh}.wav"
        tv.ghi_wav(dich, xu_ly, sr)
        goc.unlink(missing_ok=True)
        log.info("Web: da nap giong %s (%.1f giay)", dich.name, xu_ly.size / sr)
        return {
            "ok": True,
            "ten": dich.name,
            "giay": round(xu_ly.size / sr, 1),
            "nhan_xet": [{"muc": m, "chu": t} for m, t in nhan_xet],
        }

    return app


# ---------------------------------------------------------------------------
# 4. HTML - nhung thang vao file, khong goi ra mang nen chay duoc offline
# ---------------------------------------------------------------------------

TRANG_HTML = r"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TAO VOICE - doc kich ban tren may minh</title>
<style>
*{box-sizing:border-box}
body{margin:0;font:15px/1.55 "Segoe UI",system-ui,sans-serif;background:#12131a;color:#e8e9ee}
header{padding:18px 24px;border-bottom:1px solid #24262f;display:flex;align-items:center;gap:14px}
header b{font-size:19px;letter-spacing:.3px}
header span{color:#8b8fa3;font-size:13px}
.wrap{display:grid;grid-template-columns:1fr 340px;gap:20px;padding:20px;max-width:1240px;margin:0 auto}
@media(max-width:900px){.wrap{grid-template-columns:1fr}}
.hop{background:#191b24;border:1px solid #262936;border-radius:12px;padding:16px}
label{display:block;font-size:13px;color:#9aa0b5;margin:14px 0 6px}
label:first-child{margin-top:0}
textarea,select,input[type=text],input[type=number]{width:100%;background:#0f1017;color:#e8e9ee;
  border:1px solid #2c2f3d;border-radius:8px;padding:10px 12px;font:inherit}
textarea{min-height:340px;resize:vertical;line-height:1.7}
button{background:#c8f24a;color:#12131a;border:0;border-radius:8px;padding:11px 18px;
  font:600 15px/1 inherit;cursor:pointer}
button:disabled{opacity:.45;cursor:default}
button.phu{background:#2c2f3d;color:#e8e9ee;font-weight:500;padding:9px 14px;font-size:14px}
.hang{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.meo{font-size:12.5px;color:#7e8398;line-height:1.7;margin-top:10px}
.meo code{background:#0f1017;padding:1px 6px;border-radius:4px;color:#c8f24a}
#thanh{height:6px;background:#0f1017;border-radius:99px;overflow:hidden;margin:10px 0}
#thanh i{display:block;height:100%;width:0;background:#c8f24a;transition:width .3s}
.mo{color:#8b8fa3;font-size:13px}
.loi{color:#ff8087}
.dat{color:#c8f24a}
audio{width:100%;margin-top:12px}
input[type=range]{width:100%;accent-color:#c8f24a;background:transparent;padding:0}
.thang{display:flex;justify-content:space-between;font-size:11.5px;color:#6f7488;margin-top:2px}
ul.nx{list-style:none;padding:0;margin:10px 0 0;font-size:13px}
ul.nx li{padding:3px 0}
</style></head><body>

<header>
  <b>TAO VOICE</b>
  <span>chay tren may ban &middot; khong gui gi len mang</span>
</header>

<div class="wrap">
  <div class="hop">
    <label>Kich ban</label>
    <textarea id="vb" placeholder="Go hoac dan kich ban vao day...

Ket cau bang dau cham thi nghi ngan.
Dat &lt;break time=&quot;1s&quot;/&gt; o dau muon nghi dung 1 giay.

De mot dong trong thi nghi dai."></textarea>
    <div class="meo">
      <b style="color:#c8f24a">&lt;break time="1s"/&gt;</b> = nghi dung 1 giay &middot;
      <code>&lt;break time="2.5s"/&gt;</code> &middot; <code>&lt;break time="500ms"/&gt;</code>
      — dat giua cau cung duoc<br>
      Dau <code>.</code> <code>!</code> <code>?</code> = nghi ngan &middot;
      de <b>mot dong trong</b> = nghi dai &middot;
      dong chi co <code>---</code> = nghi rat dai &middot;
      dong bat dau bang <code>#</code> = ghi chu, khong doc<br>
      Cac the SSML khac (<code>&lt;speak&gt;</code>, <code>&lt;p&gt;</code>...) tu duoc bo, khong bi doc thanh chu
    </div>
  </div>

  <div>
    <div class="hop">
      <label>Kenh</label>
      <select id="kenh"></select>
      <div class="meo" style="margin-top:4px">
        Chon kenh se nap lai dung cai dat dang dung khi chay hang loat.
      </div>

      <label>Ngon ngu</label>
      <select id="nn"></select>

      <label>Giong doc</label>
      <select id="giong"></select>
      <div class="hang" style="margin-top:8px">
        <button class="phu" onclick="document.getElementById('tep').click()">Nap giong moi</button>
        <input type="file" id="tep" accept="audio/*" style="display:none">
      </div>
      <div id="nx"></div>

      <label>Xu ly am thanh</label>
      <select id="hk">
        <option value="chuan" selected>Chuan — lam sach + can am luong (nen dung)</option>
        <option value="nhe">Nhe — chi loc u va can am luong</option>
        <option value="manh">Manh — giam tap am nhieu hon (mau giong bi on)</option>
        <option value="tat">Tat — giu nguyen tieng model sinh ra</option>
      </select>

      <label>Toc do doc: <b id="td_so">1.00x</b> <span class="mo">(cao do khong doi)</span></label>
      <input type="range" id="td" min="0.70" max="1.30" step="0.01" value="1.00"
             oninput="td_so.textContent=(+this.value).toFixed(2)+'x'">
      <div class="thang"><span>Cham hon</span><span>Nhanh hon</span></div>

      <label>Cao do giong: <b id="cd_so">0.0</b> <span class="mo">nua cung (do dai khong doi)</span></label>
      <input type="range" id="cd" min="-4" max="4" step="0.5" value="0"
             oninput="cd_so.textContent=(+this.value).toFixed(1)">
      <div class="thang"><span>Tram hon</span><span>Cao hon</span></div>

      <label>Nghi ngan (giay) &middot; sau dau cham</label>
      <input type="number" id="nn1" value="0.30" step="0.05" min="0" max="3">
      <label>Nghi dai (giay) &middot; sau dong trong</label>
      <input type="number" id="nn2" value="0.85" step="0.05" min="0" max="5">

      <label style="margin-top:16px"><input type="checkbox" id="srt" checked>
        <b>Xuat kem phu de .srt</b></label>
      <div class="meo" style="margin-top:4px">
        Chu trong phu de lay tu chinh kich ban ban nhap, khong phai chu whisper doan ra.
        Lan dau bat se tai model nhan dang ve (~145 MB), nhung lan sau chay ngay.
      </div>

      <div class="hang" style="margin-top:18px">
        <button id="nut" onclick="tao()">Tao giong</button>
        <span id="tt" class="mo"></span>
      </div>
      <div class="hang" style="margin-top:10px">
        <button class="phu" onclick="luuKenh()">Luu cai dat nay cho kenh</button>
      </div>
      <div id="luu_tt" class="meo"></div>
      <div id="thanh"><i></i></div>
      <div id="kq"></div>
    </div>
  </div>
</div>

<script>
const $ = s => document.querySelector(s);
let dangChay = false;

let CAC_KENH = {};

async function nap(){
  const d = await (await fetch('/api/giong')).json();
  CAC_KENH = d.kenh || {};
  $('#nn').innerHTML = d.ngon_ngu.map(n=>`<option value="${n.ma}">${n.ten}</option>`).join('');
  const ten = Object.keys(CAC_KENH).sort();
  $('#kenh').innerHTML = '<option value="">(tu chon tay - khong theo kenh nao)</option>'
    + ten.map(k=>`<option value="${k}">${k}</option>`).join('');
  const g = d.giong;
  // Luon co lua chon "giong san" -> thu duoc ngay ca khi chua mo khoa clone giong
  $('#giong').innerHTML =
    g.map(v=>`<option value="${v.ten}">${v.nhan}${v.giay?' — '+v.giay+'s':''}</option>`).join('')
    + '<option value="">Giong co san cua model (khong can clone)</option>';
}
nap();

$('#kenh').onchange = () => {
  const k = CAC_KENH[$('#kenh').value];
  if(!k) return;
  $('#nn').value = k.model;
  if(k.voice) { const o=[...$('#giong').options].find(o=>o.value===k.voice); if(o) $('#giong').value=k.voice; }
  $('#hk').value  = k.hau_ky;
  $('#td').value  = k.toc_do;  $('#td').dispatchEvent(new Event('input'));
  $('#cd').value  = k.cao_do;  $('#cd').dispatchEvent(new Event('input'));
  $('#nn1').value = k.nghi_ngan.toFixed(2);
  $('#nn2').value = k.nghi_dai.toFixed(2);
  $('#luu_tt').textContent = 'Da nap cai dat cua kenh ' + $('#kenh').value;
  $('#luu_tt').className = 'meo';
};

async function luuKenh(){
  let ten = $('#kenh').value;
  if(!ten) ten = (prompt('Luu cai dat nay cho kenh nao? (vi du TERCO1)','') || '').trim();
  if(!ten) return;
  const fd = new FormData();
  fd.append('ten_kenh', ten);
  fd.append('model', $('#nn').value);
  fd.append('giong', $('#giong').value);
  fd.append('hau_ky', $('#hk').value);
  fd.append('toc_do', $('#td').value);
  fd.append('cao_do', $('#cd').value);
  fd.append('nghi_ngan', $('#nn1').value);
  fd.append('nghi_dai', $('#nn2').value);
  const r = await fetch('/api/luu-kenh', {method:'POST', body:fd});
  const d = await r.json().catch(()=>({}));
  if(r.ok){
    await nap(); $('#kenh').value = d.ten;
    $('#luu_tt').innerHTML = `<span class="dat">Da luu vao channels.json cho kenh <b>${d.ten}</b>.
      Tu gio tha file <code>${d.ten}_*.txt</code> vao TAO_VOICE.bat la chay dung cai dat nay.</span>`;
  } else {
    $('#luu_tt').innerHTML = '<span class="loi">Loi: '+(d.detail||'khong luu duoc')+'</span>';
  }
}

// nho lua chon .srt, toc do, cao do cho lan sau
const NHO = ['srt','td','cd','nn1','nn2','hk'];
NHO.forEach(id => {
  const o = $('#'+id), luu = localStorage.getItem('tv_'+id);
  if (luu !== null) { if (o.type === 'checkbox') o.checked = luu === '1'; else o.value = luu; }
  o.addEventListener('change', () =>
    localStorage.setItem('tv_'+id, o.type === 'checkbox' ? (o.checked?'1':'0') : o.value));
});
['td','cd'].forEach(id => $('#'+id).dispatchEvent(new Event('input')));

$('#tep').onchange = async e => {
  const f = e.target.files[0]; if(!f) return;
  const ten = prompt('Dat ten cho giong nay (chu va so, khong dau):','GIONG1');
  if(!ten) return;
  const fd = new FormData(); fd.append('file', f); fd.append('ten_kenh', ten);
  $('#nx').innerHTML = '<div class="mo" style="margin-top:10px">Dang kiem tra mau giong...</div>';
  const r = await fetch('/api/nap-giong', {method:'POST', body:fd});
  const d = await r.json().catch(()=>({}));
  const nx = (d.nhan_xet||[]).map(x=>
     `<li class="${x.muc==='OK'?'dat':(x.muc==='LOI'?'loi':'')}">[${x.muc}] ${x.chu}</li>`).join('');
  $('#nx').innerHTML = '<ul class="nx">'+nx+'</ul>';
  if(d.ok){ await nap(); $('#giong').value = d.ten; }
  e.target.value='';
};

async function tao(){
  if(dangChay) return;
  const vb = $('#vb').value.trim();
  if(!vb){ alert('Chua nhap kich ban.'); return; }
  dangChay = true; $('#nut').disabled = true; $('#kq').innerHTML = '';
  $('#tt').textContent = 'Dang chuan bi...'; $('#tt').className='mo';

  const fd = new FormData();
  fd.append('van_ban', vb);
  fd.append('model', $('#nn').value);
  fd.append('giong', $('#giong').value);
  fd.append('nghi_ngan', $('#nn1').value);
  fd.append('nghi_dai', $('#nn2').value);
  fd.append('toc_do', $('#td').value);
  fd.append('cao_do', $('#cd').value);
  fd.append('hau_ky', $('#hk').value);
  fd.append('srt', $('#srt').checked ? 'true' : 'false');

  const r = await fetch('/api/doc', {method:'POST', body:fd});
  if(!r.ok){ xong('Loi: ' + (await r.text()), true); return; }
  const {ma} = await r.json();

  const dem = setInterval(async () => {
    const s = await (await fetch('/api/trang-thai/'+ma)).json();
    const pc = s.tong ? Math.round(s.xong/s.tong*100) : 0;
    $('#thanh i').style.width = pc+'%';
    if(s.trang_thai === 'dang_chay')
      $('#tt').textContent = `Cau ${s.xong}/${s.tong} — ${s.cau||''}`;
    if(s.trang_thai === 'xong'){
      clearInterval(dem);
      $('#kq').innerHTML =
        `<audio controls src="/api/tai/${s.wav}"></audio>
         <div class="hang" style="margin-top:10px">
           <a href="/api/tai/${s.wav}" download><button>Tai WAV</button></a>
           ${s.srt?`<a href="/api/tai/${s.srt}" download><button>Tai SRT</button></a>`
                 :`<span class="mo">(khong xuat phu de)</span>`}
         </div>
         <div class="meo" style="margin-top:8px">Luu san tai <code>XONG\\web\\</code>
           &middot; ${s.wav}${s.srt?' + '+s.srt:''}</div>`;
      xong(`Xong — ${s.giay}s am thanh, lam mat ${s.da_chay}s`, false);
    }
    if(s.trang_thai === 'hong'){ clearInterval(dem); xong('Hong: '+s.thong_bao, true); }
  }, 700);
}

function xong(chu, loi){
  dangChay = false; $('#nut').disabled = false;
  $('#tt').textContent = chu; $('#tt').className = loi ? 'loi' : 'dat';
}
</script></body></html>
"""


# ---------------------------------------------------------------------------
# 5. Chay
# ---------------------------------------------------------------------------


def main() -> int:
    tv.ep_utf8()
    tv.cai_dat_log()
    import os

    os.environ.setdefault("HF_HOME", str(tv.THU_MUC_CACHE / "huggingface"))
    if not tv.nap_hf_token():
        log.warning("Chua co token HuggingFace -> chua clone duoc giong rieng.")

    try:
        import uvicorn

        if not CO_FASTAPI:
            raise ImportError("thieu fastapi")
    except ImportError:
        print("Thieu fastapi/uvicorn. Chay CAI_DAT.bat, hoac: pip install fastapi uvicorn")
        return 2

    THU_MUC_RA_WEB.mkdir(parents=True, exist_ok=True)
    log.info("=" * 68)
    log.info("GIAO DIEN WEB dang chay")
    log.info("Mo trinh duyet vao:  http://localhost:%d", CONG)
    log.info("Ban thu luu tai   :  %s", THU_MUC_RA_WEB)
    log.info("Dong cua so nay la tat. Ctrl+C cung duoc.")
    log.info("=" * 68)

    try:
        uvicorn.run(tao_app(), host="127.0.0.1", port=CONG, log_level="warning")
    except OSError as loi:
        log.error("=" * 68)
        log.error("KHONG MO DUOC GIAO DIEN: cong %d dang bi chiem (%s)", CONG, loi)
        log.error("Rat co the mot cua so GIAO_DIEN.bat cu van dang chay.")
        log.error("Dong het cac cua so den do lai roi mo lai file nay.")
        log.error("QUAN TRONG: server cu giu model da nap tu truoc trong bo nho,")
        log.error("nen nap token xong ma khong dong no thi van bao khong clone duoc giong.")
        log.error("=" * 68)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

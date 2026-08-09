#!/bin/bash
# ============================================================
#  XOA WATERMARK - ban cho macOS
#
#  BAM DUP file nay trong Finder la chay.
#  Lan dau tien: bam chuot phai > Open > Open, vi macOS chan file tai tu mang.
#
#  Anh sach ra thu muc WM_XONG/, anh goc khong bi dong vao.
# ============================================================

cd "$(dirname "$0")" || exit 1

echo "============================================================"
echo "  XOA WATERMARK  -  go logo / chu chim tren anh cua ban"
echo "  Thu muc: $(pwd)"
echo "============================================================"
echo

# --- 1. Tim Python 3 --------------------------------------------------------
PY=""
if [ -x ".venv_wm/bin/python" ]; then
    PY=".venv_wm/bin/python"
elif [ -x ".venv/bin/python" ]; then
    PY=".venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
    PY="python3"
fi

if [ -z "$PY" ]; then
    echo "[LOI] Chua co Python 3 tren may."
    echo
    echo "  Cach nhanh nhat: mo Terminal go lenh nay roi lam theo huong dan:"
    echo "      xcode-select --install"
    echo "  Hoac tai ban chinh thuc: https://www.python.org/downloads/macos/"
    echo
    read -r -p "Bam Enter de dong..."
    exit 1
fi

# --- 2. Kiem tra numpy + Pillow ---------------------------------------------
if ! "$PY" -c "import numpy, PIL" >/dev/null 2>&1; then
    echo "[!] Chua co numpy / Pillow, dang cai (chi lam 1 lan)..."
    echo

    # macOS chan cai thang vao Python he thong -> tao moi truong rieng .venv_wm
    if [ ! -x ".venv_wm/bin/python" ]; then
        "$PY" -m venv .venv_wm || {
            echo "[LOI] Khong tao duoc moi truong .venv_wm."
            read -r -p "Bam Enter de dong..."
            exit 1
        }
    fi
    PY=".venv_wm/bin/python"
    "$PY" -m pip install --upgrade pip --quiet
    "$PY" -m pip install numpy pillow || {
        echo "[LOI] Cai thu vien that bai. Kiem tra ket noi mang roi chay lai."
        read -r -p "Bam Enter de dong..."
        exit 1
    }
    echo
fi

# --- 3. Hoi vi tri watermark -------------------------------------------------
echo " Watermark nam o dau?"
echo
echo "   [1] Tu dong do          (nen dung - can it nhat 3 anh cung bo)"
echo "   [2] Goc duoi ben phai"
echo "   [3] Goc duoi ben trai"
echo "   [4] Goc tren ben phai"
echo "   [5] Goc tren ben trai"
echo "   [6] Ca dai duoi anh"
echo "   [7] Chinh giua anh"
echo "   [8] XEM THU - chi ve khung do de soi, khong sua anh"
echo
read -r -p "Go so roi bam Enter (mac dinh 1): " CHON
[ -z "$CHON" ] && CHON=1

THAM_SO="--vung tu-dong"
case "$CHON" in
    2) THAM_SO="--vung duoi-phai" ;;
    3) THAM_SO="--vung duoi-trai" ;;
    4) THAM_SO="--vung tren-phai" ;;
    5) THAM_SO="--vung tren-trai" ;;
    6) THAM_SO="--vung duoi" ;;
    7) THAM_SO="--vung giua" ;;
    8) THAM_SO="--vung tu-dong --xem-thu" ;;
esac

# --- 4. Watermark la chu trang? ---------------------------------------------
if [ "$CHON" != "8" ]; then
    echo
    echo " Watermark la CHU TRANG / xam mo tren nen anh?"
    echo "   C = chi va dung net chu, phan nen giu nguyen (dep hon)"
    echo "   K = va ca o vuong (chac an hon khi logo nhieu mau)"
    read -r -p "Go C hoac K roi bam Enter (mac dinh K): " NET
    case "$NET" in
        c|C) THAM_SO="$THAM_SO --loc-mau sang --no-rong 3" ;;
    esac
fi

# --- 5. Lay duong dan anh ----------------------------------------------------
echo
echo " Anh nam o dau?"
echo "   - Keo tha file hoac thu muc anh THANG VAO CUA SO NAY roi bam Enter"
echo "     (keo nhieu file mot luc cung duoc)"
echo "   - Hoac bam Enter luon de xu ly het anh trong thu muc WM_CHO/"
echo
read -r -p "> " DUONG_DAN

mkdir -p WM_CHO WM_XONG

export PYTHONUTF8=1
export PYTHONIOENCODING=utf-8

echo
if [ -z "$DUONG_DAN" ]; then
    echo "[*] Xu ly het anh trong WM_CHO/"
    echo
    # shellcheck disable=SC2086
    "$PY" xoa_watermark.py $THAM_SO
else
    echo "[*] Xu ly duong dan ban vua keo vao"
    echo
    # duong dan Finder keo vao co dau nhay / dau cach -> nho eval de tach cho dung
    # shellcheck disable=SC2086,SC2294
    eval "\"$PY\" xoa_watermark.py $THAM_SO" $DUONG_DAN
fi

MA=$?
echo
echo "============================================================"
if [ "$MA" = "0" ]; then
    if [ "$CHON" = "8" ]; then
        echo "  DA VE KHUNG DO. Mo WM_XONG/ xem file *_xem_truoc.png"
        echo "  Khung chua trum dung watermark thi chay lai, chon goc khac."
    else
        echo "  XONG HET. Anh sach nam trong  WM_XONG/"
        echo "  Anh goc van con nguyen, khong bi dong vao."
    fi
elif [ "$MA" = "1" ]; then
    echo "  XONG NHUNG CON FILE HONG. Xem dong [LOI] o tren."
else
    echo "  CO LOI (ma $MA). Xem chi tiet trong thu muc logs/"
fi
echo "============================================================"
echo

read -r -p "Bam Enter de dong cua so..."
exit $MA

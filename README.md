# TAO_VOICE — đọc kịch bản .txt thành WAV + SRT (Windows, CPU-only)

Tool chạy hàng loạt: quét thư mục `KB_CHO/`, mỗi file `.txt` là một kịch bản, đọc thành
giọng nói bằng [pocket-tts](https://github.com/kyutai-labs/pocket-tts) của Kyutai
(100M tham số, chạy CPU, không cần card đồ hoạ, không cần API), rồi xuất `WAV + SRT`
vào `XONG/`. Phụ đề lấy mốc thời gian bằng `faster-whisper` nhưng **giữ nguyên chữ của
kịch bản gốc**, không dùng chữ whisper đoán ra.

---

## 1. Cài đặt (làm 1 lần)

1. Cài **Python 3.11** — https://www.python.org/downloads/
   Lúc cài **nhớ tích ô “Add python.exe to PATH”**.
2. Bấm đúp **`CAI_DAT.bat`**.
   Nó tạo môi trường riêng `.venv\`, cài PyTorch bản CPU, `pocket-tts`,
   `faster-whisper`, rồi tự chạy một bài tự kiểm tra.

Lần chạy thật đầu tiên, tool còn tải model về (~vài trăm MB, lưu trong cache của
HuggingFace) nên sẽ lâu. Những lần sau chạy ngay.

## 2. Chuẩn bị

**a. File giọng mẫu** → bỏ vào `voices\`, đặt tên theo kênh:

```
voices\TERCO1.wav      voices\GODSAYS.wav      voices\RUNGWORK.wav
```

Yêu cầu: **WAV 16-bit PCM mono, 10–30 giây**, một người nói liền mạch, không nhạc nền.
(mp3/m4a cũng chạy được, tool tự chuyển, nhưng WAV 16-bit cho kết quả tốt nhất)

**b. Khai báo kênh** trong `channels.json`:

```json
"kenh": {
  "TERCO1":  { "model": "portuguese", "voice": "TERCO1.wav"  },
  "GODSAYS": { "model": "english",    "voice": "GODSAYS.wav" }
}
```

**c. Kịch bản** → bỏ vào `KB_CHO\`, tên file **bắt đầu bằng tiền tố kênh**:

```
KB_CHO\TERCO1_video_01.txt      -> model portuguese + voices\TERCO1.wav
KB_CHO\GODSAYS_05.txt           -> model english    + voices\GODSAYS.wav
```

Tiền tố là phần trước dấu `_`, `-`, `.` hoặc khoảng trắng đầu tiên; không phân biệt
hoa thường (`godsays-05.txt` cũng ra `GODSAYS`).
Tiền tố chưa khai báo → tool dùng cấu hình `mac_dinh` và ghi cảnh báo vào log.

## 3. Chạy

| Cách | Làm gì |
|---|---|
| **Kéo thả** file `.txt` hoặc cả thư mục vào `TAO_VOICE.bat` | chỉ chạy đúng những thứ được kéo vào |
| **Bấm đúp** `TAO_VOICE.bat` | chạy hết hàng đợi trong `KB_CHO\` |
| `python tao_voice.py` | như trên, chạy từ dòng lệnh |

Chạy **tuần tự** hết hàng đợi, mỗi lần một file. Một file lỗi thì ghi log rồi đi tiếp,
không làm chết cả hàng đợi. Bấm `Ctrl+C` để dừng — những file đã xong vẫn nằm trong `XONG\`.

Kết quả:

```
XONG\TERCO1_video_01.wav     (24 kHz, mono, 16-bit)
XONG\TERCO1_video_01.srt
logs\tao_voice_2026-07-29.log
```

File nào đã có `.wav` trong `XONG\` thì lần chạy sau **bỏ qua**. Muốn làm lại thì thêm
`--lam-lai` (hoặc xoá file `.wav` cũ đi).

## 4. Quy ước ngắt trong file kịch bản

| Viết trong file .txt | Kết quả |
|---|---|
| Kết câu bằng `.` `!` `?` `…` | **nghỉ ngắn** (mặc định 0.30s) |
| Câu cuối đoạn + **một dòng trống** ở dưới | **nghỉ dài** (mặc định 0.85s) |
| Dòng chỉ có `---` | **nghỉ rất dài** (mặc định 1.60s) |
| `[nghi=2.5]` hoặc `[pause=2.5]` trên một dòng riêng | nghỉ **đúng 2.5 giây** |
| Dòng bắt đầu bằng `#` hoặc `//` | ghi chú, **không đọc** |
| Dòng dạng `[INTRO]`, `[B-ROLL: ...]` | chỉ dẫn sản xuất, **không đọc** |

Ví dụ:

```
[HOOK]
Câu một. Câu hai cùng đoạn, nghỉ ngắn giữa hai câu.

Đoạn mới sau dòng trống nên câu trên được nghỉ dài.

---
Sau vạch ngang là nghỉ rất dài.
```

Các độ dài nghỉ chỉnh được cho từng kênh trong `channels.json`
(`nghi_ngan`, `nghi_dai`, `nghi_doan_dai`, `duoi_file` — đơn vị giây).

Tool **không cắt nhầm** ở `Mr.`, `Dr.`, `U.S.`, `3.5`, `$85,000` hay `Level 1. Junior.`

## 5. Tuỳ chọn dòng lệnh

```
python tao_voice.py [file/thư mục ...] [tuỳ chọn]

--lam-lai                 làm lại cả file đã có trong XONG
--khong-srt               chỉ xuất WAV, bỏ qua whisper (nhanh hơn nhiều)
--whisper-model small     tiny | base | small | medium | large-v3  (mặc định small)
--luong 4                 số luồng CPU
--temperature 0.6         ép temperature cho mọi kênh
--khong-cat-lang          giữ nguyên khoảng lặng model tự sinh ở đầu/cuối câu
--khong-chuan-am-luong    không chuẩn hoá biên độ về -1 dBFS
--chia-thu-muc            xuất vào XONG\<TÊN_KÊNH>\
--chuyen-kich-ban         chuyển .txt đã chạy sang XONG\KB_DA_CHAY\
--theo-thu-tu-ten         chạy đúng thứ tự tên file (mặc định gom theo model cho nhanh)
--chi-tiet                in thêm log gỡ rối
--tu-kiem-tra             chạy thử đường ống, không cần model, không cần mạng
```

Mặc định hàng đợi được **gom theo model** để mỗi model chỉ phải nạp một lần —
chạy 10 file TERCO1 + 10 file GODSAYS chỉ nạp 2 model thay vì nạp đi nạp lại.

## 6. Model dùng được

`english` (mặc định), `portuguese`, `french`, `german`, `italian`, `spanish`,
và các biến thể `*_24l` (bản lớn hơn, chậm hơn, chất lượng preview), `english_2026-01`,
`english_2026-04`.

## 7. Tốc độ và bộ nhớ

pocket-tts chạy nhanh hơn thời gian thực trên CPU thường (nhà làm ra đo được ~6x trên
MacBook Air M4, PC Windows tầm trung thường 1.5–3x). Một kịch bản 10 phút mất cỡ
5–10 phút đọc, cộng thêm phần whisper.

Muốn nhanh hơn:
- `--khong-srt` rồi làm phụ đề sau
- `--whisper-model tiny` hoặc `base`
- `--luong 4` (thường không nên vượt số nhân vật lý)

RAM: mỗi model ~0.5 GB. Chạy 2 kênh khác ngôn ngữ trong cùng một lần thì cả hai
cùng nằm trong RAM.

## 8. Hỏng thì xem đâu

Mọi thứ đều ghi vào `logs\tao_voice_<ngày>.log` (log file chi tiết hơn màn hình).

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| `Khong tim thay Python` | chưa tích “Add python.exe to PATH” lúc cài Python |
| `Thieu thu vien pocket-tts` | chưa chạy `CAI_DAT.bat` |
| `Khong co file giong mau` | thiếu file trong `voices\` → đang dùng giọng có sẵn của model |
| Giọng ra rè, méo | file giọng mẫu không phải WAV 16-bit, hoặc có nhạc nền |
| Giọng không giống mẫu | mẫu quá ngắn / nhiều người nói / sai ngôn ngữ so với model |
| SRT lệch | đổi `--whisper-model medium`; nếu thiếu faster-whisper thì SRT chỉ là ước lượng |
| Chạy chậm bất thường | `--luong` để quá cao, hoặc đang dùng model `*_24l` |

Xoá `.cache_voice\` nếu muốn tool mã hoá lại giọng mẫu từ đầu.

## 9. Cấu trúc thư mục

```
Tool-tao-voice\
├─ TAO_VOICE.bat       ← kéo thả / bấm đúp để chạy
├─ CAI_DAT.bat         ← cài đặt 1 lần
├─ tao_voice.py        ← toàn bộ tool
├─ channels.json       ← khai báo kênh: model + giọng + độ dài nghỉ
├─ requirements.txt
├─ KB_CHO\             ← bỏ kịch bản .txt vào đây
├─ voices\             ← bỏ giọng mẫu vào đây
├─ XONG\               ← WAV + SRT xuất ra đây
├─ logs\               ← log theo ngày
└─ .cache_voice\       ← cache giọng đã mã hoá + model whisper (tự tạo)
```

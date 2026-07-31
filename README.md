> Repo này có 2 tool:
> Thích bấm nút hơn gõ lệnh? Xem **[GIAO DIỆN WEB](README_GIAODIEN.md)** — bấm đúp `GIAO_DIEN.bat`.
>
> **TAO_VOICE** (dưới đây) đọc kịch bản thành giọng nói, và
> **[TAO_ANH](README_ANH.md)** tạo ảnh AI hàng loạt cho 5 kênh.

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

**a. Nạp giọng mẫu để clone** → kéo thả file audio vào **`THEM_GIONG.bat`**.

Nó hỏi tên kênh + ngôn ngữ rồi tự làm hết: kiểm tra chất lượng mẫu, chuyển sang WAV
16-bit mono, cắt khoảng lặng thừa, giới hạn 30 giây (cắt đúng chỗ im lặng cho khỏi
đứt giữa từ), chuẩn âm lượng, lưu vào `voices\<KÊNH>.wav`, ghi luôn vào `channels.json`,
rồi **đọc thử một câu** để bạn nghe trước — mở ra ngay sau khi chạy xong.

Nhận `wav`, `mp3`, `m4a`, `flac`, `ogg`. Giọng cũ cùng kênh được đổi tên giữ lại
(`TERCO1_cu_20260729_143012.wav`), không mất.

Mẫu tốt: **10–30 giây**, một người nói liền mạch, **không nhạc nền**, không tiếng ồn,
đúng ngôn ngữ của model. Tool sẽ cảnh báo nếu mẫu quá ngắn, ồn, vỡ tiếng, sample rate
thấp, hoặc quá nhiều khoảng lặng — dưới 4 giây thì từ chối luôn.

Chạy bằng dòng lệnh cũng được, có thêm chọn đoạn:

```
python tao_voice.py --them-giong "D:\thu\cha_A.mp3" --kenh TERCO1 --model portuguese --tu 12 --den 38
```

> Không có gì được tải lên mạng. pocket-tts clone giọng ngay trên máy bạn;
> mạng chỉ dùng đúng một lần để tải trọng số model về.

**b. Khai báo kênh** — `THEM_GIONG.bat` đã ghi sẵn, chỉ sửa `channels.json` khi cần
đổi độ dài nghỉ hay temperature:

```json
"kenh": {
  "TERCO1":  { "model": "portuguese", "voice": "TERCO1.wav", "nghi_dai": 1.0 },
  "GODSAYS": { "model": "english",    "voice": "GODSAYS.wav" }
}
```

Muốn bỏ file giọng vào tay thì cũng được: đặt tên `voices\<TÊN_KÊNH>.wav` là tool tự
nhận, nhưng nhớ xuất đúng **WAV 16-bit PCM mono**.

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
| **Kéo thả** file audio vào `THEM_GIONG.bat` | nạp giọng mẫu cho một kênh |
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

Nạp giọng mẫu:

```
python tao_voice.py --them-giong FILE [tuỳ chọn]

--kenh TERCO1             tên kênh (không có thì tool hỏi)
--model portuguese        model cho kênh đó
--tu 12  --den 38         chỉ lấy đoạn từ giây 12 đến giây 38
--ghi-de                  ghi đè giọng cũ, không giữ bản cũ
--khong-thu               nạp xong không đọc thử
--cau-thu "..."           câu dùng để đọc thử
```

Mặc định hàng đợi được **gom theo model** để mỗi model chỉ phải nạp một lần —
chạy 10 file TERCO1 + 10 file GODSAYS chỉ nạp 2 model thay vì nạp đi nạp lại.

## 6. Model dùng được

Bản `pocket-tts 2.1.0` có sẵn:

```
english   english_2026-01   english_2026-04   portuguese   portuguese_24l
german    german_24l        italian           italian_24l
spanish   spanish_24l       french_24l
```

Các bản `*_24l` là model lớn hơn (chậm hơn, đang ở dạng preview). Lưu ý **không có
`french` trơn**, chỉ có `french_24l`. Nếu gõ sai tên model, tool báo ngay tên đúng
trong log rồi chuyển sang file kế tiếp.

Về `temperature`: để `null` thì dùng mặc định của thư viện (bản 2.1.0 là `0.7`).
Muốn giọng đọc điềm đạm, đều hơn thì đặt `0.3`–`0.5`; muốn nhiều cảm xúc hơn thì `0.8`–`0.9`.

## 7. Tốc độ và bộ nhớ

pocket-tts chạy nhanh hơn thời gian thực trên CPU thường (nhà làm ra đo được ~6x trên
MacBook Air M4, PC Windows tầm trung thường 1.5–3x). Một kịch bản 10 phút mất cỡ
5–10 phút đọc, cộng thêm phần whisper.

Muốn nhanh hơn:
- **`--nhanh`** — nén model xuống int8: nhanh hơn ~27%, tốn ít RAM hơn ~48%, **giọng không đổi**.
  Máy đời cũ hoặc RAM 8 GB thì nên bật hẳn: sửa `"quantize": true` trong `channels.json`.
- **`--whisper-model base`** — phụ đề lấy *chữ từ kịch bản*, whisper chỉ đóng góp mốc thời gian,
  nên model nhỏ hơn không làm sai chữ, chỉ kém chính xác mốc một chút. Nhanh hơn `small` khoảng 2 lần.
  Muốn đặt vĩnh viễn: `setx TAO_VOICE_WHISPER base`
- `--khong-srt` rồi làm phụ đề sau
- `--luong 4` (đặt bằng số **nhân vật lý**, không tính siêu phân luồng; đặt cao hơn thường chậm hơn)

RAM: mỗi model ~0.5 GB. Chạy 2 kênh khác ngôn ngữ trong cùng một lần thì cả hai
cùng nằm trong RAM.

## 8. Hỏng thì xem đâu

Mọi thứ đều ghi vào `logs\tao_voice_<ngày>.log` (log file chi tiết hơn màn hình).

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| `Khong tim thay Python` | chưa tích “Add python.exe to PATH” lúc cài Python |
| `Thieu thu vien pocket-tts` | chưa chạy `CAI_DAT.bat` |
| `Khong co file giong mau` | thiếu file trong `voices\` → đang dùng giọng có sẵn của model |
| Giọng ra rè, méo | mẫu bị vỡ tiếng hoặc có nhạc nền — nạp lại bằng `THEM_GIONG.bat` |
| Giọng không giống mẫu | mẫu quá ngắn / nhiều người nói / sai ngôn ngữ so với model |
| Nạp giọng bị từ chối | mẫu dưới 4 giây; dùng `--tu`/`--den` để lấy đúng đoạn nói |
| SRT lệch | đổi `--whisper-model medium`; nếu thiếu faster-whisper thì SRT chỉ là ước lượng |
| Chạy chậm bất thường | `--luong` để quá cao, hoặc đang dùng model `*_24l` |

Xoá `.cache_voice\` nếu muốn tool mã hoá lại giọng mẫu từ đầu.

## 9. Cấu trúc thư mục

```
Tool-tao-voice\
├─ TAO_VOICE.bat       ← kéo thả / bấm đúp để chạy
├─ THEM_GIONG.bat      ← kéo thả file audio để nạp giọng clone
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

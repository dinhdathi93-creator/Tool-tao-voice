# GIAO DIỆN WEB — đọc kịch bản bằng trình duyệt

Không cần gõ lệnh, không cần kéo thả file. Bấm đúp **`GIAO_DIEN.bat`**, trình duyệt tự mở
`http://localhost:8777`, gõ chữ vào ô rồi bấm **Tạo giọng**.

Mọi thứ chạy trên máy bạn — model, giọng mẫu, bản thu đều nằm trong máy, không có gì gửi
lên mạng. Không tài khoản, không hạn mức, không tốn tiền.

## Làm được gì

| | |
|---|---|
| Ngôn ngữ | **English**, **Português (Brasil)**, **Español** |
| Clone giọng | Bấm *Nạp giọng mới*, chọn file audio 10–30 giây — dùng được ngay |
| **Tốc độ đọc** | Thanh trượt 0.70x–1.30x — **cao độ không đổi**, không bị méo giọng |
| **Cao độ giọng** | Thanh trượt −4 → +4 nửa cung — **độ dài không đổi**, kéo xuống là giọng trầm hơn |
| Ngắt nghỉ | `<break time="1s"/>` đặt ngay trong câu · dấu chấm = nghỉ ngắn · dòng trống = nghỉ dài · `---` = nghỉ rất dài |
| Chỉnh độ dài nghỉ | 2 ô số ngay trên giao diện |
| Xuất | Nghe thử tại chỗ, tải **WAV** và **SRT** (bật sẵn) — lưu luôn ở `XONG\web\` |
| Tiến độ | Thanh chạy + đang đọc câu mấy trên mấy |

Bản thu lưu ở `XONG\web\`, đặt tên theo ngày giờ.

## Không làm được (so với các web TTS trả phí)

Engine `pocket-tts` chạy trên CPU không có những thứ này — nói trước để khỏi mất công tìm:

- **Tag cảm xúc** `[laughter]`, `[whispering]`, `[sigh]`… — engine không hiểu, sẽ đọc
  nguyên chữ đó ra. Muốn nhấn nhá thì đổi **file giọng mẫu** cho hợp cảm xúc mong muốn.
- **Lồng tiếng theo timeline file SRT có sẵn** — công cụ này sinh SRT *ra*, không đọc theo SRT *vào*.
- **Từ điển phát âm** — chưa có. Cách vòng: viết lại chữ theo cách đọc (ví dụ `Terço` → `Tersso`).

## Chạy hàng loạt thì vẫn dùng `TAO_VOICE.bat`

Giao diện web hợp để **thử giọng, làm 1–2 đoạn ngắn, nghe ngay**. Còn chạy cả hàng đợi
20 kịch bản qua đêm thì `TAO_VOICE.bat` vẫn tốt hơn: nó chạy tuần tự, bỏ qua file đã xong,
ghi log, và không cần mở trình duyệt.

Hai đường dùng chung một engine, chung thư mục `voices\`, chung `channels.json` — giọng nạp
bằng giao diện web thì `TAO_VOICE.bat` cũng thấy và ngược lại.

## Xử lý âm thanh (ô "Xu ly am thanh")

Giọng model sinh ra còn thô: có ù tần thấp, nhiễu nền nhẹ, tiếng xì chói, và câu to câu nhỏ
không đều. Bốn mức xử lý:

| Mức | Làm gì |
|---|---|
| **Chuẩn** (mặc định) | lọc ù → giảm tạp âm → bớt chói (de-esser) → EQ rõ lời → nén động → chuẩn độ to |
| Nhẹ | chỉ lọc ù + EQ + chuẩn độ to (giữ tiếng tự nhiên nhất) |
| Mạnh | như Chuẩn nhưng giảm tạp âm và nén nhiều hơn — dùng khi mẫu giọng bị ồn |
| Tắt | giữ nguyên tiếng model sinh ra |

Cụ thể chuỗi **Chuẩn** làm:

1. **Lọc thông cao 80 Hz bậc 4** — cắt ù nền, tiếng gió, rung bàn. Giọng người không có gì
   dưới đó, chỉ có tạp. Đo được: ù 45 Hz giảm **17.5 dB**, giọng 140 Hz giữ nguyên.
2. **Giảm tạp âm theo phổ** — đo nền ồn từ những khung im nhất rồi trừ đi, tối đa 9 dB.
3. **De-esser** — chỉ hạ tiếng `s`, `x`, `sh` khi nó vọt lên, không đụng chạm chỗ khác.
4. **EQ**: +1.5 dB @140 Hz (ấm hơn) · −2 dB @350 Hz (bớt đục) · +2 dB @3.2 kHz (rõ lời) ·
   −1 dB @9 kHz (bớt gắt).
5. **Nén động 2.5:1** — câu to câu nhỏ đều nhau, nghe "đã qua phòng thu".
6. **Chuẩn độ to −16 LUFS** đúng chuẩn YouTube, chặn đỉnh −1.5 dBFS bằng limiter.

Ngoài ra tool **cân mức giữa các câu** trước khi ghép (giới hạn ±4 dB) — pocket-tts sinh
từng câu riêng nên âm lượng hay giật cục, bước này làm mượt lại.

## Chỉnh giọng cho vừa tai

**Đọc nhanh quá** → kéo thanh **Tốc độ** xuống `0.90` hoặc `0.85`. Dưới `0.80` bắt đầu nghe hơi máy móc.

**Giọng mỏng, thiếu trầm** → kéo **Cao độ** xuống `−1.5` đến `−2.5`. Quá `−4` là nghe giả tạo.

**Giọng nghe vẫn "rẻ tiền"?** Xử lý hậu kỳ chỉ làm sạch được phần tạp. Ba thứ quyết định
chất giọng mà hậu kỳ không cứu được:

1. **File giọng mẫu** — mẫu ồn thì clone ra ồn, mẫu thu bằng điện thoại thì ra như điện thoại.
   Mẫu của bạn đo được 28 dB SNR, tạm được nhưng chưa sạch. Mẫu 40 dB SNR trở lên sẽ khác hẳn.
2. **Đừng dùng thanh trượt tốc độ/cao độ nếu không cần** — mỗi lần kéo là một lần xử lý thêm,
   kéo càng xa 1.00x và 0.0 thì càng lộ. Cần chậm hơn thì tìm mẫu nói chậm sẵn.
3. **Thử tắt chế độ nhanh**: sửa `"quantize": false` trong `channels.json`. Nó nén model xuống
   int8 cho chạy nhanh trên máy cũ — nhà làm ra nói chất lượng không đổi, nhưng máy bạn đủ khoẻ
   (1.3x thời gian thực) nên cứ tắt đi nghe thử, tốn thêm ~27% thời gian thôi.

**Cách tốt nhất vẫn là đổi file giọng mẫu.** pocket-tts học cả *nhịp nói* lẫn *chất giọng*
từ mẫu — mẫu nói nhanh thì đọc ra nhanh, mẫu giọng cao thì ra giọng cao. Chỉnh bằng thanh trượt
là xử lý sau, còn đổi mẫu là sửa từ gốc, luôn tự nhiên hơn. Muốn giọng trầm và chậm thì tìm mẫu
của người nói trầm và chậm sẵn, rồi mới tinh chỉnh thêm chút bằng thanh trượt.

Chạy hàng loạt thì đặt trong `channels.json` cho từng kênh:

```json
"GODSAYS": { "model": "english", "voice": "GODSAYS.wav", "toc_do": 0.88, "cao_do": -1.5 }
```

## Mẹo

- **Lần đầu bấm Tạo giọng sẽ lâu** (nạp model, có khi phải tải về). Lần sau nhanh hẳn vì
  model đã nằm sẵn trong bộ nhớ — cứ để cửa sổ đen chạy, đừng tắt.
- Đổi ngôn ngữ giữa chừng thì phải nạp model mới, lại chờ một lần nữa.
- Muốn dừng: đóng cửa sổ đen (cửa sổ chạy `GIAO_DIEN.bat`).
- Máy khác trong nhà **không** vào được — cố ý vậy cho an toàn, chỉ mở ở `localhost`.

## Thẻ `<break>` — dùng chung cho cả dán tay lẫn chạy hàng loạt

Kịch bản có sẵn thẻ `<break time="1s"/>` thì **dán thẳng vào ô Script** là chạy, hoặc lưu thành
`.txt` rồi **thả vào `TAO_VOICE.bat`** để chạy hàng loạt. Cùng một bộ quy ước, không phải sửa gì
giữa hai đường.

```
<speak>
Em nome do Pai, do Filho e do Espirito Santo. <break time="1s"/> Amem.

<break time="2.5s"/>

Hoje vamos rezar o terco juntos. <break time="800ms"/> Comecamos agora.
</speak>
```

Nhận `1s`, `2.5s`, `500ms`, và `strength="weak|medium|strong|x-strong"`. Thẻ SSML khác
(`<speak>`, `<p>`, `<prosody>`…) tự bị bỏ nên không lọt vào lời đọc.

Đặt thẻ **giữa câu** cũng được — tool cắt câu ngay tại đó rồi chèn khoảng lặng đúng bằng thời
gian bạn ghi.

## Phụ đề SRT

Ô **Xuất kèm phụ đề .srt** bật sẵn. Xong là có hai nút: **Tải WAV** và **Tải SRT**, và cả hai
file đã nằm sẵn trong `XONG\web\` cùng tên, chỉ khác đuôi.

Chữ trong SRT lấy **từ chính kịch bản bạn nhập**, không phải chữ whisper đoán ra — whisper chỉ
đóng góp mốc thời gian. Nên phụ đề không bao giờ sai chính tả hay nghe nhầm từ.

Thẻ `<break>` cũng vào đúng mốc: `<break time="1s"/>` giữa hai câu thì trong SRT hai phụ đề đó
cách nhau đúng 1 giây.

Lần đầu bật sẽ tải model nhận dạng về (~145 MB với `base`). Muốn nhanh hơn nữa thì sửa
`"whisper_model": "tiny"` trong `channels.json`.

Giao diện **nhớ lựa chọn** của bạn (SRT, tốc độ, cao độ, độ dài nghỉ) cho lần mở sau.

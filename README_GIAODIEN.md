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
| Xuất | Nghe thử tại chỗ, tải **WAV**, tuỳ chọn kèm **SRT** |
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

## Chỉnh giọng cho vừa tai

**Đọc nhanh quá** → kéo thanh **Tốc độ** xuống `0.90` hoặc `0.85`. Dưới `0.80` bắt đầu nghe hơi máy móc.

**Giọng mỏng, thiếu trầm** → kéo **Cao độ** xuống `−1.5` đến `−2.5`. Quá `−4` là nghe giả tạo.

**Nhưng cách tốt nhất vẫn là đổi file giọng mẫu.** pocket-tts học cả *nhịp nói* lẫn *chất giọng*
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

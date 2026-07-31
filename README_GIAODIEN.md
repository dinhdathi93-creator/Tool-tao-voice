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
| Ngắt nghỉ | Dấu chấm = nghỉ ngắn, dòng trống = nghỉ dài, `---` = nghỉ rất dài, `[nghi=2.5]` |
| Chỉnh độ dài nghỉ | 2 ô số ngay trên giao diện |
| Xuất | Nghe thử tại chỗ, tải **WAV**, tuỳ chọn kèm **SRT** |
| Tiến độ | Thanh chạy + đang đọc câu mấy trên mấy |

Bản thu lưu ở `XONG\web\`, đặt tên theo ngày giờ.

## Không làm được (so với các web TTS trả phí)

Engine `pocket-tts` chạy trên CPU không có những thứ này — nói trước để khỏi mất công tìm:

- **Tag cảm xúc** `[laughter]`, `[whispering]`, `[sigh]`… — engine không hiểu, sẽ đọc
  nguyên chữ đó ra. Muốn nhấn nhá thì đổi **file giọng mẫu** cho hợp cảm xúc mong muốn.
- **Chỉnh tốc độ đọc** — không có tham số này. Muốn nhanh/chậm thì chỉnh trong phần mềm dựng video.
- **Lồng tiếng theo timeline file SRT có sẵn** — công cụ này sinh SRT *ra*, không đọc theo SRT *vào*.
- **Từ điển phát âm** — chưa có. Cách vòng: viết lại chữ theo cách đọc (ví dụ `Terço` → `Tersso`).

## Chạy hàng loạt thì vẫn dùng `TAO_VOICE.bat`

Giao diện web hợp để **thử giọng, làm 1–2 đoạn ngắn, nghe ngay**. Còn chạy cả hàng đợi
20 kịch bản qua đêm thì `TAO_VOICE.bat` vẫn tốt hơn: nó chạy tuần tự, bỏ qua file đã xong,
ghi log, và không cần mở trình duyệt.

Hai đường dùng chung một engine, chung thư mục `voices\`, chung `channels.json` — giọng nạp
bằng giao diện web thì `TAO_VOICE.bat` cũng thấy và ngược lại.

## Mẹo

- **Lần đầu bấm Tạo giọng sẽ lâu** (nạp model, có khi phải tải về). Lần sau nhanh hẳn vì
  model đã nằm sẵn trong bộ nhớ — cứ để cửa sổ đen chạy, đừng tắt.
- Đổi ngôn ngữ giữa chừng thì phải nạp model mới, lại chờ một lần nữa.
- Muốn dừng: đóng cửa sổ đen (cửa sổ chạy `GIAO_DIEN.bat`).
- Máy khác trong nhà **không** vào được — cố ý vậy cho an toàn, chỉ mở ở `localhost`.

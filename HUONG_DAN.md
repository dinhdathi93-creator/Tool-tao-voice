# Hướng dẫn cài đặt & sử dụng — tiện ích xoá watermark ảnh Flow

Xoá dấu ✦ của Flow trên ảnh **của chính bạn**, xử lý **ngay trong máy** — ảnh không gửi đi
đâu, không cần mạng, không cần Python. Viết cho máy Mac, Windows làm y hệt.

Bạn nhận được 2 file: `TIEN_ICH_CHROME_v1.9.0.zip` và `THU_1_ANH.html`.

---

## Phần 1 — Cài tiện ích vào Chrome

1. **Giải nén file zip** → được thư mục `chrome_xoa_watermark`. Chuyển nó tới **một chỗ cố
   định**, ví dụ `~/Documents/`. Xoá hay đổi chỗ thư mục này là Chrome mất tiện ích. Đừng để
   trong `Downloads` (macOS hay tự dọn).
2. Mở Chrome → gõ `chrome://extensions` vào thanh địa chỉ → Enter.
3. Bật **Chế độ dành cho nhà phát triển** (*Developer mode*) — công tắc góc trên bên phải.
4. Bấm **Tải tiện ích đã giải nén** (*Load unpacked*) → chọn thư mục `chrome_xoa_watermark`
   (thư mục có file `manifest.json` nằm trực tiếp bên trong).
5. Bấm biểu tượng mảnh ghép trên thanh công cụ → **ghim** *Xoa watermark* ra ngoài.

**Bình thường:** mỗi lần mở Chrome sẽ nhắc *“Tắt tiện ích ở chế độ nhà phát triển”* — bấm bỏ
qua.

**Trình duyệt dùng được:** Chrome, Edge, Brave, Vivaldi, Arc, Opera (Edge vào
`edge://extensions`). **Safari thì không** — định dạng khác hẳn, phải đóng gói bằng Xcode.

---

## Phần 2 — Thử trước bằng `THU_1_ANH.html`

File này **bấm đúp là chạy**, không cần cài gì, không cần mạng.

1. **Chọn cả nhóm 6–10 ảnh** cùng dự án rồi thả vào ô lớn. Nhớ chọn cả mấy ảnh khó (logo đè
   lên người, lên đồ vật). Kéo cả nhóm cùng lúc, đừng thả từng ảnh.
2. Đợi vài giây (*“Đang học lớp phủ của logo…”*), rồi **đọc dòng mô tả** dưới hàng nút ◀ ▶.
   Thấy **“cách: gỡ lớp phủ, học từ N ảnh”** là chuẩn.
3. Bấm **◀ ▶ lật từng ảnh**, soi khung **“Soi ở mức pixel (phóng to 4×)”**. Logo bé như dấu ✦
   thì nhìn ảnh thu nhỏ không thấy gì — phải soi ở mức này.
4. Ưng thì bấm **⬇ Tải ảnh đã xoá** để xem file thật.

> ⛔ **Dưới 4 ảnh, tool cố ý không xoá gì cả** — nó để nguyên ảnh và hiện cảnh báo đỏ. Với một
> ảnh đơn, không cách nào phân biệt được logo mờ với nét trắng của chính hình vẽ (bàn chân
> hình que còn sáng hơn watermark nhiều), vá bừa vào là nát chỗ đó mà logo vẫn còn. Cần **từ
> 4 ảnh**; **6–10 ảnh** thì chắc ăn nhất.

---

## Phần 3 — Xoá cả dự án: chọn 1 trong 2 đường

Hai đường cho kết quả **y hệt nhau**, dùng chung một lõi xử lý.

### Đường A — bật nút gạt, tải dự án như bình thường

1. Bấm biểu tượng tiện ích → gạt **Xoá watermark** sang bật.
2. Vào `labs.google/flow` làm việc như thường. Góc dưới bên phải hiện ô nhỏ báo đang bật.
3. Bấm **tải dự án**. Tiện ích chặn file lại, xoá từng ảnh (có thanh tiến độ), rồi trả lại
   đúng file zip đó cho bạn tải xuống.

**Đừng đóng tab Flow trong lúc nó chạy** — xử lý diễn ra ngay trong tab đó. Xong thì file tự
tải xuống, và ô nhỏ hiện thêm nút **⬇ Tải …** để bấm tay phòng khi Chrome chặn tải tự động.

### Đường B — ảnh đã tải về rồi, thả zip vào

1. Tải dự án về như bình thường (cứ để nguyên watermark).
2. Bấm biểu tượng tiện ích → **Mở trang xử lý gói zip**.
3. Kéo file `.zip` vào trang đó — hoặc kéo thẳng cả nhóm file ảnh rời.
4. Trang hiện **2 ảnh soi trước**: khung đỏ nó định xử lý, và kết quả thử trên 1 ảnh. Ưng thì
   bấm **Xử lý toàn bộ và tải xuống**.

Khung đỏ sai chỗ? **Kéo chuột khoanh lại ngay trên ảnh bên trái** — khung đó dùng cho toàn bộ
gói. Bấm **Phóng to chỗ đang khoanh** để soi trước/sau ở mức pixel.

Khuyên dùng đường B cho lô lớn: soi trước 1 ảnh rồi mới chạy 200 ảnh.

> ✅ Xong thì kiểm: dòng kết quả phải ghi **“Cách dùng: gỡ lớp phủ (học từ N ảnh)”**. Nếu ghi
> *“vá theo cấu trúc nền”* thì tool không học được lớp phủ — xem phần Xử lý sự cố.

---

## Phần 4 — Ba điều kiện để xoá sạch

| Điều kiện | Vì sao |
|---|---|
| Từ 4 ảnh trở lên | Cần nhiều ảnh để loại được mấy ảnh có vật thể nằm ngay dưới logo. 6–10 ảnh thì chắc. |
| Cùng kích thước | Logo nằm cố định một chỗ nên toạ độ học được chỉ đúng cho ảnh cùng cỡ. Ảnh khác cỡ được xử lý thành nhóm riêng. |
| Cùng một dự án | Logo phải giống hệt nhau ở mọi ảnh. Trộn ảnh của 2 kênh khác nhau vào là hỏng. |

---

## Phần 5 — Bảng cài đặt trong tiện ích

Bình thường **không cần đụng gì**.

| Mục | Nên chọn | Giải thích |
|---|---|---|
| Watermark nằm ở đâu | Tự động tìm | Thử học lớp phủ ở từng góc ảnh — góc nào có lớp phủ thật mới ra, nên không bám nhầm vào nét trắng của hình vẽ. Khung ôm sát đúng logo. |
| | Gõ toạ độ `x,y,rộng,cao` | Khi đã biết chính xác khung. |
| Cách xử lý | Tự chọn (gỡ lớp phủ nếu đủ ảnh) | Đủ ảnh thì gỡ lớp phủ — sạch nhất. Không đủ thì tự lùi về vá nền. |
| | Vá theo cấu trúc nền | Ép dùng cách vá. Chỉ hợp khi nền dưới logo hoàn toàn phẳng. |
| Chỉ vá đúng nét chữ | Vá cả ô | Chắc ăn. |
| Nở mặt nạ | 2 | Tăng 3–4 nếu vá xong còn viền mờ quanh chữ. |

---

## Phần 6 — Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| Cảnh báo đỏ “chưa đủ ảnh” | Thả ít hơn 4 ảnh. Chọn cả nhóm 6–10 ảnh rồi thả cùng lúc. |
| Kết quả ghi “vá theo cấu trúc nền” | Không tách được lớp phủ: ít ảnh, ảnh khác kích thước, hoặc watermark không ở góc. Thả thêm ảnh, hoặc khoanh tay quanh logo rồi chạy lại. |
| Bật nút gạt mà tải dự án không thấy gì | Flow đổi cách tải file. Popup → **Chẩn đoán** → tích *Ghi lại các link tải* → bấm tải dự án lần nữa → mở lại popup xem nhật ký, gửi tôi mấy dòng đó. Trong lúc chờ dùng đường B. |
| Chrome không cho tải file về | Ô nhỏ trong Flow có nút **⬇ Tải …** — bấm tay. |
| Mất tiện ích sau khi khởi động lại | Thư mục `chrome_xoa_watermark` bị xoá hoặc đổi chỗ. Để cố định rồi cài lại. |
| Vẫn còn vệt mờ | Chụp khung **phóng to 4×** trong `THU_1_ANH.html` và nói rõ thả bao nhiêu ảnh. |

---

## Phần 7 — Ảnh ra có mất chất lượng không

- **PNG → PNG:** không mất gì.
- **JPG → JPG:** mã hoá lại ở chất lượng 95 — mắt thường không thấy khác.
- Ảnh **không** bị đổi kích thước; tên file và cấu trúc thư mục trong zip giữ nguyên.
- File không phải ảnh (`.txt`, `.json`, video…) được chép nguyên.
- Ảnh nào lỗi thì **giữ nguyên bản gốc** trong gói ra và được liệt kê ở cuối.
- Zip ra ghi kiểu *store* nên có thể to hơn zip gốc một chút.

> Tiện ích chỉ xoá **logo nhìn thấy được**. Ảnh Google sinh ra còn có **SynthID** — watermark
> chìm trong chính các điểm ảnh, mắt không thấy, tiện ích này không đụng tới và cũng không có
> cách nào gỡ. Đăng YouTube thì phần khai báo “nội dung tổng hợp” vẫn phải khai như thường.
>
> Dùng cho ảnh **của chính bạn** — ảnh bạn tạo trong Flow bằng tài khoản của bạn.

---

Bản chạy trên máy (hàng loạt, có cả video): macOS bấm đúp `XOA_WATERMARK.command`, Windows kéo
thả vào `XOA_WATERMARK.bat` — cùng thuật toán, chạy bằng Python. Xem
[README_WATERMARK.md](README_WATERMARK.md). Chi tiết kỹ thuật của tiện ích:
[README_CHROME.md](README_CHROME.md).

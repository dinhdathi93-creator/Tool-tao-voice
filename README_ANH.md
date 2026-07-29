# TAO_ANH — tạo ảnh AI hàng loạt cho 5 kênh (Windows, Python 3)

Quét `PROMPT_CHO/`, mỗi file `.txt` là một danh sách prompt ảnh. Tiền tố tên file quyết
định kênh, mỗi prompt tự chọn nguồn ảnh (**Gemini image “nano banana”** cho ảnh có người,
**Pollinations flux** miễn phí cho phong cảnh/vật), xuất **1920×1080** thẳng vào thư mục
kho ảnh của từng kênh.

---

## 1. Cài đặt

Bấm đúp `CAI_DAT.bat` (đã cài chung với tool giọng), hoặc chỉ cần:

```
pip install pillow
```

Phần gọi API dùng `urllib` có sẵn của Python — không cần thư viện nào khác.

**Lấy API key Gemini:** https://aistudio.google.com/apikey → tạo vài key (mỗi key một
project) rồi dán hết vào `config.json`. Càng nhiều key càng chạy được lâu trước khi
đụng quota.

## 2. Cấu hình `config.json`

```json
"gemini": {
  "api_keys": ["AIza...key1", "AIza...key2", "AIza...key3"],
  "model": "gemini-2.5-flash-image",
  "aspect_ratio": "16:9",
  "image_size": "2K"
},
"kenh": {
  "RUNGWORK": { "thu_muc_ra": "D:\\KHO_ANH_RUNGWORK", "model": "gemini", "cam_du_phong": true },
  "TERCO1":   { "thu_muc_ra": "D:\\KHO_ANH_TERCO1",   "model": "auto" },
  "TERCO2":   { "thu_muc_ra": "D:\\KHO_ANH_TERCO2",   "model": "auto" },
  "TERCO3":   { "thu_muc_ra": "D:\\KHO_ANH_TERCO3",   "model": "auto" },
  "GODSAYS":  { "thu_muc_ra": "D:\\KHO_ANH_GODSAYS",  "model": "auto" }
}
```

Đường dẫn Windows trong JSON phải viết **hai** dấu gạch ngược: `D:\\KHO_ANH_TERCO1`.

| Khoá | Ý nghĩa |
|---|---|
| `model: "auto"` | tự chọn theo tag `[P]` và từ khoá (mặc định) |
| `model: "gemini"` | ép mọi prompt của kênh này đi Gemini |
| `model: "pollinations"` | ép mọi prompt đi Pollinations (không tốn quota) |
| `cam_du_phong: true` | **cấm** rơi xuống Pollinations — hết quota thì chờ chạy bù |
| `chung.uu_tien` | kênh chạy trước trong hàng đợi (mặc định `RUNGWORK`) |
| `pollinations.cach_nhau_giay` | 15 giây — giới hạn tài khoản ẩn danh của Pollinations |
| `pollinations.token` | có token thì dán vào để chạy nhanh hơn 15s/ảnh |

## 3. Viết file prompt

Tên file **bắt đầu bằng tiền tố kênh**: `RUNGWORK_11.txt`, `TERCO1_video03.txt`, `GODSAYS_05.txt`

Trong file, viết **mỗi prompt một dòng**, hoặc **mỗi prompt một khối cách nhau dòng trống**
(prompt dài xuống dòng thoải mái). Tool tự nhận ra kiểu file và ghi vào log.

| Ký hiệu | Tác dụng |
|---|---|
| `[P]` đầu dòng | ép prompt này đi **Gemini** (tag bị gỡ trước khi gọi API) |
| `[#7]` đầu dòng | ép số thứ tự = 7 (file `loi_*.txt` dùng cái này để chạy bù không lệch beat) |
| `1.` `2)` `- ` đầu dòng | tự gỡ, không lọt vào prompt |
| `#` hoặc `//` đầu dòng | ghi chú, không tạo ảnh |

## 4. Chạy

| Cách | Làm gì |
|---|---|
| **Kéo thả** file `.txt` hoặc thư mục vào `TAO_ANH.bat` | chỉ chạy đúng thứ được kéo vào |
| **Bấm đúp** `TAO_ANH.bat` | chạy hết hàng đợi trong `PROMPT_CHO\` |
| `python tao_anh.py` | như trên, từ dòng lệnh |

Chạy **tuần tự**, `RUNGWORK` được xếp lên đầu hàng đợi vì nặng Gemini nhất. File chạy xong
chuyển sang `PROMPT_XONG\`.

## 5. Cách tool chọn nguồn ảnh

Thứ tự ưu tiên: **ép theo kênh → tag `[P]` → từ khoá → mặc định**

1. `model` của kênh là `gemini`/`pollinations` → ép cứng, khỏi đoán.
2. Prompt mở đầu `[P]` → Gemini.
3. Prompt có từ khoá người (`woman, man, person, people, face, hands, child, monk,
   priest, figure, crowd, praying, kneeling…` và tiếng Bồ/Tây Ban Nha: `mulher, homem,
   pessoa, rosto, maos, crianca, monge, padre, multidao, rezando, ajoelhado…`) → Gemini.
4. Từ khoá phân vân (`silhouette, shadow, statue, angel, reflection, group, wedding…`)
   → cũng Gemini, vì **phân vân thì chọn Gemini**.
5. Còn lại → Pollinations.

Tool **hiểu phủ định**: `no people`, `without a person`, `sem pessoas`, `no one`, `no humans`
→ vẫn tính là ảnh không người, đi Pollinations, không phí quota Gemini.

## 6. Hết quota thì sao

- Nhiều key trong `api_keys` → gặp `429` là **đổi sang key kế tiếp** ngay.
- Hết sạch key → **ngủ chờ** rồi chạy bù, thời gian chờ tăng dần (60s → 2 phút → 4 phút →
  tối đa 15 phút), và tôn trọng `retryDelay` Google trả về. **Không bỏ prompt nào.**
- Key sai hoặc bị thu hồi (`API key not valid`) → bỏ hẳn key đó, ghi log, chạy tiếp bằng
  key còn lại. Hết sạch key sống thì báo lỗi rõ chứ không chờ vô ích.
- Kênh `cam_du_phong: true` (RUNGWORK) **không bao giờ** rơi xuống Pollinations, kể cả khi
  lỗi hay hết quota — chờ đến khi Gemini chạy được.
- Kênh khác: Gemini hỏng hẳn thì hạ xuống Pollinations để không tắc hàng đợi.

Bấm `Ctrl+C` lúc nào cũng được — ảnh đã tạo vẫn còn, chạy lại sẽ bỏ qua ảnh đã có.

## 7. Ảnh xuất ra

- Kích thước đúng **1920×1080** (phóng theo cạnh thiếu rồi cắt giữa, không kéo méo hình).
- Tên file: `001_mo_ta_ngan_tu_prompt.png` — số thứ tự **đúng thứ tự prompt trong file**,
  nên ảnh RUNGWORK khớp beat luôn, không cần đánh số lại.
- Ký tự Windows cấm (`\ / : * ? " < > |`) và dấu tiếng Việt đều bị lược khỏi tên file.
- Đổi sang JPEG: `"anh": { "dinh_dang": "jpg", "chat_luong_jpg": 95 }`.
- Ảnh chỉ được tính là xong khi **đúng định dạng ảnh thật và > 20 KB**.

## 8. Ảnh lỗi và chạy bù

Mỗi ảnh lỗi được thử lại **3 lần**. Vẫn hỏng thì prompt được ghi vào
`PROMPT_CHO\loi_<tên file gốc>.txt`, kèm lý do dưới dạng ghi chú:

```
# 1 prompt hong tu RUNGWORK_11.txt luc 2026-07-29 14:30
# Tha lai file nay vao TAO_ANH.bat de chay bu. [#so] giu dung so thu tu anh.

# loi: bi chan boi bo loc (IMAGE_SAFETY)
[#3] Flat vector stickman illustration, a CTO in a glass office
```

Thả lại file đó vào `TAO_ANH.bat` là chạy bù — `[#3]` giữ nguyên số thứ tự nên ảnh vẫn
đúng beat. File `loi_*.txt` nằm sẵn trong `PROMPT_CHO\` nên lần chạy đầy đủ kế tiếp cũng
tự nhặt lên. Xong hết thì tool tự xoá file lỗi cũ.

## 9. Tuỳ chọn dòng lệnh

```
python tao_anh.py [file/thư mục ...] [tuỳ chọn]

--lam-lai           tạo lại cả ảnh đã có
--chi-gemini        ép tất cả đi Gemini, cấm hạ xuống Pollinations
--chi-pollinations  ép tất cả đi Pollinations (không tốn quota, để test prompt)
--giu-file          không chuyển .txt sang PROMPT_XONG khi xong
--chi-tiet          in thêm log gỡ rối (có ghi lý do chọn engine của từng prompt)
--tu-kiem-tra       chạy thử toàn bộ đường ống, không gọi API, không tốn quota
```

## 10. Hỏng thì xem đâu

Log ghi ở `logs\tao_anh_<ngày>.log`. Tổng kết cuối mỗi lần chạy:

```
TONG KET sau 42.3 phut
  Gemini       : 38 anh
  Pollinations : 51 anh
  Bo qua (da co): 12
  Loi          : 3
```

| Triệu chứng | Nguyên nhân |
|---|---|
| `Chua dan API key Gemini` | `config.json` còn để `DAN_API_KEY_1_VAO_DAY` |
| `Key #1 hong, bo han` | key sai/bị thu hồi — tạo key mới ở aistudio.google.com/apikey |
| `Khong tao duoc thu muc D:\...` | ổ đĩa chưa gắn, hoặc quên viết `\\` trong JSON |
| `khong thay model` | sai tên ở `gemini.model` |
| `bi chan boi bo loc (IMAGE_SAFETY)` | prompt bị Google chặn — sửa lời prompt rồi chạy bù |
| Pollinations chậm | đúng vậy: tài khoản ẩn danh 15 giây/ảnh, muốn nhanh thì dán `token` |
| Ảnh không phải 1920×1080 | thiếu Pillow — `pip install pillow` |

## 11. Kiểm tra API key trước khi chạy

```
python tao_anh.py --kiem-tra-key
```

Gọi thử từng key trong `config.json` (chỉ liệt kê model nên **không tốn quota ảnh**) và cho biết
key nào sống, tài khoản đó có dùng được model ảnh đang khai trong `gemini.model` không.

Key đúng phải là **API key** lấy ở https://aistudio.google.com/apikey — bấm *Create API key*,
copy nguyên chuỗi một dòng.

Chuỗi bắt đầu bằng `AQ.` hoặc `ya29.` là **OAuth access token**, không phải API key: Google
trả `HTTP 401 – Expected OAuth 2 access token`, và loại token đó còn hết hạn sau khoảng 1 tiếng.

# XOA_WATERMARK — gỡ logo / chữ chìm trên ảnh và video của bạn

Kéo thả ảnh (hoặc cả thư mục) vào `XOA_WATERMARK.bat`, chọn watermark nằm ở đâu, tool
vá lại nền cho liền và xuất ảnh sạch ra `WM_XONG/`. **Ảnh gốc không bị đụng vào.**

> Tool này dành cho ảnh **của chính bạn**: ảnh do Gemini / Pollinations sinh ra bị dán
> logo góc, ảnh bạn tự chụp, ảnh bạn đã mua bản quyền. Đừng dùng nó để gỡ watermark
> trên ảnh của người khác — đó là dấu bản quyền của họ.

---

## 1. Cài đặt

Bấm đúp `CAI_DAT.bat` (cài chung với hai tool kia), hoặc chỉ cần:

```
pip install numpy pillow
```

**Không bắt buộc** nhưng nên có nếu bạn xử lý **ảnh chụp thật** (nền nhiều chi tiết):

```
pip install opencv-python-headless
```

Có OpenCV thì tool tự dùng thuật toán vá Telea, vá nền rối nét hơn. Không có thì dùng
cách vá bằng `numpy` viết sẵn trong tool — với ảnh vector phẳng / nền chuyển màu
(đúng kiểu ảnh stickman của kênh) thì gần như không thấy vết.

Muốn xử lý **video** thì cần thêm `ffmpeg` trong PATH — https://ffmpeg.org/download.html

## 2. Chạy

### Trên Windows

Kéo thả ảnh hoặc thư mục vào **`XOA_WATERMARK.bat`**. Nó hỏi 2 câu:

1. Watermark nằm ở đâu (tự động dò / góc dưới phải / góc dưới trái / …)
2. Watermark có phải chữ trắng mờ không (chọn `C` để chỉ vá đúng nét chữ, nền giữ nguyên)

Bấm đúp mà không kéo thả gì = xử lý hết ảnh trong `WM_CHO/`.

### Trên macOS

Bấm đúp **`XOA_WATERMARK.command`** trong Finder.

> **Lần đầu macOS sẽ chặn** vì file tải từ mạng về: bấm **chuột phải** (hoặc Control +
> click) lên file → **Open** → hộp thoại hiện ra bấm **Open** lần nữa. Từ lần sau bấm
> đúp là chạy. Nếu báo *"permission denied"*, mở Terminal, gõ `chmod +x ` (có dấu cách
> ở cuối) rồi kéo file `.command` vào cửa sổ Terminal và Enter.

Nó hỏi giống bản Windows, thêm một câu cuối: **ảnh nằm ở đâu**. Lúc đó bạn **kéo file
hoặc thư mục ảnh thả thẳng vào cửa sổ Terminal** (kéo nhiều file một lúc cũng được) rồi
bấm Enter. Bấm Enter luôn = xử lý hết ảnh trong `WM_CHO/`.

Lần chạy đầu nó tự tạo môi trường riêng `.venv_wm/` và cài `numpy` + `pillow` vào đó —
không đụng gì tới Python hệ thống của máy. Chưa có Python 3 thì nó dừng lại và chỉ cách cài.

**Bằng dòng lệnh:**

```
python xoa_watermark.py                                   # chạy hết WM_CHO/, tự dò vùng
python xoa_watermark.py anh.png --vung duoi-phai
python xoa_watermark.py D:\KHO_ANH --vung 1520,980,380,80 --loc-mau sang
python xoa_watermark.py anh.png --xem-thu                 # chỉ vẽ khung đỏ để soi
python xoa_watermark.py --tu-kiem-tra                     # tự test, không cần ảnh thật
```

Trên macOS thay `python` bằng `python3` (hoặc `.venv_wm/bin/python` sau lần chạy đầu),
và đường dẫn viết kiểu `/Users/ban/Anh` thay vì `D:\KHO_ANH`.

> **Chưa chắc khung đúng chỗ thì chạy `--xem-thu` trước.** Nó xuất
> `<tên>_xem_truoc.png` có khung đỏ, mở lên soi, khớp rồi mới chạy thật. Đỡ phải xử lý
> lại cả trăm ảnh.

## 3. Chọn vùng — `--vung`

| Giá trị | Nghĩa |
|---|---|
| `tu-dong` *(mặc định)* | Tự dò vị trí bằng cách so nhiều ảnh cùng bộ |
| `logo-duoi-phai` `logo-duoi-trai` `logo-tren-phai` `logo-tren-trai` | Ô nhỏ sát góc (10% × 12%) — dùng cho logo bé như dấu ✦ của Flow / Gemini |
| `duoi-phai` `duoi-trai` `tren-phai` `tren-trai` | Cả góc ảnh (30% ngang × 14% dọc) |
| `duoi` `tren` | Cả dải ngang trên/dưới |
| `giua` | Watermark to nằm giữa ảnh |
| `1520,980,380,80` | Toạ độ pixel: `x,y,rộng,cao` |
| `78%,88%,21%,10%` | Cũng `x,y,rộng,cao` nhưng theo phần trăm |

**Cách `tu-dong` hoạt động:** watermark là thứ **có mặt ở mọi ảnh trong bộ**, còn nền
thì mỗi ảnh mỗi khác. Tool đo độ nét (Sobel) của từng ảnh rồi chồng lên nhau — chỗ nào
ảnh nào cũng có nét sắc thì gần như chắc chắn là logo/chữ chìm.

Vì vậy nó cần:

- ít nhất **3 ảnh cùng kích thước**, và
- các ảnh có **nền khác nhau** (toàn ảnh giống hệt nhau thì tool từ chối dò, vì không
  tách nổi watermark ra khỏi nội dung — lúc đó bạn tự chỉ `--vung`).

**Cái bẫy:** ảnh cùng một phong cách thường có sẵn thứ khác cũng "ảnh nào cũng có" —
ví dụ đường ranh giữa nền và dải đất màu, hay khung viền. Nên trước khi chọn, tool loại
thẳng: vệt dài hết chiều ngang mà mỏng, vệt dài hết chiều dọc mà hẹp, và mọi khối lớn
hơn 15% diện tích ảnh. Số còn lại được chấm điểm theo độ sắc nét, độ gọn và mức độ nằm
sát rìa — logo thật gần như luôn là đốm nhỏ, gọn, sát mép ảnh.

Dò xong nó in ra khung đã đo, ví dụ `Tu do vi tri watermark cho anh 1280x720: 685,625,270,90`.
Khung đó dùng chung cho cả nhóm ảnh cùng kích thước, không dò lại từng ảnh.

## 4. Chọn cách xử lý — `--cach`

| Cách | Làm gì | Hợp với |
|---|---|---|
| `tu-dong` *(mặc định)* | Từ **6 ảnh cùng kích thước** trở lên: học ra chính lớp phủ mờ của logo rồi **trừ ngược nó ra**. Không đủ điều kiện thì tự lùi về `va` | Cả dự án ảnh cùng một chỗ logo — nhất là khi có ảnh logo đè lên người / đồ vật |
| `go` | Bắt buộc gỡ lớp phủ (vẫn cần ≥ 6 ảnh, nếu học không ra thì báo rồi vá) | Khi muốn biết chắc nó có gỡ được không |
| `va` | Vá theo **cấu trúc nền**: mỗi điểm nhìn sang trái/phải cùng hàng và trên/dưới cùng cột, tin hướng nào hai đầu cùng màu | Hầu hết trường hợp — giữ nguyên ranh giới sắc nét của ảnh vector / nền phẳng / chuyển màu |
| `va-mem` | Vá kiểu khuếch tán, tán màu đều từ viền vào | Ảnh chụp nền rối. **Làm nhoè ranh giới sắc nét** nên đừng dùng cho ảnh vector |
| `to` | Tô đè một màu lấy từ viền vùng | Nền đúng một màu |
| `cat` | Cắt bỏ hẳn dải có watermark (thêm `--giu-kich-thuoc` để phóng lại như cũ) | Watermark sát mép, cắt đi không tiếc |
| `nhoe` | Vỡ pixel vùng đó | Nền quá rối, vá không nổi — **che** chứ không phải xoá |

### Gỡ lớp phủ hoạt động thế nào

Watermark là một **lớp mờ dán lên ảnh**: `nhìn thấy = (1−alpha)×nền + alpha×màu logo`.
`alpha` và màu logo giống hệt nhau ở mọi ảnh trong dự án. Biết chúng rồi thì lấy lại nền
thật chỉ là một phép trừ, và **chỗ nào không có logo thì alpha = 0 → giữ nguyên từng
pixel**, nên chân người, bậc thang, đường ranh màu nằm dưới logo không bị đụng tới.

Đo `alpha` **trong từng ảnh một**: vá tạm chỗ bị che để có nền đoán, rồi
`nhìn thấy − nền = alpha × (màu logo − nền)`. Ảnh nào có vật thể ngay dưới logo thì nền
đoán sai — nhưng logo thật phải giống nhau ở mọi ảnh, nên lấy **trung vị qua tất cả ảnh
và cả 3 kênh màu** là loại sạch mấy ảnh vá nhầm. Cách này không cần nền đổi giữa các ảnh,
nên ảnh vector phẳng (góc ảnh giống hệt nhau ở mọi cảnh) chạy rất ngọt.

Chỗ giữa dấu ✦ đặc hoàn toàn thì nền mất hẳn, trừ không ra — nhưng nhờ biết chính xác
`alpha` nên chỉ vá đúng mấy điểm đó, và pha dần giữa bản trừ với bản vá để không lộ viền.

**Nó cũng là bộ dò watermark tốt nhất.** Bộ dò cũ tìm nét sắc / đốm sáng, mà trên ảnh
vector phẳng bàn chân trắng còn sáng hơn watermark nhiều — nên nó bám vào bàn chân rồi vá
nát chỗ đó. Bây giờ tool thử học lớp phủ ở **từng góc ảnh**, góc nào có lớp phủ thật mới
học ra được. Đo trên bộ ảnh kiểu kênh: bộ dò nét sắc báo `75,709` (bàn chân), cách này báo
`1320,712` — đúng dấu ✦ thật.

Số đo trên 8 ảnh, 2 ảnh có bàn chân ngay dưới logo (lệch so với nền sạch, thang 0–255):
ảnh nền thoáng `vá 0,00 / gỡ 0,09`; ảnh logo đè lên bàn chân `vá 11,29 → gỡ 0,13`. Việc
học chỉ làm **một lần cho mỗi nhóm ảnh cùng kích thước** (lấy mẫu 16 ảnh đầu), sau đó mỗi
ảnh chỉ còn phép trừ.

## 5. Chỉ vá đúng nét chữ — `--loc-mau`

Mặc định tool vá **cả ô vuông** bạn khoanh. Nếu watermark là chữ trắng mảnh, làm vậy phí
— cả phần nền tử tế trong ô cũng bị vá theo. Dùng `--loc-mau` để chỉ chọn đúng những
pixel là watermark:

```
--loc-mau sang        # watermark trắng / sáng hơn nền  (hay gặp nhất)
--loc-mau toi         # watermark đen / tối hơn nền
--loc-mau #ff0000     # watermark đúng một màu, gõ mã màu vào
--loc-mau tat         # vá cả ô (mặc định)
```

Kèm theo:

- `--dung-sai` — rộng tay hơn khi so màu (mặc định 25 cho `sang`/`toi`, 60 cho mã màu)
- `--no-rong` — phình mặt nạ thêm vài pixel để ăn hết viền mờ quanh chữ (mặc định 2,
  chữ có bóng đổ thì để 3–4)

> `sang` và `toi` **bỏ qua các mảng màu rực** (nền đỏ, lá cây xanh…) vì watermark kiểu
> này gần như luôn trắng/xám/đen. Logo nhiều màu thì dùng `#RRGGBB`, hoặc cứ để `tat`.

Lọc quá chặt (không bắt được pixel nào) hay quá rộng (ăn gần hết ô) thì tool tự quay về
vá cả ô và báo một dòng cảnh báo, không im lặng làm hỏng ảnh.

## 6. Video

```
python xoa_watermark.py clip.mp4 --vung 1520,980,380,80
```

Video dùng bộ lọc `delogo` của `ffmpeg` (tiếng giữ nguyên, chỉ mã hoá lại hình).
**Video không tự dò vùng được** — phải chỉ rõ `--vung`. Cách nhanh: chụp một khung hình
ra ảnh, chạy `--xem-thu` trên ảnh đó để canh khung, rồi lấy toạ độ đó chạy cho video.

## 7. Toàn bộ tuỳ chọn

| Tham số | Mặc định | Nghĩa |
|---|---|---|
| `--vung` | `tu-dong` | Vùng có watermark (mục 3) |
| `--cach` | `tu-dong` | `tu-dong` / `go` / `va` / `va-mem` / `to` / `cat` / `nhoe` (mục 4) |
| `--loc-mau` | `tat` | `tat` / `sang` / `toi` / `#RRGGBB` (mục 5) |
| `--dung-sai` | tự | Độ rộng tay khi lọc màu |
| `--no-rong` | `2` | Phình mặt nạ thêm mấy pixel |
| `--giu-kich-thuoc` | tắt | Với `--cach cat`: phóng lại đúng kích thước cũ |
| `--ra <thư mục>` | `WM_XONG` | Thư mục kết quả |
| `--hau-to <chữ>` | rỗng | Thêm đuôi vào tên file kết quả, ví dụ `_sach` |
| `--ghi-de` | tắt | **Ghi đè thẳng lên file gốc** — không còn bản lưu |
| `--lam-lai` | tắt | Làm lại cả những file đã có kết quả |
| `--xem-thu` | tắt | Chỉ xuất ảnh có khung đỏ, không sửa gì |
| `--chat-luong` | `95` | Chất lượng khi lưu JPG/WEBP |
| `--khong-opencv` | tắt | Ép dùng cách vá numpy dù máy có OpenCV |
| `--chi-tiet` | tắt | In thêm log gỡ rối |
| `--tu-kiem-tra` | — | Tự test toàn bộ, không cần ảnh thật |

Mã thoát: `0` = xong sạch, `1` = có file hỏng, `2` = tham số/đầu vào sai.

## 8. Hỏng thì xem đâu

| Hiện tượng | Cách xử lý |
|---|---|
| `khong thay net nao xuat hien o tat ca cac anh` | Watermark quá mờ hoặc mỗi ảnh một chỗ → tự chỉ `--vung` |
| `cac anh gan nhu giong het nhau` | Bộ ảnh nền giống nhau, không tách được → tự chỉ `--vung` |
| `chi thay duong ke / mang lon giong nhau` | Ảnh chỉ có đường ranh nền / khung viền chung, không có logo nhỏ → tự chỉ `--vung` |
| `vung tim duoc qua to` | Ảnh có khung viền/nền chung lớn → tự chỉ `--vung` |
| Khoanh nhầm cả mảng to | Dùng `--vung logo-duoi-phai`, hoặc `--xem-thu` để canh rồi gõ thẳng toạ độ |
| Vá xong còn vệt mờ | Tăng `--no-rong` lên 3–4, hoặc khoanh `--vung` rộng thêm chút |
| Vá xong lộ vệt nhoè vắt qua ranh giới màu | Đang dùng `--cach va-mem`; bỏ đi để về `va` (theo cấu trúc) |
| Vá xong nhoè cả mảng nền đẹp | Dùng `--loc-mau sang` để chỉ vá nét chữ, hoặc khoanh vùng nhỏ lại |
| Nền ảnh chụp thật vá bị bệt | Cài `opencv-python-headless` rồi chạy lại |
| Video báo cần ffmpeg | Cài ffmpeg và thêm vào PATH |

Log đầy đủ nằm trong `logs\xoa_watermark_<ngày>.log`.

## 9. Cấu trúc thư mục

```
Tool-tao-voice\
├─ XOA_WATERMARK.bat       ← Windows: kéo thả ảnh / bấm đúp để chạy
├─ XOA_WATERMARK.command   ← macOS: bấm đúp trong Finder
├─ xoa_watermark.py        ← toàn bộ tool
├─ WM_CHO\             ← bỏ ảnh dính watermark vào đây
├─ WM_XONG\            ← ảnh sạch xuất ra đây
└─ logs\               ← log theo ngày
```

## 10. Bản chạy trên trình duyệt

Muốn thử nhanh **một ảnh** mà không cài gì: bấm đúp **`THU_1_ANH.html`** — trang đơn
độc lập, thả 1 ảnh vào là thấy trước/sau phóng to 4×, kéo chuột khoanh vùng được, và
chép được toạ độ để dùng cho cả lô.


Làm ảnh bằng **Flow** thì có bản tiện ích Chrome dùng chung thuật toán này:
**[README_CHROME.md](README_CHROME.md)**. Bật nút gạt, bấm tải dự án như bình thường,
file zip tải về đã sạch watermark — không cần Python, không cần đụng tới ổ đĩa.

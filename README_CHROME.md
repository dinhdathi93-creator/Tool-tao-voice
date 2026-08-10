# Tiện ích Chrome — xoá watermark ảnh Flow / Gemini

Bật nút gạt trong Flow, bấm **tải dự án** như bình thường, file zip tải về đã sạch
watermark. Toàn bộ xử lý chạy **trong máy bạn** — không gửi ảnh đi đâu, không cần
mạng, không cần Python.

> Dùng cho ảnh **của chính bạn** — ảnh bạn tạo ra trong Flow bằng tài khoản của bạn.
> Đừng dùng để gỡ watermark trên ảnh của người khác.
>
> Tiện ích chỉ xoá **logo nhìn thấy được**. Ảnh Google sinh ra còn có SynthID —
> thứ watermark chìm nằm trong chính các điểm ảnh, mắt không thấy. Tiện ích này
> không đụng tới nó và cũng không có cách nào gỡ. Nếu bạn đăng lên YouTube, phần
> khai báo "nội dung tổng hợp" vẫn phải khai như thường.

---

## 1. Cài vào Chrome

Cách cài **giống hệt nhau trên Windows và macOS**.

1. Giải nén, được thư mục `chrome_xoa_watermark/`. **Để nó ở một chỗ cố định** —
   xoá hay đổi chỗ là Chrome mất tiện ích. Trên Mac đừng để trong thư mục Downloads
   (dễ bị dọn tự động); chuyển vào `~/Documents/` hay `~/Applications/` chẳng hạn.
2. Mở Chrome → gõ `chrome://extensions` vào thanh địa chỉ → Enter.
3. Bật **Chế độ dành cho nhà phát triển** (*Developer mode*) — công tắc góc trên bên phải.
4. Bấm **Tải tiện ích đã giải nén** (*Load unpacked*) → chọn thư mục `chrome_xoa_watermark`
   (chọn đúng thư mục có file `manifest.json` bên trong).
5. Xong. Ghim biểu tượng vào thanh công cụ cho dễ bấm.

Chrome sẽ nhắc "tiện ích ở chế độ nhà phát triển" mỗi lần mở — bấm bỏ qua là được,
đó là chuyện bình thường với tiện ích không cài từ Web Store.

**Trình duyệt nào dùng được:** Chrome, Edge, Brave, Vivaldi, Arc, Opera — tất cả
đều là nhân Chromium nên cài y hệt (Edge thì vào `edge://extensions`).
**Safari thì không** — Safari dùng định dạng tiện ích khác hẳn, phải đóng gói bằng
Xcode mới cài được. Trên Mac cứ dùng Chrome cho việc này.

## 0. Thử trước đã — `THU_1_ANH.html`

Trước khi đụng tới cả dự án 200 ảnh, **bấm đúp `THU_1_ANH.html`** (mở bằng Chrome hoặc
bất kỳ trình duyệt nào). Không cần cài tiện ích, không cần Developer mode, không cần mạng.

> ⛔ **Dưới 4 ảnh thì tool cố ý không xoá gì cả** — nó để nguyên ảnh và nói thẳng là chưa
> đủ. Lý do ở mục 4c: với một ảnh đơn, không cách nào phân biệt được cái logo mờ với nét
> trắng của chính hình vẽ (bàn chân hình que còn sáng hơn watermark nhiều), nên vá vào là
> nát chỗ đó mà logo vẫn còn. Thà nói thật còn hơn trả về ảnh hỏng.

1. Thả **6–10 ảnh** của cùng dự án vào — nhớ chọn cả mấy ảnh khó (logo đè lên người,
   đè lên đồ vật). Một ảnh cũng chạy được, nhưng **từ 4 ảnh trở lên** mới gỡ được lớp phủ
   (mục 4c), và đó là cách cho kết quả sạch nhất — càng nhiều ảnh càng chắc.
2. Tool **so các ảnh với nhau** để tìm đúng chỗ logo (logo nằm cố định một chỗ cả dự án,
   nên ảnh nào bị che vẫn lấy được vị trí từ những ảnh khác), **học ra chính cái lớp phủ
   mờ của logo** rồi gỡ đúng nó ra, và hiện **trước / sau phóng to 4×** — logo bé như dấu ✦
   thì phải nhìn ở mức này mới biết sạch hay chưa. Dòng mô tả ghi rõ nó đã dùng cách nào.
3. Bấm **◀ ▶ để lật từng ảnh** — khung giữ nguyên, bạn soi xem có ảnh nào hỏng không.
   Đây đúng là bước "test trước khi chạy hàng loạt".
4. Khung chưa chuẩn thì **kéo chuột khoanh lại**, hoặc bấm **Tự tìm lại logo**.
5. Ưng thì bấm **Tải ảnh đã xoá** để xem file thật, và bấm **Chép toạ độ vùng**.
6. Dán toạ độ đó vào ô *“hoặc gõ x,y,rộng,cao”* của tiện ích → cả dự án dùng đúng khung
   bạn vừa duyệt. Toạ độ chỉ đúng cho ảnh **cùng kích thước**.

Trang này dùng **chung một lõi xử lý** với tiện ích (file `loi_xoa.js` được nhúng thẳng
vào trong), nên thấy sao ở đây thì cả lô ra đúng như vậy. Sửa lõi xong nhớ chạy lại
`node chrome_xoa_watermark/tao_trang_thu.js` để dựng lại trang.

## 2. Dùng cách nào?

Có 2 đường, dùng đường nào cũng ra kết quả như nhau.

### Đường A — nút gạt trong Flow (nhanh nhất)

1. Bấm biểu tượng tiện ích → gạt **Xoá watermark** sang bật.
2. Vào `labs.google/flow`, làm việc như thường. Góc dưới bên phải hiện một ô nhỏ
   báo tiện ích đang bật.
3. Bấm **tải dự án**. Tiện ích chặn file lại, xoá watermark từng ảnh (có thanh tiến
   độ), rồi trả lại đúng file zip đó cho bạn tải xuống.

Xong thì file tự tải xuống, **và ô nhỏ hiện thêm nút `⬇ Tải …`** để bấm tay phòng khi
Chrome chặn tải tự động. Đừng đóng tab Flow trong lúc nó đang chạy — xử lý diễn ra ngay
trong tab đó, đóng là mất hết công.

**Nếu Flow đổi cách tải file, đường này có thể không bắt được.** Lúc đó ô nhỏ sẽ báo
lỗi và nhắc bạn chuyển sang đường B. Xem thêm mục 5.

### Đường B — thả file zip vào (lúc nào cũng chạy)

1. Tải dự án về như bình thường (giữ nguyên watermark).
2. Bấm biểu tượng tiện ích → **Mở trang xử lý gói zip**.
3. Kéo file `.zip` vừa tải vào trang đó (hoặc kéo thẳng nhiều file ảnh).
4. Trang hiện **2 ảnh soi trước**: khung đỏ tool định vá, và kết quả thử trên 1 ảnh.
   Nhìn ưng thì bấm **Xử lý toàn bộ và tải xuống**.

Đường B khuyên dùng cho lô lớn: bạn soi trước 1 ảnh rồi mới chạy 200 ảnh, đỡ phải làm lại.

**Khung đỏ khoanh sai chỗ? Kéo chuột khoanh lại ngay trên ảnh bên trái.** Khoanh xong
nó vá thử lại liền, và khung bạn vẽ được dùng cho toàn bộ ảnh trong gói. Bấm
**Phóng to chỗ đang khoanh** để soi kỹ trước/sau ở mức pixel — với logo bé như dấu ✦
của Flow thì nhìn ảnh thu nhỏ không thấy gì đâu.

## 3. Cài đặt

| Mục | Nên chọn | Giải thích |
|---|---|---|
| **Watermark nằm ở đâu** | Tự động dò | Thử **học lớp phủ ở từng góc ảnh** — góc nào có lớp phủ thật mới học ra được, và khung nó chỉ ra ôm sát đúng cái logo (mục 4c). Không ra thì lùi về so nét sắc giữa các ảnh, rồi tìm đốm sáng nhỏ ở góc trên 1 ảnh |
| | **Logo nhỏ góc dưới phải** | Ô ở góc, kích thước đo theo dấu ✦ thật của Flow (trên ảnh 1376×768 nó nằm ở `1314,706` cỡ `42×42`). Chọn cái này nếu tự động dò trượt |
| | Cả góc dưới bên phải… | Ô to hơn, cho watermark dạng chữ dài |
| | Gõ toạ độ `x,y,rộng,cao` | Khi bạn đã biết chính xác khung |
| | *Kéo chuột trên ảnh* | Chắc ăn nhất — khoanh tay đúng chỗ, không cần đoán |
| **Chỉ vá đúng nét chữ** | Vá cả ô | Chắc ăn, hợp với logo nhiều màu |
| | Chỉ nét sáng / trắng | Đẹp hơn với watermark chữ trắng — nền trong ô giữ nguyên |
| **Cách xử lý** | Tự chọn (gỡ lớp phủ nếu đủ ảnh) | Từ 4 ảnh cùng kích thước trở lên thì **học ra lớp phủ của logo rồi trừ ngược nó ra** — nền phía dưới hiện lại nguyên vẹn, kể cả khi logo đè lên người/đồ vật. Không đủ điều kiện thì tự lùi về vá nền (mục 4c) |
| | Vá theo cấu trúc nền | **Giữ nguyên ranh giới sắc nét.** Với mỗi điểm cần vá, nó nhìn sang trái/phải cùng hàng và trên/dưới cùng cột, hướng nào hai đầu cùng màu thì tin hướng đó |
| | Vá mềm — khuếch tán | Tán màu đều ra. Mượt hơn với ảnh chụp nền rối, nhưng **làm nhoè ranh giới sắc nét** |
| | Tô màu nền | Nền đúng một màu thì cách này gọn hơn |
| **Nở mặt nạ** | 2 | Tăng lên 3–4 nếu vá xong còn viền mờ quanh chỗ chữ |

Cài đặt lưu lại, lần sau mở lên vẫn thế. Nút gạt và trang xử lý dùng chung một bộ cài đặt.

## 4. Ảnh ra có mất chất lượng không?

- **PNG → PNG**: không mất gì, mã hoá lại không mất mát.
- **JPG → JPG**: phải mã hoá lại, mặc định chất lượng 95 — mắt thường không thấy khác,
  nhưng đúng là đã qua một lần nén nữa.
- Ảnh **không** bị đổi kích thước, tên file và cấu trúc thư mục trong zip giữ nguyên.
- File không phải ảnh trong gói (`.txt`, `.json`, video…) được chép nguyên, không đụng tới.
- Ảnh nào xử lý lỗi thì **giữ nguyên bản gốc** trong gói ra, và tên nó được liệt kê ở
  cuối cho bạn biết.

Zip ra ghi kiểu *store* (không nén lại) nên file có thể to hơn zip gốc một chút —
ảnh PNG/JPG vốn đã nén rồi, nén thêm gần như không nhỏ đi mà lại chậm.

## 5. Nút gạt không bắt được thì làm sao

Trong popup có mục **Chẩn đoán**:

1. Tích **Ghi lại các link tải mà tiện ích nhìn thấy**.
2. Vào Flow bấm tải dự án một lần nữa (kể cả khi nó tải ra file còn watermark).
3. Mở lại popup — phần nhật ký sẽ liệt kê những đường link/blob tiện ích nhìn thấy.

Gửi tôi mấy dòng đó là biết Flow tải kiểu gì để sửa cho khớp. Trong lúc chờ thì
cứ dùng đường B, kết quả y hệt.

## 4b. Vì sao "vá theo cấu trúc"

Ảnh kênh bạn có **ranh giới sắc lẹm giữa nền xanh và dải đất vàng**. Cách vá khuếch tán
(tán màu đều từ viền vào) đi qua chỗ đó là thành vệt nhoè — nhìn phát hiện ra ngay.

Cách mặc định bây giờ làm khác: với mỗi điểm cần vá, nó tìm điểm lành gần nhất ở
**bốn hướng** — trái/phải cùng hàng, trên/dưới cùng cột — rồi tin hướng nào có **hai đầu
cùng màu**. Nền là dải màu ngang thì hàng nào cũng đồng màu, nối ngang ra đúng màu của
chính hàng đó, nên đường ranh không bị kéo lệch một pixel nào.

Đo trên đúng tình huống đó (dấu ✦ nằm vắt qua ranh giới xanh/vàng), sai lệch so với ảnh
nền sạch: **khuếch tán 25,0/255 → theo cấu trúc 0,5/255**. Chạy hết đường ống thật trong
Chromium (giải nén zip → canvas → vá → mã hoá lại → đóng zip) thì vùng quanh logo và
đường ranh đều ra **0,00** — không lệch một pixel.

Chỗ nào nền thật sự rối (ảnh chụp), độ tin cậy thấp thì nó tự pha sang bản khuếch tán
cho mượt, không để lộ vệt gãy.

**Logo sát mép ảnh** (đúng chỗ dấu ✦ của Flow) là ca khó nhất: bên phải không còn pixel
lành để nối, nên nếu chọn nhầm hướng dọc là nó kéo màu nền xanh xuống dải vàng — đúng
vệt tối bạn thấy. Bản 1.2 xử lý bằng ba việc: đo **độ phẳng** ngay trên phía còn dùng
được (thay vì đòi đủ hai đầu), **chọn dứt khoát** hướng nào điểm lành gần và đáng tin
hơn thay vì trung bình hai hướng đang cãi nhau, và nhìn **vân của nền** quanh chỗ vá —
ảnh sọc ngang thì ưu tiên nối ngang.

Đo trên ảnh có dấu ✦ cách mép phải 24px, vắt qua ranh giới xanh/vàng:

| Khung | Khuếch tán | Theo cấu trúc |
|---|---|---|
| Vừa đủ, không chạm mép | 26,0 | **0,00** |
| Chạm mép phải | 31,6 | **0,00** |
| Chạm cả mép phải lẫn đáy | 27,6 | **0,00** |

## 4c. Gỡ lớp phủ — cách xoá sạch nhất, cần từ 4 ảnh

Watermark không phải là "sơn đè lên" mà là một **lớp mờ dán lên ảnh**:

```
nhìn thấy = (1 − alpha) × nền  +  alpha × màu logo
```

`alpha` và màu logo **giống hệt nhau ở mọi ảnh** trong dự án — logo luôn một chỗ, một
kiểu. Biết `alpha` rồi thì lấy lại nền thật chỉ là một phép trừ. Cái hay: **chỗ nào không
có logo thì alpha = 0 → giữ nguyên từng pixel**. Chân người, bậc thang, đường ranh màu
nằm ngay dưới logo đều không bị đụng tới — khác hẳn cách vá (vốn xoá sạch cả ô rồi dựng
lại từ đoán, gặp vật thể là lộ).

**Đo `alpha` thế nào.** Với mỗi ảnh, vá tạm chỗ bị che để có "nền đoán" của riêng ảnh đó;
`nhìn thấy − nền = alpha × (màu logo − nền)` là ra `alpha` ngay. Ảnh nào có vật thể ngay
dưới logo thì nền đoán sai, `alpha` ra số trợ trên trợ dưới — nhưng logo thật phải **giống
nhau ở mọi ảnh**, nên lấy **trung vị qua tất cả ảnh và cả 3 kênh màu** là mấy ảnh vá nhầm
bị loại sạch. Màu logo chưa biết thì đoán là trắng rồi tính lại bằng bình phương tối thiểu
sau mỗi vòng, ba vòng là đúng hẳn.

> Bản trước đo `alpha` bằng cách **so nền giữa các ảnh với nhau**. Cách đó chết với ảnh
> vector phẳng: góc dưới phải của mọi cảnh giống hệt nhau (vẫn nền xanh + dải vàng đó),
> nền không đổi thì không có gì mà so — kết quả là watermark còn nguyên, còn mấy chỗ có
> bàn chân đi qua lại bị tưởng nhầm là logo rồi vá loang ra. Cách mới đo **trong từng ảnh
> một** nên nền có đứng yên cũng không sao.

**Chỗ giữa dấu ✦ đặc hoàn toàn** (alpha = 1) thì nền bị che sạch, trừ kiểu gì cũng không
ra — nhưng nhờ biết chính xác `alpha` nên chỉ vá đúng mấy điểm đó, không vá lan. Chỗ
`alpha` gần 1 thì pha dần giữa bản trừ và bản vá theo độ tin cậy, nên không có đường viền
giữa hai vùng.

### Và nó cũng là bộ dò watermark tốt nhất

Các bộ dò trước đều tìm "nét sắc / đốm sáng". Trên ảnh kênh bạn, **bàn chân trắng của hình
que sáng hơn nền 160 mức, còn dấu ✦ mờ chỉ hơn vài chục** — nên bộ dò bám ngay vào bàn
chân, vá nát chỗ đó, trong khi watermark vẫn còn nguyên. Đúng cái ảnh bạn gửi.

Nên bây giờ tool **thử học lớp phủ ở từng góc ảnh**: góc nào có lớp phủ thật (mờ giống hệt
nhau ở mọi ảnh) mới học ra được, bàn chân thì không bao giờ dính. Đo trên bộ ảnh kiểu kênh:
bộ dò nét sắc báo `75,709` (bàn chân góc dưới trái), còn cách này báo `1320,712` — đúng
dấu ✦ thật `1320,712` cỡ `30×30`. Khung nó chỉ ra lấy thẳng từ bản đồ `alpha` nên **ôm sát
đúng cái logo**, không thừa một pixel.

Không tìm ra thì mới quay về bộ dò nét sắc, rồi vá — như cũ. Bộ dò nét sắc cũng được siết
lại: đốm dẹt quá (tỉ lệ hơn 2,5:1 — bàn chân hình que là 60×15) hoặc tràn ra khỏi ô góc
đều bị loại, vì đó là mảnh của vật thể to hơn chứ không phải logo.

### Ít hơn 4 ảnh thì không xoá

Đo trên đúng ảnh khó (logo đè lên bàn chân), thử cả ba kiểu khung với cách vá:

| Khung dùng để vá | Lệch quanh logo |
|---|---|
| Ô mặc định góc dưới phải | 74,8 |
| Bộ dò 1 ảnh (bám vào bàn chân) | 22,7 |
| Khung khoanh sát đúng logo | 10,0 |

Tức là **kể cả khoanh đúng chằn chặn, vá vẫn lộ** khi logo nằm trên vật thể — vì vá phải
bịa lại chi tiết. Chỉ gỡ lớp phủ mới sạch (0,09), mà nó cần ≥ 4 ảnh. Nên dưới 4 ảnh,
`THU_1_ANH.html` để nguyên ảnh và hiện cảnh báo đỏ, không xoá bừa. Muốn vá thử ngay trên
một ảnh thì cứ **kéo chuột khoanh tay** — đó là bạn chủ động chọn.

### Số đo

Bộ 8 ảnh kiểu kênh (vector phẳng, góc ảnh giống hệt nhau), hai ảnh cuối có bàn chân đứng
ngay dưới logo. Lệch so với ảnh nền sạch, thang 0–255:

| | Chưa xoá | Vá theo cấu trúc | **Gỡ lớp phủ** |
|---|---|---|---|
| Ảnh nền thoáng | 2,98 | 0,00 | **0,05** |
| Ảnh logo đè lên bàn chân | 1,67 | 11,56 | **0,09** |

Và bộ 8 ảnh chụp (nền mỗi ảnh một khác, hai ảnh có cột trắng viền đen đi qua chỗ logo):

| | Chưa xoá | Vá theo cấu trúc | **Gỡ lớp phủ** |
|---|---|---|---|
| Ảnh nền thoáng | 2,8 – 3,6 | 0,00 | **0,41** |
| Ảnh logo đè lên vật thể | 6,0 – 6,8 | 27,2 | **0,95** |

Tức là **chỗ nền phẳng thì vá vẫn vô địch, chỗ logo đè lên vật thể thì vá tệ hơn cả không
xoá, còn gỡ lớp phủ thì chỗ nào cũng sạch**. Vì vậy mặc định là "tự chọn": đủ ảnh thì gỡ
lớp phủ, không đủ thì vá.

Việc học chỉ làm **một lần cho cả lô** (lấy mẫu tối đa 14–24 ảnh đầu), mất vài giây, rồi
200 ảnh còn lại chỉ là phép trừ.

## 5b. Tự động dò khoanh nhầm chỗ

Bộ dò tìm những nét **ảnh nào trong bộ cũng có**. Ảnh kiểu kênh bạn (nền xanh đậm,
dải đất vàng ở dưới) có sẵn một **đường ranh ngang chạy hết chiều ngang** nằm đúng
một chỗ ở mọi ảnh — nhìn qua con mắt thuật toán thì nó "giống watermark" y như cái
logo thật.

Nên bộ dò loại thẳng những thứ này trước khi chọn: vệt dài hết ngang mà mỏng, vệt dài
hết dọc mà hẹp, và mọi khối lớn hơn 15% diện tích ảnh. Còn lại nó chấm điểm theo độ
sắc nét, độ gọn và mức độ nằm sát rìa ảnh — logo thật gần như luôn là một đốm nhỏ,
gọn, nằm sát mép.

Không ra thì nó tự chuyển sang cách thứ hai: **tìm đốm sáng nhỏ ở góc ngay trên một ảnh**.
Logo Flow là đốm trắng, gọn, gần như không màu, nằm sát góc — ba đặc điểm đó đủ để nhận
ra mà không cần so với ảnh khác. Cách này chạy được cả khi bạn chỉ có đúng 1 ảnh.

Vẫn trượt thì đừng chỉnh tới lui làm gì: **kéo chuột khoanh tay** trên ảnh soi trước. Xong.

> **Đừng khoanh rộng cho chắc.** Khoanh sát cái logo thôi. Trang `THU_1_ANH.html` sẽ
> cảnh báo khi khung chiếm quá 3% ảnh.
>
> Ngược lại, **logo đè lên người hay đồ vật thì không đáng sợ** — miễn là khung khoanh
> sát. Đo trên ảnh có dấu ✦ nằm đè lên chân hình que: vá xong dựng lại đúng cặp chân,
> lệch **0,00**. Cách vá bám theo cấu trúc nên nó nối tiếp đúng vạch dọc của cái chân.
> Còn với vật thể phức tạp hơn (bàn chân, cột trắng viền đen, nhiều mảng màu) thì vá bắt
> đầu lộ — đó là lúc **gỡ lớp phủ** ở mục 4c vào việc, và nó cần từ 4 ảnh.

Vài trường hợp tiện ích **cố ý không chặn**: trang tự đặt `location.href` sang link
tải, hoặc file tải qua một tab khác. Chặn mấy chỗ đó dễ làm hỏng thao tác khác của
Flow nên tôi để nguyên.

## 5c. Chạy hoài không ra file (đã sửa ở bản 1.1)

Triệu chứng: bật nút gạt, bấm tải dự án, ô nhỏ chạy `Đang xoá watermark 105/198…` hết
lượt này đến lượt khác mà không bao giờ ra file.

Nguyên nhân: xử lý xong, tiện ích bấm một thẻ `<a download>` để trả file về — nhưng
**chính bộ chặn của nó lại tóm luôn cú bấm đó**, huỷ tải rồi bắt đầu xử lý lại từ đầu.
Vòng lặp vô tận.

Bản 1.1 đánh dấu file do chính tiện ích trả về (thuộc tính `data-xw-bo-qua` cộng một
danh sách URL báo trước cho bộ chặn) nên nó không tự tóm mình nữa, và thêm nút bấm tay
phòng khi Chrome chặn tải tự động. Bài `kiem_tra/tu_kiem_tra_chan.js` dựng lại đúng
tình huống này trên một DOM giả để nó không tái phát.

## 6. Cấu trúc thư mục

```
chrome_xoa_watermark\
├─ manifest.json        ← khai báo tiện ích (MV3)
├─ loi_xoa.js           ← lõi: dò vùng, tạo mặt nạ, vá nền
├─ zip.js               ← đọc/ghi file zip (không thư viện ngoài)
├─ anh.js               ← giải mã / mã hoá ảnh bằng canvas
├─ xu_ly.js             ← đường ống: zip vào → ảnh sạch → zip ra
├─ chan_trang.js        ← chạy trong trang Flow, chặn lúc tải file
├─ trang.js / trang.css ← ô nút gạt hiện trong Flow
├─ popup.html/js/css    ← bảng cài đặt khi bấm biểu tượng
├─ xu_ly_goi.*          ← trang thả zip vào xử lý
├─ nen.js               ← service worker
├─ tao_trang_thu.js     ← dựng THU_1_ANH.html (trang thử 1 ảnh)
└─ kiem_tra\            ← bài tự kiểm tra (xem mục 7)
```

## 7. Tự kiểm tra

Cần [Node.js](https://nodejs.org/) để chạy:

```
node chrome_xoa_watermark/kiem_tra/tu_kiem_tra.js            # lõi xử lý + đọc/ghi zip
node chrome_xoa_watermark/kiem_tra/tu_kiem_tra_chan.js       # bộ chặn lúc tải file
node chrome_xoa_watermark/kiem_tra/tu_kiem_tra_chrome.js     # tiện ích thật trong Chromium
node chrome_xoa_watermark/kiem_tra/tu_kiem_tra_trang_thu.js  # trang THU_1_ANH.html
```

Bốn bài đều có phần đo **gỡ lớp phủ**, trên hai loại ảnh: kiểu kênh (vector phẳng, góc ảnh
giống hệt nhau, có bàn chân đứng dưới logo) và ảnh chụp (nền mỗi ảnh một khác). Học lớp
phủ rồi đo lại từng ảnh ra — chỗ khó phải dưới 1–2/255 và phải hơn hẳn cách vá, phần ngoài
vùng logo không được đổi một pixel. Có cả bài chốt rằng ảnh **không** có watermark thì
tuyệt đối không được bịa ra một lớp phủ.

Bài thứ ba cần `npm i -D playwright` và tự dựng một gói zip 6 ảnh có watermark, nạp
tiện ích vào Chromium, thả file vào trang xử lý, bấm nút, rồi **đo lại từng ảnh ra**:
vùng watermark phải sạch, phần ngoài vùng phải giữ nguyên từng pixel, đủ số ảnh,
file không phải ảnh còn nguyên.

## 8. Liên quan

Bản chạy trên máy (hàng loạt, có cả video) nằm ở
**[README_WATERMARK.md](README_WATERMARK.md)** — cùng một thuật toán, chạy bằng Python:
Windows kéo thả vào `XOA_WATERMARK.bat`, macOS bấm đúp `XOA_WATERMARK.command`. Dùng bản
đó khi ảnh đã nằm sẵn trong ổ đĩa, hoặc khi cần xử lý video.

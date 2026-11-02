# BÁO CÁO RÀ SOÁT SQL CINEHUNT | 02/11/2026

**Kết luận:** KHÔNG đưa bản gốc lên repository GitHub công khai và KHÔNG chạy lại trên `CineHuntDB` hiện có. Bản tách `schema.sql` và `sample-data.sql` là **bản ứng viên để review**, đã qua kiểm tra cấu trúc tĩnh nhưng **chưa được thực thi hoặc nghiệm thu trên SQL Server mới**.

## 1. Phạm vi và nguồn

- Tệp nguồn: `CineHunt_Database_V6_3_With_Sample_Data.sql`, **3.419 dòng, 115.977 bytes**, SHA-256: `d944ee624af7eb1d228a1fdabe05ac38dc0d8e4b5c37e687f52a971bbd178671`.
- Chỉ xử lý nội dung SQL trong ZIP được cung cấp; **không kết nối SQL Server**, không chạy SQL, không thay đổi database hoặc GitHub.
- Tệp gốc dù có chữ V6.3 còn chứa thông báo/bản vá được gắn nhãn **V6.2, V6.4, V6.5, V6.6** ở các dòng 2350, 2851, 2992, 3418. Không dùng tên file làm căn cứ xác nhận schema version.
- Phương pháp: tách theo các `GO` độc lập (142 batch), phân loại DDL / dữ liệu / patch / lệnh kiểm tra; tránh cắt ngang định nghĩa procedure/trigger/view.

## 2. Nguy cơ quan trọng trong tệp gốc

| Ưu tiên | Vị trí dòng gốc | Phát hiện | Cách xử lý |
|---|---|---|---|
| **CRITICAL** | 7–13 | Nếu đổi `@ResetDatabase` thành 1, script `ALTER DATABASE ... SINGLE_USER WITH ROLLBACK IMMEDIATE`, rồi `DROP DATABASE` | Bỏ toàn bộ khỏi bản tách; tuyệt đối không bật reset trên DB có dữ liệu |
| **CRITICAL** | 26–82 | DROP VIEW/PROCEDURE/TRIGGER và **28 `DROP TABLE`**, có thể mất user, phim, booking, payment, ticket | Bỏ toàn bộ khỏi `schema.sql` |
| **HIGH** | 1976–2070 | Seed hoặc nâng quyền tài khoản ADMIN định danh kèm **bcrypt hash cố định** | **Bỏ toàn bộ** khỏi `sample-data.sql`; không đưa email, hash hay câu lệnh nâng quyền vào repo public. Nếu đã dùng tài khoản này, vô hiệu hóa hoặc đổi mật khẩu qua luồng quản trị an toàn |
| **HIGH** | 3297–3316 | `READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE` có thể hủy transaction/ngắt kết nối đang hoạt động | Bỏ khỏi bản tách; lập migration riêng sau khi xác định điều kiện vận hành |
| **HIGH** | 2361–2383 | DROP rồi ADD lại check constraint trạng thái ghế/hold | Không chạy lệnh DROP; thay vào đó đưa **trực tiếp trạng thái cuối** vào `CREATE TABLE` mới trong `schema.sql` |
| **MEDIUM** | 1498–1701, 2384–2568 | `sp_confirm_payment` được định nghĩa nhiều lần | Chỉ lấy **bản cuối**, dòng 2384–2568 |
| **MEDIUM** | 1339–1397, 2569–2617, 3077–3257 | `sp_release_expired_holds` có nhiều lần định nghĩa | Chỉ lấy **bản cuối**, dòng 3077–3257, có cơ chế giảm deadlock |
| **MEDIUM** | 2102–2103, 2865–2870 | Số điện thoại trong dữ liệu rạp mẫu | Đã thay 8 số điện thoại thành `NULL`; địa chỉ/tên rạp vẫn là dữ liệu demo chưa xác minh thực tế |
| **MEDIUM** | 2195–2318 | Suất chiếu và ngày phim tính tương đối với `GETDATE()` | Chỉ phù hợp seed database thử nghiệm mới; không tái chạy trên DB hiện tại |
| **LOW** | 3382–3385 | `UPDATE STATISTICS ... FULLSCAN` làm tăng I/O trên database đang vận hành | Không đưa vào schema; xử lý tối ưu sau qua kế hoạch riêng |

**Lưu ý khi đọc số liệu:** Các đếm thô của script bao gồm `INSERT`, `UPDATE`, `DELETE` nằm **bên trong stored procedure/trigger**. Chúng là logic nghiệp vụ, không phải tác vụ DML tự động chạy tại thời điểm tạo object. Vì vậy không nên tách chỉ dựa trên từ khóa bằng regex đơn giản.

## 3. Thành phần đã tách

### `schema.sql`

- Có **29 CREATE TABLE**, **12 CREATE PROCEDURE**, **8 CREATE TRIGGER**, **3 CREATE VIEW**, cùng index và constraint.
- Không có câu lệnh thực thi `DROP TABLE`, `DROP DATABASE`, hoặc `WITH ROLLBACK IMMEDIATE` ở top-level.
- Bao gồm bản final của `sp_confirm_payment`, `sp_release_expired_holds` và các index cuối tệp (trong đó có `IX_booking_details_active_booking`, `IX_booking_orders_user_pending`).
- Hai constraint được đồng bộ về phiên bản cuối trong định nghĩa bảng ban đầu: `seat_holds.status` thêm `CONVERTED`; `showtime_seats.status` thêm `BOOKED`.
- **Không** tạo database; chỉ hướng tới một `CineHuntDB` thử nghiệm **đã được tạo, còn trống**. Có điều kiện `SET NOEXEC ON` nhằm giảm nguy cơ thực thi nếu DB thiếu/đã có bảng. Không xem NOEXEC là thay thế được việc thử nghiệm/cô lập DB.
- Tệp vẫn chứa nghiệp vụ `UPDATE`/`DELETE` **trong thân stored procedure và trigger**, cần code-review trước khi chạy đối với môi trường tin cậy.

### `sample-data.sql`

- Dữ liệu mẫu cho role, seat type, thể loại, combo, cinema, room, seat, phim, liên kết thể loại, suất chiếu, ghế suất và cập nhật poster tương ứng.
- **KHÔNG** có tài khoản ADMIN cố định, bcrypt hash mặc định hoặc thao tác nâng quyền tài khoản; **KHÔNG** có 8 số điện thoại rạp mẫu.
- Có **18 lệnh `INSERT INTO dbo...`** và các câu lệnh update/phép tạo thêm dữ liệu liên quan. Tên rạp, phim, địa chỉ, link ảnh từ source chỉ là mẫu; URL `example.com` không cung cấp poster thật.
- Yêu cầu database mới, đủ schema và **chưa có dữ liệu**; không được chạy nhiều lần. Các điều kiện `NOEXEC` chỉ là lớp kiểm tra bổ sung, không đảm bảo phục hồi nếu chạy nhầm.
- Phần seed role cần cho đồng bộ `users.role` ⇄ `user_roles`; **không tạo user demo mặc định**. Đăng ký và phân quyền thực hiện theo ứng dụng.

### Các phần KHÔNG đưa vào hai tệp

- Reset/drop tất cả object; seed admin + password hash; hai bản stored procedure cũ.
- Các batch kiểm tra/print trung gian, lệnh thống kê fullscan, thay đổi cấp database gây ngắt kết nối.
- Các lệnh ALTER constraint trung gian đã được chuyển thành constraint cuối trong bảng mới.

## 4. Điểm chưa thể xác minh

1. **Chưa chạy compile/execute trên Microsoft SQL Server.** Một script qua kiểm tra tĩnh chưa đảm bảo đúng mọi phụ thuộc FK, trigger, batch hay procedure.
2. **Chưa xác nhận mức độ tương thích với 12+ migration TypeORM hiện có trong `backend/src/migrations` của GitHub**. Schema gốc có `movie_ratings` (dòng 269 trở đi); các migration Backend cũng liên quan rating, OTP, booking, v.v. Chạy chồng có thể gây xung đột.
3. Chưa có kiểm thử số lượng phim/rạp/ghế sau khi seed, integrity constraint, và kiểm thử nghiệp vụ hold → booking → payment pending → cancel → release seat.
4. Chưa kiểm chứng email, poster và thông tin địa điểm của dữ liệu demo; **không sử dụng làm dữ liệu kinh doanh thật**.
5. Không thể bảo đảm tệp gốc không còn dữ liệu nhạy cảm khác nếu không có đối chiếu nguồn tổ chức; phần ADMIN đã được loại có chủ đích.

## 5. Quy trình triển khai kiểm thử AN TOÀN (chưa thực hiện)

1. Sao lưu và xác nhận độc lập database đang dùng. **Không chạy hai tệp này trên database hiện tại**.
2. Chuẩn bị **SQL Server/container thử nghiệm hoàn toàn riêng**, không trỏ vào cổng/database production. Nếu cần giữ tên `CineHuntDB`, dùng SQL Server instance/container riêng.
3. Tạo mới database `CineHuntDB` rỗng thủ công trên instance riêng; xác minh `SELECT DB_NAME()` và số bảng trước khi chạy.
4. Review `schema.sql` cùng Backend migrations rồi mới chạy trên DB thử nghiệm. Kiểm tra 29 bảng, 12 procedure, 8 trigger, 3 view, index/constraint và các lỗi từ SQL Server.
5. Chỉ sau khi bước 4 đạt mới xét dùng `sample-data.sql` **một lần** trên DB thử nghiệm. Xác nhận bản ghi theo bảng và các `FK`.
6. Kiểm thử API/backend bằng tài khoản tạo qua luồng đăng ký an toàn; **không tự seed ADMIN mật khẩu mặc định**.
7. Đối chiếu TypeORM migrations, xác minh đường đi từ môi trường sạch; chỉ đưa PR public sau khi có biên bản PASS. Nếu muốn bật `READ_COMMITTED_SNAPSHOT`, viết plan migration riêng cho DBA review.

## 6. Điều kiện trước khi đưa lên GitHub public

- [x] Xóa seed ADMIN cố định và hash mật khẩu khỏi file mẫu chia sẻ
- [x] Loại những lệnh reset/drop bảng/database khỏi `schema.sql`
- [x] Giữ GO batch và bản cuối của hai procedure đã vá
- [x] Làm ẩn số điện thoại mẫu
- [ ] Chạy thử trên SQL Server test tách biệt, ghi log và số liệu nghiệm thu
- [ ] Đối chiếu migrations TypeORM, bảng và status thực tế
- [ ] Review URL, điện thoại, địa chỉ, nguồn dữ liệu/demo trước khi công khai
- [ ] Người sở hữu repo xác nhận PR trước khi merge `main`

**Trạng thái:** **DRAFT / REVIEW ONLY**. Không tự động push file SQL, không chạy lệnh SQL, không thay đổi SQL Server hiện tại.

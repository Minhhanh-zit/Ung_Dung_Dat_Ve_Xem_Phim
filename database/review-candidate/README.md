# CineHunt SQL · review candidate (02/11/2026)

**TRẠNG THÁI: DRAFT / CHƯA NGHIỆM THU. Không chạy trên database CineHuntDB hiện tại.**

Nguồn: `CineHunt_Database_V6_3_With_Sample_Data.sql`, SHA-256 ghi trong `manifest.json`. Việc tách file đã qua kiểm tra tĩnh. **Ngày 02/11/2026, theo log Terminal do chủ repo cung cấp, bản ứng viên đã PASS bài kiểm thử trên SQL Server 2022 container cô lập** (schema 87/87 batches, seed 25/25, TypeORM migrations PASS). Chưa kiểm thử toàn bộ nghiệp vụ qua API, chưa nghiệm thu cho môi trường production. Xem [STATUS.md](STATUS.md).

## File trong thư mục này

- `schema.sql`: DDL ứng viên (29 bảng, 12 thủ tục, 8 trigger, 3 view), không bao gồm reset/drop toàn bộ database.
- `sample-data.sql`: dữ liệu mẫu, **không bao gồm user ADMIN hoặc password hash cố định**, không bao gồm 8 số điện thoại demo.
- `SQL_REVIEW.md`: phân tích rủi ro, nguồn dòng SQL, điểm chưa kiểm chứng.
- `manifest.json`: checksum, danh sách các đoạn source được giữ/loại.
- `validate-isolated.mjs`: trình kiểm tra trên **Docker SQL Server mới, container tạm không gắn volume**, **không** kết nối container hiện tại.

## Bước 1. Chỉ xem hướng dẫn (an toàn)

Từ thư mục gốc repo:

```bash
node database/review-candidate/validate-isolated.mjs
```

Lệnh này chỉ in hướng dẫn, **không chạy SQL**.

## Bước 2. Kiểm thử cô lập trên máy Mac (khi đã có Docker)

Yêu cầu: Docker đang chạy, có **image SQL Server** sẵn trong Docker; thư mục `backend/node_modules/mssql` đã được cài (`cd backend && npm ci` nếu chưa). Không bắt buộc dừng SQL Server đang dùng, vì thử nghiệm dùng **container khác và cổng ngẫu nhiên trên 127.0.0.1**.

```bash
node database/review-candidate/validate-isolated.mjs --execute
```

Script sẽ:
1. Kiểm tra SHA-256 hai file SQL theo manifest.
2. Tự tạo container SQL Server **mới** tên `cinehunt-review-...`, **không gắn volume**, password ngẫu nhiên chỉ tồn tại trong phiên kiểm thử, host port tự chọn và ràng buộc localhost.
3. Tạo database `CineHuntDB` **trên container mới**, xác nhận 0 bảng.
4. Chạy `schema.sql`, kiểm tra đúng số bảng/procedure/trigger/view.
5. Chạy `sample-data.sql`, kiểm tra các bảng seed có dữ liệu và **không có users, bookings, payments, tickets được seed**.
6. Xóa container thử nghiệm dù PASS hay FAIL; ghi báo cáo JSON vào Desktop (không có mật khẩu).

Muốn kiểm tra **tương thích TypeORM migrations trên database thử nghiệm mới**, dùng:

```bash
node database/review-candidate/validate-isolated.mjs --execute --migrations
```

Ở lệnh trên, TypeORM chỉ nhận **host/port ngẫu nhiên của container test**, không dùng `DB_HOST` hay `DB_PORT` đang có trong `.env` trên máy. **Không** chạy `npm run migration:run` độc lập, vì lệnh đó có thể trỏ vào SQL Server hiện tại.

Nếu image SQL Server của bạn đặt tên khác, xem `docker images` và đặt `CINEHUNT_REVIEW_SQL_IMAGE` khi chạy (chỉ dùng image tin cậy đã có trên máy).

## Điều kiện merge vào `main`

- [x] Script đã chạy PASS trên Docker test mới, có log Terminal và report JSON được lưu **trên máy người kiểm thử**; chưa upload report vào PR.
- [x] `--migrations` PASS trên instance cô lập theo log ngày 02/11/2026.
- [ ] Hoàn tất review độc lập các file SQL và dữ liệu demo, kèm kiểm thử nghiệp vụ giữ ghế/đặt vé/thanh toán; người sở hữu repository duyệt PR trước khi merge.
- Không chạy lại script gốc V6.3 trên database đang chứa user, phim, seat hold, booking hoặc payment.

Đây chỉ là **bản ứng viên**, không thay thế backup hay kiểm thử nghiệp vụ thanh toán và giữ ghế.

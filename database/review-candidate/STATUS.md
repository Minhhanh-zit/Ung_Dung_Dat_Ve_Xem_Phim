# SQL V6.3 · Isolated Database Review

**TRẠNG THÁI: KIỂM THỬ DATABASE CÔ LẬP PASS, PR VẪN DRAFT. Chưa nghiệm thu nghiệp vụ đặt vé/thanh toán; KHÔNG chạy SQL trên database hiện có.**

Nguồn SQL gốc do người sở hữu repo cung cấp: `CineHunt_Database_V6_3_With_Sample_Data.sql` (3.419 dòng), SHA-256 `d944ee624af7eb1d228a1fdabe05ac38dc0d8e4b5c37e687f52a971bbd178671`.

## Kết quả kiểm thử trên Mac (ngày 02/11/2026)

Theo log Terminal do người sở hữu repo cung cấp, lệnh `node database/review-candidate/validate-isolated.mjs --execute --migrations` đã hoàn thành trên **container SQL Server 2022 tạm** (không volume, cổng localhost ngẫu nhiên):

- [x] Docker startup, localhost TCP và đăng nhập bằng Node `mssql`: PASS
- [x] Kiểm tra instance mới và database `CineHuntDB` trống: PASS
- [x] `schema.sql`: **87/87 batches** PASS; 29 bảng, 12 stored procedures, 8 triggers, 3 views
- [x] `sample-data.sql`: **25/25 batches** PASS, kiểm tra các bảng có dữ liệu và không seed users/bookings/payments/tickets
- [x] TypeORM migrations trên instance SQL tạm: PASS
- [x] Đã xóa container thử nghiệm, không tác động database hiện tại
- [x] Đã push 6 file reviewed vào nhánh review: commit `298e89a`

Báo cáo JSON được tạo **cục bộ trên máy của người dùng**, chưa đính kèm PR: `~/Desktop/CineHunt_Isolated_SQL_1793608165990.json`.

## Checklist trước khi merge main

- [x] Rà soát tĩnh SQL gốc, loại reset/drop và seed ADMIN/hash cố định
- [x] Kiểm thử cấu trúc, seed và migrations trên instance riêng
- [ ] Đưa báo cáo kiểm thử JSON đã rà soát (không chứa mật khẩu/token) vào PR
- [ ] Chạy thêm `--sql-integration` trên Docker riêng (kiểm tra bảng/cột/index, SQL lifecycle, migration; mới thêm vào validator, chưa có log PASS)
- [ ] Kiểm thử tích hợp nghiệp vụ: tạo user → lịch chiếu → giữ ghế → booking → thanh toán trạng thái chờ → hủy/hết hạn → trả ghế; kiểm tra phân quyền
- [ ] Rà soát độc lập các thông tin demo trong seed (địa chỉ, URL) và xác nhận quyền công khai
- [ ] Review cuối và xác nhận merge của người sở hữu repo

**Không chạy trực tiếp `npm run migration:run` trên `backend/.env` hiện có. Không chạy SQL gốc có reset/drop trên database có dữ liệu.**

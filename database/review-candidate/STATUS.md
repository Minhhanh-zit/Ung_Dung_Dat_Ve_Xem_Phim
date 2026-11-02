# SQL V6.3 · Isolated Database Review

**DRAFT / CHƯA ĐƯỢC NGHIỆM THU. Không merge PR và không chạy trên database CineHuntDB đang sử dụng.**

Nguồn do chủ repository cung cấp: `CineHunt_Database_V6_3_With_Sample_Data.sql`, 3.419 dòng, SHA-256 `d944ee624af7eb1d228a1fdabe05ac38dc0d8e4b5c37e687f52a971bbd178671`.

Bản SQL đã tách ra `schema.sql` và `sample-data.sql` **hiện nằm trong ZIP kiểm thử đính kèm cuộc trò chuyện**, **chưa được đưa lên branch này**. Không được xem branch/PR là chứa schema hoàn chỉnh đến khi các file được bổ sung và kiểm chứng.

## Checklist

- [x] Phát hiện 28 lệnh DROP TABLE trong source và reset database.
- [x] Tạo bản ứng viên SQL tách cấu trúc/seed, bỏ seed ADMIN cố định, bỏ cấu hình rollback immediate.
- [x] Kiểm tra tĩnh: 29 bảng, 12 stored procedures, 8 triggers, 3 views.
- [x] Tạo bộ script thử nghiệm bằng Docker SQL container **mới, không volume, cổng localhost ngẫu nhiên**.
- [ ] Bổ sung 6 file từ ZIP vào `database/review-candidate/` trên branch này.
- [ ] Thử trên SQL Server/container mới với `node database/review-candidate/validate-isolated.mjs --execute`.
- [ ] Thử TypeORM migration bằng `--migrations` trên instance tạm.
- [ ] Đính kèm report JSON, đối chiếu số bản ghi/constraint.
- [ ] Chỉ merge sau khi có PASS và review độc lập.

**Không** dùng `npm run migration:run` độc lập trên backend/.env hiện tại, không chạy SQL gốc trên DB hiện hữu, không push file source có seed admin/password hash.

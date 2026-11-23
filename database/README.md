# CineHunt SQL Server - trạng thái nguồn dữ liệu

**Cập nhật 23/11/2026:** thư mục `database/reference/` đã có SQL V6.3 gốc dùng làm **tham chiếu**, và `database/safe/` có bản schema/seed demo cho **database thử nghiệm độc lập**. Điều này **không** chứng minh có thể tự động khởi tạo mọi máy hoặc áp dụng an toàn vào database đang chạy.

Trong môi trường phát triển trước đây, bộ SQL tham chiếu có tên `CineHunt_Database_V6_3_With_Sample_Data.sql` nằm ở máy người phát triển và **chứa câu lệnh DROP TABLE**. File SQL gốc hiện nằm tại `database/reference/CineHunt_Database_V6_3_With_Sample_Data.sql` và **có câu lệnh DROP TABLE**. Chỉ đọc để đối chiếu; không thực thi trên database có dữ liệu cần giữ.

## Cách tiếp tục an toàn

1. Sao lưu database thử nghiệm trước khi thao tác.
2. Rà soát SQL để tách **schema** (khai báo bảng/index/constraint) khỏi **seed data** (người dùng, mật khẩu hash, giao dịch, vé, token, dữ liệu cá nhân).
3. Kiểm tra mọi `DROP`, `DELETE`, `TRUNCATE`, lệnh đổi quyền, tạo tài khoản hoặc connection string. **Không thực thi** trong quá trình review.
4. Chỉ đưa script đã được xác nhận không chứa bí mật/dữ liệu cá nhân lên GitHub sau rà soát và review; các file `database/safe/` cũng chỉ chạy trên DB test riêng.
5. Các migration TypeORM ở `backend/src/migrations/` xử lý các cập nhật sau schema nền; không mặc định chạy trên SQL Server đã chứa dữ liệu.

**Không** chạy lại SQL V6.3, seed hoặc `npm run migration:run` trên database đang dùng để test giữ ghế và booking trước khi có backup và checklist phục hồi.

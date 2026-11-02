# CineHunt SQL Server - trạng thái nguồn dữ liệu

**Chưa có file schema/seed SQL gốc được kiểm tra và đưa lên repository này.** Việc có entity và migration trong `backend/src/` **không đủ** để khởi tạo database hoàn chỉnh từ số 0.

Trong môi trường phát triển trước đây, bộ SQL tham chiếu có tên `CineHunt_Database_V6_3_With_Sample_Data.sql` nằm ở máy người phát triển và **chứa câu lệnh DROP TABLE**. File đó đã được **loại khỏi commit public** để tránh công khai dữ liệu mẫu và chạy nhầm script có tác dụng xóa bảng.

## Cách tiếp tục an toàn

1. Sao lưu database thử nghiệm trước khi thao tác.
2. Rà soát SQL để tách **schema** (khai báo bảng/index/constraint) khỏi **seed data** (người dùng, mật khẩu hash, giao dịch, vé, token, dữ liệu cá nhân).
3. Kiểm tra mọi `DROP`, `DELETE`, `TRUNCATE`, lệnh đổi quyền, tạo tài khoản hoặc connection string. **Không thực thi** trong quá trình review.
4. Chỉ đưa script đã được xác nhận không chứa bí mật/dữ liệu cá nhân lên GitHub dưới dạng PR riêng.
5. Các migration TypeORM ở `backend/src/migrations/` xử lý các cập nhật sau schema nền; không mặc định chạy trên SQL Server đã chứa dữ liệu.

**Không** chạy lại SQL V6.3, seed hoặc `npm run migration:run` trên database đang dùng để test giữ ghế và booking trước khi có backup và checklist phục hồi.

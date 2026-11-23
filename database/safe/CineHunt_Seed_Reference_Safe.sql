-- Dữ liệu THAM CHIẾU không chứa dữ liệu cá nhân: roles, seat_types, genres, concession_combos.
-- Lấy từ V6.3 (dòng 1943-1948, 2072-2096). KHÔNG gồm: tài khoản admin/hash mật khẩu, phim, lịch chiếu, đơn, vé, token.
-- Chạy SAU CineHunt_Schema_Safe.sql, trên cùng DB thử nghiệm. Idempotent: chỉ chèn khi bảng còn trống.
SET NOCOUNT ON;
GO
IF DB_NAME() <> N'CineHunt_Test'
BEGIN
    RAISERROR (N'DỪNG: không seed vào DB hệ thống/DB đang dùng.', 16, 1);
    SET NOEXEC ON;
END;
GO
IF NOT EXISTS (SELECT 1 FROM dbo.roles)
    INSERT INTO dbo.roles(role_code, role_name, description) VALUES
    ('CUSTOMER', N'Khách hàng', N'Đặt vé và quản lý vé cá nhân'),
    ('STAFF', N'Nhân viên', N'Quét vé và hỗ trợ vận hành'),
    ('ADMIN', N'Quản trị viên', N'Quản lý toàn bộ hệ thống');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.seat_types)
    INSERT INTO dbo.seat_types(type_code, type_name, price_multiplier) VALUES
    ('NORMAL', N'Ghế thường', 1.00),
    ('VIP', N'Ghế VIP', 1.30),
    ('COUPLE', N'Ghế đôi', 2.00);
GO
IF NOT EXISTS (SELECT 1 FROM dbo.genres)
    INSERT INTO dbo.genres(genre_name, slug) VALUES
    (N'Hành động', 'hanh-dong'),
    (N'Hoạt hình', 'hoat-hinh'),
    (N'Kinh dị', 'kinh-di'),
    (N'Tình cảm', 'tinh-cam'),
    (N'Khoa học viễn tưởng', 'khoa-hoc-vien-tuong');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.concession_combos)
    INSERT INTO dbo.concession_combos(combo_name, description, price) VALUES
    (N'Combo Solo', N'1 bắp vừa + 1 nước vừa', 79000),
    (N'Combo Couple', N'1 bắp lớn + 2 nước vừa', 129000),
    (N'Combo Family', N'2 bắp lớn + 4 nước vừa', 239000);
GO
-- Tài khoản ADMIN: KHÔNG seed bằng SQL. Tạo bằng backend/scripts/create-admin.cjs với mật khẩu riêng trên máy bạn.
SET NOEXEC OFF;
GO
SELECT 'roles' t, COUNT(*) c FROM dbo.roles UNION ALL SELECT 'seat_types', COUNT(*) FROM dbo.seat_types
UNION ALL SELECT 'genres', COUNT(*) FROM dbo.genres UNION ALL SELECT 'concession_combos', COUNT(*) FROM dbo.concession_combos;
GO

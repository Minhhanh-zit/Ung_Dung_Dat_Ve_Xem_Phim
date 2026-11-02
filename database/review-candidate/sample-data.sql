-- SOURCE: CineHunt_Database_V6_3_With_Sample_Data.sql
-- SOURCE SHA-256: d944ee624af7eb1d228a1fdabe05ac38dc0d8e4b5c37e687f52a971bbd178671
-- DATE: 2026-11-02
-- STATIC SPLIT ONLY. CHUA THUC THI / CHUA KIEM THU TREN SQL SERVER.
-- DATA DEMO, KHONG chua tai khoan ADMIN hay password_hash co dinh.
-- Da an danh 8 so dien thoai mau thanh NULL.
-- Chi thuc thi tren CineHuntDB THU NGHIEM, da tao schema, va CHUA CO seed.
-- Co du lieu phim, rap, phong, ghe, suat chieu tuong doi theo GETDATE().
-- Khong chay tren database dang su dung; khong an toan khi chay lai.
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
USE master;
GO
IF DB_ID(N'CineHuntDB') IS NULL
BEGIN
  PRINT N'STOP: Khong ton tai database CineHuntDB.';
  SET NOEXEC ON;
END;
GO
USE CineHuntDB;
GO
IF OBJECT_ID(N'dbo.roles', N'U') IS NULL
   OR OBJECT_ID(N'dbo.movies', N'U') IS NULL
   OR OBJECT_ID(N'dbo.cinemas', N'U') IS NULL
BEGIN
  PRINT N'STOP: Chua tao schema CineHunt day du.';
  SET NOEXEC ON;
END;
GO
IF EXISTS (SELECT 1 FROM dbo.roles)
   OR EXISTS (SELECT 1 FROM dbo.movies)
   OR EXISTS (SELECT 1 FROM dbo.cinemas)
BEGIN
  PRINT N'STOP: Database da co data. Khong seed lai.';
  SET NOEXEC ON;
END;
GO
-- ORIGINAL LINES 2071-2077

INSERT INTO dbo.seat_types(type_code, type_name, price_multiplier)
VALUES
('NORMAL', N'Ghế thường', 1.00),
('VIP', N'Ghế VIP', 1.30),
('COUPLE', N'Ghế đôi', 2.00);
GO


-- ORIGINAL LINES 2078-2086

INSERT INTO dbo.genres(genre_name, slug)
VALUES
(N'Hành động', 'hanh-dong'),
(N'Hoạt hình', 'hoat-hinh'),
(N'Kinh dị', 'kinh-di'),
(N'Tình cảm', 'tinh-cam'),
(N'Khoa học viễn tưởng', 'khoa-hoc-vien-tuong');
GO


-- ORIGINAL LINES 2087-2094


INSERT INTO dbo.concession_combos(combo_name, description, price)
VALUES
(N'Combo Solo', N'1 bắp vừa + 1 nước vừa', 79000),
(N'Combo Couple', N'1 bắp lớn + 2 nước vừa', 129000),
(N'Combo Family', N'2 bắp lớn + 4 nước vừa', 239000);
GO


-- ORIGINAL LINES 2095-2104



INSERT INTO dbo.cinemas(
    cinema_name, address, city, district, phone, latitude, longitude, status
)
VALUES
(N'CineHunt Cầu Giấy', N'11 Duy Tân, Dịch Vọng Hậu', N'Hà Nội', N'Cầu Giấy', NULL, 21.0309000, 105.7828000, 'ACTIVE'),
(N'CineHunt Hà Đông', N'2 Trần Phú, Mộ Lao', N'Hà Nội', N'Hà Đông', NULL, 20.9801000, 105.7909000, 'ACTIVE');
GO


-- ORIGINAL LINES 2105-2118

DECLARE @CinemaCauGiay INT = (
    SELECT cinema_id FROM dbo.cinemas WHERE cinema_name = N'CineHunt Cầu Giấy'
);
DECLARE @CinemaHaDong INT = (
    SELECT cinema_id FROM dbo.cinemas WHERE cinema_name = N'CineHunt Hà Đông'
);

INSERT INTO dbo.rooms(cinema_id, room_name, room_type, total_seats, status)
VALUES
(@CinemaCauGiay, N'Phòng 1', 'STANDARD', 20, 'ACTIVE'),
(@CinemaCauGiay, N'Phòng VIP', 'VIP', 12, 'ACTIVE'),
(@CinemaHaDong, N'Phòng 1', 'STANDARD', 20, 'ACTIVE');
GO


-- ORIGINAL LINES 2119-2192

/* Ghế cho từng phòng */
DECLARE @NormalSeatTypeId INT = (
    SELECT seat_type_id FROM dbo.seat_types WHERE type_code = 'NORMAL'
);
DECLARE @VipSeatTypeId INT = (
    SELECT seat_type_id FROM dbo.seat_types WHERE type_code = 'VIP'
);
DECLARE @CoupleSeatTypeId INT = (
    SELECT seat_type_id FROM dbo.seat_types WHERE type_code = 'COUPLE'
);

DECLARE @RoomStandard1 INT = (
    SELECT r.room_id
    FROM dbo.rooms r
    INNER JOIN dbo.cinemas c ON c.cinema_id = r.cinema_id
    WHERE c.cinema_name = N'CineHunt Cầu Giấy' AND r.room_name = N'Phòng 1'
);
DECLARE @RoomVip INT = (
    SELECT r.room_id
    FROM dbo.rooms r
    INNER JOIN dbo.cinemas c ON c.cinema_id = r.cinema_id
    WHERE c.cinema_name = N'CineHunt Cầu Giấy' AND r.room_name = N'Phòng VIP'
);
DECLARE @RoomStandard2 INT = (
    SELECT r.room_id
    FROM dbo.rooms r
    INNER JOIN dbo.cinemas c ON c.cinema_id = r.cinema_id
    WHERE c.cinema_name = N'CineHunt Hà Đông' AND r.room_name = N'Phòng 1'
);

;WITH RoomList AS (
    SELECT @RoomStandard1 AS room_id
    UNION ALL
    SELECT @RoomStandard2
),
SeatNumbers AS (
    SELECT 1 AS seat_number
    UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
),
SeatRows AS (
    SELECT 'A' AS seat_row, @NormalSeatTypeId AS seat_type_id
    UNION ALL SELECT 'B', @NormalSeatTypeId
    UNION ALL SELECT 'C', @VipSeatTypeId
    UNION ALL SELECT 'D', @VipSeatTypeId
)
INSERT INTO dbo.seats(room_id, seat_type_id, seat_row, seat_number, seat_label, status)
SELECT
    rl.room_id,
    sr.seat_type_id,
    sr.seat_row,
    sn.seat_number,
    CONCAT(sr.seat_row, sn.seat_number),
    'ACTIVE'
FROM RoomList rl
CROSS JOIN SeatRows sr
CROSS JOIN SeatNumbers sn;

;WITH VipSeatNumbers AS (
    SELECT 1 AS seat_number
    UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
)
INSERT INTO dbo.seats(room_id, seat_type_id, seat_row, seat_number, seat_label, status)
SELECT @RoomVip, @VipSeatTypeId, 'A', seat_number, CONCAT('A', seat_number), 'ACTIVE'
FROM VipSeatNumbers
UNION ALL
SELECT @RoomVip, @VipSeatTypeId, 'B', seat_number, CONCAT('B', seat_number), 'ACTIVE'
FROM VipSeatNumbers;

INSERT INTO dbo.seats(room_id, seat_type_id, seat_row, seat_number, seat_label, status)
VALUES
(@RoomVip, @CoupleSeatTypeId, 'C', 1, 'C1', 'ACTIVE'),
(@RoomVip, @CoupleSeatTypeId, 'C', 2, 'C2', 'ACTIVE');
GO


-- ORIGINAL LINES 2193-2246

/* Phim */
INSERT INTO dbo.movies(
    title, original_title, description, duration_minutes,
    release_date, end_date, age_rating, director, actors,
    country, language, poster_url, banner_url, trailer_url,
    average_rating, status
)
VALUES
(
    N'Đại Chiến Đa Vũ Trụ', N'Multiverse War',
    N'Nhóm anh hùng phải ngăn chặn một sự kiện làm sụp đổ các dòng thời gian.',
    135, DATEADD(DAY, -7, CAST(GETDATE() AS DATE)), DATEADD(DAY, 45, CAST(GETDATE() AS DATE)),
    'T13', N'Nguyễn Minh', N'Anh Tú, Lan Phương, Hoàng Nam',
    N'Việt Nam', N'Tiếng Việt',
    N'https://example.com/posters/multiverse-war.jpg',
    N'https://example.com/banners/multiverse-war.jpg',
    N'https://example.com/trailers/multiverse-war',
    4.30, 'NOW_SHOWING'
),
(
    N'Hành Tinh Xanh', N'The Blue Planet',
    N'Một hành trình khoa học viễn tưởng khám phá hành tinh có sự sống ngoài Trái Đất.',
    120, DATEADD(DAY, -3, CAST(GETDATE() AS DATE)), DATEADD(DAY, 40, CAST(GETDATE() AS DATE)),
    'P', N'Lê Hoàng', N'Minh Khang, Thu Hà',
    N'Việt Nam', N'Tiếng Việt',
    N'https://example.com/posters/blue-planet.jpg',
    N'https://example.com/banners/blue-planet.jpg',
    N'https://example.com/trailers/blue-planet',
    4.10, 'NOW_SHOWING'
),
(
    N'Ngôi Nhà Sau Cánh Rừng', N'The House Beyond The Woods',
    N'Một nhóm bạn trẻ khám phá căn nhà bỏ hoang và đối mặt với bí mật kinh hoàng.',
    105, DATEADD(DAY, -1, CAST(GETDATE() AS DATE)), DATEADD(DAY, 30, CAST(GETDATE() AS DATE)),
    'T16', N'Phạm Quang', N'Bảo Anh, Nhật Minh',
    N'Việt Nam', N'Tiếng Việt',
    N'https://example.com/posters/house-woods.jpg',
    N'https://example.com/banners/house-woods.jpg',
    N'https://example.com/trailers/house-woods',
    3.90, 'NOW_SHOWING'
),
(
    N'Kỷ Nguyên Robot', N'Age of Robots',
    N'Tương lai nơi con người và robot phải hợp tác để bảo vệ thành phố.',
    128, DATEADD(DAY, 20, CAST(GETDATE() AS DATE)), DATEADD(DAY, 80, CAST(GETDATE() AS DATE)),
    'T13', N'Trần Vũ', N'Gia Huy, Mai Anh',
    N'Việt Nam', N'Tiếng Việt',
    N'https://example.com/posters/age-robots.jpg',
    N'https://example.com/banners/age-robots.jpg',
    N'https://example.com/trailers/age-robots',
    0, 'COMING_SOON'
);
GO


-- ORIGINAL LINES 2247-2266

DECLARE @MovieAction INT = (SELECT movie_id FROM dbo.movies WHERE title = N'Đại Chiến Đa Vũ Trụ');
DECLARE @MoviePlanet INT = (SELECT movie_id FROM dbo.movies WHERE title = N'Hành Tinh Xanh');
DECLARE @MovieHorror INT = (SELECT movie_id FROM dbo.movies WHERE title = N'Ngôi Nhà Sau Cánh Rừng');
DECLARE @MovieRobot INT = (SELECT movie_id FROM dbo.movies WHERE title = N'Kỷ Nguyên Robot');
DECLARE @GenreAction INT = (SELECT genre_id FROM dbo.genres WHERE slug = 'hanh-dong');
DECLARE @GenreAnimation INT = (SELECT genre_id FROM dbo.genres WHERE slug = 'hoat-hinh');
DECLARE @GenreHorror INT = (SELECT genre_id FROM dbo.genres WHERE slug = 'kinh-di');
DECLARE @GenreScifi INT = (SELECT genre_id FROM dbo.genres WHERE slug = 'khoa-hoc-vien-tuong');

INSERT INTO dbo.movie_genres(movie_id, genre_id)
VALUES
(@MovieAction, @GenreAction),
(@MovieAction, @GenreScifi),
(@MoviePlanet, @GenreAnimation),
(@MoviePlanet, @GenreScifi),
(@MovieHorror, @GenreHorror),
(@MovieRobot, @GenreAction),
(@MovieRobot, @GenreScifi);
GO


-- ORIGINAL LINES 2267-2307

DECLARE @SeedMovie1 INT = (SELECT movie_id FROM dbo.movies WHERE title = N'Đại Chiến Đa Vũ Trụ');
DECLARE @SeedMovie2 INT = (SELECT movie_id FROM dbo.movies WHERE title = N'Hành Tinh Xanh');
DECLARE @SeedMovie3 INT = (SELECT movie_id FROM dbo.movies WHERE title = N'Ngôi Nhà Sau Cánh Rừng');
DECLARE @SeedRoom1 INT = (
    SELECT r.room_id FROM dbo.rooms r
    INNER JOIN dbo.cinemas c ON c.cinema_id = r.cinema_id
    WHERE c.cinema_name = N'CineHunt Cầu Giấy' AND r.room_name = N'Phòng 1'
);
DECLARE @SeedRoomVip INT = (
    SELECT r.room_id FROM dbo.rooms r
    INNER JOIN dbo.cinemas c ON c.cinema_id = r.cinema_id
    WHERE c.cinema_name = N'CineHunt Cầu Giấy' AND r.room_name = N'Phòng VIP'
);
DECLARE @SeedRoom2 INT = (
    SELECT r.room_id FROM dbo.rooms r
    INNER JOIN dbo.cinemas c ON c.cinema_id = r.cinema_id
    WHERE c.cinema_name = N'CineHunt Hà Đông' AND r.room_name = N'Phòng 1'
);
DECLARE @Tomorrow DATE = DATEADD(DAY, 1, CAST(GETDATE() AS DATE));
DECLARE @DayAfterTomorrow DATE = DATEADD(DAY, 2, CAST(GETDATE() AS DATE));

INSERT INTO dbo.showtimes(movie_id, room_id, start_time, end_time, base_price, status)
VALUES
(@SeedMovie1, @SeedRoom1,
 DATEADD(HOUR, 10, CAST(@Tomorrow AS DATETIME2)),
 DATEADD(MINUTE, 150, DATEADD(HOUR, 10, CAST(@Tomorrow AS DATETIME2))),
 80000, 'OPEN'),
(@SeedMovie2, @SeedRoom1,
 DATEADD(HOUR, 14, CAST(@Tomorrow AS DATETIME2)),
 DATEADD(MINUTE, 135, DATEADD(HOUR, 14, CAST(@Tomorrow AS DATETIME2))),
 75000, 'OPEN'),
(@SeedMovie3, @SeedRoomVip,
 DATEADD(HOUR, 19, CAST(@Tomorrow AS DATETIME2)),
 DATEADD(MINUTE, 120, DATEADD(HOUR, 19, CAST(@Tomorrow AS DATETIME2))),
 120000, 'OPEN'),
(@SeedMovie1, @SeedRoom2,
 DATEADD(HOUR, 18, CAST(@DayAfterTomorrow AS DATETIME2)),
 DATEADD(MINUTE, 150, DATEADD(HOUR, 18, CAST(@DayAfterTomorrow AS DATETIME2))),
 85000, 'OPEN');
GO


-- ORIGINAL LINES 2308-2319

INSERT INTO dbo.showtime_seats(showtime_id, seat_id, price, status)
SELECT
    sh.showtime_id,
    s.seat_id,
    CAST(sh.base_price * st.price_multiplier AS DECIMAL(12,2)),
    'AVAILABLE'
FROM dbo.showtimes sh
INNER JOIN dbo.seats s ON s.room_id = sh.room_id
INNER JOIN dbo.seat_types st ON st.seat_type_id = s.seat_type_id
WHERE s.status = 'ACTIVE';
GO


-- ORIGINAL LINES 2320-2330

UPDATE r
SET r.total_seats = x.total_seats
FROM dbo.rooms r
INNER JOIN (
    SELECT room_id, COUNT(*) AS total_seats
    FROM dbo.seats
    WHERE status = 'ACTIVE'
    GROUP BY room_id
) x ON x.room_id = r.room_id;
GO


-- ORIGINAL LINES 2621-2637


INSERT INTO dbo.genres(genre_name, slug)
SELECT v.genre_name, v.slug
FROM (VALUES
    (N'Hồi hộp',  'hoi-hop'),
    (N'Tâm lý',   'tam-ly'),
    (N'Hài',      'hai'),
    (N'Gia đình', 'gia-dinh'),
    (N'Phiêu lưu','phieu-luu'),
    (N'Thần thoại','than-thoai'),
    (N'Bí ẩn',    'bi-an')
) AS v(genre_name, slug)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.genres g WHERE g.slug = v.slug
);
GO


-- ORIGINAL LINES 2638-2758

INSERT INTO dbo.movies(
    title, original_title, description, duration_minutes,
    release_date, age_rating, director, actors,
    country, language, poster_url,
    average_rating, status
)
SELECT v.title, v.original_title, v.description, v.duration_minutes,
       v.release_date, v.age_rating, v.director, v.actors,
       v.country, v.language, v.poster_url,
       0, v.status
FROM (VALUES
(N'Backrooms: Thực Thể Quỷ Quyệt', N'Backrooms',
 N'Dựa trên hiện tượng creepypasta ám ảnh nhất thập kỷ, bộ phim theo chân người phụ nữ rơi vào mê cung vô tận và chạy đua để thoát ra.',
 110, '20260626', 'T16', N'Kane Parsons', N'Chiwetel Ejiofor, Renate Reinsve, Mark Duplass',
 N'Mỹ', N'Tiếng Anh - Phụ đề Tiếng Việt', N'https://example.com/posters/backrooms.jpg', 'COMING_SOON'),

(N'Huyết Ngải Ái Tình', NULL,
 N'Bùa yêu dẫn lối, quỷ dữ đưa tang — câu chuyện kinh dị tâm lý về một lời nguyền tình yêu đẫm máu.',
 98, '20260717', 'T18', N'Razka Robby Ertanto', N'Anjasmara, Lulu Tobing, Carissa Perusset',
 N'Indonesia', N'Tiếng Indonesia - Phụ đề Tiếng Việt', N'https://example.com/posters/huyet-ngai-ai-tinh.jpg', 'COMING_SOON'),

(N'Quỷ Bắt Hồn', NULL,
 N'Đúng tháng cô hồn, một gia đình đối mặt với thế lực siêu nhiên đe dọa đến từng thành viên.',
 103, '20260710', 'T16', N'Hải Bùi',
 N'Quang Tuấn, Anh Phạm, Đinh Y Nhung, bé Huy Anh, bé Gia Phong, La Thành, Uy Trần, Sỹ Toàn, Quốc Tân, bé Minh Anh, Ngân Quỳnh, Thanh Châu, Phương Linh',
 N'Việt Nam', N'Tiếng Việt', N'https://example.com/posters/quy-bat-hon.jpg', 'COMING_SOON'),

(N'Minions & Quái Vật', NULL,
 N'Các chú Minion tinh nghịch bước vào một cuộc phiêu lưu mới đầy quái vật và tiếng cười.',
 90, '20260701', 'P', N'Pierre Coffin', NULL,
 N'Mỹ', N'Phụ đề Tiếng Việt & Lồng Tiếng Việt', N'https://example.com/posters/minions-quai-vat.jpg', 'COMING_SOON'),

(N'Phim Điện Ảnh Doraemon: Nobita và Lâu Đài Dưới Đáy Biển (Phiên bản mới)', NULL,
 N'Nobita và những người bạn khám phá tòa lâu đài huyền bí dưới đáy đại dương.',
 101, '20260522', 'P', N'Tetsuo Yajima',
 N'Wasabi Mizuta, Megumi Oohara, Yumi Kakazu, Subaru Kimura, Tomokazu Seki',
 N'Nhật Bản', N'Tiếng Nhật - Phụ đề Tiếng Việt/Lồng tiếng Việt', N'https://example.com/posters/doraemon-lau-dai-day-bien.jpg', 'COMING_SOON'),

(N'The Odyssey', NULL,
 N'Bộ phim sử thi của Christopher Nolan, được quay hoàn toàn bằng máy quay IMAX, tái hiện hành trình huyền thoại Odyssey.',
 173, '20260717', 'T16', N'Christopher Nolan',
 N'Benny Safdie, Anne Hathaway, Matt Damon, Robert Pattinson, Tom Holland, Zendaya, Charlize Theron',
 N'Mỹ', N'English - Vietnamese subtitle', N'https://example.com/posters/the-odyssey.jpg', 'COMING_SOON'),

(N'Phim Điện Ảnh Thám Tử Lừng Danh Conan: Thiên Thần Sa Ngã Trên Xa Lộ', NULL,
 N'Conan cùng đồng đội phá án trong một vụ việc bí ẩn bùng nổ tốc độ trên xa lộ.',
 109, '20260724', 'T13', N'Hasui Takahiro',
 N'Minami Takayama, Wakana Yamazaki, Rikiya Koyama, Miyuki Sawashiro, Shin-ichiro Miki',
 N'Nhật Bản', N'Tiếng Nhật - Phụ đề Tiếng Việt; Lồng tiếng', N'https://example.com/posters/conan-thien-than-sa-nga.jpg', 'COMING_SOON'),

(N'Hành Trình Của Moana', NULL,
 N'Moana cùng Maui tiếp tục hành trình phiêu lưu mới trên đại dương bao la.',
 116, '20260710', 'K', N'Thomas Kail', N'Catherine Laga''aia, Dwayne Johnson, John Tui',
 N'Mỹ', N'Tiếng Anh - Phụ đề Tiếng Việt; Lồng tiếng Việt', N'https://example.com/posters/hanh-trinh-cua-moana.jpg', 'COMING_SOON'),

(N'Cảm Ơn Người Đã Thức Cùng Tôi', NULL,
 N'Câu chuyện dành tặng tinh thần, tình yêu và tình bạn của một nhóm người trẻ cùng nhau vượt qua giông bão cuộc đời.',
 137, '20260227', 'K', N'Chung Chí Công', N'Võ Phan Kim Khánh, Trần Doãn Hoàng, Nguyễn Hùng',
 N'Việt Nam', N'Tiếng Việt', N'https://example.com/posters/cam-on-nguoi-da-thuc-cung-toi.jpg', 'NOW_SHOWING'),

(N'Đêm Truy Sát', NULL,
 N'Từ đạo diễn phim Rambo: Last Blood, một cuộc truy sát nghẹt thở xuyên đêm.',
 91, '20260717', 'T18', N'Adrian Grunberg', N'Milla Jovovich, Isabel Myers, Shane Williams',
 N'Mỹ', N'Tiếng Anh - Phụ đề Tiếng Việt', N'https://example.com/posters/dem-truy-sat.jpg', 'COMING_SOON'),

(N'Ám Ảnh', NULL,
 N'Cẩn thận với kẻ bạn đang cùng sống — một câu chuyện giật gân đầy ám ảnh.',
 109, '20260619', 'T18', N'Curry Barker',
 N'Michael Johnston, Inde Navarrette, Cooper Tomlinson, Megan Lawless, Andy Richter',
 N'Mỹ', N'Kinh dị, Giật gân - Phụ đề Tiếng Việt', N'https://example.com/posters/am-anh.jpg', 'COMING_SOON'),

(N'Mẹ Ơi, Về Nhà', NULL,
 N'Bộ phim Việt - Hàn về thế hệ "cửa hàng tiệp lợi", nếu cả đời không hoang mang thì sao?',
 98, '20260710', 'T16', N'Yun Byung Ki', N'Lee Yi Kyung, Hoàng Yến Chibi, Choi Daniel, Minh Hà',
 N'Hàn Quốc', N'Tiếng Hàn - Phụ đề Tiếng Việt', N'https://example.com/posters/me-oi-ve-nha.jpg', 'COMING_SOON'),

(N'Ma Nữ Oán Tình', NULL,
 N'Màn trả thù tình nồng bỏng và điên loạn từ màn ảnh Thái Lan.',
 96, '20260710', 'T18', N'KrisPond Witthayakhajorndet, KruNing Bhanbhassa Dhubthien, Ping Lumpraploeng',
 N'Engfa Waraha, Apo Nattawin, Freen Sarocha, Jes Jespipat',
 N'Thái Lan', N'Tiếng Thái - Phụ đề Tiếng Việt, Tiếng Anh', N'https://example.com/posters/ma-nu-oan-tinh.jpg', 'COMING_SOON'),

(N'Câu Chuyện Đồ Chơi 5', N'Toy Story 5',
 N'Woody, Buzz và những người bạn đồ chơi trở lại với hành trình phiêu lưu mới đầy cảm xúc.',
 102, '20260619', 'P', N'Kenna Harris, Andrew Stanton', N'Keanu Reeves, Tom Hanks, Annie Potts',
 N'Mỹ', N'Tiếng Anh - Phụ đề Tiếng Việt và Lồng tiếng Việt', N'https://example.com/posters/toy-story-5.jpg', 'COMING_SOON'),

(N'Colony: Bầy Xác Sống', NULL,
 N'Từ đạo diễn "Train to Busan" và "Hellbound" — Yeon Sang-ho, một đại dịch xác sống nhấn chìm cả một vùng đất.',
 122, '20260612', 'T16', N'YEON Sang-ho', N'Gianna JUN, KOO Kyo-hwan, JI Chang-wook, Shin Hyun-been, KIM Shin-rock, GO Soo',
 N'Hàn Quốc', N'Tiếng Hàn - Phụ đề Tiếng Việt và Tiếng Anh', N'https://example.com/posters/colony-bay-xac-song.jpg', 'COMING_SOON'),

(N'Supergirl', NULL,
 N'Nữ siêu anh hùng nhà DC bước ra ánh sáng trong hành trình chinh phục sức mạnh và bản thân.',
 108, '20250626', 'T13', N'Craig Gillespie',
 N'Milly Alcock, Matthias Schoenaerts, Eve Ridley, David Krumholtz, Emily Beecham, Jason Momoa',
 N'Mỹ', N'Tiếng Anh - Phụ đề Tiếng Việt', N'https://example.com/posters/supergirl.jpg', 'COMING_SOON'),

(N'Leviticus: Bóng Quỷ', NULL,
 N'Dục vọng phải sám hối, quỷ dữ đến hỏi tội — kiệt tác kinh dị được mong chờ nhất.',
 85, '20260703', 'T18', N'Adrian Chiarella', N'Joe Bird, Stacy Clausen, Jeremy Blewitt',
 N'Mỹ', N'Tiếng Anh và phụ đề Tiếng Việt', N'https://example.com/posters/leviticus-bong-quy.jpg', 'COMING_SOON'),

(N'Đồng Dao Ma Quái', NULL,
 N'Một khi xúc xắc lăn, mạng sống cũng được đặt cược trong trò chơi đồng dao rùng rợn.',
 123, '20260703', 'T18', N'Preaw Chanatip Wongpontree',
 N'Panisara Rikulsurakan, Ongart Jeamcharoenpornkul, Win Sakulsangprapha',
 N'Thái Lan', N'Tiếng Thái - Phụ đề Tiếng Việt', N'https://example.com/posters/dong-dao-ma-quai.jpg', 'COMING_SOON'),

(N'Lầu Chú Hỏa', NULL,
 N'Lời nguyền con ma nhà họ hứa — khai đàn, gọi hồn, đánh thức ác linh.',
 94, '20260612', 'T18', N'Hùng Trần',
 N'Trần Kỳ Anh, Nguyễn Minh Thời, Ngọc Chi Bảo, Phụng Hoàng, Nguyễn Công Nương, Dũng Hà',
 N'Việt Nam', N'Tiếng Việt', N'https://example.com/posters/lau-chu-hoa.jpg', 'COMING_SOON')
) AS v(title, original_title, description, duration_minutes, release_date, age_rating,
       director, actors, country, language, poster_url, status)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.movies m WHERE m.title = v.title
);
GO


-- ORIGINAL LINES 2759-2841

;WITH G AS (
    SELECT genre_id, slug FROM dbo.genres
),
M AS (
    SELECT movie_id, title FROM dbo.movies
),
MovieGenreMap AS (
    SELECT title, slug FROM (VALUES
        (N'Backrooms: Thực Thể Quỷ Quyệt', 'hoi-hop'),
        (N'Backrooms: Thực Thể Quỷ Quyệt', 'khoa-hoc-vien-tuong'),
        (N'Backrooms: Thực Thể Quỷ Quyệt', 'kinh-di'),

        (N'Huyết Ngải Ái Tình', 'hoi-hop'),
        (N'Huyết Ngải Ái Tình', 'kinh-di'),
        (N'Huyết Ngải Ái Tình', 'tam-ly'),

        (N'Quỷ Bắt Hồn', 'hanh-dong'),
        (N'Quỷ Bắt Hồn', 'kinh-di'),

        (N'Minions & Quái Vật', 'hoat-hinh'),

        (N'Phim Điện Ảnh Doraemon: Nobita và Lâu Đài Dưới Đáy Biển (Phiên bản mới)', 'hoat-hinh'),
        (N'Phim Điện Ảnh Doraemon: Nobita và Lâu Đài Dưới Đáy Biển (Phiên bản mới)', 'phieu-luu'),

        (N'The Odyssey', 'hanh-dong'),
        (N'The Odyssey', 'than-thoai'),

        (N'Phim Điện Ảnh Thám Tử Lừng Danh Conan: Thiên Thần Sa Ngã Trên Xa Lộ', 'bi-an'),
        (N'Phim Điện Ảnh Thám Tử Lừng Danh Conan: Thiên Thần Sa Ngã Trên Xa Lộ', 'hanh-dong'),
        (N'Phim Điện Ảnh Thám Tử Lừng Danh Conan: Thiên Thần Sa Ngã Trên Xa Lộ', 'hoat-hinh'),

        (N'Hành Trình Của Moana', 'gia-dinh'),
        (N'Hành Trình Của Moana', 'hai'),
        (N'Hành Trình Của Moana', 'hanh-dong'),
        (N'Hành Trình Của Moana', 'phieu-luu'),

        (N'Cảm Ơn Người Đã Thức Cùng Tôi', 'gia-dinh'),
        (N'Cảm Ơn Người Đã Thức Cùng Tôi', 'tinh-cam'),

        (N'Đêm Truy Sát', 'hanh-dong'),
        (N'Đêm Truy Sát', 'hoi-hop'),

        (N'Ám Ảnh', 'hoi-hop'),
        (N'Ám Ảnh', 'kinh-di'),

        (N'Mẹ Ơi, Về Nhà', 'tam-ly'),
        (N'Mẹ Ơi, Về Nhà', 'tinh-cam'),

        (N'Ma Nữ Oán Tình', 'hai'),
        (N'Ma Nữ Oán Tình', 'kinh-di'),
        (N'Ma Nữ Oán Tình', 'tam-ly'),

        (N'Câu Chuyện Đồ Chơi 5', 'hoat-hinh'),
        (N'Câu Chuyện Đồ Chơi 5', 'phieu-luu'),

        (N'Colony: Bầy Xác Sống', 'hanh-dong'),
        (N'Colony: Bầy Xác Sống', 'hoi-hop'),
        (N'Colony: Bầy Xác Sống', 'khoa-hoc-vien-tuong'),

        (N'Supergirl', 'hanh-dong'),
        (N'Supergirl', 'phieu-luu'),

        (N'Leviticus: Bóng Quỷ', 'kinh-di'),

        (N'Đồng Dao Ma Quái', 'hoi-hop'),
        (N'Đồng Dao Ma Quái', 'kinh-di'),
        (N'Đồng Dao Ma Quái', 'than-thoai'),

        (N'Lầu Chú Hỏa', 'bi-an'),
        (N'Lầu Chú Hỏa', 'kinh-di')
    ) AS x(title, slug)
)
INSERT INTO dbo.movie_genres(movie_id, genre_id)
SELECT DISTINCT M.movie_id, G.genre_id
FROM MovieGenreMap MGM
INNER JOIN M ON M.title = MGM.title
INNER JOIN G ON G.slug = MGM.slug
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.movie_genres mg
    WHERE mg.movie_id = M.movie_id AND mg.genre_id = G.genre_id
);
GO


-- ORIGINAL LINES 2860-2875


INSERT INTO dbo.cinemas(cinema_name, address, city, district, phone, latitude, longitude, status)
SELECT v.cinema_name, v.address, v.city, v.district, v.phone, v.latitude, v.longitude, 'ACTIVE'
FROM (VALUES
    (N'CineHunt Vincom Bà Triệu',   N'191 Bà Triệu',            N'Hà Nội',            N'Hai Bà Trưng', NULL, 21.0107000, 105.8482000),
    (N'CineHunt Aeon Long Biên',    N'27 Cổ Linh',               N'Hà Nội',            N'Long Biên',    NULL, 21.0466000, 105.8935000),
    (N'CineHunt Landmark 81',       N'720A Điện Biên Phủ',       N'TP. Hồ Chí Minh',   N'Bình Thạnh',   NULL, 10.7945000, 106.7219000),
    (N'CineHunt Vincom Đồng Khởi',  N'72 Lê Thánh Tôn',          N'TP. Hồ Chí Minh',   N'Quận 1',       NULL, 10.7772000, 106.7030000),
    (N'CineHunt Vincom Đà Nẵng',    N'910A Ngô Quyền',           N'Đà Nẵng',           N'Sơn Trà',      NULL, 16.0678000, 108.2359000),
    (N'CineHunt Sun World Bà Nà',   N'Suối Mơ, Hòa Ninh',        N'Đà Nẵng',           N'Hòa Vang',     NULL, 15.9977000, 107.9928000)
) AS v(cinema_name, address, city, district, phone, latitude, longitude)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.cinemas c WHERE c.cinema_name = v.cinema_name
);
GO


-- ORIGINAL LINES 2876-2990


DECLARE @RoomPlan TABLE (
    seq            INT IDENTITY(1,1),
    cinema_name    NVARCHAR(180),
    room_name      NVARCHAR(100),
    room_type      VARCHAR(30),
    num_rows       INT,          -- số hàng ghế (A, B, C...)
    seats_per_row  INT,          -- số ghế mỗi hàng
    vip_rows       INT,          -- số hàng cuối là ghế VIP
    has_couple_row BIT           -- hàng cuối cùng là ghế đôi (Sweetbox)?
);

INSERT INTO @RoomPlan(cinema_name, room_name, room_type, num_rows, seats_per_row, vip_rows, has_couple_row)
VALUES
(N'CineHunt Vincom Bà Triệu', N'Phòng 1',    'STANDARD', 8, 10, 2, 0),
(N'CineHunt Vincom Bà Triệu', N'Phòng 2',    'STANDARD', 8, 10, 2, 0),
(N'CineHunt Vincom Bà Triệu', N'Phòng VIP',  'VIP',      6, 8,  6, 1),
(N'CineHunt Vincom Bà Triệu', N'Phòng IMAX', 'IMAX',    10, 14, 2, 0),

(N'CineHunt Aeon Long Biên', N'Phòng 1',   'STANDARD', 8, 10, 2, 0),
(N'CineHunt Aeon Long Biên', N'Phòng 2',   'STANDARD', 8, 10, 2, 0),
(N'CineHunt Aeon Long Biên', N'Phòng VIP', 'VIP',      6, 8,  6, 1),

(N'CineHunt Landmark 81', N'Phòng 1',    'STANDARD', 8, 10, 2, 0),
(N'CineHunt Landmark 81', N'Phòng 2',    'STANDARD', 8, 10, 2, 0),
(N'CineHunt Landmark 81', N'Phòng VIP',  'VIP',      6, 8,  6, 1),
(N'CineHunt Landmark 81', N'Phòng 4DX',  '4DX',      6, 8,  0, 0),

(N'CineHunt Vincom Đồng Khởi', N'Phòng 1',   'STANDARD', 8, 10, 2, 0),
(N'CineHunt Vincom Đồng Khởi', N'Phòng VIP', 'VIP',      6, 8,  6, 1),

(N'CineHunt Vincom Đà Nẵng', N'Phòng 1',   'STANDARD', 8, 10, 2, 0),
(N'CineHunt Vincom Đà Nẵng', N'Phòng VIP', 'VIP',      6, 8,  6, 1),

(N'CineHunt Sun World Bà Nà', N'Phòng 1', 'STANDARD', 6, 8, 2, 0);


DECLARE @NormalSeatTypeId INT = (SELECT seat_type_id FROM dbo.seat_types WHERE type_code = 'NORMAL');
DECLARE @VipSeatTypeId    INT = (SELECT seat_type_id FROM dbo.seat_types WHERE type_code = 'VIP');
DECLARE @CoupleSeatTypeId INT = (SELECT seat_type_id FROM dbo.seat_types WHERE type_code = 'COUPLE');

DECLARE @cinema_name     NVARCHAR(180),
        @room_name       NVARCHAR(100),
        @room_type       VARCHAR(30),
        @num_rows        INT,
        @seats_per_row   INT,
        @vip_rows        INT,
        @has_couple_row  BIT,
        @cinema_id       INT,
        @room_id         INT,
        @total_seats     INT;

DECLARE room_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT cinema_name, room_name, room_type, num_rows, seats_per_row, vip_rows, has_couple_row
    FROM @RoomPlan
    ORDER BY seq;

OPEN room_cursor;
FETCH NEXT FROM room_cursor
INTO @cinema_name, @room_name, @room_type, @num_rows, @seats_per_row, @vip_rows, @has_couple_row;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @cinema_id = NULL;
    SET @room_id = NULL;

    SELECT @cinema_id = cinema_id FROM dbo.cinemas WHERE cinema_name = @cinema_name;

    IF @cinema_id IS NOT NULL
       AND NOT EXISTS (
            SELECT 1 FROM dbo.rooms WHERE cinema_id = @cinema_id AND room_name = @room_name
       )
    BEGIN
        SET @total_seats = @num_rows * @seats_per_row;

        INSERT INTO dbo.rooms(cinema_id, room_name, room_type, total_seats, status)
        VALUES (@cinema_id, @room_name, @room_type, @total_seats, 'ACTIVE');

        SET @room_id = SCOPE_IDENTITY();

        ;WITH RowLetters AS (
            SELECT n AS rn, CHAR(64 + n) AS row_letter
            FROM (
                SELECT TOP (@num_rows) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
                FROM sys.all_objects
            ) t
        ),
        SeatNumbers AS (
            SELECT TOP (@seats_per_row) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
            FROM sys.all_objects
        )
        INSERT INTO dbo.seats(room_id, seat_type_id, seat_row, seat_number, seat_label, status)
        SELECT
            @room_id,
            CASE
                WHEN @has_couple_row = 1 AND rl.rn = @num_rows THEN @CoupleSeatTypeId
                WHEN rl.rn > (@num_rows - @vip_rows) THEN @VipSeatTypeId
                ELSE @NormalSeatTypeId
            END,
            rl.row_letter,
            sn.n,
            CONCAT(rl.row_letter, sn.n),
            'ACTIVE'
        FROM RowLetters rl
        CROSS JOIN SeatNumbers sn;
    END

    FETCH NEXT FROM room_cursor
    INTO @cinema_name, @room_name, @room_type, @num_rows, @seats_per_row, @vip_rows, @has_couple_row;
END

CLOSE room_cursor;
DEALLOCATE room_cursor;
GO


-- ORIGINAL LINES 3034-3050

UPDATE movies
SET poster_url = N'/posters/dai-chien-da-vu-tru.jpg'
WHERE title = N'Đại Chiến Đa Vũ Trụ';

UPDATE movies
SET poster_url = N'/posters/hanh-tinh-xanh.jpg'
WHERE title = N'Hành Tinh Xanh';

UPDATE movies
SET poster_url = N'/posters/ngoi-nha-sau-canh.jpg'
WHERE title LIKE N'Ngôi Nhà Sau Cánh%';

UPDATE movies
SET poster_url = N'/posters/ky-nguyen-robot.jpg'
WHERE title = N'Kỷ Nguyên Robot';
GO

PRINT N'Demo data script da ket thuc. Khong tao tai khoan admin mac dinh.';
GO
SET NOEXEC OFF;
GO

-- SOURCE: CineHunt_Database_V6_3_With_Sample_Data.sql
-- SOURCE SHA-256: d944ee624af7eb1d228a1fdabe05ac38dc0d8e4b5c37e687f52a971bbd178671
-- DATE: 2026-11-02
-- STATIC SPLIT ONLY. CHUA THUC THI / CHUA KIEM THU TREN SQL SERVER.
-- CHI AP DUNG CHO DATABASE THU NGHIEM CineHuntDB DA TON TAI VA HOAN TOAN RONG.
-- Chua bao gom data seed, user admin, DROP TABLE, DROP DATABASE, rollback connections.
-- Khong chay tren DB dang su dung. Neu phat hien bang, se bat NOEXEC de bo qua DDL.
-- Truoc khi chay: sao luu, tao database TRONG RIENG BANG TAY, kiem tra ten DB.
-- Luu y: NOEXEC la co che stop-best-effort; can ket noi SQL Server moi neu bi STOP.
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
USE master;
GO
IF DB_ID(N'CineHuntDB') IS NULL
BEGIN
  PRINT N'STOP: Tao moi database THU NGHIEM CineHuntDB truoc khi chay schema.';
  SET NOEXEC ON;
END;
GO
USE CineHuntDB;
GO
IF EXISTS (SELECT 1 FROM sys.tables WHERE is_ms_shipped = 0)
BEGIN
  PRINT N'STOP: CineHuntDB da co bang. KHONG ghi de database hien tai.';
  SET NOEXEC ON;
END;
GO
-- ORIGINAL LINES 84-109


CREATE TABLE dbo.users (
    user_id                 INT IDENTITY(1,1) NOT NULL,
    full_name               NVARCHAR(120) NOT NULL,
    email                   VARCHAR(150) NOT NULL,
    phone                   VARCHAR(20) NULL,
    password_hash           VARCHAR(255) NOT NULL,
    avatar_url              NVARCHAR(500) NULL,
    date_of_birth           DATE NULL,
    email_verified          BIT NOT NULL CONSTRAINT DF_users_email_verified DEFAULT 0,
    failed_login_attempts   INT NOT NULL CONSTRAINT DF_users_failed_login_attempts DEFAULT 0,
    locked_until            DATETIME2(0) NULL,
    last_login_at           DATETIME2(0) NULL,
    role                    VARCHAR(20) NOT NULL CONSTRAINT DF_users_role DEFAULT 'CUSTOMER',
    status                  VARCHAR(20) NOT NULL CONSTRAINT DF_users_status DEFAULT 'ACTIVE',
    created_at              DATETIME2(0) NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSDATETIME(),
    updated_at              DATETIME2(0) NOT NULL CONSTRAINT DF_users_updated_at DEFAULT SYSDATETIME(),

    CONSTRAINT PK_users PRIMARY KEY (user_id),
    CONSTRAINT UQ_users_email UNIQUE (email),
    CONSTRAINT CK_users_role CHECK (role IN ('CUSTOMER', 'STAFF', 'ADMIN')),
    CONSTRAINT CK_users_status CHECK (status IN ('ACTIVE', 'LOCKED', 'BANNED', 'DELETED')),
    CONSTRAINT CK_users_failed_login_attempts CHECK (failed_login_attempts >= 0)
);
GO


-- ORIGINAL LINES 110-114

CREATE UNIQUE INDEX UX_users_phone
ON dbo.users(phone)
WHERE phone IS NOT NULL;
GO


-- ORIGINAL LINES 115-126

CREATE TABLE dbo.roles (
    role_id       INT IDENTITY(1,1) NOT NULL,
    role_code     VARCHAR(30) NOT NULL,
    role_name     NVARCHAR(80) NOT NULL,
    description   NVARCHAR(255) NULL,

    CONSTRAINT PK_roles PRIMARY KEY (role_id),
    CONSTRAINT UQ_roles_role_code UNIQUE (role_code),
    CONSTRAINT CK_roles_role_code CHECK (role_code IN ('CUSTOMER', 'STAFF', 'ADMIN'))
);
GO


-- ORIGINAL LINES 127-139

CREATE TABLE dbo.user_roles (
    user_id      INT NOT NULL,
    role_id      INT NOT NULL,
    assigned_at  DATETIME2(0) NOT NULL CONSTRAINT DF_user_roles_assigned_at DEFAULT SYSDATETIME(),

    CONSTRAINT PK_user_roles PRIMARY KEY (user_id, role_id),
    CONSTRAINT FK_user_roles_user FOREIGN KEY (user_id)
        REFERENCES dbo.users(user_id) ON DELETE CASCADE,
    CONSTRAINT FK_user_roles_role FOREIGN KEY (role_id)
        REFERENCES dbo.roles(role_id) ON DELETE CASCADE
);
GO


-- ORIGINAL LINES 140-177

CREATE OR ALTER PROCEDURE dbo.sp_sync_user_role
    @user_id INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @role_code VARCHAR(20);
    DECLARE @role_id INT;

    SELECT @role_code = role
    FROM dbo.users
    WHERE user_id = @user_id;

    IF @role_code IS NULL
        THROW 50001, N'Không tìm thấy người dùng.', 1;

    SELECT @role_id = role_id
    FROM dbo.roles
    WHERE role_code = @role_code;

    IF @role_id IS NULL
        THROW 50002, N'Role chưa được seed trong bảng roles.', 1;

    DELETE FROM dbo.user_roles
    WHERE user_id = @user_id
      AND role_id <> @role_id;

    IF NOT EXISTS (
        SELECT 1 FROM dbo.user_roles
        WHERE user_id = @user_id AND role_id = @role_id
    )
    BEGIN
        INSERT INTO dbo.user_roles(user_id, role_id)
        VALUES (@user_id, @role_id);
    END;
END;
GO


-- ORIGINAL LINES 178-199


CREATE TABLE dbo.refresh_tokens (
    refresh_token_id BIGINT IDENTITY(1,1) NOT NULL,
    user_id           INT NOT NULL,
    token_hash        VARCHAR(255) NOT NULL,
    device_info       NVARCHAR(300) NULL,
    ip_address        VARCHAR(45) NULL,
    expires_at        DATETIME2(0) NOT NULL,
    revoked_at        DATETIME2(0) NULL,
    replaced_by_id    BIGINT NULL,
    created_at        DATETIME2(0) NOT NULL CONSTRAINT DF_refresh_tokens_created_at DEFAULT SYSDATETIME(),

    CONSTRAINT PK_refresh_tokens PRIMARY KEY (refresh_token_id),
    CONSTRAINT FK_refresh_tokens_user FOREIGN KEY (user_id)
        REFERENCES dbo.users(user_id) ON DELETE CASCADE,
    CONSTRAINT FK_refresh_tokens_replaced_by FOREIGN KEY (replaced_by_id)
        REFERENCES dbo.refresh_tokens(refresh_token_id),
    CONSTRAINT UQ_refresh_tokens_hash UNIQUE (token_hash),
    CONSTRAINT CK_refresh_tokens_expiry CHECK (expires_at > created_at)
);
GO


-- ORIGINAL LINES 200-204

CREATE INDEX IX_refresh_tokens_user_active
ON dbo.refresh_tokens(user_id, expires_at)
WHERE revoked_at IS NULL;
GO


-- ORIGINAL LINES 205-238

/* PHIM VÀ THỂ LOẠI */

CREATE TABLE dbo.movies (
    movie_id          INT IDENTITY(1,1) NOT NULL,
    title             NVARCHAR(250) NOT NULL,
    original_title    NVARCHAR(250) NULL,
    description       NVARCHAR(MAX) NULL,
    duration_minutes  INT NOT NULL,
    release_date      DATE NULL,
    end_date          DATE NULL,
    age_rating        VARCHAR(10) NULL,
    director          NVARCHAR(150) NULL,
    actors            NVARCHAR(1000) NULL,
    country           NVARCHAR(100) NULL,
    language          NVARCHAR(100) NULL,
    poster_url        NVARCHAR(500) NULL,
    banner_url        NVARCHAR(500) NULL,
    trailer_url       NVARCHAR(500) NULL,
    average_rating    DECIMAL(3,2) NOT NULL CONSTRAINT DF_movies_average_rating DEFAULT 0,
    status            VARCHAR(20) NOT NULL CONSTRAINT DF_movies_status DEFAULT 'COMING_SOON',
    created_at        DATETIME2(0) NOT NULL CONSTRAINT DF_movies_created_at DEFAULT SYSDATETIME(),
    updated_at        DATETIME2(0) NOT NULL CONSTRAINT DF_movies_updated_at DEFAULT SYSDATETIME(),

    CONSTRAINT PK_movies PRIMARY KEY (movie_id),
    CONSTRAINT CK_movies_duration CHECK (duration_minutes > 0),
    CONSTRAINT CK_movies_age_rating CHECK (
        age_rating IS NULL OR age_rating IN ('P', 'K', 'T13', 'T16', 'T18', 'C')
    ),
    CONSTRAINT CK_movies_average_rating CHECK (average_rating BETWEEN 0 AND 5),
    CONSTRAINT CK_movies_status CHECK (status IN ('COMING_SOON', 'NOW_SHOWING', 'ENDED', 'HIDDEN')),
    CONSTRAINT CK_movies_dates CHECK (end_date IS NULL OR release_date IS NULL OR end_date >= release_date)
);
GO


-- ORIGINAL LINES 239-248

CREATE TABLE dbo.genres (
    genre_id    INT IDENTITY(1,1) NOT NULL,
    genre_name  NVARCHAR(100) NOT NULL,
    slug        VARCHAR(120) NULL,

    CONSTRAINT PK_genres PRIMARY KEY (genre_id),
    CONSTRAINT UQ_genres_genre_name UNIQUE (genre_name)
);
GO


-- ORIGINAL LINES 249-253

CREATE UNIQUE INDEX UX_genres_slug
ON dbo.genres(slug)
WHERE slug IS NOT NULL;
GO


-- ORIGINAL LINES 254-265

CREATE TABLE dbo.movie_genres (
    movie_id  INT NOT NULL,
    genre_id  INT NOT NULL,

    CONSTRAINT PK_movie_genres PRIMARY KEY (movie_id, genre_id),
    CONSTRAINT FK_movie_genres_movie FOREIGN KEY (movie_id)
        REFERENCES dbo.movies(movie_id) ON DELETE CASCADE,
    CONSTRAINT FK_movie_genres_genre FOREIGN KEY (genre_id)
        REFERENCES dbo.genres(genre_id) ON DELETE CASCADE
);
GO


-- ORIGINAL LINES 266-289



CREATE TABLE dbo.movie_ratings (
    rating_id   BIGINT IDENTITY(1,1) NOT NULL,
    movie_id    INT NOT NULL,
    user_id     INT NOT NULL,
    stars       TINYINT NOT NULL,
    created_at  DATETIME2(0) NOT NULL
        CONSTRAINT DF_movie_ratings_created_at DEFAULT SYSDATETIME(),
    updated_at  DATETIME2(0) NOT NULL
        CONSTRAINT DF_movie_ratings_updated_at DEFAULT SYSDATETIME(),

    CONSTRAINT PK_movie_ratings PRIMARY KEY (rating_id),
    CONSTRAINT UQ_movie_ratings_movie_user UNIQUE (movie_id, user_id),
    CONSTRAINT CK_movie_ratings_stars CHECK (stars BETWEEN 1 AND 5),

    CONSTRAINT FK_movie_ratings_movie FOREIGN KEY (movie_id)
        REFERENCES dbo.movies(movie_id) ON DELETE CASCADE,

    CONSTRAINT FK_movie_ratings_user FOREIGN KEY (user_id)
        REFERENCES dbo.users(user_id) ON DELETE CASCADE
);
GO


-- ORIGINAL LINES 290-294

CREATE INDEX IX_movie_ratings_user_updated
ON dbo.movie_ratings(user_id, updated_at DESC)
INCLUDE (movie_id, stars);
GO


-- ORIGINAL LINES 295-313


CREATE TABLE dbo.cinemas (
    cinema_id     INT IDENTITY(1,1) NOT NULL,
    cinema_name   NVARCHAR(180) NOT NULL,
    address       NVARCHAR(300) NOT NULL,
    city          NVARCHAR(100) NULL,
    district      NVARCHAR(100) NULL,
    phone         VARCHAR(20) NULL,
    latitude      DECIMAL(10,7) NULL,
    longitude     DECIMAL(10,7) NULL,
    status        VARCHAR(20) NOT NULL CONSTRAINT DF_cinemas_status DEFAULT 'ACTIVE',
    created_at    DATETIME2(0) NOT NULL CONSTRAINT DF_cinemas_created_at DEFAULT SYSDATETIME(),
    updated_at    DATETIME2(0) NOT NULL CONSTRAINT DF_cinemas_updated_at DEFAULT SYSDATETIME(),

    CONSTRAINT PK_cinemas PRIMARY KEY (cinema_id),
    CONSTRAINT CK_cinemas_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE'))
);
GO


-- ORIGINAL LINES 314-332

CREATE TABLE dbo.rooms (
    room_id        INT IDENTITY(1,1) NOT NULL,
    cinema_id      INT NOT NULL,
    room_name      NVARCHAR(100) NOT NULL,
    room_type      VARCHAR(30) NOT NULL CONSTRAINT DF_rooms_type DEFAULT 'STANDARD',
    total_seats    INT NOT NULL CONSTRAINT DF_rooms_total_seats DEFAULT 0,
    status         VARCHAR(20) NOT NULL CONSTRAINT DF_rooms_status DEFAULT 'ACTIVE',
    created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_rooms_created_at DEFAULT SYSDATETIME(),

    CONSTRAINT PK_rooms PRIMARY KEY (room_id),
    CONSTRAINT FK_rooms_cinema FOREIGN KEY (cinema_id)
        REFERENCES dbo.cinemas(cinema_id),
    CONSTRAINT UQ_rooms_cinema_name UNIQUE (cinema_id, room_name),
    CONSTRAINT CK_rooms_type CHECK (room_type IN ('STANDARD', 'VIP', 'IMAX', '4DX')),
    CONSTRAINT CK_rooms_total_seats CHECK (total_seats >= 0),
    CONSTRAINT CK_rooms_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE'))
);
GO


-- ORIGINAL LINES 333-346

CREATE TABLE dbo.seat_types (
    seat_type_id     INT IDENTITY(1,1) NOT NULL,
    type_code        VARCHAR(30) NOT NULL,
    type_name        NVARCHAR(80) NOT NULL,
    price_multiplier DECIMAL(5,2) NOT NULL CONSTRAINT DF_seat_types_multiplier DEFAULT 1,
    status           VARCHAR(20) NOT NULL CONSTRAINT DF_seat_types_status DEFAULT 'ACTIVE',

    CONSTRAINT PK_seat_types PRIMARY KEY (seat_type_id),
    CONSTRAINT UQ_seat_types_code UNIQUE (type_code),
    CONSTRAINT CK_seat_types_multiplier CHECK (price_multiplier > 0),
    CONSTRAINT CK_seat_types_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);
GO


-- ORIGINAL LINES 347-367

CREATE TABLE dbo.seats (
    seat_id       INT IDENTITY(1,1) NOT NULL,
    room_id       INT NOT NULL,
    seat_type_id  INT NOT NULL,
    seat_row      VARCHAR(5) NOT NULL,
    seat_number   INT NOT NULL,
    seat_label    VARCHAR(15) NOT NULL,
    status        VARCHAR(20) NOT NULL CONSTRAINT DF_seats_status DEFAULT 'ACTIVE',

    CONSTRAINT PK_seats PRIMARY KEY (seat_id),
    CONSTRAINT FK_seats_room FOREIGN KEY (room_id)
        REFERENCES dbo.rooms(room_id) ON DELETE CASCADE,
    CONSTRAINT FK_seats_type FOREIGN KEY (seat_type_id)
        REFERENCES dbo.seat_types(seat_type_id),
    CONSTRAINT UQ_seats_room_position UNIQUE (room_id, seat_row, seat_number),
    CONSTRAINT UQ_seats_room_label UNIQUE (room_id, seat_label),
    CONSTRAINT CK_seats_number CHECK (seat_number > 0),
    CONSTRAINT CK_seats_status CHECK (status IN ('ACTIVE', 'BROKEN', 'INACTIVE'))
);
GO


-- ORIGINAL LINES 368-393


CREATE TABLE dbo.showtimes (
    showtime_id    INT IDENTITY(1,1) NOT NULL,
    movie_id       INT NOT NULL,
    room_id        INT NOT NULL,
    start_time     DATETIME2(0) NOT NULL,
    end_time       DATETIME2(0) NOT NULL,
    base_price     DECIMAL(12,2) NOT NULL,
    status         VARCHAR(20) NOT NULL CONSTRAINT DF_showtimes_status DEFAULT 'OPEN',
    created_by     INT NULL,
    created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_showtimes_created_at DEFAULT SYSDATETIME(),
    updated_at     DATETIME2(0) NOT NULL CONSTRAINT DF_showtimes_updated_at DEFAULT SYSDATETIME(),

    CONSTRAINT PK_showtimes PRIMARY KEY (showtime_id),
    CONSTRAINT FK_showtimes_movie FOREIGN KEY (movie_id)
        REFERENCES dbo.movies(movie_id),
    CONSTRAINT FK_showtimes_room FOREIGN KEY (room_id)
        REFERENCES dbo.rooms(room_id),
    CONSTRAINT FK_showtimes_created_by FOREIGN KEY (created_by)
        REFERENCES dbo.users(user_id),
    CONSTRAINT CK_showtimes_time CHECK (end_time > start_time),
    CONSTRAINT CK_showtimes_price CHECK (base_price >= 0),
    CONSTRAINT CK_showtimes_status CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED'))
);
GO


-- ORIGINAL LINES 394-397

CREATE INDEX IX_showtimes_movie_start
ON dbo.showtimes(movie_id, start_time);
GO


-- ORIGINAL LINES 398-401

CREATE INDEX IX_showtimes_room_time
ON dbo.showtimes(room_id, start_time, end_time);
GO


-- ORIGINAL LINES 402-429

CREATE TABLE dbo.showtime_seats (
    showtime_seat_id   INT IDENTITY(1,1) NOT NULL,
    showtime_id        INT NOT NULL,
    seat_id            INT NOT NULL,
    price              DECIMAL(12,2) NOT NULL,
    status             VARCHAR(20) NOT NULL CONSTRAINT DF_showtime_seats_status DEFAULT 'AVAILABLE',
    held_by_user_id    INT NULL,
    hold_expires_at    DATETIME2(0) NULL,
    row_version        ROWVERSION,

    CONSTRAINT PK_showtime_seats PRIMARY KEY (showtime_seat_id),
    CONSTRAINT FK_showtime_seats_showtime FOREIGN KEY (showtime_id)
        REFERENCES dbo.showtimes(showtime_id) ON DELETE CASCADE,
    CONSTRAINT FK_showtime_seats_seat FOREIGN KEY (seat_id)
        REFERENCES dbo.seats(seat_id),
    CONSTRAINT FK_showtime_seats_held_user FOREIGN KEY (held_by_user_id)
        REFERENCES dbo.users(user_id),
    CONSTRAINT UQ_showtime_seats_showtime_seat UNIQUE (showtime_id, seat_id),
    CONSTRAINT CK_showtime_seats_price CHECK (price >= 0),
    CONSTRAINT CK_showtime_seats_status CHECK (status IN ('AVAILABLE', 'HELD', 'SOLD', 'BOOKED', 'BLOCKED')),
    CONSTRAINT CK_showtime_seats_hold_data CHECK (
        (status = 'HELD' AND held_by_user_id IS NOT NULL AND hold_expires_at IS NOT NULL)
        OR
        (status <> 'HELD')
    )
);
GO


-- ORIGINAL LINES 430-433

CREATE INDEX IX_showtime_seats_showtime_status
ON dbo.showtime_seats(showtime_id, status);
GO


-- ORIGINAL LINES 434-438

CREATE INDEX IX_showtime_seats_hold_expiry
ON dbo.showtime_seats(status, hold_expires_at)
WHERE status = 'HELD';
GO


-- ORIGINAL LINES 439-460

/* GIỮ GHẾ */

CREATE TABLE dbo.seat_holds (
    hold_id            BIGINT IDENTITY(1,1) NOT NULL,
    user_id            INT NOT NULL,
    showtime_seat_id   INT NOT NULL,
    hold_token         UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_seat_holds_token DEFAULT NEWID(),
    status             VARCHAR(20) NOT NULL CONSTRAINT DF_seat_holds_status DEFAULT 'ACTIVE',
    expires_at         DATETIME2(0) NOT NULL,
    created_at         DATETIME2(0) NOT NULL CONSTRAINT DF_seat_holds_created_at DEFAULT SYSDATETIME(),
    released_at        DATETIME2(0) NULL,

    CONSTRAINT PK_seat_holds PRIMARY KEY (hold_id),
    CONSTRAINT FK_seat_holds_user FOREIGN KEY (user_id)
        REFERENCES dbo.users(user_id),
    CONSTRAINT FK_seat_holds_showtime_seat FOREIGN KEY (showtime_seat_id)
        REFERENCES dbo.showtime_seats(showtime_seat_id),
    CONSTRAINT UQ_seat_holds_token UNIQUE (hold_token),
    CONSTRAINT CK_seat_holds_status CHECK (status IN ('ACTIVE', 'CONFIRMED', 'EXPIRED', 'CANCELLED'))
);
GO


-- ORIGINAL LINES 461-465

CREATE UNIQUE INDEX UX_seat_holds_active_seat
ON dbo.seat_holds(showtime_seat_id)
WHERE status = 'ACTIVE';
GO


-- ORIGINAL LINES 466-469

CREATE INDEX IX_seat_holds_expiry
ON dbo.seat_holds(status, expires_at);
GO


-- ORIGINAL LINES 470-506


CREATE TABLE dbo.booking_orders (
    booking_id           BIGINT IDENTITY(1,1) NOT NULL,
    booking_code         VARCHAR(40) NOT NULL,
    user_id              INT NOT NULL,
    showtime_id          INT NOT NULL,
    promotion_id         INT NULL,
    subtotal_amount      DECIMAL(12,2) NOT NULL CONSTRAINT DF_booking_subtotal DEFAULT 0,
    discount_amount      DECIMAL(12,2) NOT NULL CONSTRAINT DF_booking_discount DEFAULT 0,
    product_amount       DECIMAL(12,2) NOT NULL CONSTRAINT DF_booking_product DEFAULT 0,
    total_amount         DECIMAL(12,2) NOT NULL,
    status               VARCHAR(30) NOT NULL CONSTRAINT DF_booking_status DEFAULT 'PENDING_PAYMENT',
    idempotency_key      VARCHAR(100) NULL,
    expires_at           DATETIME2(0) NULL,
    paid_at              DATETIME2(0) NULL,
    issued_at            DATETIME2(0) NULL,
    cancelled_at         DATETIME2(0) NULL,
    created_at           DATETIME2(0) NOT NULL CONSTRAINT DF_booking_created_at DEFAULT SYSDATETIME(),
    updated_at           DATETIME2(0) NOT NULL CONSTRAINT DF_booking_updated_at DEFAULT SYSDATETIME(),

    CONSTRAINT PK_booking_orders PRIMARY KEY (booking_id),
    CONSTRAINT FK_booking_orders_user FOREIGN KEY (user_id)
        REFERENCES dbo.users(user_id),
    CONSTRAINT FK_booking_orders_showtime FOREIGN KEY (showtime_id)
        REFERENCES dbo.showtimes(showtime_id),
    CONSTRAINT UQ_booking_orders_code UNIQUE (booking_code),
    CONSTRAINT CK_booking_amounts CHECK (
        subtotal_amount >= 0 AND discount_amount >= 0 AND product_amount >= 0
        AND total_amount >= 0
        AND discount_amount <= subtotal_amount + product_amount
    ),
    CONSTRAINT CK_booking_status CHECK (
        status IN ('PENDING_PAYMENT', 'PAID', 'ISSUED', 'CANCELLED', 'EXPIRED', 'FAILED', 'REFUNDED')
    )
);
GO


-- ORIGINAL LINES 507-511

CREATE UNIQUE INDEX UX_booking_orders_idempotency
ON dbo.booking_orders(idempotency_key)
WHERE idempotency_key IS NOT NULL;
GO


-- ORIGINAL LINES 512-515

CREATE INDEX IX_booking_orders_user_created
ON dbo.booking_orders(user_id, created_at DESC);
GO


-- ORIGINAL LINES 516-519

CREATE INDEX IX_booking_orders_status_expiry
ON dbo.booking_orders(status, expires_at);
GO


-- ORIGINAL LINES 520-538

CREATE TABLE dbo.booking_details (
    booking_detail_id   BIGINT IDENTITY(1,1) NOT NULL,
    booking_id          BIGINT NOT NULL,
    showtime_seat_id    INT NOT NULL,
    seat_price          DECIMAL(12,2) NOT NULL,
    status              VARCHAR(20) NOT NULL CONSTRAINT DF_booking_details_status DEFAULT 'ACTIVE',
    created_at          DATETIME2(0) NOT NULL CONSTRAINT DF_booking_details_created_at DEFAULT SYSDATETIME(),

    CONSTRAINT PK_booking_details PRIMARY KEY (booking_detail_id),
    CONSTRAINT FK_booking_details_booking FOREIGN KEY (booking_id)
        REFERENCES dbo.booking_orders(booking_id) ON DELETE CASCADE,
    CONSTRAINT FK_booking_details_showtime_seat FOREIGN KEY (showtime_seat_id)
        REFERENCES dbo.showtime_seats(showtime_seat_id),
    CONSTRAINT UQ_booking_details_booking_seat UNIQUE (booking_id, showtime_seat_id),
    CONSTRAINT CK_booking_details_price CHECK (seat_price >= 0),
    CONSTRAINT CK_booking_details_status CHECK (status IN ('ACTIVE', 'CANCELLED', 'EXPIRED'))
);
GO


-- ORIGINAL LINES 539-543

CREATE UNIQUE INDEX UX_booking_details_active_seat
ON dbo.booking_details(showtime_seat_id)
WHERE status = 'ACTIVE';
GO


-- ORIGINAL LINES 544-562

/* SẢN PHẨM / COMBO */

CREATE TABLE dbo.products (
    product_id     INT IDENTITY(1,1) NOT NULL,
    product_name   NVARCHAR(150) NOT NULL,
    description    NVARCHAR(500) NULL,
    image_url      NVARCHAR(500) NULL,
    price          DECIMAL(12,2) NOT NULL,
    stock_quantity INT NULL,
    status         VARCHAR(20) NOT NULL CONSTRAINT DF_products_status DEFAULT 'ACTIVE',
    created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_products_created_at DEFAULT SYSDATETIME(),

    CONSTRAINT PK_products PRIMARY KEY (product_id),
    CONSTRAINT CK_products_price CHECK (price >= 0),
    CONSTRAINT CK_products_stock CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
    CONSTRAINT CK_products_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'))
);
GO


-- ORIGINAL LINES 563-581

CREATE TABLE dbo.booking_products (
    booking_product_id BIGINT IDENTITY(1,1) NOT NULL,
    booking_id         BIGINT NOT NULL,
    product_id         INT NOT NULL,
    quantity           INT NOT NULL,
    unit_price         DECIMAL(12,2) NOT NULL,
    total_price        AS (CONVERT(DECIMAL(12,2), quantity * unit_price)) PERSISTED,

    CONSTRAINT PK_booking_products PRIMARY KEY (booking_product_id),
    CONSTRAINT FK_booking_products_booking FOREIGN KEY (booking_id)
        REFERENCES dbo.booking_orders(booking_id) ON DELETE CASCADE,
    CONSTRAINT FK_booking_products_product FOREIGN KEY (product_id)
        REFERENCES dbo.products(product_id),
    CONSTRAINT UQ_booking_products_booking_product UNIQUE (booking_id, product_id),
    CONSTRAINT CK_booking_products_quantity CHECK (quantity > 0),
    CONSTRAINT CK_booking_products_price CHECK (unit_price >= 0)
);
GO


-- ORIGINAL LINES 582-598


CREATE TABLE dbo.concession_combos (
    combo_id       INT IDENTITY(1,1) NOT NULL,
    combo_name     NVARCHAR(150) NOT NULL,
    description    NVARCHAR(500) NULL,
    image_url      NVARCHAR(500) NULL,
    price          DECIMAL(12,2) NOT NULL,
    status         VARCHAR(20) NOT NULL CONSTRAINT DF_concession_combos_status DEFAULT 'ACTIVE',
    created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_concession_combos_created_at DEFAULT SYSDATETIME(),
    updated_at     DATETIME2(0) NOT NULL CONSTRAINT DF_concession_combos_updated_at DEFAULT SYSDATETIME(),

    CONSTRAINT PK_concession_combos PRIMARY KEY (combo_id),
    CONSTRAINT CK_concession_combos_price CHECK (price >= 0),
    CONSTRAINT CK_concession_combos_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'))
);
GO


-- ORIGINAL LINES 599-617

CREATE TABLE dbo.booking_combos (
    booking_combo_id BIGINT IDENTITY(1,1) NOT NULL,
    booking_id       BIGINT NOT NULL,
    combo_id         INT NOT NULL,
    quantity         INT NOT NULL,
    unit_price       DECIMAL(12,2) NOT NULL,
    total_price      AS (CONVERT(DECIMAL(12,2), quantity * unit_price)) PERSISTED,

    CONSTRAINT PK_booking_combos PRIMARY KEY (booking_combo_id),
    CONSTRAINT FK_booking_combos_booking FOREIGN KEY (booking_id)
        REFERENCES dbo.booking_orders(booking_id) ON DELETE CASCADE,
    CONSTRAINT FK_booking_combos_combo FOREIGN KEY (combo_id)
        REFERENCES dbo.concession_combos(combo_id),
    CONSTRAINT UQ_booking_combos_booking_combo UNIQUE (booking_id, combo_id),
    CONSTRAINT CK_booking_combos_quantity CHECK (quantity > 0),
    CONSTRAINT CK_booking_combos_price CHECK (unit_price >= 0)
);
GO


-- ORIGINAL LINES 618-620

CREATE INDEX IX_booking_combos_booking ON dbo.booking_combos(booking_id);
GO


-- ORIGINAL LINES 621-654

/* KHUYẾN MÃI */

CREATE TABLE dbo.promotions (
    promotion_id       INT IDENTITY(1,1) NOT NULL,
    promotion_code     VARCHAR(50) NOT NULL,
    promotion_name     NVARCHAR(150) NOT NULL,
    description        NVARCHAR(500) NULL,
    discount_type      VARCHAR(20) NOT NULL,
    discount_value     DECIMAL(12,2) NOT NULL,
    max_discount       DECIMAL(12,2) NULL,
    min_order_amount   DECIMAL(12,2) NOT NULL CONSTRAINT DF_promotions_min_order DEFAULT 0,
    usage_limit        INT NULL,
    used_count         INT NOT NULL CONSTRAINT DF_promotions_used_count DEFAULT 0,
    start_at           DATETIME2(0) NOT NULL,
    end_at             DATETIME2(0) NOT NULL,
    status             VARCHAR(20) NOT NULL CONSTRAINT DF_promotions_status DEFAULT 'ACTIVE',
    created_at         DATETIME2(0) NOT NULL CONSTRAINT DF_promotions_created_at DEFAULT SYSDATETIME(),

    CONSTRAINT PK_promotions PRIMARY KEY (promotion_id),
    CONSTRAINT UQ_promotions_code UNIQUE (promotion_code),
    CONSTRAINT CK_promotions_type CHECK (discount_type IN ('PERCENT', 'FIXED')),
    CONSTRAINT CK_promotions_value CHECK (discount_value > 0),
    CONSTRAINT CK_promotions_percent CHECK (discount_type <> 'PERCENT' OR discount_value <= 100),
    CONSTRAINT CK_promotions_amounts CHECK (
        min_order_amount >= 0 AND (max_discount IS NULL OR max_discount >= 0)
    ),
    CONSTRAINT CK_promotions_usage CHECK (
        used_count >= 0 AND (usage_limit IS NULL OR usage_limit >= 0)
    ),
    CONSTRAINT CK_promotions_time CHECK (end_at > start_at),
    CONSTRAINT CK_promotions_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'EXPIRED'))
);
GO


-- ORIGINAL LINES 655-659

ALTER TABLE dbo.booking_orders
ADD CONSTRAINT FK_booking_orders_promotion
FOREIGN KEY (promotion_id) REFERENCES dbo.promotions(promotion_id);
GO


-- ORIGINAL LINES 660-686

/* THANH TOÁN */

CREATE TABLE dbo.payments (
    payment_id          BIGINT IDENTITY(1,1) NOT NULL,
    booking_id          BIGINT NOT NULL,
    payment_method      VARCHAR(30) NOT NULL,
    provider            VARCHAR(30) NULL,
    amount              DECIMAL(12,2) NOT NULL,
    transaction_code    VARCHAR(150) NULL,
    request_id          VARCHAR(100) NULL,
    payment_status      VARCHAR(20) NOT NULL CONSTRAINT DF_payments_status DEFAULT 'PENDING',
    provider_response   NVARCHAR(MAX) NULL,
    failed_reason       NVARCHAR(500) NULL,
    paid_at             DATETIME2(0) NULL,
    created_at          DATETIME2(0) NOT NULL CONSTRAINT DF_payments_created_at DEFAULT SYSDATETIME(),
    updated_at          DATETIME2(0) NOT NULL CONSTRAINT DF_payments_updated_at DEFAULT SYSDATETIME(),

    CONSTRAINT PK_payments PRIMARY KEY (payment_id),
    CONSTRAINT FK_payments_booking FOREIGN KEY (booking_id)
        REFERENCES dbo.booking_orders(booking_id),
    CONSTRAINT CK_payments_method CHECK (payment_method IN ('MOMO', 'VNPAY', 'BANKING', 'CASH', 'MOCK')),
    CONSTRAINT CK_payments_amount CHECK (amount >= 0),
    CONSTRAINT CK_payments_status CHECK (payment_status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
    CONSTRAINT CK_payments_failed_reason CHECK (payment_status = 'FAILED' OR failed_reason IS NULL)
);
GO


-- ORIGINAL LINES 687-691

CREATE UNIQUE INDEX UX_payments_transaction_code
ON dbo.payments(transaction_code)
WHERE transaction_code IS NOT NULL;
GO


-- ORIGINAL LINES 692-696

CREATE UNIQUE INDEX UX_payments_request_id
ON dbo.payments(request_id)
WHERE request_id IS NOT NULL;
GO


-- ORIGINAL LINES 697-700

CREATE INDEX IX_payments_booking_status
ON dbo.payments(booking_id, payment_status);
GO


-- ORIGINAL LINES 701-722

CREATE TABLE dbo.refunds (
    refund_id          BIGINT IDENTITY(1,1) NOT NULL,
    payment_id         BIGINT NOT NULL,
    booking_id         BIGINT NOT NULL,
    refund_amount      DECIMAL(12,2) NOT NULL,
    reason             NVARCHAR(500) NULL,
    provider_ref       VARCHAR(150) NULL,
    refund_status      VARCHAR(20) NOT NULL CONSTRAINT DF_refunds_status DEFAULT 'PENDING',
    requested_at       DATETIME2(0) NOT NULL CONSTRAINT DF_refunds_requested_at DEFAULT SYSDATETIME(),
    completed_at       DATETIME2(0) NULL,

    CONSTRAINT PK_refunds PRIMARY KEY (refund_id),
    CONSTRAINT FK_refunds_payment FOREIGN KEY (payment_id) REFERENCES dbo.payments(payment_id),
    CONSTRAINT FK_refunds_booking FOREIGN KEY (booking_id) REFERENCES dbo.booking_orders(booking_id),
    CONSTRAINT CK_refunds_amount CHECK (refund_amount > 0),
    CONSTRAINT CK_refunds_status CHECK (refund_status IN ('PENDING', 'SUCCESS', 'FAILED')),
    CONSTRAINT CK_refunds_completed CHECK (
        (refund_status = 'SUCCESS' AND completed_at IS NOT NULL) OR refund_status <> 'SUCCESS'
    )
);
GO


-- ORIGINAL LINES 723-726

CREATE INDEX IX_refunds_booking_status
ON dbo.refunds(booking_id, refund_status);
GO


-- ORIGINAL LINES 727-749

/* VÉ ĐIỆN TỬ */

CREATE TABLE dbo.tickets (
    ticket_id           BIGINT IDENTITY(1,1) NOT NULL,
    booking_detail_id   BIGINT NOT NULL,
    ticket_code         VARCHAR(60) NOT NULL,
    qr_code             VARCHAR(500) NOT NULL,
    ticket_status       VARCHAR(20) NOT NULL CONSTRAINT DF_tickets_status DEFAULT 'VALID',
    issued_at           DATETIME2(0) NOT NULL CONSTRAINT DF_tickets_issued_at DEFAULT SYSDATETIME(),
    checked_in_at       DATETIME2(0) NULL,
    checked_in_by       INT NULL,

    CONSTRAINT PK_tickets PRIMARY KEY (ticket_id),
    CONSTRAINT FK_tickets_booking_detail FOREIGN KEY (booking_detail_id)
        REFERENCES dbo.booking_details(booking_detail_id),
    CONSTRAINT FK_tickets_checked_in_by FOREIGN KEY (checked_in_by)
        REFERENCES dbo.users(user_id),
    CONSTRAINT UQ_tickets_booking_detail UNIQUE (booking_detail_id),
    CONSTRAINT UQ_tickets_ticket_code UNIQUE (ticket_code),
    CONSTRAINT CK_tickets_status CHECK (ticket_status IN ('VALID', 'USED', 'CANCELLED', 'EXPIRED'))
);
GO


-- ORIGINAL LINES 750-772

/* OTP */

CREATE TABLE dbo.otp_codes (
    otp_id       BIGINT IDENTITY(1,1) NOT NULL,
    user_id      INT NOT NULL,
    code         VARCHAR(10) NOT NULL,
    purpose      VARCHAR(30) NOT NULL,
    expires_at   DATETIME2(0) NOT NULL,
    is_used      BIT NOT NULL CONSTRAINT DF_otp_codes_is_used DEFAULT 0,
    attempts     INT NOT NULL CONSTRAINT DF_otp_codes_attempts DEFAULT 0,
    created_at   DATETIME2(0) NOT NULL CONSTRAINT DF_otp_codes_created_at DEFAULT SYSDATETIME(),
    used_at      DATETIME2(0) NULL,

    CONSTRAINT PK_otp_codes PRIMARY KEY (otp_id),
    CONSTRAINT FK_otp_codes_user FOREIGN KEY (user_id)
        REFERENCES dbo.users(user_id) ON DELETE CASCADE,
    CONSTRAINT CK_otp_codes_purpose CHECK (
        purpose IN ('VERIFY_EMAIL', 'FORGOT_PASSWORD', 'RESET_PASSWORD', 'LOGIN')
    ),
    CONSTRAINT CK_otp_codes_attempts CHECK (attempts >= 0)
);
GO


-- ORIGINAL LINES 773-776

CREATE INDEX IX_otp_codes_lookup
ON dbo.otp_codes(user_id, purpose, is_used, expires_at DESC);
GO


-- ORIGINAL LINES 777-799

/* THÔNG BÁO VÀ SĂN VÉ */

CREATE TABLE dbo.notifications (
    notification_id    BIGINT IDENTITY(1,1) NOT NULL,
    user_id            INT NOT NULL,
    title              NVARCHAR(200) NOT NULL,
    message            NVARCHAR(MAX) NOT NULL,
    notification_type  VARCHAR(30) NOT NULL,
    reference_type     VARCHAR(30) NULL,
    reference_id       VARCHAR(80) NULL,
    is_read            BIT NOT NULL CONSTRAINT DF_notifications_is_read DEFAULT 0,
    read_at            DATETIME2(0) NULL,
    created_at         DATETIME2(0) NOT NULL CONSTRAINT DF_notifications_created_at DEFAULT SYSDATETIME(),

    CONSTRAINT PK_notifications PRIMARY KEY (notification_id),
    CONSTRAINT FK_notifications_user FOREIGN KEY (user_id)
        REFERENCES dbo.users(user_id) ON DELETE CASCADE,
    CONSTRAINT CK_notifications_type CHECK (
        notification_type IN ('BOOKING', 'PAYMENT', 'TICKET', 'TICKET_WATCH', 'PROMOTION', 'SYSTEM')
    )
);
GO


-- ORIGINAL LINES 800-803

CREATE INDEX IX_notifications_user_read
ON dbo.notifications(user_id, is_read, created_at DESC);
GO


-- ORIGINAL LINES 804-845

CREATE TABLE dbo.ticket_watch_requests (
    watch_id              BIGINT IDENTITY(1,1) NOT NULL,
    user_id               INT NOT NULL,
    movie_id              INT NOT NULL,
    cinema_id             INT NULL,
    preferred_date        DATE NULL,
    preferred_time_from   TIME(0) NULL,
    preferred_time_to     TIME(0) NULL,
    preferred_seat_type   VARCHAR(30) NULL,
    seat_preference       VARCHAR(20) NULL,
    wants_combo           BIT NOT NULL CONSTRAINT DF_watch_wants_combo DEFAULT 0,
    min_seats             INT NOT NULL CONSTRAINT DF_watch_min_seats DEFAULT 1,
    max_price             DECIMAL(12,2) NULL,
    status                VARCHAR(20) NOT NULL CONSTRAINT DF_watch_status DEFAULT 'ACTIVE',
    matched_showtime_id   INT NULL,
    created_at            DATETIME2(0) NOT NULL CONSTRAINT DF_watch_created_at DEFAULT SYSDATETIME(),
    expires_at            DATETIME2(0) NULL,
    matched_at            DATETIME2(0) NULL,

    CONSTRAINT PK_ticket_watch_requests PRIMARY KEY (watch_id),
    CONSTRAINT FK_watch_user FOREIGN KEY (user_id)
        REFERENCES dbo.users(user_id) ON DELETE CASCADE,
    CONSTRAINT FK_watch_movie FOREIGN KEY (movie_id)
        REFERENCES dbo.movies(movie_id),
    CONSTRAINT FK_watch_cinema FOREIGN KEY (cinema_id)
        REFERENCES dbo.cinemas(cinema_id),
    CONSTRAINT FK_watch_showtime FOREIGN KEY (matched_showtime_id)
        REFERENCES dbo.showtimes(showtime_id),
    CONSTRAINT CK_watch_seat_type CHECK (
        preferred_seat_type IS NULL OR preferred_seat_type IN ('NORMAL', 'VIP', 'COUPLE')
    ),
    CONSTRAINT CK_watch_seat_preference CHECK (seat_preference IS NULL OR seat_preference IN ('front', 'middle', 'back', 'any')),
    CONSTRAINT CK_watch_min_seats CHECK (min_seats BETWEEN 1 AND 8),
    CONSTRAINT CK_watch_max_price CHECK (max_price IS NULL OR max_price >= 0),
    CONSTRAINT CK_watch_status CHECK (status IN ('ACTIVE', 'MATCHED', 'CANCELLED', 'EXPIRED')),
    CONSTRAINT CK_watch_time_range CHECK (
        preferred_time_from IS NULL OR preferred_time_to IS NULL
        OR preferred_time_to > preferred_time_from
    )
);
GO


-- ORIGINAL LINES 846-849

CREATE INDEX IX_ticket_watch_active
ON dbo.ticket_watch_requests(status, movie_id, cinema_id, preferred_date);
GO


-- ORIGINAL LINES 850-871

/* AUDIT LOG */

CREATE TABLE dbo.audit_logs (
    audit_id       BIGINT IDENTITY(1,1) NOT NULL,
    user_id        INT NULL,
    action         VARCHAR(80) NOT NULL,
    entity_type    VARCHAR(80) NOT NULL,
    entity_id      VARCHAR(80) NULL,
    old_values     NVARCHAR(MAX) NULL,
    new_values     NVARCHAR(MAX) NULL,
    ip_address     VARCHAR(45) NULL,
    user_agent     NVARCHAR(500) NULL,
    created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_audit_logs_created_at DEFAULT SYSDATETIME(),

    CONSTRAINT PK_audit_logs PRIMARY KEY (audit_id),
    CONSTRAINT FK_audit_logs_user FOREIGN KEY (user_id)
        REFERENCES dbo.users(user_id),
    CONSTRAINT CK_audit_logs_old_values_json CHECK (old_values IS NULL OR ISJSON(old_values) = 1),
    CONSTRAINT CK_audit_logs_new_values_json CHECK (new_values IS NULL OR ISJSON(new_values) = 1)
);
GO


-- ORIGINAL LINES 872-875

CREATE INDEX IX_audit_logs_entity
ON dbo.audit_logs(entity_type, entity_id, created_at DESC);
GO


-- ORIGINAL LINES 876-879

CREATE INDEX IX_audit_logs_user
ON dbo.audit_logs(user_id, created_at DESC);
GO


-- ORIGINAL LINES 880-896


CREATE TRIGGER dbo.trg_users_updated_at
ON dbo.users
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE u
    SET updated_at = SYSDATETIME()
    FROM dbo.users u
    INNER JOIN inserted i ON i.user_id = u.user_id;
END;
GO


-- ORIGINAL LINES 897-912

CREATE TRIGGER dbo.trg_movies_updated_at
ON dbo.movies
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE m
    SET updated_at = SYSDATETIME()
    FROM dbo.movies m
    INNER JOIN inserted i ON i.movie_id = m.movie_id;
END;
GO


-- ORIGINAL LINES 913-929

/* CHỐNG TRÙNG LỊCH PHÒNG */

CREATE TRIGGER dbo.trg_showtimes_updated_at
ON dbo.showtimes
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE st
    SET updated_at = SYSDATETIME()
    FROM dbo.showtimes st
    INNER JOIN inserted i ON i.showtime_id = st.showtime_id;
END;
GO


-- ORIGINAL LINES 930-944

CREATE TRIGGER dbo.trg_booking_orders_updated_at
ON dbo.booking_orders
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE bo
    SET updated_at = SYSDATETIME()
    FROM dbo.booking_orders bo
    INNER JOIN inserted i ON i.booking_id = bo.booking_id;
END;
GO


-- ORIGINAL LINES 945-959

CREATE TRIGGER dbo.trg_payments_updated_at
ON dbo.payments
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE p
    SET updated_at = SYSDATETIME()
    FROM dbo.payments p
    INNER JOIN inserted i ON i.payment_id = p.payment_id;
END;
GO


-- ORIGINAL LINES 960-983

CREATE TRIGGER dbo.trg_showtimes_prevent_overlap
ON dbo.showtimes
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.showtimes s
            ON s.room_id = i.room_id
           AND s.showtime_id <> i.showtime_id
           AND s.status <> 'CANCELLED'
           AND i.status <> 'CANCELLED'
           AND i.start_time < s.end_time
           AND i.end_time > s.start_time
    )
    BEGIN
        THROW 51001, N'Phòng chiếu bị trùng lịch trong khoảng thời gian đã chọn.', 1;
    END;
END;
GO


-- ORIGINAL LINES 984-1018



CREATE TRIGGER dbo.trg_movie_ratings_sync_average
ON dbo.movie_ratings
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH changed_movies AS (
        SELECT movie_id FROM inserted
        UNION
        SELECT movie_id FROM deleted
    ),
    rating_summary AS (
        SELECT
            mr.movie_id,
            AVG(CAST(mr.stars AS DECIMAL(10,4))) AS average_stars
        FROM dbo.movie_ratings AS mr
        INNER JOIN changed_movies AS cm
            ON cm.movie_id = mr.movie_id
        GROUP BY mr.movie_id
    )
    UPDATE m
    SET
        m.average_rating = CAST(COALESCE(rs.average_stars, 0) AS DECIMAL(3,2)),
        m.updated_at = SYSDATETIME()
    FROM dbo.movies AS m
    INNER JOIN changed_movies AS cm
        ON cm.movie_id = m.movie_id
    LEFT JOIN rating_summary AS rs
        ON rs.movie_id = m.movie_id;
END;
GO


-- ORIGINAL LINES 1019-1052

CREATE PROCEDURE dbo.sp_get_movie_rating
    @movie_id INT,
    @user_id  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.movies
        WHERE movie_id = @movie_id
    )
        THROW 51050, N'Không tìm thấy phim.', 1;

    SELECT
        m.movie_id,
        CAST(m.average_rating AS DECIMAL(3,2)) AS average_stars,
        CAST(m.average_rating * 2 AS DECIMAL(4,2)) AS average_score,
        COUNT(r.rating_id) AS rating_count,
        MAX(
            CASE
                WHEN @user_id IS NOT NULL AND r.user_id = @user_id
                THEN CAST(r.stars AS INT)
                ELSE NULL
            END
        ) AS my_rating
    FROM dbo.movies AS m
    LEFT JOIN dbo.movie_ratings AS r
        ON r.movie_id = m.movie_id
    WHERE m.movie_id = @movie_id
    GROUP BY m.movie_id, m.average_rating;
END;
GO


-- ORIGINAL LINES 1053-1109

CREATE PROCEDURE dbo.sp_upsert_movie_rating
    @movie_id INT,
    @user_id  INT,
    @stars    TINYINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @stars NOT BETWEEN 1 AND 5
        THROW 51051, N'Số sao phải nằm trong khoảng từ 1 đến 5.', 1;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.movies
        WHERE movie_id = @movie_id
    )
        THROW 51052, N'Không tìm thấy phim.', 1;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.users
        WHERE user_id = @user_id
          AND status <> 'DELETED'
    )
        THROW 51053, N'Không tìm thấy người dùng hợp lệ.', 1;

    BEGIN TRANSACTION;

    IF EXISTS (
        SELECT 1
        FROM dbo.movie_ratings WITH (UPDLOCK, HOLDLOCK)
        WHERE movie_id = @movie_id
          AND user_id = @user_id
    )
    BEGIN
        UPDATE dbo.movie_ratings
        SET
            stars = @stars,
            updated_at = SYSDATETIME()
        WHERE movie_id = @movie_id
          AND user_id = @user_id;
    END
    ELSE
    BEGIN
        INSERT INTO dbo.movie_ratings(movie_id, user_id, stars)
        VALUES (@movie_id, @user_id, @stars);
    END;

    COMMIT TRANSACTION;

    EXEC dbo.sp_get_movie_rating
        @movie_id = @movie_id,
        @user_id = @user_id;
END;
GO


-- ORIGINAL LINES 1110-1127

CREATE PROCEDURE dbo.sp_delete_movie_rating
    @movie_id INT,
    @user_id  INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DELETE FROM dbo.movie_ratings
    WHERE movie_id = @movie_id
      AND user_id = @user_id;

    EXEC dbo.sp_get_movie_rating
        @movie_id = @movie_id,
        @user_id = @user_id;
END;
GO


-- ORIGINAL LINES 1128-1194

CREATE PROCEDURE dbo.sp_create_showtime
    @movie_id INT,
    @room_id INT,
    @start_time DATETIME2(0),
    @base_price DECIMAL(12,2),
    @created_by INT = NULL,
    @cleaning_minutes INT = 15
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @base_price < 0
        THROW 51015, N'Giá vé cơ bản không được âm.', 1;
    IF @cleaning_minutes NOT BETWEEN 0 AND 120
        THROW 51016, N'Thời gian vệ sinh phải từ 0 đến 120 phút.', 1;

    DECLARE @duration_minutes INT;
    SELECT @duration_minutes = duration_minutes
    FROM dbo.movies
    WHERE movie_id = @movie_id AND status <> 'HIDDEN';

    IF @duration_minutes IS NULL
        THROW 51017, N'Phim không tồn tại hoặc đang bị ẩn.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.rooms WHERE room_id = @room_id AND status = 'ACTIVE')
        THROW 51018, N'Phòng chiếu không tồn tại hoặc không hoạt động.', 1;

    DECLARE @end_time DATETIME2(0) = DATEADD(MINUTE, @duration_minutes + @cleaning_minutes, @start_time);
    DECLARE @showtime_id INT;

    BEGIN TRANSACTION;

    IF EXISTS (
        SELECT 1
        FROM dbo.showtimes WITH (UPDLOCK, HOLDLOCK)
        WHERE room_id = @room_id
          AND status <> 'CANCELLED'
          AND @start_time < end_time
          AND @end_time > start_time
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 51019, N'Phòng chiếu bị trùng lịch.', 1;
    END;

    INSERT INTO dbo.showtimes(movie_id, room_id, start_time, end_time, base_price, status, created_by)
    VALUES(@movie_id, @room_id, @start_time, @end_time, @base_price, 'OPEN', @created_by);

    SET @showtime_id = SCOPE_IDENTITY();
    EXEC dbo.sp_generate_showtime_seats @showtime_id = @showtime_id;

    INSERT INTO dbo.audit_logs(user_id, action, entity_type, entity_id, new_values)
    VALUES(
        @created_by,
        'CREATE_SHOWTIME',
        'showtimes',
        CONVERT(VARCHAR(80), @showtime_id),
        (SELECT @movie_id AS movie_id, @room_id AS room_id, @start_time AS start_time,
                @end_time AS end_time, @base_price AS base_price FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    );

    COMMIT TRANSACTION;

    SELECT * FROM dbo.showtimes WHERE showtime_id = @showtime_id;
END;
GO


-- ORIGINAL LINES 1195-1233

/* PROCEDURE SINH GHẾ CHO SUẤT CHIẾU */

CREATE PROCEDURE dbo.sp_generate_showtime_seats
    @showtime_id INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @room_id INT;
    DECLARE @base_price DECIMAL(12,2);

    SELECT
        @room_id = room_id,
        @base_price = base_price
    FROM dbo.showtimes
    WHERE showtime_id = @showtime_id;

    IF @room_id IS NULL
        THROW 51002, N'Suất chiếu không tồn tại.', 1;

    INSERT INTO dbo.showtime_seats(showtime_id, seat_id, price, status)
    SELECT
        @showtime_id,
        s.seat_id,
        ROUND(@base_price * st.price_multiplier, 0),
        CASE WHEN s.status = 'ACTIVE' THEN 'AVAILABLE' ELSE 'BLOCKED' END
    FROM dbo.seats s
    INNER JOIN dbo.seat_types st ON st.seat_type_id = s.seat_type_id
    WHERE s.room_id = @room_id
      AND NOT EXISTS (
          SELECT 1
          FROM dbo.showtime_seats ss
          WHERE ss.showtime_id = @showtime_id
            AND ss.seat_id = s.seat_id
      );
END;
GO


-- ORIGINAL LINES 1234-1338


CREATE PROCEDURE dbo.sp_hold_seats
    @user_id INT,
    @showtime_id INT,
    @seat_ids NVARCHAR(MAX),
    @hold_minutes INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @hold_minutes NOT BETWEEN 1 AND 30
        THROW 51003, N'Thời gian giữ ghế phải từ 1 đến 30 phút.', 1;

    IF NOT EXISTS (
        SELECT 1 FROM dbo.users
        WHERE user_id = @user_id AND status = 'ACTIVE'
    )
        THROW 51004, N'Người dùng không tồn tại hoặc không hoạt động.', 1;

    DECLARE @RequestedSeats TABLE (
        showtime_seat_id INT PRIMARY KEY
    );

    INSERT INTO @RequestedSeats(showtime_seat_id)
    SELECT DISTINCT TRY_CONVERT(INT, [value])
    FROM OPENJSON(@seat_ids)
    WHERE TRY_CONVERT(INT, [value]) IS NOT NULL;

    DECLARE @SeatCount INT = (SELECT COUNT(*) FROM @RequestedSeats);

    IF @SeatCount = 0
        THROW 51005, N'Danh sách ghế không hợp lệ.', 1;

    IF @SeatCount > 8
        THROW 51006, N'Mỗi đơn chỉ được chọn tối đa 8 ghế.', 1;

    BEGIN TRANSACTION;

    UPDATE ss WITH (UPDLOCK, HOLDLOCK)
    SET status = 'AVAILABLE',
        held_by_user_id = NULL,
        hold_expires_at = NULL
    FROM dbo.showtime_seats ss
    WHERE ss.showtime_id = @showtime_id
      AND ss.status = 'HELD'
      AND ss.hold_expires_at <= SYSDATETIME();

    UPDATE sh
    SET status = 'EXPIRED',
        released_at = SYSDATETIME()
    FROM dbo.seat_holds sh
    INNER JOIN dbo.showtime_seats ss
        ON ss.showtime_seat_id = sh.showtime_seat_id
    WHERE ss.showtime_id = @showtime_id
      AND sh.status = 'ACTIVE'
      AND sh.expires_at <= SYSDATETIME();

    IF (
        SELECT COUNT(*)
        FROM dbo.showtime_seats ss WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedSeats r
            ON r.showtime_seat_id = ss.showtime_seat_id
        WHERE ss.showtime_id = @showtime_id
          AND ss.status = 'AVAILABLE'
    ) <> @SeatCount
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 51007, N'Một hoặc nhiều ghế không còn trống.', 1;
    END;

    DECLARE @ExpiresAt DATETIME2(0) = DATEADD(MINUTE, @hold_minutes, SYSDATETIME());
    DECLARE @HoldToken UNIQUEIDENTIFIER = NEWID();

    UPDATE ss
    SET status = 'HELD',
        held_by_user_id = @user_id,
        hold_expires_at = @ExpiresAt
    FROM dbo.showtime_seats ss
    INNER JOIN @RequestedSeats r
        ON r.showtime_seat_id = ss.showtime_seat_id;

    INSERT INTO dbo.seat_holds(
        user_id, showtime_seat_id, hold_token, status, expires_at
    )
    SELECT
        @user_id, r.showtime_seat_id, @HoldToken, 'ACTIVE', @ExpiresAt
    FROM @RequestedSeats r;

    COMMIT TRANSACTION;

    SELECT
        @HoldToken AS hold_token,
        @ExpiresAt AS expires_at,
        ss.showtime_seat_id,
        s.seat_label,
        ss.price,
        ss.status
    FROM dbo.showtime_seats ss
    INNER JOIN dbo.seats s ON s.seat_id = ss.seat_id
    INNER JOIN @RequestedSeats r ON r.showtime_seat_id = ss.showtime_seat_id
    ORDER BY s.seat_row, s.seat_number;
END;
GO


-- ORIGINAL LINES 1398-1497

/* PROCEDURE TẠO BOOKING TỪ HOLD TOKEN */

CREATE PROCEDURE dbo.sp_create_booking
    @user_id INT,
    @showtime_id INT,
    @hold_token UNIQUEIDENTIFIER,
    @idempotency_key VARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @idempotency_key IS NOT NULL
       AND EXISTS (SELECT 1 FROM dbo.booking_orders WHERE idempotency_key = @idempotency_key)
    BEGIN
        SELECT *
        FROM dbo.booking_orders
        WHERE idempotency_key = @idempotency_key;
        RETURN;
    END;

    BEGIN TRANSACTION;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.showtimes WITH (UPDLOCK, HOLDLOCK)
        WHERE showtime_id = @showtime_id
          AND status = 'OPEN'
          AND start_time > DATEADD(MINUTE, 15, SYSDATETIME())
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 51024, N'Suất chiếu đã đóng hoặc đã quá thời hạn đặt vé trực tuyến.', 1;
    END;

    DECLARE @Seats TABLE (
        showtime_seat_id INT PRIMARY KEY,
        price DECIMAL(12,2)
    );

    INSERT INTO @Seats(showtime_seat_id, price)
    SELECT ss.showtime_seat_id, ss.price
    FROM dbo.seat_holds sh WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN dbo.showtime_seats ss WITH (UPDLOCK, HOLDLOCK)
        ON ss.showtime_seat_id = sh.showtime_seat_id
    WHERE sh.user_id = @user_id
      AND sh.hold_token = @hold_token
      AND sh.status = 'ACTIVE'
      AND sh.expires_at > SYSDATETIME()
      AND ss.showtime_id = @showtime_id
      AND ss.status = 'HELD'
      AND ss.held_by_user_id = @user_id;

    DECLARE @SeatCount INT = (SELECT COUNT(*) FROM @Seats);

    IF @SeatCount = 0
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 51008, N'Hold token không hợp lệ hoặc đã hết hạn.', 1;
    END;

    IF @SeatCount > 8
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 51023, N'Mỗi đơn chỉ được đặt tối đa 8 ghế.', 1;
    END;

    DECLARE @Subtotal DECIMAL(12,2) = (SELECT SUM(price) FROM @Seats);
    DECLARE @BookingId BIGINT;
    DECLARE @BookingCode VARCHAR(40) =
        CONCAT('CH', FORMAT(SYSDATETIME(), 'yyyyMMddHHmmss'), RIGHT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 8));

    INSERT INTO dbo.booking_orders(
        booking_code, user_id, showtime_id,
        subtotal_amount, discount_amount, product_amount, total_amount,
        status, idempotency_key, expires_at
    )
    VALUES(
        @BookingCode, @user_id, @showtime_id,
        @Subtotal, 0, 0, @Subtotal,
        'PENDING_PAYMENT', @idempotency_key,
        DATEADD(MINUTE, 10, SYSDATETIME())
    );

    SET @BookingId = SCOPE_IDENTITY();

    INSERT INTO dbo.booking_details(
        booking_id, showtime_seat_id, seat_price, status
    )
    SELECT @BookingId, showtime_seat_id, price, 'ACTIVE'
    FROM @Seats;

    COMMIT TRANSACTION;

    SELECT *
    FROM dbo.booking_orders
    WHERE booking_id = @BookingId;
END;
GO


-- ORIGINAL LINES 1702-1756
/* PROCEDURE CHECK-IN VÉ */

CREATE PROCEDURE dbo.sp_checkin_ticket
    @ticket_code VARCHAR(60),
    @staff_user_id INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    DECLARE @TicketId BIGINT;
    DECLARE @Status VARCHAR(20);
    DECLARE @StartTime DATETIME2(0);

    SELECT
        @TicketId = t.ticket_id,
        @Status = t.ticket_status,
        @StartTime = st.start_time
    FROM dbo.tickets t WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN dbo.booking_details bd ON bd.booking_detail_id = t.booking_detail_id
    INNER JOIN dbo.showtime_seats ss ON ss.showtime_seat_id = bd.showtime_seat_id
    INNER JOIN dbo.showtimes st ON st.showtime_id = ss.showtime_id
    WHERE t.ticket_code = @ticket_code;

    IF @TicketId IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 51012, N'Không tìm thấy vé.', 1;
    END;

    IF @Status <> 'VALID'
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 51013, N'Vé không hợp lệ hoặc đã được sử dụng.', 1;
    END;

    IF SYSDATETIME() NOT BETWEEN DATEADD(MINUTE, -30, @StartTime) AND DATEADD(MINUTE, 30, @StartTime)
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 51014, N'Vé chỉ được quét trong khoảng 30 phút trước hoặc sau giờ chiếu.', 1;
    END;

    UPDATE dbo.tickets
    SET ticket_status = 'USED',
        checked_in_at = SYSDATETIME(),
        checked_in_by = @staff_user_id
    WHERE ticket_id = @TicketId;

    COMMIT TRANSACTION;

    SELECT * FROM dbo.tickets WHERE ticket_id = @TicketId;
END;
GO


-- ORIGINAL LINES 1757-1849

CREATE PROCEDURE dbo.sp_find_ticket_suggestions
    @watch_id BIGINT,
    @top_n INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @top_n NOT BETWEEN 1 AND 100 SET @top_n = 20;

    DECLARE
        @movie_id INT,
        @cinema_id INT,
        @preferred_date DATE,
        @time_from TIME(0),
        @time_to TIME(0),
        @preferred_seat_type VARCHAR(30),
        @seat_preference VARCHAR(20),
        @min_seats INT,
        @max_price DECIMAL(12,2),
        @wants_combo BIT;

    SELECT
        @movie_id = movie_id,
        @cinema_id = cinema_id,
        @preferred_date = preferred_date,
        @time_from = preferred_time_from,
        @time_to = preferred_time_to,
        @preferred_seat_type = preferred_seat_type,
        @seat_preference = seat_preference,
        @min_seats = min_seats,
        @max_price = max_price,
        @wants_combo = wants_combo
    FROM dbo.ticket_watch_requests
    WHERE watch_id = @watch_id AND status = 'ACTIVE';

    IF @movie_id IS NULL
        THROW 51020, N'Yêu cầu săn vé không tồn tại hoặc không còn hoạt động.', 1;

    ;WITH Candidate AS (
        SELECT
            st.showtime_id,
            st.start_time,
            st.end_time,
            st.base_price,
            m.title AS movie_title,
            c.cinema_id,
            c.cinema_name,
            r.room_id,
            r.room_name,
            COUNT(CASE WHEN ss.status = 'AVAILABLE' THEN 1 END) AS available_seats,
            MIN(CASE WHEN ss.status = 'AVAILABLE' THEN ss.price END) AS min_available_price,
            COUNT(CASE WHEN ss.status = 'AVAILABLE'
                        AND (@preferred_seat_type IS NULL OR seat_type.type_code = @preferred_seat_type)
                       THEN 1 END) AS preferred_type_available,
            COUNT(CASE WHEN ss.status = 'AVAILABLE' AND (
                        @seat_preference IS NULL OR @seat_preference = 'any'
                        OR (@seat_preference = 'front' AND s.seat_row IN ('A','B','C'))
                        OR (@seat_preference = 'middle' AND s.seat_row IN ('D','E','F','G'))
                        OR (@seat_preference = 'back' AND s.seat_row NOT IN ('A','B','C','D','E','F','G'))
                       ) THEN 1 END) AS preferred_position_available
        FROM dbo.showtimes st
        INNER JOIN dbo.movies m ON m.movie_id = st.movie_id
        INNER JOIN dbo.rooms r ON r.room_id = st.room_id
        INNER JOIN dbo.cinemas c ON c.cinema_id = r.cinema_id
        INNER JOIN dbo.showtime_seats ss ON ss.showtime_id = st.showtime_id
        INNER JOIN dbo.seats s ON s.seat_id = ss.seat_id
        INNER JOIN dbo.seat_types seat_type ON seat_type.seat_type_id = s.seat_type_id
        WHERE st.movie_id = @movie_id
          AND st.status = 'OPEN'
          AND st.start_time > SYSDATETIME()
          AND (@cinema_id IS NULL OR c.cinema_id = @cinema_id)
          AND (@preferred_date IS NULL OR CAST(st.start_time AS DATE) = @preferred_date)
          AND (@time_from IS NULL OR CAST(st.start_time AS TIME) >= @time_from)
          AND (@time_to IS NULL OR CAST(st.start_time AS TIME) <= @time_to)
        GROUP BY st.showtime_id, st.start_time, st.end_time, st.base_price,
                 m.title, c.cinema_id, c.cinema_name, r.room_id, r.room_name
    )
    SELECT TOP (@top_n)
        *,
        @wants_combo AS wants_combo,
        CASE WHEN @wants_combo = 1 AND EXISTS (
            SELECT 1 FROM dbo.concession_combos cc WHERE cc.status = 'ACTIVE'
        ) THEN 1 ELSE 0 END AS combo_available,
        (preferred_type_available * 2 + preferred_position_available) AS match_score
    FROM Candidate
    WHERE available_seats >= @min_seats
      AND (@preferred_seat_type IS NULL OR preferred_type_available >= @min_seats)
      AND (@seat_preference IS NULL OR @seat_preference = 'any' OR preferred_position_available >= @min_seats)
      AND (@max_price IS NULL OR min_available_price <= @max_price)
    ORDER BY match_score DESC, min_available_price ASC, start_time ASC;
END;
GO


-- ORIGINAL LINES 1850-1882

/* VIEW */

CREATE VIEW dbo.vw_showtime_seat_map
AS
SELECT
    ss.showtime_seat_id,
    st.showtime_id,
    m.movie_id,
    m.title AS movie_title,
    c.cinema_id,
    c.cinema_name,
    r.room_id,
    r.room_name,
    s.seat_id,
    s.seat_label,
    s.seat_row,
    s.seat_number,
    seat_type.type_code AS seat_type,
    ss.price,
    ss.status AS seat_status,
    ss.held_by_user_id,
    ss.hold_expires_at,
    st.start_time,
    st.end_time
FROM dbo.showtime_seats ss
INNER JOIN dbo.showtimes st ON st.showtime_id = ss.showtime_id
INNER JOIN dbo.movies m ON m.movie_id = st.movie_id
INNER JOIN dbo.rooms r ON r.room_id = st.room_id
INNER JOIN dbo.cinemas c ON c.cinema_id = r.cinema_id
INNER JOIN dbo.seats s ON s.seat_id = ss.seat_id
INNER JOIN dbo.seat_types seat_type ON seat_type.seat_type_id = s.seat_type_id;
GO


-- ORIGINAL LINES 1883-1911

CREATE VIEW dbo.vw_booking_summary
AS
SELECT
    bo.booking_id,
    bo.booking_code,
    bo.user_id,
    u.full_name,
    u.email,
    bo.showtime_id,
    m.title AS movie_title,
    c.cinema_name,
    r.room_name,
    st.start_time,
    bo.subtotal_amount,
    bo.discount_amount,
    bo.product_amount,
    bo.total_amount,
    bo.status AS booking_status,
    bo.expires_at,
    bo.paid_at,
    bo.created_at
FROM dbo.booking_orders bo
INNER JOIN dbo.users u ON u.user_id = bo.user_id
INNER JOIN dbo.showtimes st ON st.showtime_id = bo.showtime_id
INNER JOIN dbo.movies m ON m.movie_id = st.movie_id
INNER JOIN dbo.rooms r ON r.room_id = st.room_id
INNER JOIN dbo.cinemas c ON c.cinema_id = r.cinema_id;
GO


-- ORIGINAL LINES 1912-1940

CREATE VIEW dbo.vw_daily_revenue
AS
WITH Paid AS (
    SELECT
        CAST(p.paid_at AS DATE) AS revenue_date,
        p.booking_id,
        p.amount
    FROM dbo.payments p
    WHERE p.payment_status = 'SUCCESS'
),
Refunded AS (
    SELECT
        r.booking_id,
        SUM(r.refund_amount) AS refunded_amount
    FROM dbo.refunds r
    WHERE r.refund_status = 'SUCCESS'
    GROUP BY r.booking_id
)
SELECT
    p.revenue_date,
    COUNT(DISTINCT p.booking_id) AS total_bookings,
    SUM(p.amount) AS gross_revenue,
    SUM(ISNULL(r.refunded_amount, 0)) AS refunded_amount,
    SUM(p.amount - ISNULL(r.refunded_amount, 0)) AS net_revenue
FROM Paid p
LEFT JOIN Refunded r ON r.booking_id = p.booking_id
GROUP BY p.revenue_date;
GO


-- ORIGINAL LINES 1949-1974

CREATE OR ALTER TRIGGER dbo.trg_users_sync_role
ON dbo.users
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DELETE ur
    FROM dbo.user_roles ur
    INNER JOIN inserted i ON i.user_id = ur.user_id
    INNER JOIN dbo.roles r ON r.role_id = ur.role_id
    WHERE r.role_code <> i.role;

    INSERT INTO dbo.user_roles(user_id, role_id)
    SELECT i.user_id, r.role_id
    FROM inserted i
    INNER JOIN dbo.roles r ON r.role_code = i.role
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.user_roles ur
        WHERE ur.user_id = i.user_id
          AND ur.role_id = r.role_id
    );
END;
GO


-- ORIGINAL LINES 2384-2568

CREATE OR ALTER PROCEDURE dbo.sp_confirm_payment
    @booking_id BIGINT,
    @payment_method VARCHAR(30),
    @provider VARCHAR(30) = 'MOCK',
    @request_id VARCHAR(100),
    @transaction_code VARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF EXISTS (
        SELECT 1
        FROM dbo.payments
        WHERE request_id = @request_id
          AND booking_id <> @booking_id
    )
    BEGIN
        THROW 51021, N'Request thanh toán đã được dùng cho đơn hàng khác.', 1;
    END;

    IF EXISTS (
        SELECT 1 FROM dbo.payments
        WHERE request_id = @request_id
          AND booking_id = @booking_id
          AND payment_status = 'SUCCESS'
    )
    BEGIN
        SELECT t.ticket_id, t.ticket_code, t.qr_code, t.ticket_status, t.issued_at, bd.showtime_seat_id
        FROM dbo.tickets t
        INNER JOIN dbo.booking_details bd ON bd.booking_detail_id = t.booking_detail_id
        WHERE bd.booking_id = @booking_id;
        RETURN;
    END;

    BEGIN TRANSACTION;

    DECLARE @Amount DECIMAL(12,2);
    DECLARE @BookingStatus VARCHAR(30);
    DECLARE @ExpiresAt DATETIME2(0);

    SELECT
        @Amount = total_amount,
        @BookingStatus = status,
        @ExpiresAt = expires_at
    FROM dbo.booking_orders WITH (UPDLOCK, HOLDLOCK)
    WHERE booking_id = @booking_id;

    IF @Amount IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 51009, N'Không tìm thấy đơn đặt vé.', 1;
    END;

    IF @BookingStatus IN ('PAID', 'ISSUED')
    BEGIN
        COMMIT TRANSACTION;
        SELECT t.ticket_id, t.ticket_code, t.qr_code, t.ticket_status, t.issued_at, bd.showtime_seat_id
        FROM dbo.tickets t
        INNER JOIN dbo.booking_details bd ON bd.booking_detail_id = t.booking_detail_id
        WHERE bd.booking_id = @booking_id;
        RETURN;
    END;

    IF @BookingStatus <> 'PENDING_PAYMENT'
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 51010, N'Đơn đặt vé không còn ở trạng thái chờ thanh toán.', 1;
    END;

    IF @ExpiresAt IS NOT NULL AND @ExpiresAt <= SYSDATETIME()
    BEGIN
        UPDATE ss
        SET ss.status = 'AVAILABLE',
            ss.held_by_user_id = NULL,
            ss.hold_expires_at = NULL
        FROM dbo.showtime_seats ss
        INNER JOIN dbo.booking_details bd ON bd.showtime_seat_id = ss.showtime_seat_id
        WHERE bd.booking_id = @booking_id
          AND bd.status = 'ACTIVE'
          AND ss.status = 'HELD';

        UPDATE sh
        SET sh.status = 'EXPIRED',
            sh.released_at = SYSDATETIME()
        FROM dbo.seat_holds sh
        INNER JOIN dbo.booking_details bd ON bd.showtime_seat_id = sh.showtime_seat_id
        WHERE bd.booking_id = @booking_id
          AND sh.status = 'ACTIVE';

        UPDATE dbo.booking_details
        SET status = 'EXPIRED'
        WHERE booking_id = @booking_id AND status = 'ACTIVE';

        UPDATE dbo.booking_orders
        SET status = 'EXPIRED'
        WHERE booking_id = @booking_id;

        COMMIT TRANSACTION;
        THROW 51011, N'Đơn đặt vé đã hết hạn.', 1;
    END;

    DECLARE @ExpectedSeatCount INT;
    DECLARE @ValidHeldSeatCount INT;

    SELECT @ExpectedSeatCount = COUNT(*)
    FROM dbo.booking_details
    WHERE booking_id = @booking_id
      AND status = 'ACTIVE';

    SELECT @ValidHeldSeatCount = COUNT(*)
    FROM dbo.booking_details bd
    INNER JOIN dbo.showtime_seats ss WITH (UPDLOCK, HOLDLOCK)
        ON ss.showtime_seat_id = bd.showtime_seat_id
    WHERE bd.booking_id = @booking_id
      AND bd.status = 'ACTIVE'
      AND ss.status = 'HELD';

    IF @ExpectedSeatCount = 0 OR @ExpectedSeatCount <> @ValidHeldSeatCount
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 51022, N'Một hoặc nhiều ghế không còn được giữ hợp lệ.', 1;
    END;

    INSERT INTO dbo.payments(
        booking_id, payment_method, provider, amount,
        transaction_code, request_id, payment_status, paid_at
    )
    VALUES(
        @booking_id, @payment_method, @provider, @Amount,
        @transaction_code, @request_id, 'SUCCESS', SYSDATETIME()
    );

    UPDATE dbo.booking_orders
    SET status = 'ISSUED',
        paid_at = SYSDATETIME(),
        issued_at = SYSDATETIME()
    WHERE booking_id = @booking_id;

    UPDATE ss
    SET ss.status = 'BOOKED',
        ss.held_by_user_id = NULL,
        ss.hold_expires_at = NULL
    FROM dbo.showtime_seats ss
    INNER JOIN dbo.booking_details bd
        ON bd.showtime_seat_id = ss.showtime_seat_id
    WHERE bd.booking_id = @booking_id
      AND bd.status = 'ACTIVE'
      AND ss.status = 'HELD';

    UPDATE sh
    SET sh.status = 'CONVERTED',
        sh.released_at = SYSDATETIME()
    FROM dbo.seat_holds sh
    INNER JOIN dbo.booking_details bd
        ON bd.showtime_seat_id = sh.showtime_seat_id
    WHERE bd.booking_id = @booking_id
      AND sh.status = 'ACTIVE';

    INSERT INTO dbo.tickets(
        booking_detail_id, ticket_code, qr_code, ticket_status
    )
    SELECT
        bd.booking_detail_id,
        CONCAT('TKT-', RIGHT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 20)),
        CONCAT('CINEHUNT:', bo.booking_code, ':', bd.booking_detail_id, ':', NEWID()),
        'VALID'
    FROM dbo.booking_details bd
    INNER JOIN dbo.booking_orders bo ON bo.booking_id = bd.booking_id
    WHERE bd.booking_id = @booking_id
      AND bd.status = 'ACTIVE'
      AND NOT EXISTS (
          SELECT 1 FROM dbo.tickets t
          WHERE t.booking_detail_id = bd.booking_detail_id
      );

    COMMIT TRANSACTION;

    SELECT t.ticket_id, t.ticket_code, t.qr_code, t.ticket_status, t.issued_at, bd.showtime_seat_id
    FROM dbo.tickets t
    INNER JOIN dbo.booking_details bd ON bd.booking_detail_id = t.booking_detail_id
    WHERE bd.booking_id = @booking_id;
END;
GO


-- ORIGINAL LINES 3063-3076

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.seat_holds')
      AND name = N'IX_seat_holds_release_expired'
)
BEGIN
    CREATE INDEX IX_seat_holds_release_expired
        ON dbo.seat_holds(status, expires_at, hold_id)
        INCLUDE(showtime_seat_id)
        WHERE status = 'ACTIVE';
END;
GO


-- ORIGINAL LINES 3077-3257

CREATE OR ALTER PROCEDURE dbo.sp_release_expired_holds
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Now DATETIME2(0) = SYSDATETIME();
    DECLARE @AppLockResult INT;
    DECLARE @ApplicationLockAcquired BIT = 0;

    DECLARE @ReleasedSeats INT = 0;
    DECLARE @ExpiredHolds INT = 0;
    DECLARE @ExpiredBookings INT = 0;
    DECLARE @ExpiredBookingDetails INT = 0;
    DECLARE @CancelledConvertedHolds INT = 0;

    EXEC @AppLockResult = sys.sp_getapplock
        @Resource = N'CineHunt:sp_release_expired_holds',
        @LockMode = 'Exclusive',
        @LockOwner = 'Session',
        @LockTimeout = 0,
        @DbPrincipal = 'public';

    IF @AppLockResult < 0
    BEGIN
        SELECT
            CAST(0 AS INT) AS releasedSeats,
            CAST(0 AS INT) AS expiredHolds,
            CAST(0 AS INT) AS expiredBookings,
            CAST(0 AS INT) AS expiredBookingDetails,
            CAST(0 AS INT) AS cancelledConvertedHolds,
            CAST(1 AS BIT) AS skippedBecauseAlreadyRunning;
        RETURN;
    END;

    SET @ApplicationLockAcquired = 1;

    BEGIN TRY
        DECLARE @ExpiredHoldBatch TABLE (
            hold_id BIGINT NOT NULL PRIMARY KEY,
            showtime_seat_id INT NOT NULL
        );

        BEGIN TRANSACTION;

        INSERT INTO @ExpiredHoldBatch(hold_id, showtime_seat_id)
        SELECT TOP (200)
            sh.hold_id,
            sh.showtime_seat_id
        FROM dbo.seat_holds sh WITH (UPDLOCK, ROWLOCK)
        WHERE sh.status = 'ACTIVE'
          AND sh.expires_at <= @Now
        ORDER BY sh.hold_id;

        UPDATE ss WITH (ROWLOCK)
        SET ss.status = 'AVAILABLE',
            ss.held_by_user_id = NULL,
            ss.hold_expires_at = NULL
        FROM dbo.showtime_seats ss
        INNER JOIN @ExpiredHoldBatch batch
            ON batch.showtime_seat_id = ss.showtime_seat_id
        WHERE ss.status = 'HELD'
          AND ss.hold_expires_at IS NOT NULL
          AND ss.hold_expires_at <= @Now;

        SET @ReleasedSeats = @@ROWCOUNT;

        UPDATE sh WITH (ROWLOCK)
        SET sh.status = 'EXPIRED',
            sh.released_at = @Now
        FROM dbo.seat_holds sh
        INNER JOIN @ExpiredHoldBatch batch
            ON batch.hold_id = sh.hold_id
        WHERE sh.status = 'ACTIVE'
          AND sh.expires_at <= @Now;

        SET @ExpiredHolds = @@ROWCOUNT;

        COMMIT TRANSACTION;

        DECLARE @ExpiredBookingBatch TABLE (
            booking_id BIGINT NOT NULL PRIMARY KEY
        );

        BEGIN TRANSACTION;

        INSERT INTO @ExpiredBookingBatch(booking_id)
        SELECT TOP (200)
            bo.booking_id
        FROM dbo.booking_orders bo WITH (UPDLOCK, ROWLOCK)
        WHERE bo.status = 'PENDING_PAYMENT'
          AND bo.expires_at IS NOT NULL
          AND bo.expires_at <= @Now
        ORDER BY bo.booking_id;

        UPDATE bo WITH (ROWLOCK)
        SET bo.status = 'EXPIRED',
            bo.updated_at = @Now
        FROM dbo.booking_orders bo
        INNER JOIN @ExpiredBookingBatch batch
            ON batch.booking_id = bo.booking_id
        WHERE bo.status = 'PENDING_PAYMENT'
          AND bo.expires_at IS NOT NULL
          AND bo.expires_at <= @Now;

        SET @ExpiredBookings = @@ROWCOUNT;

        UPDATE bd WITH (ROWLOCK)
        SET bd.status = 'EXPIRED'
        FROM dbo.booking_details bd
        INNER JOIN @ExpiredBookingBatch batch
            ON batch.booking_id = bd.booking_id
        WHERE bd.status = 'ACTIVE';

        SET @ExpiredBookingDetails = @@ROWCOUNT;

        COMMIT TRANSACTION;

        DECLARE @ConvertedHoldBatch TABLE (
            hold_id BIGINT NOT NULL PRIMARY KEY
        );

        BEGIN TRANSACTION;

        INSERT INTO @ConvertedHoldBatch(hold_id)
        SELECT TOP (200)
            sh.hold_id
        FROM dbo.booking_orders bo WITH (UPDLOCK, ROWLOCK)
        INNER JOIN dbo.booking_details bd WITH (UPDLOCK, ROWLOCK)
            ON bd.booking_id = bo.booking_id
        INNER JOIN dbo.seat_holds sh WITH (UPDLOCK, ROWLOCK)
            ON sh.showtime_seat_id = bd.showtime_seat_id
        WHERE bo.status IN ('EXPIRED', 'CANCELLED')
          AND sh.status = 'CONVERTED'
        ORDER BY bo.booking_id, sh.hold_id
        OPTION (FORCE ORDER);

        UPDATE sh WITH (ROWLOCK)
        SET sh.status = 'CANCELLED',
            sh.released_at = @Now
        FROM dbo.seat_holds sh
        INNER JOIN @ConvertedHoldBatch batch
            ON batch.hold_id = sh.hold_id
        WHERE sh.status = 'CONVERTED';

        SET @CancelledConvertedHolds = @@ROWCOUNT;

        COMMIT TRANSACTION;

        EXEC sys.sp_releaseapplock
            @Resource = N'CineHunt:sp_release_expired_holds',
            @LockOwner = 'Session',
            @DbPrincipal = 'public';

        SET @ApplicationLockAcquired = 0;

        SELECT
            @ReleasedSeats AS releasedSeats,
            @ExpiredHolds AS expiredHolds,
            @ExpiredBookings AS expiredBookings,
            @ExpiredBookingDetails AS expiredBookingDetails,
            @CancelledConvertedHolds AS cancelledConvertedHolds,
            CAST(0 AS BIT) AS skippedBecauseAlreadyRunning;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        IF @ApplicationLockAcquired = 1
        BEGIN
            EXEC sys.sp_releaseapplock
                @Resource = N'CineHunt:sp_release_expired_holds',
                @LockOwner = 'Session',
                @DbPrincipal = 'public';
        END;

        THROW;
    END CATCH;
END;
GO


-- ORIGINAL LINES 3320-3346

/*
   Tối ưu truy vấn:
   SELECT ... FROM booking_details
   WHERE booking_id = @bookingId
     AND status = 'ACTIVE'
*/
IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.booking_details')
      AND name = N'IX_booking_details_active_booking'
)
BEGIN
    CREATE INDEX IX_booking_details_active_booking
    ON dbo.booking_details(booking_id)
    INCLUDE (showtime_seat_id, seat_price)
    WHERE status = 'ACTIVE';

    PRINT N'Đã tạo IX_booking_details_active_booking.';
END
ELSE
BEGIN
    PRINT N'IX_booking_details_active_booking đã tồn tại.';
END;
GO


-- ORIGINAL LINES 3347-3377

/*
   Tối ưu truy vấn booking đang chờ thanh toán theo user và booking_id.
*/
IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.booking_orders')
      AND name = N'IX_booking_orders_user_pending'
)
BEGIN
    CREATE INDEX IX_booking_orders_user_pending
    ON dbo.booking_orders(user_id, booking_id)
    INCLUDE
    (
        booking_code,
        showtime_id,
        total_amount,
        expires_at,
        created_at
    )
    WHERE status = 'PENDING_PAYMENT';

    PRINT N'Đã tạo IX_booking_orders_user_pending.';
END
ELSE
BEGIN
    PRINT N'IX_booking_orders_user_pending đã tồn tại.';
END;
GO

-- Khong bao gom READ_COMMITTED_SNAPSHOT WITH ROLLBACK IMMEDIATE.
-- Khong chay UPDATE STATISTICS trong qua trinh tao schema.
PRINT N'DDL schema da ket thuc; kiem tra bang/index/proc/trigger/view va migration truoc khi seed.';
GO
SET NOEXEC OFF;
GO

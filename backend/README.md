# CineHunt Backend

Backend hệ thống đặt vé xem phim CineHunt — NestJS 10 + TypeORM 0.3 + SQL Server.

> **Cập nhật cấu trúc repo (11/2026):** chạy lệnh từ `backend/` trong repository CineHunt. **File SQL V6.3 nền không nằm trên GitHub**. Phần hướng dẫn schema bên dưới mô tả tài liệu tham chiếu lịch sử, **không phải lệnh có thể thực thi ngay sau khi clone**. Xem [database/README.md](../database/README.md).

---

## Yêu cầu môi trường

| Thành phần | Phiên bản |
|---|---|
| Node.js | >= 18 (khuyến nghị 20 LTS) |
| SQL Server | 2019 trở lên (Express cũng được) |
| SSMS / Azure Data Studio | để chạy file SQL khởi tạo |

---

## Setup máy mới — LÀM ĐÚNG THỨ TỰ 5 BƯỚC

> ⚠️ **Bước 3 bắt buộc phải chạy TRƯỚC bước 5.**
> Nếu chạy `npm run migration:run` khi database chưa có `dbo.users` và
> `dbo.movies`, migration sẽ dừng và báo lỗi tiếng Việt yêu cầu quay lại
> bước 3. Đây là hành vi cố ý, không phải bug.

### 1. Clone và cài dependency

```bash
cd backend
npm ci
```

### 2. Tạo database rỗng trong SQL Server

```sql
CREATE DATABASE CineHuntDB;
```

### 3. Chạy file schema gốc + dữ liệu mẫu

**DỪNG tại đây trên máy clone mới:** SQL V6.3 hiện **không có trong repository**. Không thể tự tạo schema hoàn chỉnh chỉ từ migration.

Tài liệu gốc từng dùng file `CineHunt_Database_V6_3_With_Sample_Data.sql`, có lệnh `DROP TABLE` và dữ liệu mẫu. **Không chạy lại trên DB đang có dữ liệu**. Trước tiên cần có file schema được rà soát, bản sao lưu và xác nhận database thử nghiệm sạch; xem [hướng dẫn an toàn](../database/README.md).

> 💡 Không có file V6.4 nữa. Bảng `movie_recommendations` trước đây được tạo
> bằng `CineHunt_Patch_V6_4_Recommendation.sql` — file đó **đã bị xoá** vì
> định nghĩa lệch với migration TypeScript, khiến mỗi máy có schema một kiểu.
> Xem mục [Nguồn sự thật của schema](#nguồn-sự-thật-của-schema) bên dưới.

### 4. Tạo file `.env`

Copy từ mẫu rồi điền thông tin thật:

```bash
cp .env.example .env
```

Tối thiểu phải có đủ 5 biến DB, nếu thiếu thì TypeORM CLI sẽ báo lỗi rõ ràng
ngay khi chạy migration:

```
DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE
```

Nếu SQL Server cài dạng **named instance** (ví dụ `MAYTINH\SQLEXPRESS`), thêm:

```
DB_INSTANCE=SQLEXPRESS
```

### 5. Chạy migration

Chỉ khi đã xác minh schema nền và backup database, mới xem xét:

```bash
npm run migration:show
# Khi đã review toàn bộ migration và có backup:
# npm run migration:run
```

Kiểm tra lại bằng:

```bash
npm run migration:show
```

Hoặc trong SSMS:

```sql
SELECT * FROM dbo.typeorm_migrations;
```

### 6. Khởi động server

```bash
npm run start:dev
```

- API: <http://localhost:3000>
- Swagger: <http://localhost:3000/api>

---

## Các lệnh migration

| Lệnh | Công dụng |
|---|---|
| `npm run migration:run` | Chạy các migration chưa được áp dụng |
| `npm run migration:revert` | Revert **1** migration gần nhất |
| `npm run migration:show` | Xem migration nào đã/chưa chạy |
| `npm run migration:generate -- src/migrations/TenMigration` | **Tự sinh** migration bằng cách so sánh entity với schema DB hiện tại |
| `npm run migration:create -- src/migrations/TenMigration` | Tạo file migration **rỗng** để tự viết SQL |

### Lưu ý về `migration:generate`

Dấu `--` là bắt buộc — nó báo cho npm biết phần phía sau là tham số truyền cho
TypeORM chứ không phải cho npm.

```bash
# ĐÚNG
npm run migration:generate -- src/migrations/AddColumnAbc

# SAI — npm sẽ nuốt mất đường dẫn
npm run migration:generate src/migrations/AddColumnAbc
```

Quy trình chuẩn khi sửa entity:

1. Sửa file `src/entities/*.entity.ts`
2. Chạy `npm run migration:generate -- src/migrations/MoTaThayDoi`
3. **Mở file vừa sinh ra và đọc lại kỹ** — TypeORM so sánh khá thô, đôi khi
   sinh ra lệnh DROP không mong muốn (đặc biệt với các bảng do file SQL V6.3
   tạo mà chưa có entity tương ứng). Xoá bớt những câu lệnh thừa.
4. Chạy `npm run migration:run`

---

## Nguồn sự thật của schema

Bảng `movie_recommendations` trước đây có **hai** định nghĩa mâu thuẫn nhau:

| Điểm khác | SQL Patch V6.4 (đã xoá) | Migration TS (giữ lại) |
|---|---|---|
| Kiểu khoá chính | `BIGINT IDENTITY` | `INT IDENTITY` |
| Cột thứ hạng | `rank_position` | `rank_order` |
| Cột `algorithm` | không có | `VARCHAR(30)` |
| Cột `expires_at` | có | không có |
| Index FK `movie_id` | không có | có |

**Quyết định: migration TypeScript trong `src/migrations/` là nguồn sự thật
duy nhất.** Lý do:

- `src/entities/movie-recommendation.entity.ts` đang map đúng theo migration
  (`rankOrder`, `algorithm`, PK kiểu `int`). Chọn file SQL làm chuẩn đồng
  nghĩa với việc phải viết lại entity và mọi query dùng nó.
- Migration có lịch sử lưu trong bảng `typeorm_migrations`, nhưng **vẫn có thể gây thay đổi/xóa dữ liệu** nếu chạy trên DB không phù hợp. Phải review và backup trước. File SQL chạy tay không để lại dấu vết nào.

Migration `1722300000000-ReconcileMovieRecommendations.ts` tự động dọn giúp
những máy đã lỡ chạy file SQL patch cũ: nó phát hiện bảng có cột
`rank_position`, drop rồi tạo lại đúng chuẩn. An toàn vì đây chỉ là **bảng
cache gợi ý**, dữ liệu do `train.py` sinh và chạy lại lúc nào cũng được.

**Từ nay: mọi thay đổi schema đều đi qua migration, không viết file `.sql`
patch rời nữa.**

---

## Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| `Failed to connect to undefined:1433` | Thiếu biến trong `.env`, hoặc `.env` đặt sai thư mục | `.env` phải nằm cùng cấp `package.json` |
| Lỗi FK, báo thiếu `dbo.users` / `dbo.movies` | Chạy migration trước file V6.3 | Quay lại **bước 3** |
| Kết nối timeout khi deploy Linux/Docker (local vẫn chạy) | Driver `mssql` validate SSL certificate | Đã fix bằng `trustServerCertificate: true` trong `app.module.ts` |
| `migration:show` không thấy bảng `typeorm_migrations` | Tên bảng mặc định là `migrations` | Đã fix bằng `migrationsTableName: 'typeorm_migrations'` ở cả `app.module.ts` và `typeorm.config.ts` — hai file này phải luôn khớp nhau |
| Kết nối được bằng SSMS nhưng backend thì không | SQL Server dùng named instance | Thêm `DB_INSTANCE=SQLEXPRESS` vào `.env` |
| `npm run migration:generate` sinh ra file rỗng | Không có thay đổi nào giữa entity và DB | Bình thường, không phải lỗi |

---

## Cấu trúc thư mục

```
cinehunt-backend/
├── src/
│   ├── entities/        # Entity TypeORM (map 1-1 với bảng trong DB)
│   ├── migrations/      # Nguồn sự thật của schema
│   ├── common/          # Filter, interceptor, constant dùng chung
│   ├── <module>/        # Mỗi nghiệp vụ 1 module: controller + service + dto
│   ├── app.module.ts    # Cấu hình runtime (DB, throttler, schedule)
│   └── main.ts          # Bootstrap, CORS, Swagger, static files
├── uploads/             # File người dùng upload (không commit lên Git)
├── typeorm.config.ts    # DataSource riêng cho TypeORM CLI
└── .env                 # Không commit lên Git
```

> `app.module.ts` và `typeorm.config.ts` là **hai** cấu hình DB riêng biệt
> (CLI của TypeORM không bootstrap được NestJS nên không đọc được
> `forRootAsync`). Sửa options ở một file thì phải sửa file còn lại cho khớp.

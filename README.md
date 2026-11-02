# CineHunt | Hệ thống đặt vé xem phim

**Trạng thái:** bản phát triển / kiểm thử, chưa được xác nhận sẵn sàng production.

CineHunt gồm ứng dụng Mobile cho khách hàng, ứng dụng Web (khách hàng và quản trị), Backend nghiệp vụ, dịch vụ gợi ý phim AI và SQL Server. Đây là repository làm việc độc lập; **không chỉnh sửa repository nguồn**.

## Thành phần

| Đường dẫn | Công nghệ | Vai trò |
| --- | --- | --- |
| [mobile/](mobile/) | React Native, **Expo SDK 58**, Expo Router | Tìm phim, chọn suất, ghế, đặt vé, xem đơn và tài khoản |
| [admin-web/](admin-web/) | React + TypeScript + Vite | Giao diện khách hàng, nhân viên và quản trị |
| [backend/](backend/) | NestJS + TypeORM | API, xác thực, ghế, đặt vé, thanh toán, vé và quản trị |
| [ai/](ai/) | Python + FastAPI | Gợi ý phim theo mô hình hoặc fallback popularity |
| [database/](database/) | SQL Server | **Hiện mới có hướng dẫn; schema SQL gốc chưa được đưa lên GitHub** |
| [docs/setup/](docs/setup/) | Markdown / log | Minh chứng kiểm tra khởi tạo ngày 27/10/2026 |

## Bắt đầu trên máy mới

**Chuẩn bị:** Node.js và npm phù hợp với các package trong từng thư mục, Python 3.10–3.12 cho AI, SQL Server thử nghiệm riêng. Cài dependencies độc lập trong từng thành phần.

1. Clone repository và kiểm tra trạng thái: `git status`.
2. Tạo file cấu hình **chỉ ở máy cá nhân** từ các mẫu:
   - `cp backend/.env.example backend/.env`
   - `cp ai/.env.example ai/.env`
   - `cp admin-web/.env.example admin-web/.env.local`
   - `cp mobile/.env.example mobile/.env.local`
3. Sửa các giá trị placeholder, đặt **mật khẩu SQL Server và hai JWT secret riêng** trong `backend/.env`. Không để giá trị thật trong ví dụ hoặc commit.
4. Database phải có schema tương thích **trước khi** chạy ứng dụng cần dữ liệu. **SQL V6.3 gốc chưa có trên repository này**: xem [database/README.md](database/README.md); không chạy lại seed hay migration trên DB có dữ liệu thật.
5. Chạy các dịch vụ từ **đúng thư mục** theo bảng bên dưới.

| Thư mục | Cài đặt | Lệnh phát triển / kiểm tra |
| --- | --- | --- |
| `backend/` | `npm ci` | `npm run build`, `npm test`, `npm run start:dev` |
| `admin-web/` | `npm ci` | `npm run build`, `npm test`, `npm run dev` |
| `mobile/` | `npm ci` | `npx tsc --noEmit`, `npx expo install --check`, `npx expo start --clear --go --lan` |
| `ai/` | `python3.12 -m venv .venv` và `pip install -r requirements.txt` trong venv | `python smoke_test.py`, `uvicorn app.main:app --host 127.0.0.1 --port 8000` |

**Cổng khi chạy local:** Backend 3000; Web 5173; AI 8000; Metro Expo mặc định 8081. Backend và AI cần kết nối tới một SQL Server được cấu hình riêng. Trong thử nghiệm trước đây, SQL Server Docker được ánh xạ sang cổng **14332 của máy Mac**; đây chỉ là cấu hình của máy thử nghiệm, không phải mặc định dùng chung.

### Cách Mobile kết nối Backend

- `mobile/.env.local` phải có `EXPO_PUBLIC_API_URL=http://<IP_MAC_CO_THE_TRUY_CAP>:3000`.
- Trên iPhone thật, **không** dùng `localhost` làm Backend URL, vì đó là địa chỉ của iPhone.
- Nếu iPhone dùng 4G và Mac dùng mạng khác, cần kết nối riêng (ví dụ Tailscale) và đảm bảo Backend có thể truy cập từ iPhone.
- Chỉ khởi động Metro ở **thư mục `mobile/`**. Expo Go phải tương thích SDK 58.

### Web và AI

- Web dùng `/api` với Vite proxy tới `http://localhost:3000` khi phát triển; xem `admin-web/.env.example`.
- Backend gọi AI qua `RECOMMENDATION_SERVICE_URL`; AI có thể dùng `BACKEND_ENV_PATH` để đọc cấu hình DB ở Backend.
- `POST /train` và `POST /reload` của AI yêu cầu `RECOMMENDATION_ADMIN_TOKEN`. Không mở cổng AI trực tiếp ra Internet.

## Phạm vi chức năng và trạng thái xác minh

- **Mobile:** đã kiểm tra hiển thị 23 phim và các màn Phim / Khám phá / Đơn & vé / Tài khoản trên iPhone (28/10/2026). Có code chi tiết phim, sơ đồ ghế, giữ ghế, checkout, đơn, yêu thích tạm trong bộ nhớ, GPS và chat.
- **Backend:** có mã nguồn cho đặt vé, xác thực, thanh toán PENDING, check-in, v.v. Các kiểm thử từng chạy ở môi trường phát triển; **không mặc định tất cả luồng đã được nghiệm thu sau khi ghép One-Shot**.
- **AI:** có mô hình gợi ý và fallback. Khi thiếu dữ liệu tương tác, kết quả có thể chỉ là **phim phổ biến**, không được tuyên bố là gợi ý cá nhân hóa.
- **Thanh toán:** BANKING/CASH có thể tạo trạng thái chờ; không đồng nghĩa với tiền đã thanh toán. Không tự xác nhận thanh toán giả, không chạy migration/seed thử nghiệm trên DB đang dùng.
- **Bảo mật:** repository **public**. Mọi `.env`, khóa API, JWT, mật khẩu, file DB/backup, model nhị phân và ảnh tải lên phải nằm ngoài Git. Kiểm tra tự động trước đây không thay thế việc rà soát bí mật thủ công.

Thông tin **CV01 ngày 27/10/2026** trong [docs/setup/validation-report.md](docs/setup/validation-report.md) là báo cáo lịch sử của thời điểm SDK 57, không phải mô tả phiên bản đang có trên `main`.

## Hạn chế còn lại

1. Chưa có bản schema SQL gốc an toàn để người khác clone repo và tự dựng DB mới.
2. Mobile hiện giữ JWT và danh sách yêu thích trong RAM, không lưu vững bền qua lần mở ứng dụng.
3. Chưa có ảnh poster thật hoàn chỉnh cho danh sách phim; cần kiểm tra UI/UX trên nhiều kích thước màn hình.
4. Các luồng thanh toán thật, webhook, QR và soát vé cần kiểm thử tích hợp theo vai trò trước khi phát hành.
5. Cần tiếp tục rà soát npm audit và cấu hình production, không xem repository này là cấu hình production hoàn chỉnh.

## Nguồn và quy tắc cộng tác

- Repository làm việc: https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim
- Repository nguồn tham chiếu (chỉ đọc): https://github.com/Cuaaaaa2504/-n-chuy-n-ng-nh
- Ưu tiên thay đổi trên branch, mở Pull Request và chỉ merge khi đã review. Không force-push `main`, không commit file bí mật.

# CineHunt Mobile

Hệ thống đặt vé xem phim CineHunt Mobile, phát triển ứng dụng di động dành cho khách hàng và tái sử dụng các thành phần hiện có của hệ thống CineHunt.

## 1. Tổng quan

CineHunt Mobile hướng tới việc hỗ trợ khách hàng tìm kiếm phim, lựa chọn rạp và suất chiếu, đặt ghế, thanh toán và sử dụng vé QR trên điện thoại.

Dự án được phát triển độc lập từ mã nguồn CineHunt hiện có. Repository gốc không bị thay đổi.

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Mobile | React Native, Expo SDK 57, Expo Router |
| Backend | NestJS, TypeScript |
| Frontend Web | React, Vite |
| AI | Python 3.12, FastAPI, scikit-learn |
| Database | SQL Server |
| Quản lý mã nguồn | Git, GitHub |

## 3. Cấu trúc thư mục

- `mobile/`: Ứng dụng di động dành cho khách hàng.
- `backend/`: API và xử lý nghiệp vụ CineHunt.
- `admin-web/`: Frontend React được tái sử dụng.
- `ai/`: Dịch vụ AI Recommendation.
- `database/reference/`: Bộ SQL tham chiếu V6.3.
- `docs/`: Báo cáo, tài liệu và minh chứng dự án.

Lưu ý: `admin-web/` hiện chứa cả giao diện khách hàng và giao diện quản trị từ mã nguồn gốc. Việc tách riêng sẽ được thực hiện sau khi đánh giá các dependency hiện tại.

## 4. Yêu cầu môi trường

Môi trường đã được kiểm tra:

- Node.js 24.18.1.
- Expo SDK 57.0.31.
- Python 3.12.13.
- Expo Go trên iPhone thật.

Cần chuẩn bị SQL Server thử nghiệm riêng khi triển khai kiểm thử tích hợp.

## 5. Khởi chạy Mobile

Từ thư mục `mobile/`:

1. Cài đặt thư viện: `npm ci`
2. Khởi động Expo: `npx expo start --lan`
3. Mở Expo Go trên iPhone và quét mã QR.

Mobile hiện sử dụng giao diện khởi tạo Expo. Các màn hình nghiệp vụ đặt vé sẽ được phát triển trong những công việc tiếp theo.

## 6. Frontend React

Từ thư mục `admin-web/`:

1. Cài thư viện: `npm ci`
2. Build: `npm run build`
3. Kiểm thử: `npm test`
4. Kiểm tra ESLint: `npm run lint`
5. Chạy giao diện: `npm run dev`

Frontend cần Backend hoạt động để tải dữ liệu phim, suất chiếu và các thông tin nghiệp vụ.

## 7. Backend NestJS

Từ thư mục `backend/`:

1. Cài thư viện: `npm ci`
2. Build: `npm run build`
3. Kiểm thử: `npm test`

Chưa chạy `npm run start:stack` hoặc migration khi chưa cấu hình database thử nghiệm an toàn.

## 8. Dịch vụ AI

Từ thư mục `ai/`:

1. Tạo môi trường ảo: `python3.12 -m venv .venv`
2. Kích hoạt: `source .venv/bin/activate`
3. Cài thư viện: `python -m pip install -r requirements.txt`
4. Kiểm tra thư viện: `python -m pip check`
5. Chạy smoke test: `python smoke_test.py`
6. Thoát môi trường: `deactivate`

Smoke test sử dụng dữ liệu giả, không yêu cầu SQL Server.

## 9. Cấu hình Backend và AI

- Backend hỗ trợ `RECOMMENDATION_SERVICE_DIR` để xác định thư mục AI.
- AI hỗ trợ `BACKEND_ENV_PATH` để xác định file cấu hình Backend.
- Cần tạo cấu hình môi trường từ các file `.env.example` phù hợp.
- Không đưa mật khẩu, token hoặc file `.env` lên GitHub.

Tại thời điểm kiểm tra CV01, `backend/.env` chưa được tạo và chưa xác nhận tích hợp Backend với AI.

## 10. Kết quả kiểm thử CV01

| Thành phần | Kết quả |
|---|---|
| Mobile | Chạy giao diện Expo trên iPhone thật |
| Frontend Build | PASS |
| Frontend Test | 40/40 PASS |
| Frontend ESLint | PASS |
| Backend Build | PASS |
| Backend Test | 49/49 PASS |
| AI Smoke Test | PASS, exit code 0 |
| SQL Server Integration | Chưa kiểm thử |
| Backend - AI Integration | Chưa kiểm thử |

Expo Doctor đạt 20/21 bài kiểm tra. Xcode 26.0.1 không đáp ứng yêu cầu Xcode >= 26.4.0 của SDK hiện tại.

## 11. Các hạn chế cần xử lý

- Mobile chưa có các màn hình nghiệp vụ CineHunt.
- Frontend từng gặp ECONNREFUSED do Backend chưa khởi động.
- Backend có 20 cảnh báo bảo mật production dependency, gồm 1 Critical.
- Chưa kiểm thử tích hợp SQL Server.
- Chưa kiểm thử kết nối Backend - AI.
- Chưa xác nhận hệ thống sẵn sàng triển khai công khai.

Bộ SQL tham chiếu V6.3 có lệnh DROP TABLE. Không chạy trên cơ sở dữ liệu chứa dữ liệu cần giữ.

## 12. Tài liệu dự án

- `docs/setup/original_commit.txt`
- `docs/setup/source-inventory.md`
- `docs/setup/validation-report.md`

## 13. Repository

Repository nguồn:
https://github.com/Cuaaaaa2504/-n-chuy-n-ng-nh

Repository CineHunt Mobile:
https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim

Repository nguồn được giữ nguyên. Các thay đổi tại repository CineHunt Mobile phải được kiểm tra và phê duyệt trước khi commit hoặc push.

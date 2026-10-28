# Báo cáo kiểm tra khởi tạo CineHunt Mobile

Ngày kiểm tra: 27/10/2026
Nhánh thực hiện: chore/cv01-project-structure

## 1. Mục tiêu

Xác nhận mã nguồn được sao chép và các thành phần
chính có thể cài đặt, build hoặc kiểm thử độc lập.

Không sử dụng kết quả này để khẳng định hệ thống
đã tích hợp hoặc sẵn sàng triển khai production.

## 2. Kết quả kiểm tra

| Hạng mục | Phương pháp | Kết quả |
|---|---|---|
| Mobile | Expo Go trên iPhone thật | PASS |
| Expo SDK | npm ls expo --depth=0 | 57.0.31 |
| Expo Doctor | npx expo-doctor@latest | 20/21 |
| Frontend | npm run build | PASS |
| Frontend | npm test | 40/40 PASS |
| Frontend | npm run lint | PASS |
| Backend | npm run build | PASS |
| Backend | npm test | 49/49 PASS |
| AI | Python 3.12.13 | PASS |
| AI | python -m pip check | PASS |
| AI | python smoke_test.py | PASS, exit code 0 |
| Git | Kiểm tra repository nguồn | Không có thay đổi |
| Gitignore | Kiểm tra ENV và ảnh upload | PASS |

## 3. Kiểm thử nghiệp vụ đại diện

### Trường hợp thành công

- Backend chấp nhận giữ ghế hợp lệ.
- Backend xử lý các tình huống payment được hỗ trợ.
- Frontend chạy thành công các bộ kiểm thử hiện có.
- AI gợi ý phim theo lịch sử tương tác.
- AI lưu và nạp lại mô hình thành công.
- AI trả về gợi ý khi người dùng chưa có lịch sử.

### Trường hợp từ chối hợp lệ

Các kiểm thử Backend đã xác nhận những tình huống như:

- Từ chối giữ ghế vượt thời hạn cho phép.
- Từ chối truy cập thanh toán của người dùng khác.
- Từ chối thao tác không hợp lệ với ticket đã sử dụng.
- Từ chối cập nhật trường role hoặc status
  qua API admin không phù hợp.

Đây là kết quả unit test / automated test,
không phải kiểm thử tích hợp SQL Server thực tế.

## 4. Vấn đề và giới hạn

### Mobile

Expo Doctor đạt 20/21 kiểm tra.

Xcode 26.0.1 chưa đáp ứng mức yêu cầu >= 26.4.0.
Mobile vẫn chạy được trên iPhone thật bằng Expo Go.

Đã từng xuất hiện log thiếu assets/icon.png.
Chưa có bằng chứng kiểm tra lại cuối cùng cho cảnh báo này.

### Frontend

Vite build thành công.

Khi chạy giao diện, request /movies gặp ECONNREFUSED
do API đích chưa hoạt động.

Chưa xác nhận luồng API tích hợp hoàn chỉnh.

### Backend

npm audit --omit=dev ghi nhận:
- 20 vulnerability
- 1 Critical
- 10 High
- 9 Moderate

Đáng chú ý là proxy-addr, multer và các dependency
liên quan đến Express/NestJS.

Chưa áp dụng npm audit fix hoặc nâng cấp major version.
Cần đánh giá và khắc phục trước khi triển khai công khai.

### AI

Smoke test sử dụng dữ liệu giả, không cần SQL Server.

Mô hình chạy thành công với Python 3.12.
Chưa kiểm chứng tải dữ liệu và suy luận qua API thực tế.

### Database

Chưa chạy migration hoặc bộ SQL V6.3
trên môi trường thử nghiệm.

### Cấu hình

backend/.env chưa được tạo.

Backend hỗ trợ RECOMMENDATION_SERVICE_DIR.
AI hỗ trợ BACKEND_ENV_PATH.

Chưa xác nhận kết nối tích hợp Backend - AI.

## 5. Kết luận

Các thành phần được kiểm tra độc lập đã đạt
những bài kiểm thử nêu trên.

Kết quả xác nhận cơ sở để tiếp tục phát triển
CineHunt Mobile, nhưng chưa đủ để nghiệm thu
khả năng tích hợp hoặc triển khai production.

Chờ kiểm tra và phê duyệt thay đổi trước khi commit/push.

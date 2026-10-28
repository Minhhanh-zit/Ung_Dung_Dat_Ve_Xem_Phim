# Kiểm kê mã nguồn tái sử dụng - CineHunt Mobile

## 1. Nguồn mã

Repository gốc:
https://github.com/Cuaaaaa2504/-n-chuy-n-ng-nh

Repository triển khai mới:
https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim

Commit nguồn được lưu tại:
docs/setup/original_commit.txt

Nguyên tắc triển khai:
- Giữ nguyên repository gốc.
- Sao chép mã nguồn sang repository mới để phát triển độc lập.
- Không commit hoặc push khi chưa được kiểm tra, phê duyệt.

## 2. Bảng kiểm kê

| Thành phần | Vị trí trong nguồn gốc | Vị trí mới | Phương án |
|---|---|---|---|
| Backend NestJS | San Ve Backend3/cinehunt-backend | backend/ | Tái sử dụng |
| Frontend React | San Ve Frontend/San Ve Frontend/frontend1 | admin-web/ | Tái sử dụng |
| AI Recommendation | recommendation-service | ai/ | Tái sử dụng |
| SQL Server | Bộ SQL CineHunt V6.3 | database/reference/ | Lưu làm tài liệu tham chiếu |
| Mobile React Native | Chưa có trong phạm vi nguồn đã sao chép | mobile/ | Khởi tạo mới |
| Tài liệu triển khai | Tài liệu nguồn và tài liệu nhóm | docs/ | Bổ sung |

## 3. Phạm vi tái sử dụng

### Backend

Giữ lại các module nghiệp vụ, API, entity, migration,
script và bộ kiểm thử hiện có.

Chưa xác nhận kết nối tới SQL Server thật sau khi di chuyển.

### Frontend

Giữ lại mã nguồn React và Vite.

Lưu ý: admin-web hiện chứa cả giao diện khách hàng
và giao diện quản trị từ dự án gốc, không chỉ riêng Admin.

Việc tách riêng giao diện quản trị sẽ được đánh giá
ở công việc tiếp theo, tránh phá vỡ dependency hiện có.

### AI

Giữ lại mã nguồn FastAPI, mô hình gợi ý và smoke test.

Thư mục recommendation-service được chuyển thành ai/.
Cần cấu hình lại đường dẫn khi chạy tích hợp.

### Mobile

Khởi tạo React Native với Expo SDK 57 và Expo Router.

Hiện mới có giao diện mẫu Expo.
Các màn hình nghiệp vụ CineHunt sẽ được triển khai
ở những công việc tiếp theo.

### Database

Giữ bộ SQL V6.3 trong database/reference/.

CẢNH BÁO:
Script SQL nguồn có lệnh DROP TABLE.
Không chạy trên cơ sở dữ liệu chứa dữ liệu cần giữ.
Chỉ kiểm thử trên database riêng sau khi rà soát script.

## 4. Cấu trúc dự án

Cinehunt/
- mobile/       Ứng dụng khách hàng React Native
- backend/      API và nghiệp vụ NestJS
- admin-web/    Frontend React được tái sử dụng
- ai/           Dịch vụ gợi ý phim FastAPI
- database/     SQL tham chiếu
- docs/         Tài liệu dự án

## 5. Những việc chưa thuộc phạm vi hoàn thành CV01

- Chưa tích hợp Mobile với Backend.
- Chưa kiểm thử Backend với SQL Server thật.
- Chưa chạy tích hợp Backend và AI.
- Chưa tách giao diện Admin khỏi frontend cũ.
- Chưa xử lý toàn bộ cảnh báo bảo mật dependency.
- Chưa triển khai production.

Các phần này cần được theo dõi ở các công việc tiếp theo.

# CV01 (#1) | Bằng chứng khởi tạo và đối chiếu cập nhật 23/11/2026

**Mục tiêu:** đóng gói bằng chứng cho issue khởi tạo, không viết lại báo cáo lịch sử ngày 27/10/2026.  
**Đầu vào:** [bảng kiểm kê nguồn](source-inventory.md), [validation ngày 27/10](validation-report.md), [commit nguồn](original_commit.txt), [README dự án](../../README.md).

## 1. Thư mục và nguồn tái sử dụng

| Phần | Trong repo mới | Nguồn hoặc cách hình thành |
|---|---|---|
| React Native/Expo | mobile/ | khởi tạo mới; có màn CineHunt |
| NestJS + TypeORM | backend/ | tái sử dụng và tiếp tục phát triển |
| React + Vite | admin-web/ | tái sử dụng; chứa UI khách và Admin |
| FastAPI | ai/ | tái sử dụng recommendation-service |
| SQL Server | database/reference/, database/safe/ | SQL tham chiếu + bản schema/seed dùng cho **DB test độc lập** |
| CI/CD | .github/workflows | build/test trên GitHub Actions |
| Cấu hình | .gitignore; các file *.env.example; README | không đưa khóa thật vào Git |

File gốc trong database/reference/ **có lệnh DROP TABLE**. Không chạy lại trên database đang chứa booking/ticket. Source inventory ngày 27/10 mô tả Expo SDK 57 theo thời điểm đó; README hiện tại mô tả Expo SDK 58, đây là hai mốc khác nhau.

## 2. Bằng chứng chạy kiểm thử tại commit d3092e6

- [CI Full Stack: success](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/actions/runs/45167652942): Backend NestJS (npm ci/lint/test/build); Admin Web (npm ci/lint/test/build); Mobile Expo (npm ci/typecheck/lint:active/test); AI (pip install/compileall/smoke_test).
- [CineHunt Auto Test: success](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/actions/runs/45167652955): Backend typecheck/test/lint/build; Mobile typecheck/lint/test; Web build và Playwright Chromium.
- Web unit tests trên Mac: 40/40 PASS, Playwright Web 15/15 PASS (API mock trong các ca UI mở rộng).
- Test thành công đại diện: trang phim tải dữ liệu mock và nút mua vé hợp lệ; API public được parse đúng định dạng.
- Test lỗi đại diện: khi GET /movies trả 503, màn hình hiện Thử lại và phục hồi sau lần gọi kế tiếp; trang Admin yêu cầu đăng nhập và trường mật khẩu đăng ký không khớp bị chặn.

**Giới hạn:** các kết quả CI trên không xác nhận rằng toàn bộ chuỗi booking/payment/QR đã được nghiệm thu bằng SQL thực. Dữ liệu GPS, Maestro và tài khoản Staff/Manager cần nghiệm thu riêng.

## 3. Tình trạng checklist CV01

- Có bằng chứng kiểm kê và mapping nguồn: [source-inventory.md](source-inventory.md).
- Cấu trúc mobile, backend, admin-web, ai, database, docs đã có; không thấy thư mục code chính dùng tên có dấu.
- Có .gitignore, env examples, README hướng dẫn chạy.
- CI chạy trên clone mới của commit d3092e6 và các job đều success.
- **Chưa đối chiếu bằng chứng lịch sử rằng repository gốc không thay đổi do nhiệm vụ này** ngoài báo cáo ngày 27/10; cần trưởng nhóm kiểm tra Git log của repo gốc trong khoảng triển khai.
- **Chưa có phê duyệt đóng issue của trưởng nhóm trên GitHub**: đề nghị review rồi mới đổi trạng thái.

## 4. Cách nghiệm thu CV01

1. Trưởng nhóm kiểm tra repo gốc tham chiếu tại https://github.com/Cuaaaaa2504/-n-chuy-n-ng-nh và xác nhận không bị commit ngoài phạm vi dự án mới.
2. Mở cả hai workflow ở mục 2, đối chiếu commit SHA với branch main.
3. Xác minh không có file .env/key thật trong tree/commit; không chỉ dựa vào grep tên file.
4. Sau khi xác nhận, ghi comment duyệt CV01 ở [Issue #1](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/1) rồi mới close.

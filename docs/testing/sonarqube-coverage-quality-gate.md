# CineHunt | Coverage & Quality Gate (GitHub Actions + SonarQube Cloud)

## Mục tiêu và phạm vi

Workflow `.github/workflows/sonarqube.yml` chạy kiểm thử, tạo **coverage thật**,
rồi import kết quả lên SonarQube Cloud. Không chỉnh sửa source nghiệp vụ,
không chạy migration/seed SQL Server, không thay đổi workflows CI/CD có sẵn.

| Thành phần | Bộ kiểm thử | Định dạng | Đường dẫn report |
| --- | --- | --- | --- |
| Backend NestJS | Node.js `node:test` + ts-node | LCOV | `backend/coverage/lcov.info` |
| Admin Web | Vitest + V8 | LCOV | `admin-web/coverage/lcov.info` |
| AI | Python smoke test + coverage.py | Cobertura XML | `ai/coverage.xml` |
| Mobile Expo | Node.js test với `vm` / transpile TS | **Chưa đo coverage đáng tin cậy** | Không import |

Mobile vẫn được SonarQube phân tích **chất lượng code** trong `mobile/src`,
nhưng test hiện tại chưa instrument toàn bộ mã ứng dụng. Không ghi
Mobile coverage = 100% hoặc cộng nhầm số của tests vào source.
Cần bổ sung bộ test React Native/Expo có coverage instrumented trong tương lai.

## Luồng hoạt động

1. Push/PR kích hoạt ba job coverage độc lập, dùng test hiện có.
2. Job Backend và Web sinh LCOV; script
   `scripts/normalize-sonar-lcov.py` chuẩn hóa paths theo cấu trúc monorepo,
   kiểm tra có bản ghi source thực tế.
3. Job AI tạo Cobertura XML; xác minh path trỏ đến `ai/app`.
4. Artifact được tải về job SonarQube ở các vị trí trong `sonar-project.properties`.
5. SonarScanner xác thực OIDC (Secretless) và import cả LCOV + XML.
6. `sonar.qualitygate.wait=true` chờ kết quả Quality Gate của SonarQube,
   đánh dấu job đỏ nếu không đạt. Đỏ không tự động có nghĩa là code không build.

## Cấu hình Quality Gate ở giao diện SonarQube

- Mở https://sonarcloud.io/project/overview?id=Minhhanh-zit_Ung_Dung_Dat_Ve_Xem_Phim
- Trong project, vào **Quality Gate**. Xác nhận đang áp dụng **Sonar way**
  hoặc chọn **Use a specific quality gate > Sonar way > Save** nếu có quyền.
- Sonar way (chuẩn có sẵn) tập trung chất lượng **new code**, có điều kiện
  coverage trên new code >= 80% và duplicated new lines <= 3%, cùng
  các yêu cầu về reliability/security/maintainability/hotspots.
- Không tự khai báo đã thay đổi Quality Gate trên website từ GitHub:
  thiết lập cấp project thuộc SonarQube Cloud.
- Nếu Quality Gate hiện **Not computed**, cần thiết lập New Code Definition
  tại project, sau đó có thêm lần phân tích. Không làm giả trạng thái PASS.
- Không tắt các điều kiện hoặc loại trừ source Mobile chỉ để tăng số Coverage.

## Kiểm chứng và minh chứng báo cáo

- GitHub Actions: job Backend LCOV, Admin Web LCOV, AI Python Coverage,
  SonarQube Analysis + Quality Gate cùng đạt yêu cầu.
- Download từng artifact `cinehunt-backend-lcov`, `cinehunt-web-lcov`,
  `cinehunt-ai-coverage` để đối chiếu khi cần.
- SonarQube: Overview/Measures/Quality Gate, số liệu coverage theo thư mục,
  tỷ lệ duplication và các issues còn tồn tại.
- Chụp màn hình kèm commit SHA, ngày chạy và rõ loại kiểm thử được đo.
- Không dùng các số từ các bài test mock/smoke để khẳng định E2E trên SQL thật,
  giao dịch thanh toán thật hoặc hệ thống sẵn sàng production.

## Lưu ý chất lượng

Coverage là thước đo các dòng/nhánh được thực thi trong test, **không chứng minh**
logic nghiệp vụ hoàn toàn đúng. Quality Gate mới là điều kiện quản trị chất lượng,
không thay cho kiểm thử tích hợp có SQL Server riêng.

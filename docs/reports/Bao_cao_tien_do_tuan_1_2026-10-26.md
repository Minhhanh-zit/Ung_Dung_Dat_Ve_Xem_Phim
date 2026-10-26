# BÁO CÁO TIẾN ĐỘ THỰC HIỆN ĐỒ ÁN

**Tuần báo cáo:** Tuần 1 – Giai đoạn khởi tạo và lập kế hoạch  
**Ngày cập nhật:** 26/10/2026  
**Đề tài:** Ứng dụng đặt vé xem phim   
**Tên hệ thống:** CineHunt Mobile  
**Số lượng thành viên:** 05  
**Trưởng nhóm:** Chu Thị Minh Hạnh

## I. Tổng quan tiến độ

Trong giai đoạn đầu, nhóm tập trung xác định phạm vi đề tài, phân chia chức năng, lập kế hoạch triển khai và tổ chức quản lý công việc trên GitHub. CineHunt Mobile dự kiến bao gồm ứng dụng di động dành cho khách hàng và nhân viên, web quản trị dành cho quản lý chi nhánh và Admin, cùng backend, SQL Server và trợ lý AI.

Nhóm đã tạo repository riêng và lập **48 GitHub Issues (CV01–CV48)**, được chia theo **10 nhóm mốc M01–M10**. Mỗi Issue có mô tả yêu cầu, người phụ trách bằng tên, mức ưu tiên, công việc phụ thuộc và tiêu chí nghiệm thu. Tên nhóm mốc hiện nằm trong tiêu đề Issue; cần hoàn tất tạo và liên kết GitHub Milestones để theo dõi tự động.

**Trạng thái đối chiếu trên GitHub ngày 26/10/2026:**
- 48 Issues đang mở, **0 Issues đóng**, **0 Pull Requests**.
- Nhánh `main` hiện chỉ chứa tệp `README.md`; **chưa có mã nguồn ứng dụng mobile, backend hoặc web quản trị** trong repository này.
- Người phụ trách được ghi trong phần mô tả Issue, **chưa gán GitHub Assignee**.
- Công việc lập kế hoạch đã có dữ liệu quản lý trên GitHub; các kết quả kỹ thuật thực hiện trên máy cá nhân, nếu có, **chưa có minh chứng trong repository này để xác nhận hoàn thành**.

## II. Bảng phân công công việc và kết quả ghi nhận trong tuần

| STT | Thành viên | Nhiệm vụ phụ trách | Công việc đã ghi nhận trong tuần | Trạng thái |
|---|---|---|---|---|
| 1 | **Chu Thị Minh Hạnh** | Trưởng nhóm, phân tích nghiệp vụ (BA), AI và GPS. Phụ trách CV01, CV03, CV04, CV09, CV30–CV34, CV48. | Đã tổ chức repository dự án; thống nhất phạm vi hệ thống, phân chia 48 đầu việc và giao nhiệm vụ trong GitHub Issues. Chưa có bản Use Case hoặc kiến trúc hệ thống được bàn giao trên `main`. | **Hoàn thành phần lập kế hoạch ban đầu; phần thiết kế đang chờ bàn giao** |
| 2 | **Nguyễn Hà Trung Nam Nam** | Phát triển chính ứng dụng di động và backend. Phụ trách CV02, CV05, CV08, CV13–CV16, CV20, CV44. | Đã nhận phân công kiểm tra backend/API, xây dựng luồng đặt vé, giữ ghế và thanh toán. Chưa thấy mã nguồn hoặc kết quả kiểm thử của cá nhân trên repository để xác nhận hoàn thành. | **Đã phân công, chờ minh chứng thực hiện** |
| 3 | **Phạm Phương Linh** | Mobile UI, SQL Server và kiểm thử. Phụ trách CV06, CV10, CV11, CV17, CV19, CV35–CV38, CV43. | Đã nhận phân công kiểm tra cơ sở dữ liệu, xây dựng giao diện và kiểm thử nghiệp vụ. Chưa thấy mã nguồn, báo cáo kiểm thử hoặc dữ liệu bàn giao trên repository. | **Đã phân công, chờ minh chứng thực hiện** |
| 4 | **Phạm Ngọc Thành** | Web Admin, quản lý chi nhánh và bảo mật. Phụ trách CV07, CV21–CV25, CV27–CV29, CV39, CV46, CV47. | Đã nhận phân công xây dựng web quản trị, phân quyền và quản lý dữ liệu theo chi nhánh. Chưa thấy mã nguồn web hoặc kết quả kiểm thử bảo mật trên repository. | **Đã phân công, chờ minh chứng thực hiện** |
| 5 | **Nguyễn Quốc Tuấn** | Giao diện cơ bản, CRUD phim, tài liệu và kiểm thử. Phụ trách CV12, CV18, CV26, CV40–CV42, CV45. | Đã nhận phân công giao diện phim, CRUD phim, kiểm thử UI và tài liệu. Chưa thấy sản phẩm bàn giao tương ứng trên repository. | **Đã phân công, chờ minh chứng thực hiện** |


## III. Kết quả chung đã thực hiện

1. Tạo repository GitHub riêng cho đề tài CineHunt Mobile.
2. Xác định bốn nhóm người dùng: Khách hàng, Nhân viên rạp, Quản lý chi nhánh và Admin; đồng thời xác định phạm vi trợ lý AI.
3. Thống nhất định hướng công nghệ: React Native/Expo cho mobile, React/TypeScript cho web quản trị, NestJS/TypeORM và Microsoft SQL Server cho backend/cơ sở dữ liệu.
4. Lập 48 công việc có mã CV, mô tả, mức ưu tiên, phụ thuộc và tiêu chí nghiệm thu.
5. Phân công trách nhiệm chính cho 5 thành viên, làm cơ sở triển khai và cập nhật tiến độ theo từng tuần.



## IV. Khó khăn và nội dung cần xử lý

- Mã nguồn và kết quả kiểm thử của các thành viên chưa được đồng bộ vào repository dự án.
- Chưa có Issue nào được nghiệm thu và đóng.
- Các GitHub Milestones, Assignees và lịch thực hiện cần được cấu hình đầy đủ để thuận tiện theo dõi.
- Cần thống nhất quy trình tạo nhánh, commit, mở Pull Request, review và liên kết mã CV trong commit/PR.
- Việc tích hợp mobile, backend, SQL Server và AI cần có hướng dẫn cấu hình và môi trường thử nghiệm chung.

## V. Kế hoạch tuần tiếp theo

| Thành viên | Công việc dự kiến | Sản phẩm bàn giao mong đợi |
|---|---|---|
| **Chu Thị Minh Hạnh** | Hoàn thiện yêu cầu, Use Case, phân quyền sơ bộ và kiến trúc tích hợp. | Tài liệu yêu cầu, sơ đồ kiến trúc và bảng phân quyền. |
| **Nguyễn Nam** | Rà soát NestJS/API; chuẩn bị các phần nền tảng của mobile và luồng chọn rạp, suất chiếu, giữ ghế. | Backend chạy được và bằng chứng gọi API; mã nguồn chức năng được đẩy lên nhánh phát triển. |
| **Phương Linh** | Kiểm tra dữ liệu SQL Server, thiết kế giao diện điều hướng mobile, xác thực tài khoản. | Kết quả kiểm tra dữ liệu, giao diện mobile và luồng đăng nhập ban đầu. |
| **Phạm Ngọc Thành** | Thiết kế phân quyền theo chi nhánh, khởi tạo khung web quản trị React/TypeScript. | Thiết kế phân quyền và mã nguồn khung web quản trị. |
| **Nguyễn Quốc Tuấn** | Triển khai giao diện danh sách/chi tiết phim, chuẩn bị mẫu tài liệu và checklist kiểm thử UI. | Màn hình phim ban đầu, tài liệu và minh chứng kiểm thử. |

**Ưu tiên của tuần tiếp theo:** Có mã nguồn triển khai thực tế trong repository mới, đồng bộ API và cơ sở dữ liệu, sau đó nghiệm thu từng Issue dựa trên kết quả thử nghiệm.

## VI. Liên kết GitHub

- **Repository (`main`):** https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/tree/main
- **Danh sách công việc (Issues):** https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues
- **Lịch sử cập nhật (Commits):** https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/commits/main
- **Trang Milestones:** https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/milestones

## VII. Đánh giá chung

Nhóm đã hoàn thành bước khởi tạo repository, định hướng phạm vi và tổ chức phân công công việc. Các đầu việc đã có mô tả rõ ràng, tạo cơ sở để theo dõi tiến độ thực hiện ở các tuần tiếp theo.

Trong kỳ báo cáo, sản phẩm kỹ thuật chưa có minh chứng bàn giao trên nhánh `main`, vì vậy nhóm cần ưu tiên đồng bộ mã nguồn và kết quả kiểm thử, triển khai quy trình review và xác nhận trạng thái hoàn thành theo từng Issue.



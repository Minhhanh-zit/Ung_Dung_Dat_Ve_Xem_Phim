# BÁO CÁO TIẾN ĐỘ THỰC HIỆN BÀI TẬP LỚN – TUẦN 2

**Thời gian thực hiện:** 27/10/2026 – 02/11/2026  
**Ngày lập báo cáo:** 02/11/2026  
**Đề tài:** Ứng dụng đặt vé xem phim  
**Tên hệ thống:** CineHunt Mobile  
**Nhóm:** 05 thành viên  
**Trưởng nhóm:** Chu Thị Minh Hạnh  
**Môn học:** Phát triển ứng dụng di động

## I. TỔNG QUAN TIẾN ĐỘ TUẦN 2

Tuần 1 (26/10/2026), nhóm tập trung xác định phạm vi, thiết kế kế hoạch triển khai và phân công 48 đầu việc CV01–CV48. Trong tuần 2 (27/10–02/11/2026), nhóm chuyển sang triển khai mã nguồn và chạy thử thực tế. Ứng dụng Mobile đã mở được trên iPhone, Backend NestJS đọc dữ liệu phim từ SQL Server, giao diện Web đã có mã nguồn và bản thiết kế mới của Mobile đã được đưa lên main. Nhóm chưa tuyên bố nghiệm thu toàn bộ chu trình thanh toán, vé QR và soát vé.

### 1.1. So sánh với tuần 1

| Hạng mục | Tuần 1 (26/10) | Tuần 2 (27/10–02/11) |
| --- | --- | --- |
| Quản lý công việc | Repo mới, phân công 48 issues, lập hướng kiến trúc | Mã nguồn Mobile/Backend/Web/AI có trên main; PR #49, #50 đã merge; PR #51 review SQL còn Draft |
| Mobile | Lập danh sách chức năng, chuẩn bị khung Expo | Expo SDK 58; chạy trên iPhone; có Phim, Khám phá, Đơn & vé, Tài khoản |
| Dữ liệu và API | Chưa có minh chứng backend tích hợp trên main tại mốc 26/10 | GET /movies?page=1&limit=5 trả HTTP 200 với total=23 từ CineHuntDB |
| Web quản trị | Định hướng web React/TypeScript | Có giao diện khách hàng và các trang quản trị trong admin-web; chưa nghiệm thu phân quyền từng chi nhánh |
| AI | Xác định AI-1, AI-2, AI-3 | Có mã FastAPI/gợi ý và chatbot UI; nguồn gợi ý quan sát là FALLBACK (UNREACHABLE) |
| Kiểm thử | Lập kế hoạch và kiểm tra khởi tạo độc lập | SQL review trên Docker tạm PASS 87/87 schema, 25/25 seed, migrations và SQL integration |

## II. CÔNG VIỆC ĐÃ THỰC HIỆN

**2.1. Mobile:** Đưa ứng dụng React Native/Expo SDK 58 vào vận hành thử trên iPhone thật. Các màn Phim, Khám phá, Đơn & vé, Tài khoản hiển thị; API cung cấp 23 phim. Có tìm kiếm/lọc, chi tiết phim, tài khoản CUSTOMER, lịch sử đơn và combo. Mã nguồn cũng có các bước giữ ghế/đặt vé/thanh toán/QR, nhưng chưa có đủ bằng chứng kiểm thử trọn luồng.

**2.2. Backend và Database:** Backend NestJS được chạy với SQL Server Docker hiện có (`CineHuntDB`, cổng Mac 14332). Truy vấn `GET /movies?page=1&limit=5` nhận HTTP 200 OK với 23 phim. Bài kiểm thử SQL V6.3 thực hiện **trên container cô lập không gắn volume**, schema 87/87, seed 25/25, TypeORM migrations và SQL integration tests đều PASS theo log chạy.

**2.3. Web quản trị:** Mã nguồn React/TypeScript có các trang khách hàng và trang quản trị phim, rạp, suất chiếu, đơn hàng, người dùng, báo cáo. Đã có ảnh giao diện Web trong quá trình chạy thử, nhưng chưa đánh giá đầy đủ RBAC của quản lý chi nhánh.

**2.4. AI và GPS:** Mobile hiển thị danh sách gợi ý, rạp và combo. Có phần định vị rạp gần và trò chuyện với AI trong mã nguồn. Trong lần thử, AI recommendation sử dụng `FALLBACK (UNREACHABLE)` và chatbot có báo quá tải, nên chưa đánh giá đạt phần tích hợp AI.

**2.5. Chuẩn hóa và nâng cấp giao diện:** PR #49 đưa Mobile SDK 58 lên main; PR #50 cập nhật tài liệu, mẫu cấu hình. Đến 02/11, giao diện Premium UI được cập nhật vào `main` tại commit `e1a8fa1`, gồm 10 file trong thư mục Mobile. Cần kiểm thử lại TypeScript và chức năng sau cập nhật.

## III. KẾT QUẢ KIỂM THỬ VÀ MINH CHỨNG

| Hạng mục | Trạng thái | Minh chứng / giới hạn |
| --- | --- | --- |
| Mobile mở trên iPhone | Đã quan sát | Ảnh chụp 4 tab và các màn danh sách/chi tiết phim, hồ sơ, đơn, khám phá |
| Backend kết nối SQL Server | PASS bước đọc | GET /movies?page=1&limit=5 → HTTP/1.1 200 OK, total=23 |
| Đăng nhập / hồ sơ | Có minh chứng giao diện | Ảnh tài khoản CUSTOMER và thông tin cá nhân; chưa xác nhận toàn bộ test phân quyền |
| Đơn đặt vé | Có dữ liệu hiển thị | Các đơn quan sát ở trạng thái CANCELLED; không diễn giải là thanh toán thành công |
| Web giao diện phim | Có minh chứng giao diện | Banner phim trên web chạy thực tế; chưa kết luận tất cả chức năng Admin PASS |
| SQL schema + seed + migrations | PASS cô lập | 87/87 batch schema, 25/25 batch seed, TypeORM migrations PASS |
| SQL integration tests | PASS cô lập | Script kết thúc thành công; chưa xác thực số lượng case từ JSON |
| AI recommendation | Chưa đạt tích hợp | Mobile hiển thị FALLBACK (UNREACHABLE), dùng gợi ý dự phòng |
| Chatbot | Cần khắc phục | Lần thử trên Mobile báo quá tải / chưa cấu hình upstream |
| Booking → payment → QR → check-in | Chưa nghiệm thu | Chưa có bằng chứng E2E xuyên suốt trên môi trường test riêng |
| Premium UI trên main | Đã tích hợp mã nguồn | Commit e1a8fa1, 10 file Mobile; chưa xác nhận toàn bộ kiểm thử UI sau merge |

**Phân biệt mức độ xác nhận:** “Có mã nguồn” không đồng nghĩa “đã chạy demo”; “hiển thị trên iPhone” không đồng nghĩa “nghiệp vụ đã nghiệm thu”; SQL integration PASS không đồng nghĩa HTTP API E2E đã PASS.

## IV. PHÂN CÔNG VÀ PHỐI HỢP NHÓM

Bảng dưới đây kế thừa phân công từ báo cáo tuần 1. Đây là **trách nhiệm được giao** và nội dung cần đối soát trong tuần 2, **không phải kết luận đã hoàn thành cá nhân** vì chưa có minh chứng nghiệm thu theo từng Issues.

| Thành viên | Vai trò | Issues phụ trách | Việc cần đối soát |
| --- | --- | --- | --- |
| Chu Thị Minh Hạnh | Trưởng nhóm; BA, AI, GPS | CV01, CV03, CV04, CV09, CV30–CV34, CV48 | Tổng hợp minh chứng; đối soát AI/GPS và chuẩn bị nghiệm thu |
| Nguyễn Hà Trung Nam | Mobile và Backend | CV02, CV05, CV08, CV13–CV16, CV20, CV44 | Đối soát giữ ghế, booking, API và đồng bộ trạng thái |
| Phạm Phương Linh | Mobile UI, SQL Server, kiểm thử | CV06, CV10, CV11, CV17, CV19, CV35–CV38, CV43 | Đối soát UI, dữ liệu mẫu, xác thực và test SQL |
| Phạm Ngọc Thành | Web Admin, quản lý chi nhánh, phân quyền | CV07, CV21–CV25, CV27–CV29, CV39, CV46, CV47 | Kiểm tra màn quản trị và RBAC theo chi nhánh |
| Nguyễn Quốc Tuấn | Giao diện phim, CRUD, tài liệu, QA | CV12, CV18, CV26, CV40–CV42, CV45 | Đối soát giao diện phim, tài liệu demo và checklist UI |

## V. VƯỚNG MẮC VÀ HƯỚNG KHẮC PHỤC

| Vấn đề | Tình trạng |
| --- | --- |
| Dữ liệu phim & poster | Một số posterUrl là đường dẫn tương đối hoặc URL mẫu; cần asset thật và xử lý fallback nhất quán. |
| Lịch chiếu demo | Ảnh một phim báo chưa có suất chiếu sắp tới; cần kiểm tra dữ liệu và trạng thái suất. |
| AI / chatbot | Recommendation fallback do upstream không truy cập được; chatbot có lỗi quá tải hoặc cấu hình. |
| Premium UI | Trong giai đoạn chỉnh UI từng gặp API limit >50, SVG trên iOS và lỗi type StyleSheet; bản code đưa lên main đã chỉnh limit=50 và absoluteFill, vẫn cần xác nhận chạy lại trên thiết bị. |
| Nghiệp vụ lõi | Chưa có minh chứng E2E đầy đủ về giữ nhiều ghế atomic, thanh toán, vé QR và check-in; chưa đánh dấu hoàn thành P1. |
| Quản lý nhánh và dữ liệu | PR #51 SQL vẫn Draft; không merge hoặc chạy schema/seed/migration thử nghiệm trên CineHuntDB đang dùng. |

## VI. KẾ HOẠCH TUẦN 3

| Ưu tiên | Công việc cần hoàn thành |
| --- | --- |
| P0 | Chạy lại npx tsc --noEmit, Expo Go trên iPhone và kiểm tra 4 tab Premium UI; ghi lại log/ảnh đạt và lỗi. |
| P0 | Chuẩn bị suất chiếu hợp lệ trên cơ sở dữ liệu thử nghiệm được kiểm soát, không can thiệp dữ liệu thật. |
| P0 | Kiểm thử luồng khách hàng: đăng nhập → phim → suất → ghế → giữ ghế → booking → mock payment → QR. |
| P0 | Kiểm thử đồng thời chống trùng ghế, hết hạn giữ ghế, hoàn trả ghế và check-in theo vai trò STAFF. |
| P1 | Khôi phục AI upstream, đánh giá chatbot, GPS, poster và trải nghiệm đặt vé trên thiết bị nhỏ. |
| P1 | Đối soát kết quả từng thành viên với Issues, cập nhật Assignees/PR, lưu bằng chứng nghiệm thu. |

## VII. LIÊN KẾT VÀ MINH CHỨNG

- **Báo cáo tuần 1:** https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/blob/main/docs/reports/Bao_cao_tien_do_tuan_1_2026-10-26.md
- **Mã nguồn main:** https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/tree/main
- **Mã nguồn Mobile:** https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/tree/main/mobile
- **Commit Premium UI:** https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/commit/e1a8fa1dd0b968118b5cbb4721e48bf48b6d9914
- **Kiểm thử SQL (Draft PR #51):** https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/pull/51
- **Video buổi 2:** https://youtu.be/SKQl2Q5keYc
- **Video họp giai đoạn đầu:** https://youtu.be/YijEeqPgfxI

**Yêu cầu video:** Nhóm cung cấp đường dẫn video họp nhóm, báo cáo tiến độ và demo buổi 2. Thời lượng/nội dung chi tiết của video chưa được xác minh độc lập; trước khi nộp cần kiểm tra video **tối thiểu 10 phút**, có minh chứng họp và demo phù hợp.

## VIII. KẾT LUẬN

Qua tuần 2, nhóm đã đạt bước chuyển từ lập kế hoạch sang triển khai và chạy thử: Mobile hoạt động trên iPhone, có dữ liệu 23 phim từ Backend/SQL Server; Web có giao diện và code quản trị; SQL V6.3 đạt vòng kiểm tra cô lập; Premium UI đã được đưa lên main. Tuy nhiên nhóm cần hoàn thiện suất chiếu demo, AI, kiểm thử xuyên suốt giữ ghế – thanh toán – vé QR – check-in và nghiệm thu phân quyền trước khi xác nhận đạt toàn bộ P1. Báo cáo này ghi nhận tiến độ thực tế tại 02/11/2026, không thay cho báo cáo cuối kỳ.
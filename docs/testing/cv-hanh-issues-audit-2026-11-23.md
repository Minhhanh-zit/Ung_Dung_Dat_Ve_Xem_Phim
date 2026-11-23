# Theo dõi 10 Issues giao @Minhhanh-zit | 23/11/2026

**Repo:** [CineHunt Mobile](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim). **Baseline:** commit d3092e6.  
Mục đích: phân biệt **đã có code**, **đã có tự động test** và **đã nghiệm thu thực tế**; không đánh dấu PASS chỉ từ giao diện hoặc mock.

## 1. Bảng trạng thái có căn cứ

| Issue | Hiện có từ code/repo | Chưa có bằng chứng / phần cần làm | Đề xuất trạng thái |
|---|---|---|---|
| [#1 CV01](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/1) | 4 thư mục mobile/backend/admin-web/ai; source-inventory, gitignore, env examples, README, báo cáo cài đặt; 2 workflow CI xanh | Trưởng nhóm đối chiếu checklist/nguồn gốc và xác nhận nghiệm thu | **Chờ review để đóng** |
| [#3 CV03](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/3) | Tài liệu [Use Case và RBAC](../requirements/cv03-use-cases-rbac.md); API JWT/role | Đánh giá cùng nhóm; Manager theo cinemaId; test quyền theo vai trò | **Đang thực hiện** |
| [#4 CV04](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/4) | [Sơ đồ kiến trúc + sequence + quyết định](../architecture/cv04-system-design.md) | Duyệt quyết định đồng bộ ở CV44; E2E DB; kiểm thử lỗi theo thiết kế | **Đang thực hiện** |
| [#9 CV09](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/9) | API /cinemas/nearest, lọc ba rạp; showtimes API; CinemaSchedule lọc rạp/ngày/suất OPEN | Bộ lọc phối hợp **vị trí + thời gian + ngân sách** chưa chứng minh thống nhất; tọa độ ba rạp trên DB test | **Đang thực hiện** |
| [#30 CV30](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/30) | Mobile ChatAssistant gọi /chat; Discover gọi /recommendations; backend FastAPI fallback và Groq | Test hội thoại tiếng Việt, mất kết nối, ngữ nghĩa sai, nguồn dữ liệu trên iPhone, log không chứa bí mật | **Đang thực hiện** |
| [#31 CV31](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/31) | expo-location xin quyền theo yêu cầu; haversine; từ chối GPS vẫn có danh sách rạp; test helper Mobile | Kiểm thử GPS thực tế 2 vị trí và khi từ chối quyền; không có dữ liệu tọa độ | **Đang thực hiện** |
| [#32 CV32](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/32) | Nút mở Google Maps theo rạp, chi tiết địa chỉ; URL chỉ đường có test helper | **Marker bản đồ trong app** chưa thấy; thử 2 rạp bằng thiết bị; xử lý Linking.openURL lỗi | **Đang thực hiện** |
| [#33 CV33](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/33) | ChatDataService có search_movies/get_showtimes/check_seats từ DB; chatbot hỗ trợ tiếng Việt | Lọc **ngân sách/khung giờ** bằng API chưa chứng minh đủ; test kết quả rỗng và thời gian quá hạn, CTA sang suất | **Đang thực hiện** |
| [#34 CV34](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/34) | ChatActionService dùng service Backend; ChatService yêu cầu xác nhận ghế/phương thức, tool combo, tạo booking/payment | Kiểm thử xác nhận thành công/không hợp lệ, ghế đổi, voucher hết lượt, quyền AI; giao diện dẫn tới bước phù hợp | **Đang thực hiện** |
| [#48 CV48](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/48) | Có transaction/lock và một số unit test về ghế | **Chưa có log SQL test cạnh tranh ba kênh** (AI, Mobile, Staff), kiểm tra không bán trùng và mã ticket | **Chưa nghiệm thu** |

> **Chú ý:** Đường dẫn Issue chính xác là dạng https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/NUMBER. Liên kết tương đối trong bảng chỉ là cách dẫn nội bộ; khi trích dẫn ngoài repo, dùng URL đầy đủ.

## 2. Bằng chứng đang có

- [CI Full Stack tại commit d3092e6](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/actions/runs/45167652942): Backend, Mobile, Admin Web, AI đều **success**.
- [CineHunt Auto Test tại commit d3092e6](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/actions/runs/45167652955): Backend test/build; Mobile typecheck/lint/test; Playwright Web smoke đều **success**.
- Playwright Web: 15 bài mock UI PASS trên Mac; không kiểm thử SQL thật. Admin Web Vitest: 40 PASS trên Mac.
- [GPS unit test](../../mobile/tests/nearestCinema.test.cjs): test ba rạp, sắp xếp đường thẳng, link Maps, origin Tân Mai, thiếu tọa độ.
- [Policy test BANKING](../../backend/test/bank-verification.policy.test.ts): từ chối xác nhận BANKING khi thiếu bằng chứng đối soát.
- **Maestro iPhone Simulator:** bài smoke chưa PASS (không tìm thấy selector Phim), nên không ghi là đã tự động hóa Mobile UI thành công.

## 3. Ma trận nghiệm thu mở (không chạy trên DB có dữ liệu thực)

| Mã | Issue liên quan | Bước kiểm tra và oracle | Cách ghi minh chứng |
|---|---|---|---|
| T01 | #1, #3, #4 | clone sạch → cài dependencies → start riêng từng thành phần; env không chứa khóa thật | commit SHA + terminal output + ảnh cấu trúc |
| T02 | #9, #31 | giả lập GPS gần Hà Đông rồi gần Thanh Xuân; danh sách xếp theo km đường thẳng | tọa độ giả lập + screenshot + expected/actual |
| T03 | #31, #32 | từ chối GPS, chọn rạp thủ công; Maps mở đúng 2 rạp, không bịa phút | video/screenshot thiết bị + URL đã mã hóa |
| T04 | #30 | chat tiếng Việt từ API thật; ngắt AI rồi kiểm tra đặt vé thủ công vẫn vào được | request/response ẩn token + log lỗi |
| T05 | #33 | truy vấn phim/suất theo thời gian và giới hạn ngân sách; suất quá giờ hoặc budget quá thấp → không có kết quả phù hợp | test dataset + response có showtimeId/giá thật |
| T06 | #34 | AI gợi ý ghế, chưa xác nhận → KHÔNG hold; sau xác nhận hợp lệ → dùng API/backend cùng userId | log yêu cầu + trạng thái seat trước/sau, redacted |
| T07 | #48 | 3 client Customer/Staff/AI tranh cùng ghế trên **SQL test DB**, chỉ 1 SOLD/ticket hợp lệ | timestamps, HTTP statuses, SQL COUNT đối chiếu, rollback dữ liệu test |
| T08 | #3, #34 | Customer không đọc admin; user A không dùng hold user B; AI không tự vượt role | 401/403 và DB không bị thay đổi |

## 4. Quy tắc ghi kết quả

Mỗi ca cần: mục tiêu, điều kiện đầu, tài khoản/role giả lập, API URL, kết quả mong đợi, kết quả thực tế, bằng chứng, môi trường và commit SHA. Không đưa JWT, số điện thoại/email thật, API Key hay nội dung database nhạy cảm vào issue hoặc GitHub public.

**Một issue chỉ đóng khi** mọi Acceptance Criteria được kiểm chứng và có review; với #48 nếu AI chưa chạy được thao tác đặt vé thật thì phải ghi **BLOCKED**, không thay thế bằng test hai client hoặc test UI mock.

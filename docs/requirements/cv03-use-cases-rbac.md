# CV03 (#3) | Use Case, phạm vi nền tảng và ma trận RBAC CineHunt Mobile

**Phiên bản đối chiếu mã:** main tại d3092e6 (23/11/2026). **Loại tài liệu:** đặc tả nghiệp vụ và đối chiếu triển khai, không thay thế nghiệm thu trực tiếp.  
**Phụ thuộc:** [CV01 #1](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/1).  
**Nguồn:** các controller trong backend/src, mobile/src/cinehunt/App.tsx, mobile/src/services/authSession.ts, admin-web/src và docs/setup/source-inventory.md.

## 1. Tác nhân và nguyên tắc

| Tác nhân | Nền tảng đích | Phạm vi nghiệp vụ | Trạng thái ở commit tham chiếu |
|---|---|---|---|
| Customer | React Native/Expo (có giao diện khách trên Web) | Phim, rạp/suất, ghế, giữ ghế, đơn, thanh toán, vé, yêu thích, AI/GPS | Có code; chưa nghiệm thu E2E tất cả luồng |
| Staff | Mobile | Đối chiếu/vé tại quầy, soát vé theo quyền | Một số API dùng STAFF; chưa xác nhận đủ toàn bộ màn Mobile dành riêng |
| Cinema Manager | Web React/TypeScript | Quản lý dữ liệu và báo cáo theo chi nhánh phụ trách | **Thiết kế dự kiến**, chưa xác nhận RBAC theo chi nhánh ở backend |
| Admin | Web React/TypeScript | Quản trị toàn hệ thống, lịch chiếu, phòng/ghế, đơn, doanh thu, phân quyền | Nhiều API dùng guard ADMIN |
| CineHunt AI | Dịch vụ qua NestJS, không phải tài khoản quản trị riêng | Tra cứu phim/suất/ghế/combo; đề xuất và thao tác có xác nhận | Có công cụ chat trong backend; cần kiểm thử bảo mật và cạnh tranh trên DB riêng |

**Quy tắc:** React/Web chỉ ẩn hoặc hiện nút để hướng dẫn người dùng; **NestJS phải xác thực JWT, kiểm soát quyền và quyền sở hữu dữ liệu** trước thao tác. Cinema Manager không được tự nhận quyền ADMIN để lách kiểm soát chi nhánh.

## 2. Use Case cốt lõi và ngoại lệ

| UC | Tác nhân | Luồng chính | Ngoại lệ / xử lý | Bằng chứng mã |
|---|---|---|---|---|
| UC-C01 | Khách/Customer | Xem/tìm phim, xem thể loại và chi tiết | Không có phim, API mất kết nối: thông báo rõ | mobile/src/cinehunt/Movies.tsx; backend phim |
| UC-C02 | Khách/Customer | Chọn rạp, ngày, suất OPEN trong tương lai | Suất bị hủy/quá giờ/không còn ghế: ngừng đặt | mobile/src/cinehunt/CinemaSchedule.tsx; backend/src/showtime/showtime.controller.ts |
| UC-C03 | Customer có phiên hợp lệ | Xem ghế theo showtimeId, chọn tối đa 8 ghế, giữ 10 phút | Ghế HELD/SOLD, hold hết hạn, tranh chấp: báo lỗi và tải lại trạng thái | backend/src/showtime-seats/showtime-seats.controller.ts; mobile/src/cinehunt/SeatFlow.tsx |
| UC-C04 | Customer | Tạo đơn từ hold hợp lệ, chọn combo/voucher, tạo payment PENDING | Giá đổi, ghế đổi, voucher hết lượt: rollback/cho chọn lại | backend/src/booking/booking.controller.ts; backend/src/payment/payment.controller.ts |
| UC-C05 | Customer | Theo dõi trạng thái đơn, xem vé/QR sau khi thanh toán được xác nhận | Chưa thanh toán: không tự coi là PAID/đã có vé | backend/src/booking/booking.controller.ts; mobile/src/cinehunt/Orders.tsx |
| UC-C06 | Customer | Yêu cầu hủy/hoàn tiền theo chính sách, xem tiến độ | Không đủ điều kiện, không sở hữu đơn: backend từ chối | backend/src/refund/refund.controller.ts |
| UC-C07 | Khách/Customer | Chọn dùng GPS, xếp rạp theo khoảng cách đường thẳng, mở Google Maps | Từ chối GPS/thiếu tọa độ: vẫn chọn rạp thủ công; không bịa km ô tô | mobile/src/cinehunt/Discover.tsx; backend/src/cinema/cinema-distance.ts |
| UC-C08 | Customer có JWT | Hỏi chatbot phim, suất, ghế và combo từ dữ liệu CineHunt | Gemini/Groq quá tải: thông báo lỗi, đặt vé thủ công vẫn dùng được | backend/src/chat; mobile/src/cinehunt/ChatAssistant.tsx |
| UC-S01 | Staff | Kiểm tra giao dịch BANKING trước khi xác nhận tiền vào | Không có bằng chứng chuyển khoản, ref trùng, sai số tiền: không xác nhận | backend/src/payment/payment.controller.ts; payment.service.ts |
| UC-S02 | Staff | Soát vé/thu tiền tại quầy theo khung thời gian và quyền | Vé đã dùng, đơn sai, ngoài khung thời gian: từ chối | Cần nghiệm thu API và màn Staff trên thiết bị |
| UC-M01 | Cinema Manager | Xem/sửa phim, lịch, phòng và báo cáo của **chính chi nhánh** | Truy cập chi nhánh khác: phải trả 403 | **Chưa đạt**: chưa có bằng chứng backend ràng buộc cinemaId theo Manager |
| UC-A01 | Admin | Quản lý rạp/phòng/lịch, đơn, doanh thu và cấu hình | Trạng thái xung đột, bản ghi đã sửa: báo lỗi và giữ dữ liệu đúng | backend/src/cinema/cinema.controller.ts; showtime.controller.ts; booking.controller.ts |

## 3. Ma trận quyền mục tiêu và thực trạng

Ký hiệu: **R** = đọc; **W** = ghi; **O** = chỉ dữ liệu thuộc khách; **B** = chỉ chi nhánh được gán; **C** = hành động sau xác nhận; **—** = không cấp quyền. Bảng là **quy định đích**, không khẳng định mọi ô đã được code.

| Chức năng | Customer | Staff | Cinema Manager | Admin | AI qua backend |
|---|---|---|---|---|---|
| Phim/rạp/suất công khai | R | R | R | R/W | R |
| Giữ ghế, đặt vé cá nhân | O/W | W (quầy, theo chính sách) | — | quản trị phù hợp | C (dùng đúng userId) |
| Xem đơn và QR cá nhân | O/R | R theo nghiệp vụ quầy | R/B theo yêu cầu | R | — |
| Xác nhận đã nhận BANKING | — | W, có đối soát | — | W, có đối soát | — |
| Quản lý rạp/phòng/lịch chiếu | — | — | R/W/B **dự kiến** | R/W | — |
| Phê duyệt hoàn tiền | — | — | — | W | — |
| Báo cáo toàn hệ thống | — | — | R/B **dự kiến** | R | — |

**Khoảng trống:** RolesGuard so sánh vai trò được yêu cầu; các API admin hiện dùng ADMIN. Chưa thấy một lớp ủy quyền Cinema Manager có kiểm soát cinemaId xuyên suốt. Vì vậy **không đưa Cinema Manager vào danh sách quyền đã nghiệm thu**.

## 4. Mapping màn hình

- **Mobile hiện có:** Phim (Movies), Khám phá / rạp / GPS / lịch theo rạp (Discover, CinemaSchedule), chọn ghế và checkout (SeatFlow), Đơn & vé (Orders, BookingView), Tài khoản (Account), trợ lý (ChatAssistant).
- **Web hiện có:** trang khách, lịch chiếu/đặt ghế và màn quản trị phim, rạp, lịch, đơn, đối soát, báo cáo.
- **Thiết kế còn thiếu minh chứng:** màn Staff đầy đủ và dashboard/permission Cinema Manager giới hạn theo rạp.

## 5. Quy tắc nghiệm thu tối thiểu

1. **Ca thành công:** Customer đăng nhập, chọn suất OPEN và ghế AVAILABLE, tạo đơn hợp lệ; xác nhận thanh toán bằng phương thức có thật trong môi trường test, sau đó mới có QR.
2. **Ca xung đột:** hai khách cùng chọn một showtimeSeatId; chỉ một lần chuyển sang HELD/SOLD hợp lệ, đối chiếu SQL sau transaction.
3. **Ca phân quyền:** Customer gọi GET admin hoặc xác nhận BANKING bị 401/403; Staff chỉ thực hiện đúng API được cấp.
4. **Ca vị trí:** từ chối quyền GPS vẫn xem được rạp và lịch; tọa độ trống không sinh số km giả.
5. **Ca AI:** hỏi suất không tồn tại, AI phải nói không tìm thấy; AI không tự giữ ghế trước xác nhận; AI/Backend mất kết nối không chặn đặt vé thủ công.
6. **Ca Manager:** chỉ được nghiệm thu sau khi backend kiểm tra ràng buộc chi nhánh, gồm test truy cập ngoài phạm vi.

## 6. Quyết định và các mục chờ duyệt

- Đã phân định **4 tác nhân nghiệp vụ**, nhưng Cinema Manager là phạm vi **chưa triển khai đầy đủ**.
- Chưa có bằng chứng nhóm chính thức duyệt matrix, chưa có đủ log SQL/E2E và xác nhận trưởng nhóm. **Giữ Issue #3 mở đến khi review và kiểm thử theo bảng này.**
- Đặc tả được liên kết cùng [CV04 #4](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/4), [CV31 #31](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/31), [CV34 #34](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/34), [CV48 #48](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/48).

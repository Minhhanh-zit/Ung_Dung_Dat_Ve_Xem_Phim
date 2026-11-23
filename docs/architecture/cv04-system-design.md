# CV04 (#4) | Kiến trúc Mobile - Web - NestJS - SQL Server - AI

**Phạm vi:** CineHunt Mobile, commit đối chiếu d3092e6 (23/11/2026). Tách bạch **đã thấy trong mã** và **định hướng kỹ thuật**. Không phải giấy chứng nhận production.  
**Tài liệu liên quan:** [CV03](../requirements/cv03-use-cases-rbac.md), [CV01](../setup/source-inventory.md), [Issue #4](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/issues/4).

## 1. Sơ đồ thành phần và trust boundary

~~~mermaid
flowchart LR
  Customer["Customer / Staff\nReact Native + Expo"]
  Web["Web React + Vite\nKhách / Admin"]
  API["NestJS API\nJWT / RBAC / validation"]
  SQL[("SQL Server\nbooking, showtime_seats,\npayments, tickets")]
  Reco["FastAPI Recommendation\nmô hình hoặc popularity"]
  AI["Gemini / Groq\nbên ngoài"]
  Maps["Google Maps\nliên kết chỉ đường"]
  Customer -->|"HTTPS / REST; bearer"| API
  Web -->|"REST; phiên đăng nhập"| API
  API -->|"TypeORM / transaction"| SQL
  API -->|"HTTP nội bộ"| Reco
  API -->|"API Key chỉ ở Backend"| AI
  Customer -.->|"mở URL, không gọi Routes API bắt buộc"| Maps
~~~

**Nguồn tin cậy:** SQL Server và các transaction của Backend quyết định ghế, đơn và thanh toán. UI, AI và kết quả GPS chỉ là đầu vào chưa đáng tin; không cập nhật trực tiếp bảng dữ liệu nghiệp vụ. Mobile/Web phải xử lý lỗi timeout, 401, 403, 409 và giữ khả năng thử lại **không lặp thao tác ghi**.

**Phân quyền:** JwtAuthGuard/PaymentAccessGuard/RolesGuard trên NestJS. Manager theo chi nhánh chỉ là **mục tiêu**; chưa được mô tả là tính năng RBAC đã có.

## 2. Sơ đồ quy trình đặt vé

~~~mermaid
sequenceDiagram
  participant U as Customer Mobile/Web
  participant B as NestJS API
  participant DB as SQL Server
  participant P as Thanh toán / Staff
  U->>B: GET phim / suất OPEN / sơ đồ ghế
  B->>DB: Đọc dữ liệu showtime_seats
  DB-->>U: Trạng thái ghế qua API
  U->>B: POST /showtime-seats/hold-many (JWT, 1-8 ghế)
  B->>DB: Transaction + khóa ghế + lưu expiresAt
  alt Ghế còn AVAILABLE
    DB-->>B: Hold thành công
    B-->>U: holdIds và hạn giữ
    U->>B: POST /bookings bằng holdIds
    B->>DB: Xác nhận sở hữu hold, tạo PENDING_PAYMENT
    B-->>U: bookingId, tiền theo nguồn dữ liệu
    U->>B: POST /payments, chọn phương thức
    B->>DB: Tạo payment PENDING
    B-->>U: Màn thanh toán / chờ tại quầy
    P->>B: Xác nhận theo đúng chính sách từng phương thức
    B->>DB: Transaction: PAID, SOLD, vé QR, audit
    B-->>U: Trạng thái đơn/vé sau xác nhận
  else Ghế đã HELD hoặc SOLD
    DB-->>B: Conflict
    B-->>U: Báo ghế không còn, tải lại sơ đồ
  end
~~~

**Giới hạn hiện tại:** sơ đồ mô tả nghiệp vụ có thể được kiểm thử; **không hàm ý các bước đã PASS E2E trên SQL thật**. Phương thức BANKING yêu cầu STAFF/ADMIN đối chiếu bằng chứng giao dịch trước khi dùng API xác nhận; tạo payment PENDING **không phải** đã thanh toán. MOCK chỉ dùng dev nếu được cấu hình.

## 3. Contract API đại diện và xử lý lỗi

| HTTP/API | Người gọi | Dữ liệu chính | Điều kiện và phản hồi cần xử lý |
|---|---|---|---|
| GET /movies, GET /showtimes, GET /cinemas | công khai | id, phim, giờ/giá, rạp | 200 mảng rỗng: không có dữ liệu; 5xx: thông báo thử lại |
| GET /showtime-seats/:showtimeId | JWT | trạng thái theo suất | Bắt buộc kiểm tra thay đổi mới trước hold |
| POST /showtime-seats/hold-many | JWT | showtimeSeatIds, holdMinutes | kiểm tra sở hữu, 1–8 ghế; ghế bận phải từ chối |
| POST /bookings | JWT | holdIds, voucher/combo | chỉ từ hold hợp lệ; chống đặt trùng |
| POST /payments | JWT | bookingId, paymentMethod | tạo PENDING; chủ đơn mới được thao tác |
| POST /payments/:id/admin-bank-confirm | STAFF/ADMIN | bankReference | chỉ sau đối chiếu; ref không hợp lệ hoặc đã dùng: từ chối |
| GET /bookings/my, GET /bookings/:id/tickets | JWT | dữ liệu theo chủ đơn | không tiết lộ đơn/vé người khác |
| GET /recommendations | JWT | limit | có thể popularity fallback khi FastAPI không khả dụng |
| POST /chat; POST /chat/stream | JWT | messages | lỗi AI không chặn luồng đặt vé thủ công |
| POST /cinemas/nearest | JWT | tọa độ hoặc originAddress | trả DRIVING khi có Routes API hợp lệ; nếu không dùng đường thẳng hoặc chưa xếp hạng |

Cấu hình riêng tư: JWT/refresh token không được log; phiên native dùng lớp lưu trữ an toàn; API Keys cho Gemini, Groq và Google Routes **chỉ ở Backend**. Không commit tệp môi trường thực tế.

## 4. Thiết kế GPS / chatbot

~~~mermaid
flowchart TD
  A["Khách nhấn tìm rạp hoặc hỏi chatbot"] --> B{"Vị trí hiện tại?"}
  B -->|Có| C["Xin quyền GPS khi cần"]
  B -->|Không; nhập địa danh| D["Lấy originAddress"]
  C -->|Cho phép| E["Expo Location: tọa độ"]
  C -->|Từ chối / lỗi| F["Danh sách rạp / chọn thủ công"]
  D --> G["NestJS /cinemas/nearest"]
  E --> G
  G --> H{"Có Google Routes API và dữ liệu tuyến?"}
  H -->|Có| I["km ô tô, thời gian do Routes API trả"]
  H -->|Không, có GPS| J["Haversine: km đường thẳng, ghi rõ ước tính"]
  H -->|Không, chỉ có tên địa danh| K["Không xếp hạng km; mở liên kết Maps"]
  I --> L["Khách chọn rạp, suất rồi tự xác nhận"]
  J --> L
  K --> L
  F --> L
~~~

Không tự suy diễn thời gian đi ô tô từ tọa độ; Google Maps URL chỉ giúp thiết bị mở điều hướng. Nếu thiếu tọa độ của một rạp, không bịa số km. Tại commit đối chiếu, 3 rạp demo được lọc theo tên: Thanh Xuân, Hà Đông, Cầu Giấy. Script thiết lập Thanh Xuân là thao tác **dev riêng**, không phải SQL migration tự chạy.

## 5. AI có xác nhận

Backend có read tools (phim, suất, ghế, combo, rạp) và action tools. ChatService kiểm tra tin nhắn xác nhận ghế và phương thức thanh toán trước khi gọi action. ChatActionService dùng lại BookingService/SeatHoldService/PaymentService với userId đã xác thực.

**Rủi ro chưa nghiệm thu:** prompt/model không phải cơ chế bảo mật duy nhất. Cần test server-side khi AI gọi sai công cụ, thay đổi seat state giữa kiểm tra và hold, xác nhận mơ hồ, retries và hai khách tranh cùng ghế. Trong Chat UI hiện tại không thể coi một câu trả lời “đã đặt vé” là bằng chứng booking thành công.

## 6. Quyết định đồng bộ ghế: Polling và WebSocket

| Yếu tố | Polling qua REST | WebSocket / Socket.IO |
|---|---|---|
| Đơn giản triển khai | Cao, tận dụng REST đang có | Cần gateway/reconnect/room theo showtime |
| Cập nhật trực quan | Trễ theo chu kỳ | Gần real-time khi kết nối ổn |
| Đứt mạng | Gọi lại + trạng thái loading/error | Cần resubscribe, chống mất sự kiện |
| Nguồn quyết định xung đột | SQL transaction | SQL transaction, WebSocket chỉ phát sự kiện |
| Khả năng kiểm thử | GET ghế và thử concurrent hold | Phải test thêm reconnect/event order |

**Quyết định hiện tại:** dùng **REST + kiểm tra lại trạng thái ghế từ Backend** là phương án cơ sở an toàn; không tuyên bố WebSocket production đã hoàn tất. Việc có hay không Socket.IO là hạng mục cần nghiệm thu riêng ở CV44. Dù chọn phương án nào, không được lấy cache hoặc sự kiện WebSocket làm nguồn quyết định SOLD.

## 7. Kiểm thử và phụ thuộc chưa hoàn tất

- **Minh chứng tự động:** GitHub Actions [CI Full Stack](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/actions/runs/45167652942) và [CineHunt Auto Test](https://github.com/Minhhanh-zit/Ung_Dung_Dat_Ve_Xem_Phim/actions/runs/45167652955) của commit d3092e6 đều thành công. Playwright dùng mock nên không khẳng định DB E2E.
- **Cần chạy:** test thành công/loại lỗi của flow hold → book → payment → tickets trên **test DB độc lập**; test phân quyền theo chi nhánh dành cho Manager sau khi phát triển; đo độ trễ/tranh chấp ghế nhiều kênh; AI mất kết nối và GPS từ chối.
- **Chưa có biên bản nhóm duyệt chính thức:** Issue #4 chỉ nên đóng sau khi review sơ đồ, quyết định Polling/WebSocket và bằng chứng E2E phù hợp.

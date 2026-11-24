# CineHunt Mobile: kiểm thử và coverage

## Lệnh chạy tại thư mục `mobile`

```bash
npm ci
npm run typecheck
npm run lint
npm run test:node
npm run test:coverage
```

Hoặc chạy cả bộ regression Node.js và Jest:

```bash
npm run test:all
```

## Hai lớp kiểm thử

- `tests/*.test.cjs`: regression tests chạy bằng Node.js built-in test runner. Các bài này kiểm tra API client, auth refresh, SecureStore, theme, GPS và các guard giao diện.
- `tests/*.jest.test.tsx`: Jest Expo + React Native Testing Library. Đây là lớp tạo `mobile/coverage/lcov.info` cho SonarQube, đồng thời kiểm tra UI và luồng nghiệp vụ.

Không dùng số coverage tự nhập hoặc coverage giả. Jest thu thập dữ liệu từ `mobile/src/**` và sinh LCOV thực tế.

## Các nhóm đang được kiểm thử

- API client: HTTP status, thông báo an toàn, timeout, refresh token, retry GET và không retry write.
- Auth session: token rotation, session mới, concurrency, logout invalid token và unsubscribe.
- Persistence: SecureStore native, sessionStorage/localStorage web, dữ liệu cũ, version, dữ liệu hỏng.
- Public catalog: phân trang, payload lỗi, trang rỗng và giới hạn 100 trang.
- UI dùng chung: Button, Field, Notice, StatusPill, poster URL, FilmArt và layout primitives.
- Màn hình: Movies, Discover, ChatAssistant, Orders, AgeAdmissionGate, BookingView và App shell.
- Logic thuần: cinema scope, GPS nearest, theme tokens và độ tương phản.

## SonarQube Cloud

GitHub Actions cài dependencies từ `mobile/package-lock.json`, chạy typecheck/lint, chạy Node regression tests, chạy Jest coverage, rồi xác thực và chuẩn hóa LCOV bằng `scripts/normalize-sonar-lcov.py mobile`.

Nếu một bài test hoặc typecheck thất bại, job Mobile sẽ dừng trước bước SonarQube. Không bỏ qua lỗi bằng cách loại source khỏi coverage.

## Giới hạn kiểm thử

Các bài kiểm thử UI dùng mock cho API và nền tảng native. Chúng không thay thế kiểm thử tích hợp với Backend/SQL Server, kiểm thử thiết bị iOS/Android, payment sandbox hoặc kiểm thử tải giữ ghế đồng thời. Những kiểm thử đó cần môi trường dịch vụ riêng và dữ liệu kiểm thử có kiểm soát.

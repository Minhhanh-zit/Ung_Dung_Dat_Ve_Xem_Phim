# CineHunt Mobile (Expo SDK 58)

Ứng dụng đặt vé CineHunt bằng **React Native + Expo SDK 58 + Expo Router**. Mã chạy trong `src/cinehunt/`, được mount từ `src/app/index.tsx`.

## Chạy trên máy phát triển

```bash
cd mobile
npm ci
cp .env.example .env.local
# Sửa EXPO_PUBLIC_API_URL thành địa chỉ Backend mà điện thoại truy cập được
npx tsc --noEmit
npx expo install --check
npx expo start --clear --go --lan
```

Mở bằng **Expo Go tương thích SDK 58**. Khi sửa cấu hình môi trường hoặc cài native packages, tắt Metro và mở lại. Không dùng lệnh `npm run reset-project`: đây là script của template Expo, **không phục vụ ứng dụng CineHunt hiện tại**.

## Kết nối iPhone thật

`EXPO_PUBLIC_API_URL` phải trỏ tới Backend đang hoạt động, ví dụ `http://<IP_MAC_TRUY_CAP_DUOC>:3000`. `localhost` trên iPhone **không phải** Mac.

Nếu hai thiết bị ở khác mạng, có thể dùng Tailscale. Khi Metro không tìm thấy thiết bị, hãy kiểm tra cùng mạng/VPN và cổng 8081; với Tailscale, có thể đặt `EXPO_PACKAGER_PROXY_URL=http://<TAILSCALE_IP_MAC>:8081` trước lệnh `npx expo start --clear --go --lan --port 8081`.

## Các màn hình hiện có

- **Phim:** danh sách, tìm kiếm, lọc, chi tiết và lịch chiếu.
- **Đặt vé:** chọn ghế theo API, giữ ghế có thời hạn, tối đa 8 ghế, chọn combo/voucher, tạo booking.
- **Đơn & vé:** lịch sử, chi tiết booking, thanh toán trạng thái chờ, xem vé khi Backend đã phát hành.
- **Khám phá:** rạp, combo, gợi ý phim từ Backend (có thể fallback popularity), tìm rạp bằng GPS và chatbot tùy cấu hình.
- **Tài khoản:** đăng nhập, đăng ký, hồ sơ; một số thao tác nhân viên cần quyền STAFF/ADMIN.

**Giới hạn:** JWT và yêu thích được lưu trong RAM, mất khi tải lại ứng dụng; poster phim có thể chỉ là placeholder. Giao diện chạy được **không đồng nghĩa** toàn bộ nghiệp vụ hoặc thanh toán đã qua nghiệm thu.

## Kiểm thử an toàn

```bash
cd mobile
npx tsc --noEmit
npx expo install --check
git diff --check
```

Không chạy seed/migration SQL từ Mobile. Chỉ thử thanh toán với các phương thức Backend đang bật và không gọi endpoint xác nhận thành công giả.

Xem [README dự án](../README.md) và [cấu hình mẫu](.env.example).

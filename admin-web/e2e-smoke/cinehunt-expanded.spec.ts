/**
 * CineHunt UI regression with network fixtures. NEVER touches real banking / SQL.
 * Source: public CineHunt Web components, no secret or real customer accounts.
 * 'Mock' tests verify UI+request wiring, NOT end-to-end database correctness.
 */
import { expect, test, type Page, type Route } from '@playwright/test';

const movies = [
  { movieId: 101, title: 'Kiểm Thử Hành Tinh', status: 'NOW_SHOWING', durationMinutes: 125,
    ageRating: 'T13', averageRating: 4.5, genres: [{ genreId: 1, genreName: 'Hành động' }], posterUrl: null },
  { movieId: 102, title: 'Kiểm Thử Tương Lai', status: 'COMING_SOON', durationMinutes: 98,
    ageRating: 'P', averageRating: 0, genres: [{ genreId: 2, genreName: 'Hoạt hình' }], posterUrl: null },
];

const adminUser = { id: 42, userId: 42, fullName: 'Admin kiểm thử', email: 'admin-test@cinehunt.invalid', role: 'ADMIN' };
const pendingBooking = {
  bookingId: 501, bookingCode: 'BK-TEST-501', customerName: 'Khách thử nghiệm',
  movieTitle: 'Kiểm Thử Hành Tinh', cinemaName: 'CineHunt Hà Đông',
  showtime: new Date(Date.now() + 3 * 86400000).toISOString(), seats: ['G4', 'G5'],
  totalAmount: 150000, status: 'PENDING_PAYMENT', paymentStatus: 'PENDING',
};

/** Intercept ALL /api traffic: even if an endpoint changes, these tests never write production data. */
async function isolatedApi(page: Page, custom?: (path: string, route: Route) => Promise<boolean>) {
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    if (custom && await custom(path, route)) return;
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ message: 'Mock test: chặn mọi thao tác ghi' }) });
      return;
    }
    if (path === '/movies' || path === '/movies/catalog') {
      await route.fulfill({ json: { items: movies, total: movies.length, page: 1, limit: 50 } });
    } else if (path === '/movie-ratings/top') {
      await route.fulfill({ json: [] });
    } else if (/^\/movies\/\d+\/rating$/.test(path)) {
      await route.fulfill({ json: { averageStars: 0, ratingCount: 0 } });
    } else if (/^\/movies\/\d+$/.test(path)) {
      const m = movies.find((item) => item.movieId === Number(path.split('/')[2]));
      await route.fulfill(m ? { json: m } : { status: 404, json: { message: 'Không tìm thấy phim' } });
    } else if (path === '/showtimes') {
      await route.fulfill({ json: [] });
    } else if (path === '/auth/me') {
      await route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
    } else {
      await route.fulfill({ status: 404, json: { message: 'Mock: chưa định nghĩa ' + path } });
    }
  });
  // Avoid external network dependencies (poster fallbacks).
  await page.route('https://picsum.photos/**', route => route.fulfill({
    status: 200, contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
  }));
}

const go = (page: Page, url: string) => page.goto(url, { waitUntil: 'domcontentloaded' });

/** Movie list, search and filtering use mocked GET /movies/catalog, not seeded SQL. */
test('Phim: hiển thị phim từ API và nút mua vé', async ({ page }) => {
  await isolatedApi(page);
  await go(page, '/movies');
  await expect(page.getByRole('heading', { name: 'Khám phá phim' })).toBeVisible();
  await expect(page.locator('.cc-card')).toHaveCount(1);
  await expect(page.locator('.cc-card').first()).toContainText('Kiểm Thử Hành Tinh');
  await expect(page.locator('.cc-card').first().getByRole('link', { name: 'Mua vé' })).toHaveAttribute('href', '/showtimes/101');
  await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
  await expect(page.locator('.cc-card')).toHaveCount(2);
});

test('Phim: lọc Đang chiếu và Sắp chiếu', async ({ page }) => {
  await isolatedApi(page);
  await go(page, '/movies');
  await expect(page.locator('.cc-card')).toHaveCount(1);
  await expect(page.locator('.cc-card').first()).toContainText('Kiểm Thử Hành Tinh');
  await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
  await expect(page.locator('.cc-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Sắp chiếu', exact: true }).click();
  await expect(page.locator('.cc-card')).toHaveCount(1);
  await expect(page.locator('.cc-card').first()).toContainText('Kiểm Thử Tương Lai');
  await page.getByRole('button', { name: 'Đang chiếu', exact: true }).click();
  await expect(page.locator('.cc-card')).toHaveCount(1);
  await expect(page.locator('.cc-card').first()).toContainText('Kiểm Thử Hành Tinh');
});

test('Phim: tìm tên không tồn tại hiển thị trạng thái rỗng', async ({ page }) => {
  await isolatedApi(page);
  await go(page, '/movies');
  await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
  await expect(page.locator('.cc-card')).toHaveCount(2);
  await page.getByPlaceholder('Tìm theo tên phim...').fill('Phim không có trong CineHunt 999');
  await expect(page.getByText('Không tìm thấy phim phù hợp.')).toBeVisible();
  await expect(page.locator('.cc-card')).toHaveCount(0);
});

test('Phim: API lỗi hiện Thử lại và phục hồi khi API hoạt động', async ({ page }) => {
  let attempts = 0;
  await isolatedApi(page, async (path, route) => {
    if (path !== '/movies/catalog') return false;
    attempts++;
    if (attempts === 1) await route.fulfill({ status: 503, json: { message: 'Hệ thống tạm bận' } });
    else await route.fulfill({ json: { items: movies, total: movies.length } });
    return true;
  });
  await go(page, '/movies');
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.locator('.cc-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
  await expect(page.locator('.cc-card')).toHaveCount(2);
  expect(attempts).toBeGreaterThanOrEqual(2);
});

test('Chi tiết phim: API đúng title, không tạo đơn', async ({ page }) => {
  await isolatedApi(page);
  await go(page, '/movies/101');
  await expect(page.locator('.stitch-detail-hero h1')).toHaveText('Kiểm Thử Hành Tinh');
  await expect(page.getByText('T13').first()).toBeVisible();
});

test('Lịch chiếu: chưa có suất OPEN thì hiển thị thông báo', async ({ page }) => {
  await isolatedApi(page);
  await go(page, '/schedule');
  await expect(page.getByRole('heading', { name: 'Lịch chiếu phim' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chưa có suất chiếu' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem danh sách phim' })).toBeVisible();
});

test('Lịch chiếu: có suất tương lai và nhấn giờ chiếu yêu cầu đăng nhập', async ({ page }) => {
  const future = new Date(Date.now() + 3 * 86400000);
  future.setHours(19, 30, 0, 0);
  const end = new Date(future.getTime() + 125 * 60000);
  await isolatedApi(page, async (path, route) => {
    if (path !== '/showtimes') return false;
    await route.fulfill({ json: [{
      showtimeId: 711, movieId: 101, roomId: 301, basePrice: 75000, status: 'OPEN',
      startTime: future.toISOString(), endTime: end.toISOString(),
      room: { roomId: 301, roomName: 'Phòng 1', cinema: { cinemaId: 2, cinemaName: 'CineHunt Hà Đông' } },
    }] });
    return true;
  });
  await go(page, '/schedule');
  await expect(page.getByRole('heading', { name: 'Lịch chiếu phim' })).toBeVisible();
  await expect(page.locator('.cgv-time-grid button')).toHaveCount(1);
  await expect(page.getByText('CineHunt Hà Đông')).toBeVisible();
  await page.locator('.cgv-time-grid button').first().click();
  await expect(page).toHaveURL(/\/login/);
});

test('Đăng ký: mật khẩu không trùng bị chặn trước khi gọi API', async ({ page }) => {
  let writes = 0;
  await isolatedApi(page, async (path, route) => {
    if (path === '/auth/register') { writes++; await route.fulfill({ status: 405, json: { message: 'Không cho đăng ký thật trong test' } }); return true; }
    return false;
  });
  await go(page, '/register');
  await page.getByLabel('Họ và tên').fill('Người Kiểm Thử');
  await page.getByLabel('Email').fill('e2e-user@cinehunt.invalid');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('StrongPassword123!');
  await page.getByLabel('Xác nhận mật khẩu').fill('WrongPassword123!');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /tạo tài khoản/i }).click();
  await expect(page.getByText('Mật khẩu xác nhận không khớp!')).toBeVisible();
  expect(writes).toBe(0);
});

test('Đăng nhập: API trả 401 thì hiện thông báo sai mật khẩu', async ({ page }) => {
  let logins = 0;
  await isolatedApi(page, async (path, route) => {
    if (path === '/auth/login') {
      logins++;
      await route.fulfill({ status: 401, json: { message: 'Email hoặc mật khẩu không đúng' } });
      return true;
    }
    return false;
  });
  await go(page, '/login');
  await page.getByLabel('Email').fill('none@cinehunt.invalid');
  await page.getByLabel('Mật khẩu').fill('WrongPassword123!');
  await page.getByRole('button', { name: /vào hệ thống/i }).click();
  await expect(page.getByText('Email hoặc mật khẩu không đúng')).toBeVisible();
  expect(logins).toBe(1);
});

async function prepareMockAdmin(page: Page, paymentMethod = 'BANKING') {
  let confirmations = 0;
  await page.addInitScript((user) => {
    sessionStorage.setItem('accessToken', 'test-jwt-not-for-real-api');
    sessionStorage.setItem('user', JSON.stringify(user));
  }, adminUser);
  await isolatedApi(page, async (path, route) => {
    if (path === '/auth/me') { await route.fulfill({ json: adminUser }); return true; }
    if (path === '/bookings/admin/all') {
      await route.fulfill({ json: { data: [pendingBooking], total: 1, page: 1, limit: 20 } });
      return true;
    }
    if (path === '/payments/booking/501') {
      await route.fulfill({ json: { paymentId: '901', bookingId: '501', amount: 150000, paymentMethod,
        paymentStatus: 'PENDING', transactionCode: 'CH-TEST-901' } });
      return true;
    }
    if (path === '/payments/901/admin-bank-confirm') {
      confirmations++;
      const body = route.request().postDataJSON() as {bankReference?: string};
      if (!body?.bankReference || body.bankReference.length < 6) {
        await route.fulfill({ status: 400, json: { message: 'Bank reference không hợp lệ' } });
      } else {
        await route.fulfill({ json: { success: true, paymentId: '901', bookingId: '501' } });
      }
      return true;
    }
    if (path === '/admin/stats') { await route.fulfill({ json: {} }); return true; }
    return false;
  });
  await go(page, '/admin/bookings');
  await expect(page.getByRole('heading', { name: 'Quản lý Đơn Đặt Vé' })).toBeVisible();
  await expect(page.getByText('BK-TEST-501').first()).toBeVisible();
  return () => confirmations;
}

test('Admin: chưa kiểm tra tiền vào thì không thể bấm xác nhận', async ({ page }) => {
  const confirmations = await prepareMockAdmin(page);
  await page.getByRole('button', { name: 'Kiểm tra chuyển khoản' }).first().click();
  await expect(page.getByText('Đối soát chuyển khoản ngân hàng')).toBeVisible();
  const confirm = page.getByRole('button', { name: 'Xác nhận đã nhận tiền' });
  await expect(confirm).toBeDisabled();
  await page.getByPlaceholder('Mã giao dịch trên sao kê').fill('BANK-REF-ABC123');
  await expect(confirm).toBeDisabled();
  expect(confirmations()).toBe(0);
});

test('Admin: chỉ xác nhận tiền khi đã tick đối chiếu + nhập mã tham chiếu', async ({ page }) => {
  const confirmations = await prepareMockAdmin(page);
  await page.getByRole('button', { name: 'Kiểm tra chuyển khoản' }).first().click();
  await expect(page.getByPlaceholder('Mã giao dịch trên sao kê')).toBeVisible();
  const confirm = page.getByRole('button', { name: 'Xác nhận đã nhận tiền' });
  await page.getByPlaceholder('Mã giao dịch trên sao kê').fill('BANK-REF-ABC123');
  await page.getByRole('checkbox', { name: /trực tiếp đối chiếu/i }).check();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect.poll(confirmations).toBe(1);
  await expect(page.getByText('Đối soát chuyển khoản ngân hàng')).toHaveCount(0);
});

test('Admin: thanh toán CASH không được xác nhận nhầm là BANKING', async ({ page }) => {
  const confirmations = await prepareMockAdmin(page, 'CASH');
  await page.getByRole('button', { name: 'Kiểm tra chuyển khoản' }).first().click();
  await expect(page.getByText(/chưa có giao dịch BANKING đang chờ/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xác nhận đã nhận tiền' })).toBeDisabled();
  expect(confirmations()).toBe(0);
});

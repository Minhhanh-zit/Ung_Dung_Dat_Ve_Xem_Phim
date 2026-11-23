import {expect,test} from '@playwright/test';
test('Trang đăng nhập CineHunt hiển thị đúng trường',async({page})=>{
  await page.goto('/login');
  await expect(page.getByRole('heading',{name:'Đăng nhập'})).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Mật khẩu')).toBeVisible();
  await expect(page.getByRole('button',{name:/vào hệ thống/i})).toBeVisible();
});
test('Khách chưa đăng nhập không vào được khu vực admin',async({page})=>{
  await page.goto('/admin/bookings');
  await expect(page).toHaveURL(/\/login/);
});
test('Khách chưa đăng nhập không xem được vé cá nhân',async({page})=>{
  await page.goto('/my-tickets');
  await expect(page).toHaveURL(/\/login/);
});

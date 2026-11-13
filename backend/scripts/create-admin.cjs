/**
 * Tạo (hoặc cập nhật) tài khoản ADMIN trực tiếp trong SQL Server.
 *
 * Đặt file này tại: backend/scripts/create-admin.cjs
 *
 * Cách chạy (trong thư mục backend/, đã có backend/.env với DB_*):
 *   ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="<mat-khau-manh>" node scripts/create-admin.cjs
 *
 * Windows PowerShell:
 *   $env:ADMIN_EMAIL="admin@example.com"; $env:ADMIN_PASSWORD="<mat-khau-manh>"; node scripts/create-admin.cjs
 *
 * Không ghi email hoặc mật khẩu thật vào file code. Không tự chạy script khi khởi động Backend.
 * LƯU Ý: Nếu email đã tồn tại, script sẽ đổi mật khẩu và nâng quyền tài khoản lên ADMIN.
 * Chỉ chạy trên cơ sở dữ liệu bạn có quyền quản trị sau khi kiểm tra cấu hình DB.
 */
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const sql = require('mssql');

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const fullName = (process.env.ADMIN_FULL_NAME || 'Administrator').trim();

if (!email || !password) {
  console.error('Thiếu ADMIN_EMAIL hoặc ADMIN_PASSWORD.');
  process.exit(1);
}
if (password.length < 6) {
  console.error('Mật khẩu phải có ít nhất 6 ký tự (theo RegisterDto).');
  process.exit(1);
}

const config = {
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '1433', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: (process.env.DB_ENCRYPT ?? 'false').toLowerCase() === 'true',
    trustServerCertificate:
      (process.env.DB_TRUST_SERVER_CERTIFICATE ?? 'true').toLowerCase() === 'true',
    ...(process.env.DB_INSTANCE ? { instanceName: process.env.DB_INSTANCE } : {}),
  },
};

(async () => {
  const pool = await sql.connect(config);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    // Cùng cách băm với AuthService.register: bcrypt, 10 vòng
    const passwordHash = await bcrypt.hash(password, 10);

    const existing = await new sql.Request(tx)
      .input('email', sql.VarChar(150), email)
      .query('SELECT user_id FROM users WHERE email = @email');

    let userId;
    if (existing.recordset.length > 0) {
      userId = existing.recordset[0].user_id;
      await new sql.Request(tx)
        .input('id', sql.Int, userId)
        .input('hash', sql.VarChar(255), passwordHash)
        .query(`UPDATE users
                SET password_hash = @hash, role = 'ADMIN', status = 'ACTIVE',
                    email_verified = 1, failed_login_attempts = 0, locked_until = NULL
                WHERE user_id = @id`);
      console.log(`Đã cập nhật user hiện có (id=${userId}) thành ADMIN.`);
    } else {
      const inserted = await new sql.Request(tx)
        .input('name', sql.NVarChar(120), fullName)
        .input('email', sql.VarChar(150), email)
        .input('hash', sql.VarChar(255), passwordHash)
        .query(`INSERT INTO users
                  (full_name, email, password_hash, email_verified, failed_login_attempts, role, status)
                OUTPUT INSERTED.user_id
                VALUES (@name, @email, @hash, 1, 0, 'ADMIN', 'ACTIVE')`);
      userId = inserted.recordset[0].user_id;
      console.log(`Đã tạo tài khoản ADMIN mới (id=${userId}).`);
    }

    // Đồng bộ bảng user_roles nếu bảng roles có mã ADMIN
    const role = await new sql.Request(tx).query(
      "SELECT role_id FROM roles WHERE role_code = 'ADMIN'",
    );
    if (role.recordset.length > 0) {
      await new sql.Request(tx)
        .input('uid', sql.Int, userId)
        .input('rid', sql.Int, role.recordset[0].role_id)
        .query(`IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = @uid AND role_id = @rid)
                  INSERT INTO user_roles (user_id, role_id) VALUES (@uid, @rid)`);
    }

    await tx.commit();
    console.log('Hoàn tất.');
  } catch (err) {
    await tx.rollback();
    console.error('Lỗi, đã rollback:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.close();
  }
})();

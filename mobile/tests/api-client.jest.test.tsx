type ApiClient = typeof import('../src/services/apiClient');

type FakeResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

const originalFetch = globalThis.fetch;
let fetchMock: jest.Mock;

function response(status: number, body: unknown, raw?: string): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => raw ?? (body === null ? '' : JSON.stringify(body)),
  };
}

function loadClient(): ApiClient {
  return require('../src/services/apiClient') as ApiClient;
}

beforeEach(() => {
  jest.resetModules();
  process.env.EXPO_PUBLIC_API_URL = 'https://api.cinehunt.test/';
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.EXPO_PUBLIC_API_URL;
  jest.useRealTimers();
});

describe('apiClient', () => {
  test('normalizes the API base URL and returns JSON', async () => {
    fetchMock.mockResolvedValue(response(200, { items: [1, 2] }));
    const client = loadClient();

    await expect(client.api('/movies')).resolves.toEqual({ items: [1, 2] });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cinehunt.test/movies',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  test('does not add JSON headers when there is no request body', async () => {
    fetchMock.mockResolvedValue(response(200, []));
    const client = loadClient();

    await client.api('/movies');

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.headers).toEqual({});
    expect(options.body).toBeUndefined();
  });

  test('sends bearer token and JSON body for writes', async () => {
    fetchMock.mockResolvedValue(response(201, { bookingId: 9 }));
    const client = loadClient();

    await client.api('/bookings', {
      method: 'POST',
      token: 'access-token',
      body: { holdIds: ['1'] },
    });

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer access-token');
    expect((options.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(options.body).toBe(JSON.stringify({ holdIds: ['1'] }));
  });

  test.each<[number, unknown, string]>([
    [400, { message: 'Dữ liệu sai' }, 'Dữ liệu sai'],
    [422, {}, 'Thông tin gửi lên chưa hợp lệ'],
    [403, { message: 'private detail' }, 'không có quyền'],
    [404, {}, 'Không tìm thấy dữ liệu'],
    [429, {}, 'thao tác quá nhanh'],
    [500, { message: 'database password' }, 'đang gặp sự cố'],
  ])('maps HTTP %i to a safe public error', async (status, body, expected) => {
    fetchMock.mockResolvedValue(response(status, body));
    const client = loadClient();

    await expect(client.api('/users/me')).rejects.toThrow(expected as string);
  });

  test('joins validation message arrays', async () => {
    fetchMock.mockResolvedValue(response(400, { message: ['Email sai', 'Thiếu tên'] }));
    const client = loadClient();

    await expect(client.api('/auth/register')).rejects.toThrow('Email sai, Thiếu tên');
  });

  test('uses login-specific 401 copy and hides backend details on business APIs', async () => {
    fetchMock
      .mockResolvedValueOnce(response(401, { message: 'internal auth trace' }))
      .mockResolvedValueOnce(response(401, {}));
    const client = loadClient();

    await expect(client.api('/users/me')).rejects.toThrow('Phiên đăng nhập đã hết hạn');
    await expect(client.api('/auth/native/login', { method: 'POST' }))
      .rejects.toThrow('Email hoặc mật khẩu không đúng');
  });

  test('uses booking conflict copy and preserves non-booking conflict detail', async () => {
    const client = loadClient();
    fetchMock.mockResolvedValueOnce(response(409, { message: 'raw deadlock' }));
    await expect(client.api('/showtime-seats/hold-many', { method: 'POST' }))
      .rejects.toThrow('tải lại trạng thái');

    fetchMock.mockResolvedValueOnce(response(409, { message: 'Tên đã tồn tại' }));
    await expect(client.api('/users', { method: 'POST' })).rejects.toThrow('Tên đã tồn tại');
  });

  test('rejects malformed JSON even when HTTP status is successful', async () => {
    fetchMock.mockResolvedValue(response(200, null, '<html>gateway error</html>'));
    const client = loadClient();

    await expect(client.api('/movies')).rejects.toThrow('dữ liệu không hợp lệ');
  });

  test('does not expose network internals', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED 10.0.0.5:3000'));
    const client = loadClient();

    await expect(client.api('/movies')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      message: 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.',
    });
  });

  test('aborts a timed-out request and reports an actionable message', async () => {
    fetchMock.mockImplementation((_url: string, options: RequestInit) => new Promise((_, reject) => {
      options.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    const client = loadClient();

    await expect(client.api('/bookings', { method: 'POST', timeout: 5 }))
      .rejects.toThrow('phản hồi quá lâu');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('refreshes an expired GET once and retries with the new access token', async () => {
    fetchMock
      .mockResolvedValueOnce(response(401, { message: 'expired' }))
      .mockResolvedValueOnce(response(200, { ok: true }));
    const client = loadClient();
    const refresh = jest.fn(async () => 'rotated-token');
    client.configureSessionRefresh(refresh);

    await expect(client.api('/users/me', { token: 'old-token' })).resolves.toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledWith('old-token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers)
      .toEqual({ Authorization: 'Bearer rotated-token' });
  });

  test('never automatically resends a write after refreshing a token', async () => {
    fetchMock.mockResolvedValue(response(401, { message: 'expired' }));
    const client = loadClient();
    client.configureSessionRefresh(async () => 'rotated-token');

    await expect(client.api('/payments', {
      method: 'POST', token: 'old-token', body: { bookingId: 'B-1' },
    })).rejects.toThrow('Vui lòng thực hiện lại thao tác');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('does not refresh authentication endpoints or unauthenticated requests', async () => {
    fetchMock.mockResolvedValue(response(401, {}));
    const client = loadClient();
    const refresh = jest.fn(async () => 'new-token');
    client.configureSessionRefresh(refresh);

    await expect(client.api('/auth/login', { method: 'POST' })).rejects.toThrow();
    await expect(client.api('/users/me')).rejects.toThrow();
    expect(refresh).not.toHaveBeenCalled();
  });

  test('fails before networking when the API URL is missing', async () => {
    process.env.EXPO_PUBLIC_API_URL = '   ';
    jest.resetModules();
    const client = loadClient();

    await expect(client.api('/movies')).rejects.toThrow('Chưa cấu hình máy chủ');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('formats VND and rejects invalid money values', () => {
    const client = loadClient();
    expect(client.formatMoney(123456)).toContain('123.456');
    expect(client.formatMoney('123456')).toContain('123.456');
    expect(client.formatMoney(null)).toBe('—');
    expect(client.formatMoney(undefined)).toBe('—');
    expect(client.formatMoney(' ')).toBe('—');
    expect(client.formatMoney('NaN')).toBe('—');
    expect(client.formatMoney(Number.MAX_SAFE_INTEGER + 1)).toBe('—');
  });

  test('formats missing and invalid dates and supports date-only output', () => {
    const client = loadClient();
    expect(client.formatDate()).toBe('Chưa cập nhật');
    expect(client.formatDate('not-a-date')).toBe('Ngày không hợp lệ');
    expect(client.formatDate('2026-01-01T00:00:00.000Z', false)).toContain('01/01/2026');
    expect(client.formatDate('2026-01-01T00:00:00.000Z')).toContain('01/01/2026');
  });

  test('future handles missing, invalid, past and future values', () => {
    const client = loadClient();
    expect(client.future(null)).toBe(false);
    expect(client.future('invalid')).toBe(false);
    expect(client.future('2000-01-01T00:00:00.000Z')).toBe(false);
    expect(client.future('2999-01-01T00:00:00.000Z')).toBe(true);
  });

  test('createKey creates distinct namespaced keys and errorMessage is defensive', () => {
    const client = loadClient();
    expect(client.createKey()).toMatch(/^cinehunt-\d+-[a-z0-9]+$/);
    expect(client.errorMessage(new Error('known error'))).toBe('known error');
    expect(client.errorMessage('raw')).toBe('Có lỗi xảy ra. Vui lòng thử lại.');
  });
});

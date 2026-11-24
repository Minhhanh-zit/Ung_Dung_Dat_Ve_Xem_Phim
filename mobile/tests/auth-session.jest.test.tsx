type AuthSession = typeof import('../src/services/authSession');

type Session = { token: string; user: { userId: number } };

const originalFetch = globalThis.fetch;
let fetchMock: jest.Mock;

function loadAuth(platform: 'ios' | 'android' | 'web' = 'ios', baseUrl = 'https://api.cinehunt.test') {
  jest.resetModules();
  process.env.EXPO_PUBLIC_API_URL = baseUrl;
  const state: {
    session: Session | null;
    refresh: string | null;
    loadSession: jest.Mock;
    loadRefreshToken: jest.Mock;
    saveSession: jest.Mock;
    saveRefreshToken: jest.Mock;
  } = {
    session: { token: 'old-access', user: { userId: 1 } },
    refresh: 'old-refresh',
    loadSession: jest.fn(async () => state.session),
    loadRefreshToken: jest.fn(async () => state.refresh),
    saveSession: jest.fn(async (value: Session | null) => { state.session = value; }),
    saveRefreshToken: jest.fn(async (value: string | null) => { state.refresh = value; }),
  };

  jest.doMock('react-native', () => ({ Platform: { OS: platform } }));
  jest.doMock('../src/store/persist', () => ({
    loadSession: state.loadSession,
    loadRefreshToken: state.loadRefreshToken,
    saveSession: state.saveSession,
    saveRefreshToken: state.saveRefreshToken,
  }));
  jest.doMock('../src/services/apiClient', () => ({
    ApiError: class ApiError extends Error {
      constructor(message: string, public readonly status: number) { super(message); }
    },
  }));

  const auth = require('../src/services/authSession') as AuthSession;
  return { auth, state };
}

beforeEach(() => {
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.EXPO_PUBLIC_API_URL;
});

describe('authSession', () => {
  test('rotates both tokens, persists before notifying subscribers', async () => {
    const { auth, state } = loadAuth();
    const order: string[] = [];
    state.saveRefreshToken.mockImplementation(async (value: string | null) => {
      state.refresh = value;
      order.push('refresh-saved');
    });
    state.saveSession.mockImplementation(async (value: Session | null) => {
      state.session = value;
      order.push('session-saved');
    });
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
    });
    auth.subscribeNativeTokenChanges(token => order.push(`notified:${token}`));

    await expect(auth.refreshNativeAccessToken('old-access')).resolves.toBe('new-access');
    expect(state.refresh).toBe('new-refresh');
    expect(state.session?.token).toBe('new-access');
    expect(order).toEqual(['refresh-saved', 'session-saved', 'notified:new-access']);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cinehunt.test/auth/native/refresh',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer old-refresh' },
      }),
    );
  });

  test('does not refresh on web or when the API URL is missing', async () => {
    const web = loadAuth('web');
    await expect(web.auth.refreshNativeAccessToken('old-access')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    const noBase = loadAuth('ios', '  ');
    await expect(noBase.auth.refreshNativeAccessToken('old-access')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('returns null when no saved session or refresh token exists', async () => {
    const noSession = loadAuth();
    noSession.state.session = null;
    await expect(noSession.auth.refreshNativeAccessToken('old-access')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    const noRefresh = loadAuth();
    noRefresh.state.refresh = null;
    await expect(noRefresh.auth.refreshNativeAccessToken('old-access')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('uses a newer session instead of refreshing an old access token', async () => {
    const { auth, state } = loadAuth();
    state.session = { token: 'new-login-token', user: { userId: 2 } };

    await expect(auth.refreshNativeAccessToken('old-access')).resolves.toBe('new-login-token');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.saveSession).not.toHaveBeenCalled();
  });

  test.each([401, 403])('clears only the expired session on HTTP %i', async status => {
    const { auth, state } = loadAuth();
    fetchMock.mockResolvedValue({ ok: false, status });
    const listener = jest.fn();
    auth.subscribeNativeTokenChanges(listener);

    await expect(auth.refreshNativeAccessToken('old-access')).resolves.toBeNull();
    expect(state.saveRefreshToken).toHaveBeenCalledWith(null);
    expect(state.saveSession).toHaveBeenCalledWith(null);
    expect(listener).toHaveBeenCalledWith(null);
  });

  test('does not clear a newer login after an old refresh is rejected', async () => {
    const { auth, state } = loadAuth();
    state.loadSession
      .mockResolvedValueOnce({ token: 'old-access', user: { userId: 1 } })
      .mockResolvedValueOnce({ token: 'new-login-token', user: { userId: 2 } });
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    await expect(auth.refreshNativeAccessToken('old-access')).resolves.toBeNull();
    expect(state.saveRefreshToken).not.toHaveBeenCalled();
    expect(state.saveSession).not.toHaveBeenCalled();
  });

  test('rejects malformed token rotation payloads', async () => {
    const { auth } = loadAuth();
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ accessToken: 'only-access' }) });

    await expect(auth.refreshNativeAccessToken('old-access'))
      .rejects.toMatchObject({ status: 0 });
  });

  test('concurrent refresh calls share one network request', async () => {
    const { auth } = loadAuth();
    let finish!: (value: unknown) => void;
    fetchMock.mockImplementation(() => new Promise(resolve => { finish = resolve; }));

    const first = auth.refreshNativeAccessToken('old-access');
    const second = auth.refreshNativeAccessToken('old-access');
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish({ ok: true, status: 200, json: async () => ({ accessToken: 'new-access', refreshToken: 'new-refresh' }) });
    await expect(Promise.all([first, second])).resolves.toEqual(['new-access', 'new-access']);
  });

  test('unsubscribe stops later token notifications', async () => {
    const { auth } = loadAuth();
    const listener = jest.fn();
    const unsubscribe = auth.subscribeNativeTokenChanges(listener);
    unsubscribe();
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    await auth.refreshNativeAccessToken('old-access');
    expect(listener).not.toHaveBeenCalled();
  });
});

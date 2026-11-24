type Persist = typeof import('../src/store/persist');

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn((key: string) => { values.delete(key); }),
  };
}

function loadPersist(platform: 'ios' | 'web' = 'ios') {
  jest.resetModules();
  const values = new Map<string, string>();
  const secureStore = {
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    deleteItemAsync: jest.fn(async (key: string) => { values.delete(key); }),
  };
  jest.doMock('react-native', () => ({ Platform: { OS: platform } }));
  jest.doMock('expo-secure-store', () => secureStore);
  const persist = require('../src/store/persist') as Persist;
  return { persist, values, secureStore };
}

describe('persist storage', () => {
  test('stores versioned native sessions and reads legacy sessions', async () => {
    const { persist, values } = loadPersist();
    const session = { token: 'jwt', user: { userId: 7 } };

    await persist.saveSession(session as never);
    expect(JSON.parse(values.get('cinehunt.session')!)).toEqual({ version: 1, data: session });
    await expect(persist.loadSession()).resolves.toEqual(session);

    values.set('cinehunt.session', JSON.stringify(session));
    await expect(persist.loadSession()).resolves.toEqual(session);
  });

  test('fails closed for corrupted, future-version and incomplete sessions', async () => {
    const { persist, values } = loadPersist();
    for (const raw of [
      '{broken',
      JSON.stringify({ version: 99, data: { token: 'secret', user: {} } }),
      JSON.stringify({ token: ' ', user: {} }),
      JSON.stringify({ token: 'jwt' }),
    ]) {
      values.set('cinehunt.session', raw);
      await expect(persist.loadSession()).resolves.toBeNull();
    }
  });

  test('deduplicates and validates favorite IDs', async () => {
    const { persist, values } = loadPersist();
    values.set('cinehunt.favorites', JSON.stringify([3, 3, -2, 'bad', 1, 1.5]));
    await expect(persist.loadFavorites()).resolves.toEqual([3, 1]);

    await persist.saveFavorites([1, 2, 2, -5, 0]);
    expect(JSON.parse(values.get('cinehunt.favorites')!)).toEqual({ version: 1, data: [1, 2] });
  });

  test('round-trips themes and falls back to light for unknown values', async () => {
    const { persist, values } = loadPersist();
    await expect(persist.loadTheme()).resolves.toBe('light');
    await persist.saveTheme('dark');
    await expect(persist.loadTheme()).resolves.toBe('dark');
    values.set('cinehunt.theme', 'sepia');
    await expect(persist.loadTheme()).resolves.toBe('light');
    values.set('cinehunt.theme', JSON.stringify({ version: 5, data: 'dark' }));
    await expect(persist.loadTheme()).resolves.toBe('light');
  });

  test('stores refresh tokens separately and clears them from SecureStore', async () => {
    const { persist, values } = loadPersist();
    await persist.saveRefreshToken('refresh-secret');
    expect(values.get('cinehunt.refresh')).toBe('refresh-secret');
    await expect(persist.loadRefreshToken()).resolves.toBe('refresh-secret');
    await persist.saveRefreshToken(null);
    await expect(persist.loadRefreshToken()).resolves.toBeNull();
  });

  test('web keeps sensitive session data in sessionStorage and preferences in localStorage', async () => {
    const sessionStorage = createMemoryStorage();
    const localStorage = createMemoryStorage();
    const oldSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    const oldLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: sessionStorage });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });

    try {
      const { persist, secureStore } = loadPersist('web');
      const session = { token: 'web-access', user: { userId: 8 } };
      await persist.saveSession(session as never);
      await persist.saveFavorites([4, 5]);
      await persist.saveTheme('dark');
      await persist.saveRefreshToken('must-not-persist-on-web');

      expect(sessionStorage.setItem).toHaveBeenCalledWith('cinehunt.session', expect.any(String));
      expect(localStorage.setItem).toHaveBeenCalledWith('cinehunt.favorites', expect.any(String));
      expect(localStorage.setItem).toHaveBeenCalledWith('cinehunt.theme', expect.any(String));
      await expect(persist.loadSession()).resolves.toEqual(session);
      await expect(persist.loadFavorites()).resolves.toEqual([4, 5]);
      await expect(persist.loadTheme()).resolves.toBe('dark');
      await expect(persist.loadRefreshToken()).resolves.toBeNull();
      expect(secureStore.setItemAsync).not.toHaveBeenCalled();
    } finally {
      if (oldSession) Object.defineProperty(globalThis, 'sessionStorage', oldSession);
      else Reflect.deleteProperty(globalThis, 'sessionStorage');
      if (oldLocal) Object.defineProperty(globalThis, 'localStorage', oldLocal);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});

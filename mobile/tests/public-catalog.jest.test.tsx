type PublicCatalog = typeof import('../src/cinehunt/publicCatalog');

function loadCatalog() {
  jest.resetModules();
  jest.doMock('../src/services/apiClient', () => ({ api: jest.fn() }));
  const client = require('../src/services/apiClient') as { api: jest.Mock };
  const catalog = require('../src/cinehunt/publicCatalog') as PublicCatalog;
  return { catalog, api: client.api };
}

describe('loadPublicCatalog', () => {
  test('loads a single page and returns the backend total', async () => {
    const { catalog, api } = loadCatalog();
    api.mockResolvedValueOnce({ items: [{ movieId: 1 }], total: 1 });

    await expect(catalog.loadPublicCatalog()).resolves.toEqual({
      items: [{ movieId: 1 }], total: 1,
    });
    expect(api).toHaveBeenCalledWith('/movies/catalog?page=1&limit=50');
  });

  test('loads all pages until the backend total is reached', async () => {
    const { catalog, api } = loadCatalog();
    api
      .mockResolvedValueOnce({ items: [{ movieId: 1 }], total: 2 })
      .mockResolvedValueOnce({ items: [{ movieId: 2 }], total: 2 });

    await expect(catalog.loadPublicCatalog()).resolves.toEqual({
      items: [{ movieId: 1 }, { movieId: 2 }], total: 2,
    });
    expect(api).toHaveBeenNthCalledWith(2, '/movies/catalog?page=2&limit=50');
  });

  test('rejects malformed catalogue payloads', async () => {
    const { catalog, api } = loadCatalog();
    api.mockResolvedValueOnce({ items: 'not-an-array', total: 1 });

    await expect(catalog.loadPublicCatalog()).rejects.toThrow('Danh mục phim không hợp lệ');
  });

  test('rejects a catalogue page that makes no progress', async () => {
    const { catalog, api } = loadCatalog();
    api.mockResolvedValueOnce({ items: [], total: 1 });

    await expect(catalog.loadPublicCatalog()).rejects.toThrow('Danh mục phim thay đổi');
  });

  test('stops after 100 pages rather than looping indefinitely', async () => {
    const { catalog, api } = loadCatalog();
    api.mockResolvedValue({ items: [{ movieId: 1 }], total: 101 });

    await expect(catalog.loadPublicCatalog()).rejects.toThrow('Danh mục phim quá lớn');
    expect(api).toHaveBeenCalledTimes(100);
  });
});

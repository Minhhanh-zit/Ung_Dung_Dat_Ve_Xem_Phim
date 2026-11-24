import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import Discover from '../src/cinehunt/Discover';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('../src/services/apiClient', () => ({
  api: jest.fn(),
  errorMessage: (error: unknown) => error instanceof Error ? error.message : 'Lỗi',
  formatMoney: (value: number) => `${value}đ`,
}));

jest.mock('../src/cinehunt/publicCatalog', () => ({ loadPublicCatalog: jest.fn() }));
jest.mock('../src/cinehunt/CinemaSchedule', () => ({
  __esModule: true,
  default: ({ cinemas }: { cinemas: { cinemaId: number; cinemaName: string }[] }) => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return React.createElement(View, null, React.createElement(Text, null, 'Cinema schedule test'),
      ...cinemas.map(cinema => React.createElement(Text, { key: cinema.cinemaId }, cinema.cinemaName)));
  },
}));

jest.mock('../src/cinehunt/theme', () => ({
  useCineHuntTheme: () => ({
    C: {
      bg: '#fff', purple: '#75a', stroke: '#ddd', panel: '#fff', panel2: '#f5f5f5',
      lavender: '#eee', heroCyan: '#0aa', hero: '#fff', cyan: '#0aa', green: '#0a8',
      muted: '#666', white: '#111', iconA: '#eee', iconB: '#ddd',
    },
    S: { title: {}, muted: {}, card: {} },
  }),
}));

jest.mock('../src/cinehunt/icons', () => ({ AppIcon: () => null }));

jest.mock('../src/cinehunt/ui', () => {
  const React = require('react');
  const ReactNative = require('react-native');
  const Text = ReactNative.Text;
  const View = ReactNative.View;
  const Pressable = ReactNative.Pressable;
  return {
    Button: ({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) =>
      React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: title, disabled, onPress }, React.createElement(Text, null, title)),
    FilmArt: ({ movie }: { movie: { title: string } }) => React.createElement(Text, null, `Poster:${movie.title}`),
    GlowPanel: ({ children, style }: { children: React.ReactNode; style?: object }) => React.createElement(View, { style }, children),
    Kicker: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children),
    Loader: () => React.createElement(Text, null, 'Loading discover'),
    Notice: ({ text, bad }: { text: string; bad?: boolean }) => React.createElement(Text, { accessibilityRole: bad ? 'alert' : undefined }, text),
    SectionHeading: ({ title, subtitle }: { title: string; subtitle?: string }) =>
      React.createElement(View, null, React.createElement(Text, null, title), subtitle ? React.createElement(Text, null, subtitle) : null),
    SimpleScroll: ({ children, refreshing, onRefresh }: { children: React.ReactNode; refreshing?: boolean; onRefresh?: () => void }) =>
      React.createElement(ReactNative.ScrollView, { refreshControl: onRefresh ? React.createElement(ReactNative.RefreshControl, { refreshing: !!refreshing, onRefresh }) : undefined }, children),
  };
});

const client = require('../src/services/apiClient') as { api: jest.Mock };
const catalog = require('../src/cinehunt/publicCatalog') as { loadPublicCatalog: jest.Mock };
const Location = require('expo-location') as {
  requestForegroundPermissionsAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
};

const cinemas = [
  { cinemaId: 1, cinemaName: 'CineHunt Cầu Giấy', address: '11 Duy Tân', latitude: 21.0309, longitude: 105.7828 },
  { cinemaId: 2, cinemaName: 'CineHunt Hà Đông', address: '2 Trần Phú', latitude: 20.9801, longitude: 105.7909 },
  { cinemaId: 3, cinemaName: 'CineHunt Thanh Xuân', address: '2 Lê Văn Thiêm', latitude: 21.0022, longitude: 105.80277 },
];

function setupApi() {
  client.api.mockImplementation((path: string) => {
    if (path === '/cinemas') return Promise.resolve(cinemas);
    if (path === '/concession-combos') return Promise.resolve([{ comboId: 1, comboName: 'Combo đôi', price: 99000 }]);
    if (path === '/recommendations?limit=10') return Promise.resolve({ items: [], source: 'FALLBACK' });
    return Promise.reject(new Error(`Unexpected API path: ${path}`));
  });
  catalog.loadPublicCatalog.mockResolvedValue({
    items: [{ movieId: 9, title: 'Phim yêu thích', posterUrl: null }], total: 1,
  });
}

describe('Discover screen', () => {
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => {
    client.api.mockReset();
    catalog.loadPublicCatalog.mockReset();
    Location.requestForegroundPermissionsAsync.mockReset();
    Location.getCurrentPositionAsync.mockReset();
  });

  test('loads pilot cinemas, combos, favorites and schedule', async () => {
    setupApi();
    const ui = await render(<Discover token={null} favorites={[9]} onOpen={jest.fn()} onAuth={jest.fn()} onSeats={jest.fn()} />);

    await waitFor(() => expect(ui.getByText('CineHunt Cầu Giấy')).toBeTruthy());
    expect(ui.getByText('CineHunt Hà Đông')).toBeTruthy();
    expect(ui.getByText('CineHunt Thanh Xuân')).toBeTruthy();
    expect(ui.getByText('Combo đôi')).toBeTruthy();
    expect(ui.getByText('Poster:Phim yêu thích')).toBeTruthy();
    expect(ui.getByText('Cinema schedule test')).toBeTruthy();
    expect(ui.getByText('Đăng nhập để nhận gợi ý')).toBeTruthy();
  });

  test('shows permission feedback when GPS access is denied', async () => {
    setupApi();
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const ui = await render(<Discover token={null} favorites={[]} onOpen={jest.fn()} onAuth={jest.fn()} onSeats={jest.fn()} />);

    await waitFor(() => expect(ui.getByText('Combo đôi')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('Tìm rạp gần tôi bằng GPS'));
    await waitFor(() => expect(ui.getByText('Bạn chưa cấp quyền vị trí.')).toBeTruthy());
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  test('sorts nearby cinemas using the granted GPS location and opens directions', async () => {
    setupApi();
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 21.002, longitude: 105.802 } });
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const ui = await render(<Discover token={null} favorites={[]} onOpen={jest.fn()} onAuth={jest.fn()} onSeats={jest.fn()} />);

    await waitFor(() => expect(ui.getByText('Combo đôi')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('Tìm rạp gần tôi bằng GPS'));
    await waitFor(() => expect(ui.getAllByText('Nhấn Chỉ đường để xem km đi xe thực tế')).toHaveLength(3));
    expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
    expect(ui.getAllByLabelText(/^Xem vị trí /)[0].props.accessibilityLabel).toBe('Xem vị trí CineHunt Thanh Xuân');
    await fireEvent.press(ui.getByLabelText('Xem vị trí CineHunt Thanh Xuân'));
    await waitFor(() => expect(openURL).toHaveBeenCalledWith(expect.stringContaining('travelmode=driving')));
    openURL.mockRestore();
  });

  test('shows partial-data errors without discarding other successful sections', async () => {
    client.api.mockImplementation((path: string) => {
      if (path === '/cinemas') return Promise.reject(new Error('Cinema API offline'));
      if (path === '/concession-combos') return Promise.resolve([{ comboId: 2, comboName: 'Combo vẫn tải', price: 50000 }]);
      return Promise.reject(new Error(`Unexpected API path: ${path}`));
    });
    catalog.loadPublicCatalog.mockResolvedValue({ items: [], total: 0 });
    const ui = await render(<Discover token={null} favorites={[]} onOpen={jest.fn()} onAuth={jest.fn()} onSeats={jest.fn()} />);

    await waitFor(() => expect(ui.getByText(/Chưa tải được dữ liệu rạp/)).toBeTruthy());
    expect(ui.getByText('Combo vẫn tải')).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('Tìm rạp gần tôi bằng GPS'));
    await waitFor(() => expect(ui.getByText(/Chưa tải được danh sách rạp từ Backend/)).toBeTruthy());
  });
});

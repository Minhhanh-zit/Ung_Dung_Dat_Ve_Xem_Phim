import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import Movies from '../src/cinehunt/Movies';

jest.mock('../src/services/apiClient', () => ({
  api: jest.fn(),
  errorMessage: (error: unknown) => error instanceof Error ? error.message : 'Lỗi',
  formatDate: () => '01/01/2027 19:00',
  formatMoney: (value: number) => `${value}đ`,
}));

jest.mock('../src/cinehunt/publicCatalog', () => ({ loadPublicCatalog: jest.fn() }));
jest.mock('../src/cinehunt/cinemaScope', () => ({ isCoreShowtime: jest.fn(() => true) }));
jest.mock('../src/cinehunt/icons', () => ({ AppIcon: () => null }));

jest.mock('../src/cinehunt/theme', () => ({
  useCineHuntTheme: () => ({
    C: {
      title: '#111', bg: '#fff', purple: '#75a', panel: '#fff', stroke: '#ddd',
      hero: '#fff', muted: '#666', white: '#111', soft: '#777', red: '#a22',
      cyan: '#0aa', green: '#0a8',
    },
    S: { title: {}, muted: {}, card: {} },
  }),
}));

jest.mock('../src/cinehunt/ui', () => {
  const React = require('react');
  const ReactNative = require('react-native');
  const Text = ReactNative.Text;
  const View = ReactNative.View;
  const Pressable = ReactNative.Pressable;
  return {
    Button: ({ title, onPress }: { title: string; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityRole: 'button', onPress }, React.createElement(Text, null, title)),
    FilmArt: ({ movie }: { movie: { title: string } }) => React.createElement(Text, null, `Poster:${movie.title}`),
    GlowPanel: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
    Kicker: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children),
    Loader: () => React.createElement(Text, null, 'Loading movies'),
    Notice: ({ text }: { text: string }) => React.createElement(Text, null, text),
    SectionHeading: ({ title, subtitle }: { title: string; subtitle?: string }) =>
      React.createElement(View, null, React.createElement(Text, null, title), subtitle ? React.createElement(Text, null, subtitle) : null),
    SimpleScroll: ({ children }: { children: React.ReactNode }) => React.createElement(ReactNative.ScrollView, null, children),
  };
});

const { loadPublicCatalog } = require('../src/cinehunt/publicCatalog') as { loadPublicCatalog: jest.Mock };

const movies = [
  { movieId: 1, title: 'Phim đang chiếu', status: 'NOW_SHOWING', durationMinutes: 120, ageRating: 'T13', genres: [{ genreName: 'Drama' }], hasEarlyShowtime: true },
  { movieId: 2, title: 'Phim sắp chiếu', status: 'COMING_SOON', durationMinutes: 100, ageRating: 'P', genres: [], hasEarlyShowtime: false },
  { movieId: 3, title: 'Phim thứ ba', status: 'NOW_SHOWING', durationMinutes: 90, ageRating: 'T16', genres: [], hasEarlyShowtime: false },
];

describe('Movies screen', () => {
  beforeEach(() => loadPublicCatalog.mockReset());

  test('loads movies, filters by status, searches and toggles favorites', async () => {
    loadPublicCatalog.mockResolvedValue({ items: movies, total: 3 });
    const onOpen = jest.fn();
    const onToggleFav = jest.fn();
    const ui = await render(
      <Movies mode="list" favorites={[]} onToggleFav={onToggleFav} onOpen={onOpen} />,
    );

    await waitFor(() => expect(ui.getByLabelText('Xem phim Phim đang chiếu')).toBeTruthy());
    expect(ui.getByLabelText('Xem phim Phim thứ ba')).toBeTruthy();
    expect(ui.queryByLabelText('Xem phim Phim sắp chiếu')).toBeNull();

    await fireEvent.press(ui.getByText('SẮP CHIẾU'));
    expect(ui.getByLabelText('Xem phim Phim sắp chiếu')).toBeTruthy();
    expect(ui.queryByLabelText('Xem phim Phim thứ ba')).toBeNull();

    await fireEvent.press(ui.getByText('SUẤT CHIẾU SỚM'));
    expect(ui.getByLabelText('Xem phim Phim đang chiếu')).toBeTruthy();
    expect(ui.queryByLabelText('Xem phim Phim thứ ba')).toBeNull();

    await fireEvent.press(ui.getByText('ĐANG CHIẾU'));
    await fireEvent.changeText(ui.getByLabelText('Tìm phim'), 'không tồn tại');
    expect(ui.getByText('Không có phim phù hợp với bộ lọc này. Hãy thử mục khác.')).toBeTruthy();

    await fireEvent.changeText(ui.getByLabelText('Tìm phim'), 'đang chiếu');
    await fireEvent.press(ui.getByLabelText('Khám phá phim Phim đang chiếu'));
    expect(onOpen).toHaveBeenCalledWith(movies[0]);
    await fireEvent.press(ui.getByLabelText('Yêu thích Phim đang chiếu'));
    expect(onToggleFav).toHaveBeenCalledWith(1);
  });

  test('shows an empty early-showtime message and supports retry', async () => {
    loadPublicCatalog.mockResolvedValue({ items: [], total: 0 });
    const ui = await render(
      <Movies mode="list" favorites={[]} onToggleFav={jest.fn()} onOpen={jest.fn()} />,
    );

    await waitFor(() => expect(ui.getByText('Không có phim phù hợp với bộ lọc này. Hãy thử mục khác.')).toBeTruthy());
    await fireEvent.press(ui.getByText('SUẤT CHIẾU SỚM'));
    expect(ui.getByText('Chưa tìm thấy suất chiếu mở bán trước ngày khởi chiếu trong dữ liệu hiện có.')).toBeTruthy();
    await fireEvent.press(ui.getByText('Tải lại danh sách phim'));
    await waitFor(() => expect(loadPublicCatalog).toHaveBeenCalledTimes(2));
  });

  test('shows a readable error when the public catalogue fails', async () => {
    loadPublicCatalog.mockRejectedValue(new Error('Backend unavailable'));
    const ui = await render(
      <Movies mode="list" favorites={[]} onToggleFav={jest.fn()} onOpen={jest.fn()} />,
    );

    await waitFor(() => expect(ui.getByText('Backend unavailable')).toBeTruthy());
  });
});

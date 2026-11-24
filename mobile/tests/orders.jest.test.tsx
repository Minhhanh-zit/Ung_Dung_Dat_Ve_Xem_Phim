import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import Orders from '../src/cinehunt/Orders';

jest.mock('../src/services/apiClient', () => ({
  api: jest.fn(),
  errorMessage: (error: unknown) => error instanceof Error ? error.message : 'Lỗi',
  formatDate: () => '01/01/2027 19:00',
  formatMoney: (value: number) => `${value}đ`,
}));

jest.mock('../src/cinehunt/theme', () => ({
  useCineHuntTheme: () => ({
    C: {
      lavender: '#eee', hero: '#fff', heroGreen: '#0a8', cyan: '#0aa',
      green: '#0a8', orange: '#f90', cancelBar: '#999', purple: '#75a',
      bg: '#fff', panel: '#fff', panel2: '#f5f5f5', stroke: '#ddd', muted: '#666', white: '#111',
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
      React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: title, disabled, onPress },
        React.createElement(Text, null, title)),
    GlowPanel: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
    Kicker: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children),
    Loader: () => React.createElement(Text, null, 'Loading'),
    Notice: ({ text, bad }: { text: string; bad?: boolean }) => React.createElement(Text, { accessibilityRole: bad ? 'alert' : undefined }, text),
    SectionHeading: ({ title, subtitle }: { title: string; subtitle?: string }) =>
      React.createElement(View, null, React.createElement(Text, null, title), subtitle ? React.createElement(Text, null, subtitle) : null),
    SimpleScroll: ({ children }: { children: React.ReactNode }) => React.createElement(ReactNative.ScrollView, null, children),
    StatusPill: ({ status }: { status: string }) => React.createElement(Text, null, status),
  };
});

const { api } = require('../src/services/apiClient') as { api: jest.Mock };

const bookings = [
  {
    bookingId: 11, bookingCode: 'BK-11', status: 'PAID', totalAmount: 180000,
    showtimeId: 1, showtime: { movie: { title: 'Phim đã thanh toán' }, startTime: '2027-01-01T12:00:00Z' },
  },
  {
    bookingId: 12, bookingCode: 'BK-12', status: 'PENDING_PAYMENT', totalAmount: 90000,
    showtimeId: 2, showtime: { movie: { title: 'Phim chờ thanh toán' }, startTime: '2027-01-02T12:00:00Z' },
  },
  {
    bookingId: 13, bookingCode: 'BK-13', status: 'EXPIRED', totalAmount: 70000,
    showtimeId: 3, showtime: { movie: { title: 'Phim hết hạn' }, startTime: '2027-01-03T12:00:00Z' },
  },
];

describe('Orders screen', () => {
  beforeEach(() => api.mockReset());

  test('asks guests to sign in without calling the booking API', async () => {
    const onAuth = jest.fn();
    const ui = await render(<Orders token={null} revision={0} onOpen={jest.fn()} onAuth={onAuth} />);
    await fireEvent.press(ui.getByText('Đăng nhập để xem vé'));
    expect(onAuth).toHaveBeenCalledTimes(1);
    expect(api).not.toHaveBeenCalled();
  });

  test('loads bookings and filters paid, active and cancelled orders', async () => {
    api.mockResolvedValue(bookings);
    const onOpen = jest.fn();
    const ui = await render(<Orders token="access-token" revision={0} onOpen={onOpen} onAuth={jest.fn()} />);

    await waitFor(() => expect(ui.getByText('Phim đã thanh toán')).toBeTruthy());
    expect(ui.getByText('Phim chờ thanh toán')).toBeTruthy();
    expect(ui.getByText('Phim hết hạn')).toBeTruthy();

    await fireEvent.press(ui.getByRole('button', { name: 'Đã thanh toán' }));
    expect(ui.getByText('Phim đã thanh toán')).toBeTruthy();
    expect(ui.queryByText('Phim chờ thanh toán')).toBeNull();

    await fireEvent.press(ui.getByRole('button', { name: 'Chờ thanh toán' }));
    expect(ui.getByText('Phim chờ thanh toán')).toBeTruthy();
    expect(ui.queryByText('Phim đã thanh toán')).toBeNull();

    await fireEvent.press(ui.getByRole('button', { name: 'Đã hủy' }));
    expect(ui.getByText('Phim hết hạn')).toBeTruthy();
    expect(ui.queryByText('Phim chờ thanh toán')).toBeNull();
    expect(api).toHaveBeenCalledWith('/bookings/my', { token: 'access-token' });
  });

  test('shows a friendly error when history cannot be loaded', async () => {
    api.mockRejectedValue(new Error('Mất kết nối'));
    const ui = await render(<Orders token="access-token" revision={0} onOpen={jest.fn()} onAuth={jest.fn()} />);

    await waitFor(() => expect(ui.getByText('Mất kết nối')).toBeTruthy());
  });
});

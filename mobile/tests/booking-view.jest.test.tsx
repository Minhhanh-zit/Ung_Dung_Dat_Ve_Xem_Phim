import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import BookingView from '../src/cinehunt/BookingView';

jest.mock('../src/services/apiClient', () => ({
  api: jest.fn(),
  ApiError: jest.requireActual('../src/services/apiClient').ApiError,
  errorMessage: (error: unknown) => error instanceof Error ? error.message : 'Lỗi',
  formatDate: () => '01/01/2027 19:00',
  formatMoney: (value: number) => `${value}đ`,
}));

jest.mock('react-native-qrcode-svg', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ value }: { value: string }) => React.createElement(Text, null, `QR:${value}`) };
});

jest.mock('../src/cinehunt/theme', () => ({
  useCineHuntTheme: () => ({
    C: {
      lavender: '#eee', hero: '#fff', heroGreen: '#0a8', heroCyan: '#0aa',
      cyan: '#0aa', green: '#0a8', purple: '#75a', bg: '#fff', panel: '#fff',
      panel2: '#f5f5f5', stroke: '#ddd', muted: '#666', white: '#111',
    },
    S: { title: {}, muted: {}, card: {}, h2: {} },
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

const client = require('../src/services/apiClient') as {
  api: jest.Mock;
  ApiError: new (message: string, status: number) => Error & { status: number };
};

const pendingBooking = {
  bookingId: 'B-1', bookingCode: 'CH-B-1', status: 'PENDING_PAYMENT',
  totalAmount: 180000, seatCount: 2, showtimeId: 31,
  showtime: { movie: { title: 'Phim đang chờ thanh toán' } },
};

const paidBooking = {
  bookingId: 'B-2', bookingCode: 'CH-B-2', status: 'PAID',
  totalAmount: 180000, seatCount: 2, showtimeId: 32,
  showtime: { movie: { title: 'Phim đã thanh toán' } },
};

function mockPendingBooking() {
  client.api.mockImplementation(async (path: string) => {
    if (path === '/bookings/B-1') return pendingBooking;
    if (path === '/payments/methods') return [
      { code: 'BANKING', name: 'Chuyển khoản', enabled: true },
      { code: 'CASH', name: 'Tiền mặt', enabled: false },
    ];
    if (path === '/payments/booking/B-1') throw new client.ApiError('not found', 404);
    throw new Error(`Unexpected API path: ${path}`);
  });
}

describe('BookingView', () => {
  beforeEach(() => client.api.mockReset());

  test('asks a guest to authenticate before showing an order', async () => {
    const onAuth = jest.fn();
    const ui = await render(
      <BookingView bookingId="B-1" token={null} onAuth={onAuth} onCancelled={jest.fn()} onTickets={jest.fn()} />,
    );
    await fireEvent.press(ui.getByText('Đăng nhập'));
    expect(onAuth).toHaveBeenCalledTimes(1);
    expect(client.api).not.toHaveBeenCalled();
  });

  test('loads the pending booking and only displays enabled payment methods', async () => {
    mockPendingBooking();
    const ui = await render(
      <BookingView bookingId="B-1" token="access-token" onAuth={jest.fn()} onCancelled={jest.fn()} onTickets={jest.fn()} />,
    );

    await waitFor(() => expect(ui.getByText('Tạo giao dịch chờ xác nhận')).toBeTruthy());
    expect(ui.getByText('Phim đang chờ thanh toán')).toBeTruthy();
    expect(ui.getByText('Chuyển khoản')).toBeTruthy();
    expect(ui.queryByText('Tiền mặt')).toBeNull();
    expect(ui.getByText('Tạo giao dịch chờ xác nhận')).toBeTruthy();
    expect(ui.getByText('Đơn chưa thanh toán thành công nên chưa có vé QR.')).toBeTruthy();
  });

  test('shows a payment already created without claiming it was paid', async () => {
    client.api.mockImplementation(async (path: string) => {
      if (path === '/bookings/B-1') return pendingBooking;
      if (path === '/payments/methods') return [{ code: 'BANKING', name: 'Chuyển khoản', enabled: true }];
      if (path === '/payments/booking/B-1') return {
        paymentId: 5, paymentMethod: 'BANKING', paymentStatus: 'PENDING', transactionCode: 'TX-5',
      };
      throw new Error(`Unexpected API path: ${path}`);
    });
    const ui = await render(
      <BookingView bookingId="B-1" token="access-token" onAuth={jest.fn()} onCancelled={jest.fn()} onTickets={jest.fn()} />,
    );

    await waitFor(() => expect(ui.getByText('Đã ghi nhận yêu cầu thanh toán. Chưa có xác nhận đã nhận tiền.')).toBeTruthy());
    expect(ui.getByText('Giao dịch: TX-5')).toBeTruthy();
    expect(ui.queryByText('Tạo giao dịch chờ xác nhận')).toBeNull();
  });

  test('renders QR tickets only after a paid booking is confirmed by the API', async () => {
    client.api.mockImplementation(async (path: string) => {
      if (path === '/bookings/B-2') return paidBooking;
      if (path === '/payments/methods') return [];
      if (path === '/payments/booking/B-2') throw new client.ApiError('not found', 404);
      if (path === '/bookings/B-2/tickets') return [{
        ticketId: 90, movieTitle: 'Phim đã thanh toán', showDate: '01/01/2027',
        showTime: '19:00', seatCode: 'A1', qrCode: 'QR-SECRET',
        ticketCode: 'TICKET-90', ticketStatus: 'ISSUED',
      }];
      throw new Error(`Unexpected API path: ${path}`);
    });
    const ui = await render(
      <BookingView bookingId="B-2" token="access-token" ticketsOnly onAuth={jest.fn()} onCancelled={jest.fn()} onTickets={jest.fn()} />,
    );

    await waitFor(() => expect(ui.getByText('QR:QR-SECRET')).toBeTruthy());
    expect(ui.getByText('TICKET-90')).toBeTruthy();
    expect(ui.getByText('Phim đã thanh toán')).toBeTruthy();
  });

  test('shows a warning if a paid booking has no ticket records', async () => {
    client.api.mockImplementation(async (path: string) => {
      if (path === '/bookings/B-2') return paidBooking;
      if (path === '/payments/methods') return [];
      if (path === '/payments/booking/B-2') throw new client.ApiError('not found', 404);
      if (path === '/bookings/B-2/tickets') return [];
      throw new Error(`Unexpected API path: ${path}`);
    });
    const ui = await render(
      <BookingView bookingId="B-2" token="access-token" ticketsOnly onAuth={jest.fn()} onCancelled={jest.fn()} onTickets={jest.fn()} />,
    );

    await waitFor(() => expect(ui.getByText('Đơn đã thanh toán nhưng Backend chưa trả vé. Hãy kiểm tra lại.')).toBeTruthy());
  });
});

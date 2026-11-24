import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ChatAssistant from '../src/cinehunt/ChatAssistant';

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children, visible }: { children: React.ReactNode; visible: boolean }) =>
      visible ? React.createElement(require('react-native').View, null, children) : null,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { SafeAreaView: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children) };
});

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('../src/services/apiClient', () => ({
  api: jest.fn(),
  errorMessage: (error: unknown) => error instanceof Error ? error.message : 'Lỗi',
}));

jest.mock('../src/cinehunt/theme', () => ({
  useCineHuntTheme: () => ({
    C: {
      bg: '#fff', stroke: '#ddd', purple: '#75a', muted: '#666', white: '#111',
      panel: '#fff', cyan: '#0aa',
    },
  }),
  ThemeTransitionVeil: () => null,
}));

jest.mock('../src/cinehunt/icons', () => ({ AppIcon: () => null }));

const { api } = require('../src/services/apiClient') as { api: jest.Mock };
const Location = require('expo-location') as {
  requestForegroundPermissionsAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
};

describe('ChatAssistant', () => {
  beforeEach(() => {
    api.mockReset();
    Location.requestForegroundPermissionsAsync.mockReset();
    Location.getCurrentPositionAsync.mockReset();
  });

  test('asks guests to sign in and supports closing the assistant', async () => {
    const onAuth = jest.fn();
    const onClose = jest.fn();
    const ui = await render(<ChatAssistant visible token={null} onAuth={onAuth} onClose={onClose} />);

    await fireEvent.press(ui.getByText('Đăng nhập để trò chuyện'));
    expect(onAuth).toHaveBeenCalledTimes(1);
    await fireEvent.press(ui.getByLabelText('Đóng cửa sổ chat'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(api).not.toHaveBeenCalled();
  });

  test('requires GPS permission for nearest-cinema requests without a named place', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const ui = await render(<ChatAssistant visible token="access-token" onAuth={jest.fn()} onClose={jest.fn()} />);

    await fireEvent.press(ui.getByLabelText('Tìm rạp gần tôi'));
    await waitFor(() => expect(ui.getByText(/Cần cho phép vị trí để tìm rạp gần bạn/)).toBeTruthy());
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });

  test('uses a named location rather than requesting the phone GPS', async () => {
    api.mockResolvedValue({
      method: 'STRAIGHT_LINE',
      note: 'Khoảng cách ước tính',
      cinemas: [{
        cinemaId: 1, cinemaName: 'CineHunt Thanh Xuân', address: '2 Lê Văn Thiêm',
        ward: 'Phường Thanh Xuân', distanceKm: 1.25, durationMinutes: null,
        mapsUrl: 'https://www.google.com/maps/dir/?api=1&destination=21,105',
      }],
    });
    const ui = await render(<ChatAssistant visible token="access-token" onAuth={jest.fn()} onClose={jest.fn()} />);

    await fireEvent.changeText(ui.getByLabelText('Nhập tin nhắn cho CineHunt AI'), 'Tìm rạp gần Tân Mai');
    await fireEvent.press(ui.getByLabelText('Gửi tin nhắn'));

    await waitFor(() => expect(ui.getByText('Rạp gần nhất theo vị trí GPS')).toBeTruthy());
    expect(api).toHaveBeenCalledWith('/cinemas/nearest', {
      token: 'access-token',
      method: 'POST',
      body: { originAddress: 'Khu vực Tân Mai, Hoàng Mai, Hà Nội, Việt Nam' },
      timeout: 25000,
    });
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(ui.getByText(/^CineHunt Thanh Xuân · /)).toBeTruthy();
    expect(ui.getByText('Chỉ đường · CineHunt Thanh Xuân')).toBeTruthy();
    expect(ui.queryByText(/Kết quả theo vị trí điện thoại hiện tại/)).toBeNull();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  test('sends normal questions to the chat endpoint and validates the response', async () => {
    api.mockResolvedValueOnce({ reply: 'Bạn có thể xem phim đang chiếu.' });
    const ui = await render(<ChatAssistant visible token="access-token" onAuth={jest.fn()} onClose={jest.fn()} />);

    await fireEvent.changeText(ui.getByLabelText('Nhập tin nhắn cho CineHunt AI'), 'Tư vấn phim hôm nay');
    await fireEvent.press(ui.getByLabelText('Gửi tin nhắn'));
    await waitFor(() => expect(ui.getByText('Bạn có thể xem phim đang chiếu.')).toBeTruthy());
    expect(api).toHaveBeenCalledWith('/chat', expect.objectContaining({
      token: 'access-token', method: 'POST', timeout: 30000,
    }));
  });

  test('shows an error and offers retry when the assistant endpoint fails', async () => {
    api.mockRejectedValue(new Error('Backend tạm ngắt'));
    const ui = await render(<ChatAssistant visible token="access-token" onAuth={jest.fn()} onClose={jest.fn()} />);

    await fireEvent.changeText(ui.getByLabelText('Nhập tin nhắn cho CineHunt AI'), 'Tư vấn phim');
    await fireEvent.press(ui.getByLabelText('Gửi tin nhắn'));
    await waitFor(() => expect(ui.getByText(/Backend tạm ngắt/)).toBeTruthy());
    expect(ui.getByText('Thử gửi lại')).toBeTruthy();
  });
});

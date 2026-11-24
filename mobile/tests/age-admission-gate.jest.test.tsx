import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AgeAdmissionGate from '../src/cinehunt/AgeAdmissionGate';

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children, visible }: { children: React.ReactNode; visible: boolean }) =>
      visible ? React.createElement(require('react-native').View, null, children) : null,
  };
});

jest.mock('../src/services/apiClient', () => ({
  api: jest.fn(),
  errorMessage: (error: unknown) => error instanceof Error ? error.message : 'Lỗi',
}));

jest.mock('../src/cinehunt/theme', () => ({
  useCineHuntTheme: () => ({
    C: { panel: '#fff', stroke: '#ddd', purple: '#75a', bg: '#fff', white: '#111' },
    S: { title: {}, h2: {}, muted: {} },
  }),
}));

jest.mock('../src/cinehunt/ui', () => {
  const React = require('react');
  const ReactNative = require('react-native');
  const Text = ReactNative.Text;
  const Pressable = ReactNative.Pressable;
  return {
    Button: ({ title, onPress }: { title: string; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityRole: 'button', onPress }, React.createElement(Text, null, title)),
    Loader: () => React.createElement(Text, null, 'Loading policy'),
    Notice: ({ text }: { text: string }) => React.createElement(Text, null, text),
    SimpleScroll: ({ children }: { children: React.ReactNode }) => React.createElement(ReactNative.ScrollView, null, children),
  };
});

const { api } = require('../src/services/apiClient') as { api: jest.Mock };

const policy = (action: 'ALLOW' | 'CONFIRM' | 'BLOCK') => ({
  showtimeId: 31,
  movieId: 7,
  movieTitle: 'Phim giới hạn độ tuổi',
  rating: 'T18',
  action,
  message: 'Vui lòng xác nhận điều kiện độ tuổi.',
  confirmLabel: action === 'CONFIRM' ? 'Tôi đã đủ tuổi' : null,
});

describe('AgeAdmissionGate', () => {
  beforeEach(() => api.mockReset());

  test('allows the seat flow only after backend returns ALLOW', async () => {
    api.mockResolvedValue(policy('ALLOW'));
    const ui = await render(
      <AgeAdmissionGate showtimeId={31} movieId={7} onBack={jest.fn()}>
        <Text>Seat map allowed</Text>
      </AgeAdmissionGate>,
    );

    await waitFor(() => expect(ui.getByText('Seat map allowed')).toBeTruthy());
    expect(api).toHaveBeenCalledWith('/showtimes/31/age-policy');
  });

  test('requires explicit confirmation for CONFIRM policy', async () => {
    api.mockResolvedValue(policy('CONFIRM'));
    const ui = await render(
      <AgeAdmissionGate showtimeId={31} movieId={7} onBack={jest.fn()}>
        <Text>Seat map allowed</Text>
      </AgeAdmissionGate>,
    );

    await waitFor(() => expect(ui.getByText('Tôi đã đủ tuổi')).toBeTruthy());
    expect(ui.queryByText('Seat map allowed')).toBeNull();
    await fireEvent.press(ui.getByText('Tôi đã đủ tuổi'));
    await waitFor(() => expect(ui.getByText('Seat map allowed')).toBeTruthy());
  });

  test('blocks access when the policy is BLOCK', async () => {
    api.mockResolvedValue(policy('BLOCK'));
    const onBack = jest.fn();
    const ui = await render(
      <AgeAdmissionGate showtimeId={31} movieId={7} onBack={onBack}>
        <Text>Seat map allowed</Text>
      </AgeAdmissionGate>,
    );

    await waitFor(() => expect(ui.getByText('Vui lòng xác nhận điều kiện độ tuổi.')).toBeTruthy());
    expect(ui.queryByText('Seat map allowed')).toBeNull();
    await fireEvent.press(ui.getByText('Quay lại'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('rejects mismatched showtime or movie policy responses', async () => {
    api.mockResolvedValue({ ...policy('ALLOW'), movieId: 99 });
    const ui = await render(
      <AgeAdmissionGate showtimeId={31} movieId={7} onBack={jest.fn()}>
        <Text>Seat map allowed</Text>
      </AgeAdmissionGate>,
    );

    await waitFor(() => expect(ui.getByText('Không xác minh được phân loại của suất chiếu.')).toBeTruthy());
    expect(ui.queryByText('Seat map allowed')).toBeNull();
  });

  test('rejects invalid showtime IDs without calling the backend', async () => {
    const ui = await render(
      <AgeAdmissionGate showtimeId={0} onBack={jest.fn()}>
        <Text>Seat map allowed</Text>
      </AgeAdmissionGate>,
    );

    await waitFor(() => expect(ui.getByText('Chưa chọn suất chiếu hợp lệ.')).toBeTruthy());
    expect(api).not.toHaveBeenCalled();
  });
});

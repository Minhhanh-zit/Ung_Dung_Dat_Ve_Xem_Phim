import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import CineHuntApp from '../src/cinehunt/App';

jest.mock('../src/services/apiClient', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  api: jest.fn(),
  configureSessionRefresh: jest.fn(),
}));

jest.mock('../src/services/authSession', () => ({
  refreshNativeAccessToken: jest.fn(),
  subscribeNativeTokenChanges: jest.fn(() => () => {}),
}));

jest.mock('../src/store/persist', () => ({
  loadFavorites: jest.fn(async () => []),
  loadSession: jest.fn(async () => null),
  saveFavorites: jest.fn(async () => {}),
  saveSession: jest.fn(async () => {}),
  saveRefreshToken: jest.fn(async () => {}),
}));

jest.mock('../src/cinehunt/theme', () => ({
  useCineHuntTheme: () => ({
    C: {
      bg: '#ffffff', logoBg: '#eeeeee', logoLine: '#dddddd',
      brand: '#333333', soft: '#777777', avatarBg: '#eeeeee',
      avatarLine: '#dddddd', purple: '#7755aa',
      stroke: '#dddddd', panel: '#ffffff', white: '#111111',
      tabBg: '#ffffff', tabLine: '#dddddd',
    },
    S: { screen: { flex: 1 } },
    isDark: false,
  }),
  ThemeTransitionVeil: () => null,
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children }: any) =>
      React.createElement(View, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('../src/cinehunt/ui', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    ThemeToggle: () => React.createElement(Text, null, 'Theme toggle'),
  };
});

jest.mock('../src/cinehunt/icons', () => ({
  AppIcon: () => null,
}));

jest.mock('../src/cinehunt/Movies', () => ({
  __esModule: true,
  default: () => require('react').createElement(
    require('react-native').Text, null, 'Movies screen'
  ),
}));

jest.mock('../src/cinehunt/Discover', () => ({
  __esModule: true,
  default: () => require('react').createElement(
    require('react-native').Text, null, 'Discover screen'
  ),
}));

jest.mock('../src/cinehunt/Orders', () => ({
  __esModule: true,
  default: () => require('react').createElement(
    require('react-native').Text, null, 'Orders screen'
  ),
}));

jest.mock('../src/cinehunt/Account', () => ({
  __esModule: true,
  default: () => require('react').createElement(
    require('react-native').Text, null, 'Account screen'
  ),
}));

jest.mock('../src/cinehunt/SeatFlow', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../src/cinehunt/BookingView', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../src/cinehunt/ChatAssistant', () => ({
  __esModule: true,
  default: ({ visible }: { visible: boolean }) =>
    visible
      ? require('react').createElement(
          require('react-native').Text, null, 'AI assistant visible'
        )
      : null,
}));

describe('CineHunt App Shell', () => {
  test('navigates between main tabs', async () => {
    const ui = await render(<CineHuntApp />);

    await waitFor(() => {
      expect(ui.getByText('Movies screen')).toBeTruthy();
    });

    await fireEvent.press(ui.getByLabelText('Khám phá'));

    await waitFor(() => {
      expect(ui.getByText('Discover screen')).toBeTruthy();
    });

    await fireEvent.press(ui.getByLabelText('Đơn & vé'));

    await waitFor(() => {
      expect(ui.getByText('Orders screen')).toBeTruthy();
    });

    await fireEvent.press(ui.getByLabelText('Tài khoản'));

    await waitFor(() => {
      expect(ui.getByText('Account screen')).toBeTruthy();
    });
  });

  test('opens floating AI assistant', async () => {
    const ui = await render(<CineHuntApp />);

    await waitFor(() => {
      expect(ui.getByText('Movies screen')).toBeTruthy();
    });

    await fireEvent.press(ui.getByLabelText('Mở CineHunt AI'));

    await waitFor(() => {
      expect(ui.getByText('AI assistant visible')).toBeTruthy();
    });
  });
});

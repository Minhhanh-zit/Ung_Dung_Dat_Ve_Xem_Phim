import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import {
  Button,
  Field,
  FilmArt,
  GlowPanel,
  Kicker,
  Label,
  Loader,
  Notice,
  SectionHeading,
  SimpleScroll,
  StatusPill,
  posterUri,
} from '../src/cinehunt/ui';

jest.mock('../src/cinehunt/theme', () => ({
  useCineHuntTheme: () => ({
    C: {
      bg: '#ffffff', panel: '#ffffff', panel2: '#f5f5f5', stroke: '#dddddd',
      violet: '#7755aa', purple: '#7755aa', cyan: '#0088aa', muted: '#666666',
      soft: '#777777', white: '#111111', glow: '#7755aa', outlineBg: '#ffffff',
      outlineLine: '#dddddd', dangerBg: '#ffeeee', dangerLine: '#ddaaaa', red: '#aa2222',
      badText: '#aa2222', badBg: '#ffeeee', badLine: '#ddaaaa',
      okText: '#116644', okBg: '#eeffee', okLine: '#99ccaa',
    },
    S: { scroll: { padding: 12 }, muted: { color: '#666666' }, h2: { fontSize: 20 }, input: { padding: 8 } },
    isDark: false,
    toggleTheme: jest.fn(),
    progress: { value: 0 },
  }),
}));

jest.mock('../src/cinehunt/icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { AppIcon: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});

jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: { View: ReactNative.View },
    interpolate: jest.fn(() => 0),
    interpolateColor: jest.fn(() => '#ffffff'),
    useAnimatedStyle: jest.fn(() => ({})),
  };
});

const movie = {
  movieId: 1,
  title: 'CineHunt Test Movie',
  posterUrl: null,
} as never;

describe('shared CineHunt UI', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_API_URL;
  });

  test('Button invokes its action and exposes disabled state', async () => {
    const onPress = jest.fn();
    const ui = await render(<Button title="Tiếp tục" onPress={onPress} icon="check" iconRight="forward" />);
    await fireEvent.press(ui.getByRole('button', { name: 'Tiếp tục' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await ui.unmount();
    const disabled = await render(<Button title="Đang tải" onPress={onPress} disabled />);
    expect(disabled.getByRole('button', { name: 'Đang tải' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  test('Field updates text and can reveal a password', async () => {
    const onChangeText = jest.fn();
    const ui = await render(<Field label="Mật khẩu" value="secret" onChangeText={onChangeText} secure />);
    const input = ui.getByPlaceholderText('Mật khẩu');
    expect(input.props.secureTextEntry).toBe(true);
    await fireEvent.changeText(input, 'new-secret');
    expect(onChangeText).toHaveBeenCalledWith('new-secret');

    await fireEvent.press(ui.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(ui.getByPlaceholderText('Mật khẩu').props.secureTextEntry).toBe(false);
    await fireEvent.press(ui.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(ui.getByPlaceholderText('Mật khẩu').props.secureTextEntry).toBe(true);
  });

  test('Notice distinguishes alert from informational feedback', async () => {
    const bad = await render(<Notice text="Không thể thanh toán" bad />);
    expect(bad.getByText('Không thể thanh toán').parent?.props.accessibilityRole).toBe('alert');
    expect(bad.getByText('Không thể thanh toán')).toBeTruthy();

    await bad.unmount();
    const good = await render(<Notice text="Đã lưu" />);
    expect(good.getByText('Đã lưu')).toBeTruthy();
    expect(good.getByText('Đã lưu').parent?.props.accessibilityRole).toBeUndefined();
  });

  test('StatusPill maps known and unknown backend statuses', async () => {
    const paid = await render(<StatusPill status="PAID" />);
    expect(paid.getByText('Đã thanh toán')).toBeTruthy();
    await paid.unmount();
    const unknown = await render(<StatusPill status="REFUND_REVIEW" />);
    expect(unknown.getByText('REFUND_REVIEW')).toBeTruthy();
  });

  test('posterUri rejects unsafe placeholders and resolves relative API paths', async () => {
    expect(posterUri()).toBeNull();
    expect(posterUri(' https://example.com/poster.jpg ')).toBeNull();
    expect(posterUri('javascript:alert(1)')).toBeNull();
    expect(posterUri('//cdn.example.test/poster.jpg')).toBeNull();
    expect(posterUri('https://cdn.test/poster.jpg')).toBe('https://cdn.test/poster.jpg');

    process.env.EXPO_PUBLIC_API_URL = 'https://api.cinehunt.test/';
    expect(posterUri('/uploads/poster.jpg')).toBe('https://api.cinehunt.test/uploads/poster.jpg');
  });

  test('FilmArt renders the designed fallback when a poster is unavailable', async () => {
    const ui = await render(<FilmArt movie={movie} size={90} />);
    expect(ui.getByText('CINEHUNT TEST MOVIE')).toBeTruthy();
  });

  test('layout primitives render their content', async () => {
    const ui = await render(
      <SimpleScroll>
        <GlowPanel><Kicker>FEATURED</Kicker><SectionHeading title="Phim nổi bật" subtitle="Đang chiếu" /></GlowPanel>
        <Label>Họ và tên</Label>
        <Loader />
      </SimpleScroll>,
    );
    expect(ui.getByText('FEATURED')).toBeTruthy();
    expect(ui.getByText('Phim nổi bật')).toBeTruthy();
    expect(ui.getByText('Họ và tên')).toBeTruthy();
  });
});

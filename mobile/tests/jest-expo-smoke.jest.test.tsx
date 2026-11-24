import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

test('CineHunt Jest Expo renders native component', async () => {
  const { getByText } = await render(
    <Text>CineHunt Test Ready</Text>
  );

  expect(getByText('CineHunt Test Ready')).toBeTruthy();
});

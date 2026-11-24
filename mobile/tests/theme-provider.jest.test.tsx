import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider, ThemeTransitionVeil, useCineHuntTheme } from '../src/cinehunt/theme';
import { loadTheme, saveTheme } from '../src/store/persist';
import { hideAsync } from 'expo-splash-screen';
import { useReducedMotion, withTiming } from 'react-native-reanimated';

jest.mock('../src/store/persist',()=>({loadTheme:jest.fn(),saveTheme:jest.fn(async()=>{})}));
jest.mock('expo-splash-screen',()=>({preventAutoHideAsync:jest.fn(async()=>{}),hideAsync:jest.fn(async()=>{})}));
jest.mock('react-native-reanimated',()=>{
  const React=jest.requireActual('react') as typeof import('react');
  return {
    __esModule:true,default:{View:jest.requireActual('react-native').View},
    Easing:{cubic:()=>0,inOut:()=>()=>0,out:()=>()=>0},
    useSharedValue:(initial:number)=>React.useRef({value:initial,set(value:number){this.value=value;}}).current,
    useAnimatedStyle:(f:()=>object)=>f(),useReducedMotion:jest.fn(()=>false),
    withTiming:jest.fn((value:number)=>value),withSequence:(...values:number[])=>values[values.length-1],
  };
});
function Probe(){
  const {mode,toggleTheme,setMode,themeReady,C}=useCineHuntTheme();
  return <><Text>{`${mode}:${String(themeReady)}:${C.bg}`}</Text><Pressable accessibilityLabel="Đổi theme" onPress={toggleTheme}><Text>Toggle</Text></Pressable><Pressable accessibilityLabel="Light" onPress={()=>setMode('light')}><Text>Light</Text></Pressable><ThemeTransitionVeil/></>;
}
beforeEach(()=>{(loadTheme as jest.Mock).mockReset();(useReducedMotion as jest.Mock).mockReturnValue(false);});
test('restores saved theme before revealing children and persists user toggle',async()=>{
  (loadTheme as jest.Mock).mockResolvedValue('dark');
  const ui=await render(<ThemeProvider><Probe/></ThemeProvider>);
  await waitFor(()=>expect(ui.getByText('dark:true:#080B16')).toBeTruthy());expect(hideAsync).toHaveBeenCalled();
  await fireEvent.press(ui.getByLabelText('Đổi theme'));
  expect(ui.getByText('light:true:#FBF5E8')).toBeTruthy();expect(saveTheme).toHaveBeenCalledWith('light');expect(withTiming).toHaveBeenCalled();
  await fireEvent.press(ui.getByLabelText('Light'));expect(saveTheme).toHaveBeenCalledTimes(1);
});
test('uses immediate changes when reduced motion is enabled',async()=>{
  (loadTheme as jest.Mock).mockResolvedValue('light');(useReducedMotion as jest.Mock).mockReturnValue(true);
  const ui=await render(<ThemeProvider><Probe/></ThemeProvider>);
  await waitFor(()=>expect(ui.getByText('light:true:#FBF5E8')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('Đổi theme'));expect(ui.getByText('dark:true:#080B16')).toBeTruthy();
  expect(withTiming).not.toHaveBeenCalled();expect(saveTheme).toHaveBeenCalledWith('dark');
});
test('storage failure falls back to light and still releases splash screen',async()=>{
  (loadTheme as jest.Mock).mockRejectedValue(Error('storage unavailable'));
  const ui=await render(<ThemeProvider><Probe/></ThemeProvider>);
  await waitFor(()=>expect(ui.getByText('light:true:#FBF5E8')).toBeTruthy());expect(hideAsync).toHaveBeenCalled();
});

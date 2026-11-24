import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {StyleSheet, View} from 'react-native';
import Animated, {Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming, type SharedValue} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import {loadTheme, saveTheme} from '../store/persist';
import {DEFAULT_THEME_MODE, PALETTES, paletteFor, type Palette, type ThemeMode} from './themeTokens';

export type {Palette, ThemeMode} from './themeTokens';

function makeStyles(C: Palette) {
  return StyleSheet.create({
    screen:{flex:1,backgroundColor:C.bg},
    scroll:{paddingHorizontal:20,paddingTop:12,paddingBottom:48},
    title:{color:C.white,fontSize:30,fontWeight:'900',letterSpacing:-.8},
    h2:{color:C.white,fontSize:21,fontWeight:'800',letterSpacing:-.35},
    text:{color:C.white,fontSize:15},
    muted:{color:C.muted,fontSize:13.5,lineHeight:21},
    card:{backgroundColor:C.panel,borderRadius:23,padding:18,borderWidth:1,borderColor:C.stroke,marginBottom:14},
    input:{backgroundColor:C.panel2,color:C.white,borderColor:C.stroke,borderWidth:1,borderRadius:17,paddingHorizontal:17,paddingVertical:15,fontSize:15,marginTop:9},
    pill:{paddingHorizontal:15,paddingVertical:11,borderRadius:14,backgroundColor:C.panel2},
    row:{flexDirection:'row',alignItems:'center',gap:10},
  });
}
export type Styles = ReturnType<typeof makeStyles>;
const STYLE_CACHE: Partial<Record<ThemeMode, Styles>> = {};
function stylesFor(mode: ThemeMode): Styles {
  return STYLE_CACHE[mode] ??= makeStyles(paletteFor(mode));
}

/** Thời lượng chuyển theme; bằng 0 khi người dùng bật Reduce Motion. */
export const THEME_TRANSITION_MS = 280;
const VEIL_START_OPACITY = 0.6;

export type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  /** Bảng màu của theme hiện tại (nguồn dữ liệu duy nhất cho màu). */
  C: Palette;
  /** Style dùng chung đã dựng sẵn theo theme hiện tại. */
  S: Styles;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  /** Theme đã khôi phục từ bộ nhớ chưa. */
  themeReady: boolean;
  reduceMotion: boolean;
  /** 0 = Light, 1 = Dark (animate bằng withTiming; dùng cho interpolateColor). */
  progress: SharedValue<number>;
  veil: SharedValue<number>;
  veilColor: string;
};

const FALLBACK_PROGRESS = {value: 0} as SharedValue<number>;
const FALLBACK: ThemeContextValue = {
  mode: DEFAULT_THEME_MODE, isDark: false, C: PALETTES.light, S: stylesFor('light'),
  setMode: () => {}, toggleTheme: () => {}, themeReady: true, reduceMotion: false,
  progress: FALLBACK_PROGRESS, veil: FALLBACK_PROGRESS, veilColor: PALETTES.light.bg,
};
const ThemeContext = createContext<ThemeContextValue>(FALLBACK);

// Giữ splash native tới khi theme khôi phục xong để không nháy sai màu lúc mở app.
SplashScreen.preventAutoHideAsync().catch(() => {});

export function ThemeProvider({children}: {children: ReactNode}) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [themeReady, setThemeReady] = useState(false);
  const [veilColor, setVeilColor] = useState(PALETTES.light.bg);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const veil = useSharedValue(0);
  const modeRef = useRef<ThemeMode>(DEFAULT_THEME_MODE);
  const changedByUser = useRef(false);

  useEffect(() => {
    let alive = true;
    loadTheme().then(saved => {
      if (!alive || changedByUser.current) return;
      modeRef.current = saved;
      progress.set(saved === 'dark' ? 1 : 0);
      setModeState(saved);
    }).catch(() => {}).finally(() => {
      if (!alive) return;
      setThemeReady(true);
      SplashScreen.hideAsync().catch(() => {});
    });
    return () => { alive = false; };
  }, [progress]);

  const setMode = useCallback((next: ThemeMode) => {
    const prev = modeRef.current;
    if (prev === next) return;
    changedByUser.current = true;
    modeRef.current = next;
    const target = next === 'dark' ? 1 : 0;
    if (reduceMotion) {
      progress.set(target);
      veil.set(0);
    } else {
      setVeilColor(paletteFor(prev).bg);
      progress.set(withTiming(target, {duration: THEME_TRANSITION_MS, easing: Easing.inOut(Easing.cubic)}));
      veil.set(withSequence(withTiming(VEIL_START_OPACITY, {duration: 0}), withTiming(0, {duration: THEME_TRANSITION_MS, easing: Easing.out(Easing.cubic)})));
    }
    setModeState(next);
    void saveTheme(next);
  }, [progress, veil, reduceMotion]);

  const toggleTheme = useCallback(() => setMode(modeRef.current === 'dark' ? 'light' : 'dark'), [setMode]);

  const value = useMemo<ThemeContextValue>(() => ({
    mode, isDark: mode === 'dark', C: paletteFor(mode), S: stylesFor(mode),
    setMode, toggleTheme, themeReady, reduceMotion, progress, veil, veilColor,
  }), [mode, setMode, toggleTheme, themeReady, reduceMotion, progress, veil, veilColor]);

  // Chưa khôi phục xong: splash native vẫn che; web hiển thị nền Light mặc định.
  if (!themeReady) return <View style={{flex:1,backgroundColor:PALETTES.light.bg}}/>;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useCineHuntTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Lớp phủ cross-fade khi đổi theme: phủ màu nền cũ rồi mờ dần để lộ giao diện mới.
 * Đặt ở cuối cây của một "gốc" (root app, modal) và không nhận thao tác chạm.
 */
export function ThemeTransitionVeil() {
  const {veil, veilColor} = useCineHuntTheme();
  const animated = useAnimatedStyle(() => ({opacity: veil.value}));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor: veilColor}, animated]}/>;
}

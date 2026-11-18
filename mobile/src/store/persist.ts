import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../types';
import type { ThemeMode } from '../cinehunt/ui';

/**
 * Lưu trạng thái app qua lần mở sau.
 * - iOS/Android: expo-secure-store (token được mã hóa bởi hệ điều hành).
 * - Web: expo-secure-store không hỗ trợ, dùng sessionStorage cho token
 *   (mất khi đóng tab) và localStorage cho dữ liệu không nhạy cảm.
 */
const KEY_SESSION = 'cinehunt.session';
const KEY_FAVORITES = 'cinehunt.favorites';
const KEY_THEME = 'cinehunt.theme';

const isWeb = Platform.OS === 'web';

async function read(key: string, sensitive: boolean): Promise<string | null> {
  try {
    if (isWeb) {
      const store = sensitive ? globalThis.sessionStorage : globalThis.localStorage;
      return store?.getItem(key) ?? null;
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null, sensitive: boolean): Promise<void> {
  try {
    if (isWeb) {
      const store = sensitive ? globalThis.sessionStorage : globalThis.localStorage;
      if (value === null) store?.removeItem(key);
      else store?.setItem(key, value);
      return;
    }
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    /* Không lưu được thì bỏ qua, app vẫn chạy bình thường. */
  }
}

export type StoredSession = { token: string; user: User };

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await read(KEY_SESSION, true);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    return parsed.token && parsed.user ? (parsed as StoredSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession | null) {
  return write(KEY_SESSION, session ? JSON.stringify(session) : null, true);
}

export async function loadFavorites(): Promise<number[]> {
  const raw = await read(KEY_FAVORITES, false);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : [];
  } catch {
    return [];
  }
}

export function saveFavorites(ids: number[]) {
  return write(KEY_FAVORITES, JSON.stringify(ids), false);
}

export async function loadTheme(): Promise<ThemeMode> {
  return (await read(KEY_THEME, false)) === 'dark' ? 'dark' : 'light';
}

export function saveTheme(mode: ThemeMode) {
  return write(KEY_THEME, mode, false);
}

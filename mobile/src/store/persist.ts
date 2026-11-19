import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../types';
import type { ThemeMode } from '../cinehunt/ui';

/**
 * iOS/Android: SecureStore. Web: sessionStorage for sensitive data,
 * localStorage for favorites and theme only.
 * Legacy data remains readable after introducing versioned payloads.
 */
const KEY_SESSION = 'cinehunt.session';
const KEY_REFRESH = 'cinehunt.refresh';
const KEY_FAVORITES = 'cinehunt.favorites';
const KEY_THEME = 'cinehunt.theme';
const STORAGE_VERSION = 1;
const isWeb = Platform.OS === 'web';

async function read(key: string, sensitive: boolean): Promise<string | null> {
  try {
    if (isWeb) {
      const store = sensitive ? globalThis.sessionStorage : globalThis.localStorage;
      return store?.getItem(key) ?? null;
    }
    return await SecureStore.getItemAsync(key);
  } catch { return null; }
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
    // Storage unavailable: app remains usable, but does not claim persistence.
  }
}

function decode(raw: string): unknown {
  const parsed: unknown = JSON.parse(raw);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'version' in parsed) {
    const payload = parsed as {version: unknown; data?: unknown};
    return payload.version === STORAGE_VERSION ? payload.data : null;
  }
  return parsed; // Backwards compatible with sessions/favorites saved before v1.
}

function encode<T>(data: T): string {
  return JSON.stringify({version: STORAGE_VERSION, data});
}

export type StoredSession = { token: string; user: User };

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await read(KEY_SESSION, true);
  if (!raw) return null;
  try {
    const value = decode(raw);
    if (!value || typeof value !== 'object') return null;
    const session = value as Partial<StoredSession>;
    return typeof session.token === 'string' && !!session.token.trim() &&
      !!session.user && typeof session.user === 'object'
      ? session as StoredSession : null;
  } catch { return null; }
}

export function saveSession(session: StoredSession | null) {
  return write(KEY_SESSION, session ? encode(session) : null, true);
}

/** Native refresh tokens are stored only in encrypted SecureStore. */
export async function loadRefreshToken(): Promise<string|null> {
  if(isWeb)return null;
  const value=await read(KEY_REFRESH,true);
  return value&&value.trim()?value:null;
}

export async function saveRefreshToken(value:string|null):Promise<void> {
  if(isWeb)return;
  // Unlike cosmetic state, losing a rotating refresh token must be observable.
  if(value===null)await SecureStore.deleteItemAsync(KEY_REFRESH);
  else await SecureStore.setItemAsync(KEY_REFRESH,value);
}

export async function loadFavorites(): Promise<number[]> {
  const raw = await read(KEY_FAVORITES, false);
  if (!raw) return [];
  try {
    const value = decode(raw);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((id): id is number =>
      typeof id === 'number' && Number.isInteger(id) && id > 0))];
  } catch { return []; }
}

export function saveFavorites(ids: number[]) {
  const valid = [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))];
  return write(KEY_FAVORITES, encode(valid), false);
}

export async function loadTheme(): Promise<ThemeMode> {
  return (await read(KEY_THEME, false)) === 'dark' ? 'dark' : 'light';
}

export function saveTheme(mode: ThemeMode) {
  return write(KEY_THEME, mode, false);
}

import { Preferences } from '@capacitor/preferences';
import { isNativeApp } from './app-shell';

export const AUTH_STORAGE_KEY = 'agent-home-auth';
export const AUTH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const THEME_STORAGE_KEY = 'agent-home-theme';
export const HOME_VIEW_CACHE_STORAGE_KEY = 'agent-home-home-view-cache';
export const POST_DETAIL_CACHE_KEY_PREFIX = 'agent-home-post-detail-cache:';
export const CONTENT_CACHE_TTL_MS = 30 * 60 * 1000;
export const DEFAULT_THEME = 'tech';

function getLocalStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function readLocalValue(key) {
  try {
    return getLocalStorage()?.getItem(key) || '';
  } catch (error) {
    return '';
  }
}

function writeLocalValue(key, value) {
  try {
    getLocalStorage()?.setItem(key, value);
  } catch (error) {
    // Ignore storage write failures so the app remains usable in restricted environments.
  }
}

function removeLocalValue(key) {
  try {
    getLocalStorage()?.removeItem(key);
  } catch (error) {
    // Ignore storage removal failures so logout still completes in memory.
  }
}

function parseAuthValue(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed?.token || !parsed?.user || !parsed?.expiresAt) {
      return null;
    }

    if (Date.now() > parsed.expiresAt) {
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
}

function parseContentCacheValue(rawValue, maxAgeMs = CONTENT_CACHE_TTL_MS) {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed?.savedAt || parsed.payload === undefined) {
      return null;
    }

    if (Date.now() - parsed.savedAt > maxAgeMs) {
      return null;
    }

    return parsed.payload;
  } catch (error) {
    return null;
  }
}

function buildAuthValue(token, user) {
  return JSON.stringify({
    token,
    user,
    expiresAt: Date.now() + AUTH_TTL_MS
  });
}

function buildContentCacheValue(payload) {
  return JSON.stringify({
    savedAt: Date.now(),
    payload
  });
}

export function readStoredAuth() {
  const rawValue = readLocalValue(AUTH_STORAGE_KEY);
  const parsed = parseAuthValue(rawValue);

  if (!parsed && rawValue) {
    removeLocalValue(AUTH_STORAGE_KEY);
  }

  return parsed || { token: null, user: null };
}

export function readStoredTheme() {
  return readLocalValue(THEME_STORAGE_KEY) || DEFAULT_THEME;
}

export async function hydrateStoredSession() {
  const localAuthRaw = readLocalValue(AUTH_STORAGE_KEY);
  const localTheme = readLocalValue(THEME_STORAGE_KEY);

  if (!isNativeApp()) {
    return {
      auth: parseAuthValue(localAuthRaw) || { token: null, user: null },
      theme: localTheme || DEFAULT_THEME
    };
  }

  const [nativeAuthResult, nativeThemeResult] = await Promise.all([
    Preferences.get({ key: AUTH_STORAGE_KEY }),
    Preferences.get({ key: THEME_STORAGE_KEY })
  ]);

  const authRaw = localAuthRaw || nativeAuthResult.value || '';
  const parsedAuth = parseAuthValue(authRaw);
  if (parsedAuth) {
    writeLocalValue(AUTH_STORAGE_KEY, JSON.stringify(parsedAuth));
  } else {
    removeLocalValue(AUTH_STORAGE_KEY);
    await Preferences.remove({ key: AUTH_STORAGE_KEY });
  }

  const theme = localTheme || nativeThemeResult.value || DEFAULT_THEME;
  writeLocalValue(THEME_STORAGE_KEY, theme);

  return {
    auth: parsedAuth || { token: null, user: null },
    theme
  };
}

export async function persistStoredAuth(token, user) {
  if (!token || !user) {
    await clearStoredAuth();
    return;
  }

  const rawValue = buildAuthValue(token, user);
  writeLocalValue(AUTH_STORAGE_KEY, rawValue);

  if (isNativeApp()) {
    await Preferences.set({
      key: AUTH_STORAGE_KEY,
      value: rawValue
    });
  }
}

export async function clearStoredAuth() {
  removeLocalValue(AUTH_STORAGE_KEY);

  if (isNativeApp()) {
    await Preferences.remove({ key: AUTH_STORAGE_KEY });
  }
}

export async function persistStoredTheme(theme) {
  writeLocalValue(THEME_STORAGE_KEY, theme);

  if (isNativeApp()) {
    await Preferences.set({
      key: THEME_STORAGE_KEY,
      value: theme
    });
  }
}

export function readStoredHomeViewCache() {
  const rawValue = readLocalValue(HOME_VIEW_CACHE_STORAGE_KEY);
  const parsed = parseContentCacheValue(rawValue);

  if (!parsed && rawValue) {
    removeLocalValue(HOME_VIEW_CACHE_STORAGE_KEY);
  }

  return parsed;
}

export function persistStoredHomeViewCache(payload) {
  if (!payload) {
    removeLocalValue(HOME_VIEW_CACHE_STORAGE_KEY);
    return;
  }

  writeLocalValue(HOME_VIEW_CACHE_STORAGE_KEY, buildContentCacheValue(payload));
}

export function readStoredPostDetailCache(postId) {
  const storageKey = `${POST_DETAIL_CACHE_KEY_PREFIX}${postId}`;
  const rawValue = readLocalValue(storageKey);
  const parsed = parseContentCacheValue(rawValue);

  if (!parsed && rawValue) {
    removeLocalValue(storageKey);
  }

  return parsed;
}

export function persistStoredPostDetailCache(postId, payload) {
  const storageKey = `${POST_DETAIL_CACHE_KEY_PREFIX}${postId}`;

  if (!payload) {
    removeLocalValue(storageKey);
    return;
  }

  writeLocalValue(storageKey, buildContentCacheValue(payload));
}

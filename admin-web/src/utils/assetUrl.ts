import { API_BASE_URL, stripTrailingSlashes } from '../config/env';

export function resolveAssetUrl(path?: string | null): string {
  if (!path) return '';

  if (/^(https?:|blob:|data:)/i.test(path)) return path;

  const base = stripTrailingSlashes(API_BASE_URL);
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

export default resolveAssetUrl;

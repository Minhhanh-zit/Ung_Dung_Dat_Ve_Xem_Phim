const BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = 'ApiError'; }
}

export async function api<T>(path: string, opts: {
  token?: string | null; method?: 'GET'|'POST'|'PATCH'|'PUT'|'DELETE'; body?: unknown; timeout?: number;
} = {}): Promise<T> {
  if (!BASE) throw new ApiError('Thiếu EXPO_PUBLIC_API_URL trong mobile/.env.local', 0);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout ?? 15000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET', signal: ctrl.signal,
      headers: {
        ...(opts.body !== undefined ? {'Content-Type': 'application/json'} : {}),
        ...(opts.token ? {Authorization: `Bearer ${opts.token}`} : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const raw = await res.text();
    let data: unknown = null;
    if (raw) { try { data = JSON.parse(raw); } catch { throw new ApiError(`Phản hồi HTTP ${res.status} không phải JSON`, res.status); } }
    if (!res.ok) {
      const problem = data && typeof data === 'object' ? data as {message?: string|string[]; error?:string} : null;
      const detail = Array.isArray(problem?.message) ? problem.message.join(', ') : problem?.message;
      throw new ApiError(detail || problem?.error || `Yêu cầu thất bại (HTTP ${res.status})`, res.status);
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (ctrl.signal.aborted) throw new ApiError('Quá thời gian kết nối. Hãy kiểm tra trạng thái trước khi gửi lại.', 0);
    throw new ApiError('Không thể kết nối Backend. Kiểm tra Tailscale và cổng 3000.', 0);
  } finally { clearTimeout(timer); }
}

export function errorMessage(e: unknown) { return e instanceof Error ? e.message : 'Đã có lỗi xảy ra'; }
export function formatMoney(n: number | string | undefined | null) { return `${Number(n ?? 0).toLocaleString('vi-VN')}đ`; }
export function formatDate(iso?: string | null, withTime = true) {
  if (!iso) return 'Chưa cập nhật';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return 'Ngày không hợp lệ';
  try { return new Intl.DateTimeFormat('vi-VN', {
    timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',
    ...(withTime ? {hour:'2-digit',minute:'2-digit',hour12:false} : {}),
  }).format(t); } catch { return t.toISOString(); }
}
export function future(iso: string | null | undefined) {return !!iso && new Date(iso).getTime() > Date.now();}
export function createKey() { return `cinehunt-${Date.now()}-${Math.random().toString(36).slice(2,12)}`; }

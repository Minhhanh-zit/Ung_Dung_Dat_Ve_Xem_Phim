const BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Keep technical details out of messages shown to moviegoers. */
function publicHttpMessage(status: number, detail?: string, path = ''): string {
  switch (status) {
    case 400:
    case 422:
      return detail || 'Thông tin gửi lên chưa hợp lệ. Vui lòng kiểm tra lại.';
    case 401:
      return (path.startsWith('/auth/login') || path === '/auth/native/login')
        ? (detail || 'Email hoặc mật khẩu không đúng.')
        : 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.';
    case 403:
      return 'Bạn không có quyền thực hiện thao tác này.';
    case 404:
      return 'Không tìm thấy dữ liệu yêu cầu.';
    case 409:
      return (path.startsWith('/bookings') || path.startsWith('/payments') || path.startsWith('/showtime-seats'))
        ? 'Ghế hoặc đơn đặt vé vừa thay đổi. Vui lòng tải lại trạng thái trước khi tiếp tục.'
        : (detail || 'Dữ liệu vừa thay đổi. Vui lòng tải lại và thử lại.');
    case 429:
      return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
    default:
      return status >= 500
        ? 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.'
        : (detail || `Yêu cầu chưa thành công (HTTP ${status}).`);
  }
}

type RefreshHandler=(expiredToken:string)=>Promise<string|null>;
let refreshHandler:RefreshHandler|null=null;
export function configureSessionRefresh(handler:RefreshHandler|null):void {
  refreshHandler=handler;
}

export async function api<T>(path: string, opts: {
  token?: string | null;
  method?: 'GET'|'POST'|'PATCH'|'PUT'|'DELETE';
  body?: unknown;
  timeout?: number;
} = {}): Promise<T> {
  if (!BASE) throw new ApiError('Chưa cấu hình máy chủ. Vui lòng liên hệ hỗ trợ.', 0);
  const method=opts.method??'GET';
  async function execute(token:string|null|undefined,alreadyRefreshed:boolean):Promise<T> {
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),opts.timeout??15000);
    try {
      const res=await fetch(`${BASE}${path}`,{
        method,signal:ctrl.signal,
        headers:{
          ...(opts.body!==undefined?{'Content-Type':'application/json'}:{}),
          ...(token?{Authorization:`Bearer ${token}`}:{})
        },
        body:opts.body!==undefined?JSON.stringify(opts.body):undefined,
      });
      const raw=await res.text();
      let data:unknown=null;
      if(raw){try{data=JSON.parse(raw)}catch{
        throw new ApiError('Máy chủ trả dữ liệu không hợp lệ. Vui lòng thử lại sau.',res.status);
      }}
      if(!res.ok){
        // Refresh only on authenticated business API calls, never on auth itself.
        if(res.status===401&&token&&!alreadyRefreshed&&
           !path.startsWith('/auth/')&&refreshHandler){
          const newToken=await refreshHandler(token);
          if(newToken&&newToken!==token){
            // Never auto-resubmit booking/payment/seat writes: avoid duplicate transactions.
            if(method==='GET')return execute(newToken,true);
            throw new ApiError('Phiên đăng nhập đã được làm mới. Vui lòng thực hiện lại thao tác.',401);
          }
        }
        const problem=data&&typeof data==='object'
          ? data as {message?:string|string[];error?:string}:null;
        const detail=Array.isArray(problem?.message)
          ? problem.message.join(', '):problem?.message;
        throw new ApiError(publicHttpMessage(res.status,detail,path),res.status);
      }
      return data as T;
    }catch(e){
      if(e instanceof ApiError)throw e;
      if(ctrl.signal.aborted)throw new ApiError('Máy chủ phản hồi quá lâu. Vui lòng kiểm tra trạng thái trước khi gửi lại.',0);
      throw new ApiError('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.',0);
    }finally{clearTimeout(timer)}
  }
  return execute(opts.token,false);
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
}

const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
});

/** VND is formatted with zero fractional digits. Invalid/missing amounts are never shown as 0đ. */
export function formatMoney(value: number | string | undefined | null): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' && !value.trim()) return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount) || Math.abs(amount) > Number.MAX_SAFE_INTEGER) return '—';
  return vnd.format(amount);
}

export function formatDate(iso?: string | null, withTime = true) {
  if (!iso) return 'Chưa cập nhật';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return 'Ngày không hợp lệ';
  try { return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
    ...(withTime ? {hour: '2-digit', minute: '2-digit', hour12: false} : {}),
  }).format(t); }
  catch { return t.toISOString(); }
}

export function future(iso: string | null | undefined) {
  return !!iso && new Date(iso).getTime() > Date.now();
}

export function createKey() {
  return `cinehunt-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

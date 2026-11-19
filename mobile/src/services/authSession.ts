import {Platform} from 'react-native';
import {loadRefreshToken,loadSession,saveRefreshToken,saveSession} from '../store/persist';
import {ApiError} from './apiClient';

const BASE=(process.env.EXPO_PUBLIC_API_URL??'').trim().replace(/\/+$/,'');
type Listener=(token:string|null)=>void;
let listener:Listener|null=null;
let inFlight:Promise<string|null>|null=null;

export function subscribeNativeTokenChanges(next:Listener):()=>void {
  listener=next;
  return ()=>{if(listener===next)listener=null};
}

/** Refresh only with a SecureStore refresh token, and never retry a write here. */
export async function refreshNativeAccessToken(expiredToken:string):Promise<string|null> {
  if(Platform.OS==='web'||!BASE)return null;
  if(inFlight)return inFlight;
  const task=(async()=>{
    const session=await loadSession();
    if(!session)return null;
    if(session.token!==expiredToken)return session.token;
    const storedRefresh=await loadRefreshToken();
    if(!storedRefresh)return null;
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),10000);
    try {
      const res=await fetch(`${BASE}/auth/native/refresh`,{
        method:'POST',headers:{Authorization:`Bearer ${storedRefresh}`},signal:ctrl.signal,
      });
      if(res.status===401||res.status===403){
        const latest=await loadSession();
        // A newer login must never be wiped by an older failed refresh.
        if(latest?.token===expiredToken){
          await saveRefreshToken(null);
          await saveSession(null);
          listener?.(null);
        }
        return null;
      }
      if(!res.ok)throw new ApiError('Không thể làm mới phiên đăng nhập. Vui lòng thử lại.',res.status);
      const data=await res.json() as {accessToken?:string;refreshToken?:string};
      if(typeof data.accessToken!=='string'||!data.accessToken||
         typeof data.refreshToken!=='string'||!data.refreshToken){
        throw new ApiError('Máy chủ trả thông tin phiên đăng nhập không hợp lệ.',0);
      }
      const current=await loadSession();
      if(!current||current.token!==expiredToken)return current?.token??null;
      // Persist rotated refresh token before notifying UI about the access token.
      await saveRefreshToken(data.refreshToken);
      await saveSession({...current,token:data.accessToken});
      listener?.(data.accessToken);
      return data.accessToken;
    } catch(e){
      if(e instanceof ApiError)throw e;
      throw new ApiError('Không thể làm mới phiên do mất kết nối. Vui lòng thử lại.',0);
    } finally {clearTimeout(timer)}
  })();
  inFlight=task;
  try{return await task}finally{if(inFlight===task)inFlight=null}
}

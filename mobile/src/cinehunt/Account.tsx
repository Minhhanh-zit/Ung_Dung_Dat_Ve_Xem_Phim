import {useCallback,useEffect,useState} from 'react';
import {Alert,Text,View} from 'react-native';
import {api,errorMessage} from './api';
import {Button,C,Field,Loader,Notice,S,SimpleScroll} from './ui';
import type {User} from './types';

type Props={token:string|null;user:User|null;forceAuth?:boolean;onLogin:(token:string,user:User)=>void;onLogout:()=>void};
type Notification={notificationId:string;title?:string;message?:string;isRead?:boolean};
export default function Account({token,user,forceAuth=false,onLogin,onLogout}:Props){
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [fullName,setFullName]=useState('');const [phone,setPhone]=useState('');
  const [profile,setProfile]=useState<User|null>(null);
  const [notifications,setNotifications]=useState<Notification[]>([]);
  const [membership,setMembership]=useState<unknown>(null);
  const [code,setCode]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');const [info,setInfo]=useState('');
  const load=useCallback(async()=>{if(!token)return;setLoading(true);setError('');try{
    const [p,n,m]=await Promise.all([api<User>('/users/me',{token}),api<Notification[]>('/notifications',{token}),api<unknown>('/users/me/membership',{token})]);
    setProfile(p);setFullName(p.fullName||'');setPhone(p.phone||'');setNotifications(Array.isArray(n)?n:[]);setMembership(m);
  }catch(e){setError(errorMessage(e))}finally{setLoading(false)}},[token]);
  useEffect(()=>{void load()},[load]);
  async function submitAuth(){
    if(!email.trim()||!password){setError('Nhập email và mật khẩu.');return;}
    setLoading(true);setError('');setInfo('');
    try{
      if(mode==='register'){
        if(!fullName.trim()){setError('Nhập họ và tên.');return;}
        await api('/auth/register',{method:'POST',body:{fullName:fullName.trim(),email:email.trim(),password,phone:phone.trim()||undefined}});
        setMode('login');setPassword('');setInfo('Đăng ký thành công. Vui lòng đăng nhập.');return;
      }
      const result=await api<{accessToken:string;user:User}>('/auth/login',{method:'POST',body:{email:email.trim(),password}});
      if(!result.accessToken||!result.user)throw new Error('Backend chưa trả JWT');
      setPassword('');onLogin(result.accessToken,result.user);
    }catch(e){setError(errorMessage(e))}finally{setLoading(false)}
  }
  async function saveProfile(){if(!token)return;setLoading(true);setError('');try{
    const p=await api<User>('/users/me',{method:'PATCH',token,body:{fullName:fullName.trim(),phone:phone.trim()}});
    setProfile(p);setInfo('Đã lưu thông tin tài khoản.');
  }catch(e){setError(errorMessage(e))}finally{setLoading(false)}}
  async function checkIn(){if(!token||!code.trim())return;setLoading(true);setError('');setInfo('');try{
    const r=await api<{message?:string;ticketCode?:string}>(`/tickets/${encodeURIComponent(code.trim())}/checkin`,{method:'POST',token});
    setInfo(r.message||`Đã soát vé ${r.ticketCode||code}`);setCode('');
  }catch(e){setError(errorMessage(e))}finally{setLoading(false)}}
  async function logout(){if(token){try{await api('/auth/logout',{method:'POST',token});}catch{/* Thu hồi tại server có thể thất bại khi mất mạng; xóa JWT khỏi bộ nhớ dù sao */}}onLogout()}
  if(forceAuth||!token)return <SimpleScroll>
    <Text style={S.title}>{mode==='login'?'Đăng nhập CineHunt':'Đăng ký tài khoản'}</Text>
    <Text style={[S.muted,{marginTop:12,marginBottom:20}]}>Đăng nhập để giữ ghế, xem lịch sử, thanh toán và vé QR. Phiên đăng nhập được giữ trong bộ nhớ, mất khi tải lại ứng dụng.</Text>
    {mode==='register'&&<><Field label="Họ và tên" value={fullName} onChangeText={setFullName}/><Field label="Số điện thoại (không bắt buộc)" value={phone} onChangeText={setPhone} keyboardType="phone-pad"/></>}
    <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address"/>
    <Field label="Mật khẩu" value={password} onChangeText={setPassword} secure/>
    {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}{!!info&&<Notice text={info}/>}
    <Button title={mode==='login'?'Đăng nhập':'Tạo tài khoản'} disabled={loading} onPress={()=>void submitAuth()}/>
    <Button kind="outline" title={mode==='login'?'Chưa có tài khoản? Đăng ký':'Đã có tài khoản? Đăng nhập'} onPress={()=>{setMode(mode==='login'?'register':'login');setError('')}}/>
  </SimpleScroll>;
  const isStaff=['STAFF','ADMIN'].includes(String(user?.role||profile?.role||'').toUpperCase());
  return <SimpleScroll>
    <Text style={S.title}>Tài khoản</Text><Text style={[S.muted,{marginVertical:10}]}>{user?.email||profile?.email} · {user?.role||profile?.role||'CUSTOMER'}</Text>
    {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}{!!info&&<Notice text={info}/>}
    <View style={S.card}><Text style={S.h2}>Thông tin cá nhân</Text>
      <Field label="Họ và tên" value={fullName} onChangeText={setFullName}/>
      <Field label="Số điện thoại" value={phone} onChangeText={setPhone} keyboardType="phone-pad"/>
      <Button title="Lưu hồ sơ" disabled={loading} onPress={()=>void saveProfile()}/>
    </View>
    <View style={S.card}><Text style={S.h2}>Hạng thành viên</Text>
      <Text style={[S.muted,{marginTop:10}]}>{membership?JSON.stringify(membership,null,2):'Chưa có dữ liệu thành viên'}</Text>
    </View>
    <View style={S.card}><Text style={S.h2}>Thông báo ({notifications.length})</Text>
      {notifications.length===0?<Text style={[S.muted,{marginTop:8}]}>Không có thông báo.</Text>:notifications.slice(0,20).map((n,i)=><View key={String(n.notificationId||i)} style={{paddingVertical:12,borderBottomWidth:1,borderColor:C.stroke}}><Text style={{color:C.white,fontWeight:'800'}}>{n.title||'Thông báo'}</Text><Text style={[S.muted,{marginTop:6}]}>{n.message}</Text></View>)}
    </View>
    {isStaff&&<View style={S.card}><Text style={S.h2}>Nhân viên: Soát vé</Text>
      <Text style={[S.muted,{marginVertical:12}]}>Chỉ STAFF/ADMIN được xác nhận check-in, trong khung giờ Backend cho phép. Nhập mã vé hoặc mã đơn tại quầy.</Text>
      <Field label="Mã vé hoặc mã đơn" value={code} onChangeText={setCode} placeholder="TCK-... hoặc BK-..."/>
      <Button title="Kiểm tra và check-in" disabled={loading||!code.trim()} onPress={()=>Alert.alert('Soát vé?',`Xác nhận sử dụng mã ${code.trim()}?`,[{text:'Không',style:'cancel'},{text:'Check-in',onPress:()=>void checkIn()}])}/>
    </View>}
    <Notice text="MoMo/VNPay chưa cấu hình, và khách hàng không thể tự xác nhận thanh toán thành công."/>
    <Button title="Tải lại hồ sơ và thông báo" kind="outline" disabled={loading} onPress={()=>void load()}/>
    <Button title="Đăng xuất" kind="danger" onPress={()=>Alert.alert('Đăng xuất?','Xóa JWT khỏi ứng dụng và đăng xuất khỏi Backend?', [{text:'Không',style:'cancel'},{text:'Đăng xuất',style:'destructive',onPress:()=>void logout()}])}/>
  </SimpleScroll>;
}

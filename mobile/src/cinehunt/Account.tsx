import {useCallback,useEffect,useState} from 'react';
import {Alert,Pressable,Text,View} from 'react-native';
import {api,errorMessage} from './api';
import {Button,C,Field,GlowPanel,Kicker,Loader,Notice,S,SectionHeading,SimpleScroll} from './ui';
import type {User} from './types';

type Props={token:string|null;user:User|null;forceAuth?:boolean;onLogin:(token:string,user:User)=>void;onLogout:()=>void};
type Notification={notificationId:string;title?:string;message?:string;isRead?:boolean};
type Membership={tier?:string;points?:number;totalSpent?:number;paidBookings?:number;nextTier?:string;pointsToNextTier?:number;progressPercent?:number};
export default function Account({token,user,forceAuth=false,onLogin,onLogout}:Props){
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [fullName,setFullName]=useState('');const [phone,setPhone]=useState('');
  const [profile,setProfile]=useState<User|null>(null);
  const [notifications,setNotifications]=useState<Notification[]>([]);
  const [membership,setMembership]=useState<Membership|null>(null);
  const [code,setCode]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');const [info,setInfo]=useState('');
  const load=useCallback(async()=>{if(!token)return;setLoading(true);setError('');try{
    const [p,n,m]=await Promise.all([api<User>('/users/me',{token}),api<Notification[]>('/notifications',{token}),api<Membership>('/users/me/membership',{token})]);
    setProfile(p);setFullName(p.fullName||'');setPhone(p.phone||'');setNotifications(Array.isArray(n)?n:[]);
    setMembership(m&&typeof m==='object'&&!Array.isArray(m)?m:null);
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
  async function logout(){if(token){try{await api('/auth/logout',{method:'POST',token});}catch{/* Clear local session even when network fails. */}}onLogout()}
  if(forceAuth||!token)return <SimpleScroll>
    <View style={{marginTop:24,marginBottom:23}}><Kicker>WELCOME BACK</Kicker><Text style={[S.title,{fontSize:32,marginTop:10}]}>{mode==='login'?'Rất vui được gặp lại.':'Gia nhập CineHunt.'}</Text><Text style={[S.muted,{marginTop:9}]}>Tài khoản của bạn là tấm vé mở ra thế giới điện ảnh.</Text></View>
    <GlowPanel from="#3F285C" to="#172944" style={{marginBottom:23}}>
      <Text style={{fontSize:30,color:C.lavender}}>✦</Text><Text style={{fontSize:22,fontWeight:'900',color:C.white,marginTop:12}}>Mỗi suất chiếu là một trải nghiệm</Text>
      <Text style={{color:'#D1D2E9',lineHeight:21,fontSize:13,marginTop:8}}>Lưu lịch sử đặt vé, chọn ghế yêu thích và quản lý vé ngay trên iPhone.</Text>
    </GlowPanel>
    {mode==='register'&&<><Field label="Họ và tên" value={fullName} onChangeText={setFullName}/><Field label="Số điện thoại (tùy chọn)" value={phone} onChangeText={setPhone} keyboardType="phone-pad"/></>}
    <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address"/>
    <Field label="Mật khẩu" value={password} onChangeText={setPassword} secure/>
    {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}{!!info&&<Notice text={info}/>}
    <Button title={mode==='login'?'Đăng nhập  →':'Tạo tài khoản  →'} disabled={loading} onPress={()=>void submitAuth()}/>
    <Button kind="outline" title={mode==='login'?'Chưa có tài khoản? Đăng ký':'Đã có tài khoản? Đăng nhập'} onPress={()=>{setMode(mode==='login'?'register':'login');setError('')}}/>
    <Text style={[S.muted,{textAlign:'center',fontSize:11,marginTop:16}]}>Phiên đăng nhập hiện chưa được lưu khi ứng dụng tải lại.</Text>
  </SimpleScroll>;
  const isStaff=['STAFF','ADMIN'].includes(String(user?.role||profile?.role||'').toUpperCase());
  const progress=Math.min(100,Math.max(0,Number(membership?.progressPercent??0)||0));
  return <SimpleScroll>
    <View style={{marginTop:8,marginBottom:15}}><Kicker>MY CINEHUNT</Kicker><Text style={[S.title,{marginTop:8}]}>Tài khoản của tôi</Text></View>
    <GlowPanel from="#432C6D" to="#102940" style={{marginBottom:18}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:14}}>
        <View style={{width:64,height:64,borderRadius:22,backgroundColor:'#D9BDF333',borderWidth:1,borderColor:'#FFFFFF50',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:32,fontWeight:'900',color:C.lavender}}>{(profile?.fullName||user?.fullName||'C').charAt(0).toUpperCase()}</Text></View>
        <View style={{flex:1}}><Kicker color={C.lavender}>THÀNH VIÊN CINEHUNT</Kicker><Text style={{color:C.white,fontSize:20,fontWeight:'900',marginTop:7}} numberOfLines={1}>{profile?.fullName||user?.fullName||'Người yêu điện ảnh'}</Text><Text style={{color:'#D4D6EE',fontSize:12,marginTop:5}} numberOfLines={1}>{user?.email||profile?.email}</Text></View>
      </View>
      <View style={{height:1,backgroundColor:'#FFFFFF22',marginTop:18,marginBottom:14}}/>
      <View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={{color:'#E4DEF7',fontSize:12}}>HẠNG THÀNH VIÊN</Text><Text style={{color:C.green,fontWeight:'900',fontSize:12}}>{membership?.tier||'Member'}</Text></View>
      <View style={{flexDirection:'row',alignItems:'flex-end',marginTop:6,gap:8}}><Text style={{color:C.white,fontSize:32,fontWeight:'900'}}>{Number(membership?.points??0).toLocaleString('vi-VN')}</Text><Text style={{color:'#CDD3E7',fontSize:12,marginBottom:6}}>điểm tích lũy</Text></View>
      <View style={{marginTop:13,backgroundColor:'#FFFFFF28',height:8,borderRadius:9,overflow:'hidden'}}><View style={{height:'100%',width:`${progress}%`,backgroundColor:C.cyan,borderRadius:9}}/></View>
      <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:8}}><Text style={{color:'#D4D6EE',fontSize:11}}>Tiến độ: {progress}%</Text><Text style={{color:'#D4D6EE',fontSize:11}}>{membership?.nextTier?`Tiếp theo: ${membership.nextTier}`:'Hạng hiện tại'}</Text></View>
    </GlowPanel>
    {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}{!!info&&<Notice text={info}/>}
    <SectionHeading title="Hồ sơ cá nhân" subtitle="Thông tin dùng để đặt vé"/>
    <View style={S.card}><Field label="Họ và tên" value={fullName} onChangeText={setFullName}/><Field label="Số điện thoại" value={phone} onChangeText={setPhone} keyboardType="phone-pad"/><Button title="Lưu thay đổi  ✓" disabled={loading} onPress={()=>void saveProfile()}/></View>
    <View style={[S.card,{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}]}><View><Kicker>THỐNG KÊ TÀI KHOẢN</Kicker><Text style={{color:C.white,fontSize:15,fontWeight:'800',marginTop:7}}>Vé đã thanh toán</Text></View><Text style={{color:C.cyan,fontSize:26,fontWeight:'900'}}>{Number(membership?.paidBookings??0)}</Text></View>
    <SectionHeading title={`Thông báo (${notifications.length})`}/>
    <View style={S.card}>{notifications.length===0?<View style={{alignItems:'center',paddingVertical:15}}><Text style={{fontSize:28,color:C.purple}}>✉</Text><Text style={[S.muted,{marginTop:12}]}>Bạn chưa có thông báo mới.</Text></View>:notifications.slice(0,20).map((n,i)=><View key={String(n.notificationId||i)} style={{paddingVertical:13,borderBottomWidth:i===notifications.length-1?0:1,borderColor:C.stroke}}><Text style={{color:C.white,fontWeight:'800'}}>{n.title||'Thông báo'}</Text><Text style={[S.muted,{marginTop:6}]}>{n.message}</Text></View>)}</View>
    {isStaff&&<><SectionHeading title="Nhân viên · Soát vé" subtitle="Xác nhận vé hợp lệ theo quyền được phân công"/><View style={S.card}><Field label="Mã vé hoặc mã đơn" value={code} onChangeText={setCode} placeholder="TICKET-... hoặc BK-..."/><Button title="Kiểm tra và check-in" disabled={loading||!code.trim()} onPress={()=>Alert.alert('Soát vé?',`Xác nhận sử dụng mã ${code.trim()}?`,[{text:'Không',style:'cancel'},{text:'Check-in',onPress:()=>void checkIn()}])}/></View></>}
    <Button title="↻  Tải lại hồ sơ" kind="outline" disabled={loading} onPress={()=>void load()}/>
    <Button title="Đăng xuất" kind="danger" onPress={()=>Alert.alert('Đăng xuất?','Xóa JWT khỏi ứng dụng và đăng xuất khỏi Backend?', [{text:'Không',style:'cancel'},{text:'Đăng xuất',style:'destructive',onPress:()=>void logout()}])}/>
    <Text style={[S.muted,{textAlign:'center',fontSize:11,marginTop:13}]}>Thanh toán chỉ được xác nhận bởi hệ thống hoặc nhân viên có thẩm quyền.</Text>
  </SimpleScroll>;
}

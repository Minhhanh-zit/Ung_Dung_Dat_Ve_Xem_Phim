import {useCallback,useEffect,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {api,errorMessage,formatDate,formatMoney} from './api';
import {Button,C,Loader,Notice,S,SimpleScroll} from './ui';
import type {Booking} from './types';

type Props={token:string|null;revision:number;onOpen:(ref:string)=>void;onAuth:()=>void};
export default function Orders({token,revision,onOpen,onAuth}:Props){
  const [items,setItems]=useState<Booking[]>([]);const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  const load=useCallback(async()=>{if(!token)return;setLoading(true);setError('');try{const r=await api<Booking[]>('/bookings/my',{token});if(!Array.isArray(r))throw new Error('Phản hồi lịch sử đơn không hợp lệ');setItems(r);}catch(e){setError(errorMessage(e))}finally{setLoading(false)}},[token]);
  useEffect(()=>{void load()},[load,revision]);
  return <SimpleScroll><Text style={S.title}>Đơn và vé của tôi</Text>
    <Text style={[S.muted,{marginVertical:12}]}>Tải trực tiếp từ tài khoản CineHunt. Chỉ đơn đã thanh toán mới có vé QR.</Text>
    {!token?<><Notice text="Đăng nhập để xem lịch sử đặt vé."/><Button title="Đăng nhập" onPress={onAuth}/></>:<>
      {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}
      {!loading&&!error&&items.length===0&&<Notice text="Bạn chưa có đơn đặt vé nào."/>}
      {items.map(b=><Pressable key={String(b.bookingId)} onPress={()=>onOpen(String(b.bookingId))} style={S.card} accessibilityRole="button">
        <Text style={{color:C.cyan,fontWeight:'900',fontSize:15}}>{b.bookingCode}</Text>
        <Text style={[S.h2,{fontSize:16,marginTop:12}]}>{b.showtime?.movie?.title||`Suất #${b.showtimeId}`}</Text>
        {!!b.showtime?.startTime&&<Text style={[S.muted,{marginTop:7}]}>{formatDate(b.showtime.startTime)}</Text>}
        <Text style={[S.muted,{marginTop:7}]}>Trạng thái: {b.status}</Text>
        <Text style={{color:C.green,fontWeight:'900',fontSize:20,marginTop:9}}>{formatMoney(b.totalAmount)}</Text>
        <Text style={{color:C.purple,marginTop:9,fontWeight:'700'}}>Xem đơn {['PAID','CONFIRMED'].includes(b.status)?'và vé QR':'và thanh toán'} ›</Text>
      </Pressable>)}
      <Button title="Làm mới lịch sử đơn" kind="outline" disabled={loading} onPress={()=>void load()}/>
    </>}
  </SimpleScroll>;
}

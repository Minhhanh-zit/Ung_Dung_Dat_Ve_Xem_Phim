import {useCallback,useEffect,useMemo,useState} from 'react';
import {Pressable,ScrollView,Text,View} from 'react-native';
import {api,errorMessage,formatDate,formatMoney} from './api';
import {Button,C,GlowPanel,Kicker,Loader,Notice,S,SectionHeading,SimpleScroll,StatusPill} from './ui';
import type {Booking} from './types';

type Props={token:string|null;revision:number;onOpen:(ref:string)=>void;onAuth:()=>void};
type Filter='ALL'|'ACTIVE'|'DONE'|'CANCELLED';
export default function Orders({token,revision,onOpen,onAuth}:Props){
  const [items,setItems]=useState<Booking[]>([]);
  const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [filter,setFilter]=useState<Filter>('ALL');
  const load=useCallback(async()=>{if(!token)return;setLoading(true);setError('');try{
    const r=await api<Booking[]>('/bookings/my',{token});if(!Array.isArray(r))throw new Error('Phản hồi lịch sử đơn không hợp lệ');setItems(r);
  }catch(e){setError(errorMessage(e))}finally{setLoading(false)}},[token]);
  useEffect(()=>{void load()},[load,revision]);
  const visible=useMemo(()=>items.filter(b=>filter==='ALL'||filter==='ACTIVE'&&b.status==='PENDING_PAYMENT'||filter==='DONE'&&['PAID','CONFIRMED'].includes(b.status)||filter==='CANCELLED'&&['CANCELLED','EXPIRED'].includes(b.status)),[items,filter]);
  const completed=items.filter(b=>['PAID','CONFIRMED'].includes(b.status)).length;
  return <SimpleScroll refreshing={loading&&items.length>0} onRefresh={()=>void load()}>
    <View style={{marginTop:8,marginBottom:16}}><Kicker>MY TICKETS</Kicker><Text style={[S.title,{marginTop:8}]}>Đơn & vé của tôi</Text><Text style={[S.muted,{marginTop:7}]}>Một nơi lưu giữ những cuộc hẹn với màn ảnh rộng.</Text></View>
    <GlowPanel from="#3D2A68" to="#10283E" style={{marginBottom:20}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
        <View><Kicker color={C.lavender}>CINEHUNT PASS</Kicker><Text style={{fontSize:24,color:C.white,fontWeight:'900',marginTop:11}}>Vé của bạn, mọi lúc.</Text><Text style={{color:'#D9D5ED',fontSize:12,marginTop:8}}>Vé QR xuất hiện khi thanh toán hợp lệ.</Text></View>
        <View style={{width:55,height:55,borderRadius:17,backgroundColor:'#FFFFFF18',borderWidth:1,borderColor:'#FFFFFF44',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:29,color:C.lavender}}>▣</Text></View>
      </View>
      <View style={{height:1,backgroundColor:'#FFFFFF24',marginVertical:17}}/>
      <View style={{flexDirection:'row',justifyContent:'space-around'}}><View><Text style={{fontSize:21,fontWeight:'900',color:C.white}}>{items.length}</Text><Text style={{color:'#CFD1E6',fontSize:11}}>Tổng đơn</Text></View><View><Text style={{fontSize:21,fontWeight:'900',color:C.green}}>{completed}</Text><Text style={{color:'#CFD1E6',fontSize:11}}>Đã thanh toán</Text></View></View>
    </GlowPanel>
    {!token?<><Notice text="Đăng nhập để xem lịch sử đặt vé của bạn."/><Button title="Đăng nhập để xem vé" onPress={onAuth}/></>:<>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:3}}>
        {([['ALL','Tất cả'],['ACTIVE','Chờ thanh toán'],['DONE','Đã thanh toán'],['CANCELLED','Đã hủy']] as const).map(([v,label])=><Pressable key={v} onPress={()=>setFilter(v)} style={{borderRadius:13,paddingVertical:11,paddingHorizontal:13,backgroundColor:filter===v?C.purple:C.panel2,borderWidth:1,borderColor:filter===v?C.purple:C.stroke}}><Text style={{fontSize:12,fontWeight:'800',color:filter===v?C.bg:C.muted}}>{label}</Text></Pressable>)}
      </ScrollView>
      <SectionHeading title="Lịch sử đặt vé" subtitle={`${visible.length} đơn được tìm thấy`}/>
      {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}
      {!loading&&!error&&visible.length===0&&<View style={[S.card,{alignItems:'center',paddingVertical:30}]}><Text style={{fontSize:34,color:C.purple}}>▣</Text><Text style={{color:C.white,fontWeight:'900',fontSize:16,marginTop:12}}>Chưa có đơn phù hợp</Text><Text style={[S.muted,{textAlign:'center',marginTop:7}]}>Đổi bộ lọc hoặc khám phá thêm phim mới nhé.</Text></View>}
      {visible.map(b=><Pressable key={String(b.bookingId)} onPress={()=>onOpen(String(b.bookingId))} accessibilityRole="button" style={[S.card,{padding:0,overflow:'hidden'}]}>
        <View style={{height:4,backgroundColor:['PAID','CONFIRMED'].includes(b.status)?C.green:b.status==='PENDING_PAYMENT'?C.orange:'#774662'}}/>
        <View style={{padding:17}}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8}}><Kicker color={C.cyan}>VÉ CINEHUNT</Kicker><StatusPill status={b.status}/></View>
          <Text style={{color:C.white,fontSize:18,fontWeight:'900',marginTop:13,lineHeight:24}}>{b.showtime?.movie?.title||`Suất chiếu #${b.showtimeId}`}</Text>
          {!!b.showtime?.startTime&&<Text style={[S.muted,{marginTop:7}]}>◷  {formatDate(b.showtime.startTime)}</Text>}
          <Text style={[S.muted,{marginTop:7}]} numberOfLines={1}>Mã đơn: {b.bookingCode}</Text>
          <View style={{height:1,backgroundColor:C.stroke,marginVertical:15,borderStyle:'dashed'}}/>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{color:C.green,fontSize:22,fontWeight:'900'}}>{formatMoney(b.totalAmount)}</Text><Text style={{color:C.purple,fontSize:13,fontWeight:'900'}}>Chi tiết  ↗</Text></View>
        </View>
      </Pressable>)}
      <Button title="↻  Làm mới danh sách" kind="outline" disabled={loading} onPress={()=>void load()}/>
    </>}
  </SimpleScroll>;
}

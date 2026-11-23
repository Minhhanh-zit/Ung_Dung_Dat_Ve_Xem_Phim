import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Alert,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {api,createKey,errorMessage,formatDate,formatMoney} from '../services/apiClient';
import {Button,C,GlowPanel,Kicker,Loader,Notice,S,SectionHeading,SimpleScroll} from './ui';
import type {Booking,Hold,Seat,SeatMap,Showtime,User} from '../types';

type Props={token:string|null;user:User|null;showtime:Showtime;onAuth:()=>void;onBooking:(id:string)=>void};
export default function SeatFlow({token,user,showtime,onAuth,onBooking}:Props){
  const [map,setMap]=useState<SeatMap|null>(null);
  const [holds,setHolds]=useState<Hold[]>([]);
  const [existing,setExisting]=useState<Booking|null>(null);
  const [loading,setLoading]=useState(false);
  const [verified,setVerified]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [warning,setWarning]=useState('');
  const [combos,setCombos]=useState<{comboId:number;name:string;price:number|string}[]>([]);
  const [quantities,setQuantities]=useState<Record<number,number>>({});
  const [voucher,setVoucher]=useState('');
  const [now,setNow]=useState<number|null>(null);
  const [entryStartedAt,setEntryStartedAt]=useState<number|null>(null);
  const inFlight=useRef(false);
  const bookingKey=useRef<string|null>(null);
  const uncertain=useRef(false);
  const [uncertainUI,setUncertainUI]=useState(false);
  const expiredOnce=useRef('');
  useEffect(()=>{
    const tick=()=>{const time=Date.now();setNow(time);setEntryStartedAt(old=>old??time)};
    const initial=setTimeout(tick,0);
    const interval=setInterval(tick,1000);
    return ()=>{clearTimeout(initial);clearInterval(interval)};
  },[]);
  const load=useCallback(async()=>{
    if(!token)return;
    setLoading(true);setError('');setVerified(false);
    try{
      const [m,h,b]=await Promise.all([
        api<SeatMap>(`/showtime-seats/${showtime.showtimeId}`,{token}),
        api<Hold[]>('/showtime-seats/my-holds/list',{token}),
        api<Booking[]>('/bookings/my',{token}),
      ]);
      if(!Array.isArray(m.seats)||!Array.isArray(h)||!Array.isArray(b))throw new Error('Phản hồi dữ liệu chưa hợp lệ');
      setMap(m);
      const ids=new Set(m.seats.map(s=>s.showtimeSeatId));
      setHolds(h.filter(x=>ids.has(Number(x.showtimeSeatId))&&new Date(x.expiresAt).getTime()>Date.now()));
      setExisting(b.find(x=>Number(x.showtimeId)===showtime.showtimeId&&x.status==='PENDING_PAYMENT'&&(!x.expiresAt||new Date(x.expiresAt).getTime()>Date.now()))??null);
      setVerified(true);
    }catch(e){setError(errorMessage(e));}finally{setLoading(false)}
  },[token,showtime.showtimeId]);
  useEffect(()=>{const timer=setTimeout(()=>{void load()},0);return ()=>clearTimeout(timer)},[load]);
  useEffect(()=>{let active=true;void api<{comboId:number;name:string;price:number|string}[]>('/concession-combos').then(data=>{if(active&&Array.isArray(data))setCombos(data)}).catch(()=>{});return ()=>{active=false};},[]);
  const rows=useMemo(()=>{
    const groups=new Map<string,Seat[]>();
    for(const s of map?.seats??[]){const row=s.seatRow??'?';groups.set(row,[...(groups.get(row)??[]),s]);}
    return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([row,seats])=>[row,seats.sort((a,b)=>(a.seatNumber??0)-(b.seatNumber??0))] as const);
  },[map]);
  const validHolds=now===null?holds:holds.filter(h=>new Date(h.expiresAt).getTime()>now);
  const expires=validHolds.length?Math.min(...validHolds.map(h=>new Date(h.expiresAt).getTime())):0;
  const seconds=now===null?0:expires?Math.max(0,Math.ceil((expires-now)/1000)):0;
  // Selection timer starts on entering the screen, SQL holds only after tapping seats.
  const browsingSeconds=now===null||entryStartedAt===null?600:Math.max(0,Math.ceil((entryStartedAt+600000-now)/1000));
  const shownSeconds=validHolds.length?seconds:browsingSeconds;
  const total=validHolds.reduce((sum,h)=>sum+Number(h.price??map?.seats.find(s=>s.showtimeSeatId===Number(h.showtimeSeatId))?.price??0),0);
  useEffect(()=>{
    if(now===null||!holds.length||validHolds.length)return;
    const fingerprint=holds.map(h=>h.holdId).join('/');
    if(expiredOnce.current===fingerprint)return;
    expiredOnce.current=fingerprint;
    setWarning('Lượt giữ ghế đã hết hạn. Đang tải lại trạng thái từ server.');
    void load();
  },[now,holds,validHolds.length,load]);
  async function toggle(s:Seat){
    if(!token||inFlight.current||!verified||!map||existing||busy)return;
    if(!validHolds.length && browsingSeconds===0){
      Alert.alert('Hết thời gian chọn ghế','Hãy tải lại sơ đồ để bắt đầu phiên chọn ghế mới.');
      return;
    }
    const own = validHolds.find(h=>Number(h.showtimeSeatId)===s.showtimeSeatId);
    if(!own && s.status!=='AVAILABLE')return;
    if(!own && validHolds.length>=8){Alert.alert('Giới hạn','Tối đa 8 ghế.');return;}
    inFlight.current=true;setBusy(true);setError('');setWarning('');
    try{
      if(own){
        await api(`/showtime-seats/release/${encodeURIComponent(String(own.holdId))}`,{token,method:'POST'});
      }else{
        const r=await api<Hold>('/showtime-seats/hold',{
          method:'POST',token,
          body:{showtimeSeatId:s.showtimeSeatId,holdMinutes:10},
          timeout:18000,
        });
        if(!r.holdId || Number(r.showtimeSeatId)!==s.showtimeSeatId)throw new Error('Chưa xác minh được lượt giữ ghế');
      }
      await load();
    }catch(e){
      const message=errorMessage(e);
      await load();
      setError(message);
      setWarning('Có thể máy chủ đã xử lý nhưng kết nối bị gián đoạn. Đã tải lại trạng thái ghế, hãy kiểm tra trước khi chạm tiếp.');
    }finally{inFlight.current=false;setBusy(false)}
  }
  async function release(){
    if(!token||inFlight.current||!validHolds.length)return;
    inFlight.current=true;setBusy(true);setError('');
    const failed:string[]=[];
    try{
      for(const h of validHolds){
        try{await api(`/showtime-seats/release/${encodeURIComponent(String(h.holdId))}`,{token,method:'POST'});}catch{failed.push(h.seatLabel)}
      }
      await load();
      if(failed.length)setWarning(`Chưa xác nhận nhả ghế: ${failed.join(', ')}. Xem trạng thái mới trước khi thử lại.`);
    }finally{inFlight.current=false;setBusy(false)}
  }
  async function makeBooking(){
    if(!token||inFlight.current||!verified||existing||!validHolds.length||uncertain.current)return;
    if(validHolds.length>8){setError('Tối đa 8 ghế.');return;}
    inFlight.current=true;setBusy(true);setError('');
    if(!bookingKey.current)bookingKey.current=createKey();
    try{
      const products=combos.filter(x=>(quantities[x.comboId]||0)>0).map(x=>({productId:x.comboId,quantity:quantities[x.comboId]}));
      const data=await api<Booking>('/bookings',{method:'POST',token,body:{holdIds:validHolds.map(x=>String(x.holdId)),idempotencyKey:bookingKey.current,products,voucherCode:voucher.trim()||undefined}});
      if(!data.bookingId||data.status!=='PENDING_PAYMENT')throw new Error('Không xác nhận được trạng thái tạo đơn');
      onBooking(String(data.bookingId));
    }catch(e){
      try{
        const orders=await api<Booking[]>('/bookings/my',{token});
        const found=orders.find(b=>b.idempotencyKey===bookingKey.current);
        if(found){onBooking(String(found.bookingId));return;}
        uncertain.current=true;setUncertainUI(true);setWarning('Chưa tìm thấy đơn theo khóa chống trùng. KHÔNG tạo lại ngay. Hãy kiểm tra lịch sử đơn.');
      }catch{uncertain.current=true;setUncertainUI(true);setWarning('Không xác định được kết quả, không gửi lại. Vào Đơn & vé để kiểm tra trước.');}
      setError(errorMessage(e));
    }finally{inFlight.current=false;setBusy(false)}
  }
  if(!token)return <SimpleScroll><Kicker>SEAT SELECTION</Kicker><Text style={[S.title,{marginTop:9}]}>Chọn chỗ ngồi</Text><Notice text="Đăng nhập để xem sơ đồ ghế và giữ ghế trên hệ thống."/><Button title="Đăng nhập để chọn ghế" onPress={onAuth}/></SimpleScroll>;
  return <SimpleScroll>
    <View style={{marginTop:7}}><Kicker>YOUR CINEMA EXPERIENCE</Kicker><Text style={[S.title,{marginTop:8}]}>Chọn ghế ngồi</Text><Text style={[S.muted,{marginTop:7}]}>Suất #{showtime.showtimeId}  •  {formatDate(showtime.startTime)}</Text></View>
    <GlowPanel from="#3B2866" to="#0D3041" style={{marginTop:20,marginBottom:13}}><Kicker color={C.lavender}>RẠP CHIẾU</Kicker><Text style={{fontSize:20,color:C.hero,fontWeight:'900',marginTop:8}}>{map?.cinemaName||showtime.room?.cinema?.cinemaName||'CineHunt Cinema'}</Text><Text style={{color:'#D2D3E8',marginTop:7,fontSize:12}}>Phòng {map?.roomName||showtime.room?.roomName||'Đang tải'}  •  {map?.totalSeats??'—'} ghế</Text></GlowPanel>
    <View style={{padding:12,marginBottom:10,borderRadius:14,backgroundColor:C.panel,borderWidth:1,borderColor:C.stroke}}>
      <Text style={{color:C.white,fontWeight:'900',fontSize:17}}>◷  Thời gian còn lại: {Math.floor(shownSeconds/60)}:{String(shownSeconds%60).padStart(2,'0')}</Text>
      <Text style={{color:C.muted,fontSize:11,marginTop:5}}>{validHolds.length?'Ghế của bạn đã được giữ trên SQL Server.':'Bạn có 10 phút chọn ghế. Hệ thống sẽ tự giữ ghế 10 phút kể từ khi bạn chạm; chỉ xem sơ đồ sẽ không chiếm ghế.'}</Text>
    </View>
    {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}{!!warning&&<Notice text={warning} bad/>}
    {existing&&<View style={S.card}><Text style={S.h2}>Bạn đã có đơn chờ thanh toán</Text><Text style={[S.muted,{marginVertical:9}]}>{existing.bookingCode}</Text><Button title="Mở đơn đã tạo  →" onPress={()=>onBooking(String(existing.bookingId))}/></View>}
    {map&&<>
      <View style={[S.card,{paddingHorizontal:12,paddingVertical:20,marginTop:6}]}>
        <View style={{alignItems:'center',marginHorizontal:25,marginBottom:27}}><View style={{height:6,width:'100%',backgroundColor:C.cyan,borderRadius:9,shadowColor:C.cyan,shadowOpacity:.6,shadowRadius:17,shadowOffset:{width:0,height:3}}}/><Text style={{color:C.muted,fontSize:10,letterSpacing:3,marginTop:13,fontWeight:'800'}}>MÀN HÌNH CHIẾU</Text></View>
        {rows.map(([name,seats])=><View key={name} style={{flexDirection:'row',alignItems:'center',marginBottom:9,gap:5}}>
          <Text style={{color:C.soft,fontSize:12,fontWeight:'900',width:21,textAlign:'center'}}>{name}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:5,paddingRight:7}}>
            {seats.map(s=>{
              const heldByMe=validHolds.some(h=>Number(h.showtimeSeatId)===s.showtimeSeatId);
              const available=s.status==='AVAILABLE';
              const seatColor=heldByMe?C.cyan:available?C.seatFree:s.status==='BLOCKED'?C.seatBlocked:C.seatOff;
              return <Pressable key={s.showtimeSeatId} disabled={(!available&&!heldByMe)||!!existing||!verified||busy} onPress={()=>void toggle(s)} accessibilityRole="button" accessibilityLabel={`Ghế ${s.seatLabel}, ${s.status}`} style={{width:35,height:36,backgroundColor:seatColor,borderWidth:1,borderColor:heldByMe?C.cyan:available?C.okLine:C.stroke,borderRadius:10,alignItems:'center',justifyContent:'center'}}><Text style={{color:heldByMe?C.bg:available?C.okText:C.muted,fontWeight:'900',fontSize:11}}>{s.seatNumber??s.seatLabel}</Text></Pressable>;
            })}
          </ScrollView>
        </View>)}
        {!map.seatsGenerated&&<Notice text="Suất chiếu này chưa tạo sơ đồ ghế." bad/>}
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:12,marginTop:20,justifyContent:'center'}}>
          {([[C.seatFree,'Trống'],[C.cyan,'Bạn đang giữ'],[C.seatOff,'Không khả dụng']] as const).map(([color,label])=><View key={label} style={{flexDirection:'row',alignItems:'center',gap:5}}><View style={{width:10,height:10,borderRadius:3,backgroundColor:color}}/><Text style={{color:C.muted,fontSize:10}}>{label}</Text></View>)}
        </View>
      </View>
      <GlowPanel from="#2B285C" to="#103242" style={{marginBottom:16}}>
        <Kicker color={C.lavender}>ĐƠN ĐẶT VÉ</Kicker>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:8}}><Text style={{color:C.hero,fontSize:15,fontWeight:'700'}}>Đang giữ {validHolds.length}/8 ghế</Text><Text style={{color:C.heroGreen,fontSize:23,fontWeight:'900'}}>{formatMoney(total)}</Text></View>
        <Text style={{color:'#CACDE6',fontSize:11,marginTop:9}}>Chạm ghế trống để tự giữ 10 phút trên SQL Server. Chạm lại ghế mình đang giữ để bỏ chọn. Giá do Backend tính.</Text>
      </GlowPanel>
      {!!validHolds.length&&<View style={S.card}>
        <Kicker color={C.green}>✓  GIỮ GHẾ THÀNH CÔNG</Kicker>
        <Text style={[S.h2,{marginTop:10}]}>{validHolds.map(x=>x.seatLabel).join(' · ')}</Text>
        <Text style={{color:C.cyan,fontSize:29,fontWeight:'900',marginTop:12,marginBottom:13}}>◷  {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</Text>
        <Button title="Nhả các ghế đang giữ" kind="outline" disabled={busy} onPress={()=>Alert.alert('Nhả ghế?','Nhả toàn bộ lượt giữ hiện tại?', [{text:'Không',style:'cancel'},{text:'Nhả ghế',style:'destructive',onPress:()=>void release()}])}/>
      </View>}
      {!existing&&!validHolds.length&&<Notice text="Chạm một ghế trống để bắt đầu giữ tự động 10 phút. Đồng hồ bắt đầu khi server xác nhận giữ ghế, không phải khi mở sơ đồ."/>}
      {!existing&&validHolds.length>0&&<>
        <SectionHeading title="Bắp nước & ưu đãi" subtitle="Thêm combo cho trải nghiệm trọn vẹn"/>
        <View style={S.card}>
          {combos.map(co=><View key={co.comboId} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.stroke}}>
            <View style={{width:38,height:38,backgroundColor:C.iconC,borderRadius:12,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:20}}>🍿</Text></View>
            <View style={{flex:1}}><Text style={{color:C.white,fontWeight:'800',fontSize:13}}>{co.name}</Text><Text style={{color:C.green,fontSize:12,marginTop:5}}>{formatMoney(co.price)}</Text></View>
            <View style={{flexDirection:'row',alignItems:'center',gap:7}}><Pressable onPress={()=>setQuantities(v=>({...v,[co.comboId]:Math.max(0,(v[co.comboId]||0)-1)}))} style={[S.pill,{paddingHorizontal:10,paddingVertical:8}]}><Text style={S.text}>−</Text></Pressable><Text style={{color:C.white,fontWeight:'900',minWidth:15,textAlign:'center'}}>{quantities[co.comboId]||0}</Text><Pressable onPress={()=>setQuantities(v=>({...v,[co.comboId]:Math.min(10,(v[co.comboId]||0)+1)}))} style={[S.pill,{paddingHorizontal:10,paddingVertical:8}]}><Text style={S.text}>+</Text></Pressable></View>
          </View>)}
          <TextInput placeholder="Mã giảm giá (nếu có)" placeholderTextColor={C.soft} value={voucher} onChangeText={setVoucher} autoCapitalize="characters" style={S.input}/>
        </View>
        <Button title="Tiếp tục tạo đơn chờ thanh toán  →" disabled={!verified||busy||uncertainUI} onPress={()=>Alert.alert('Xác nhận đặt vé',`Chuyển ${validHolds.length} ghế đang giữ thành đơn chờ thanh toán?`,[{text:'Không',style:'cancel'},{text:'Tạo đơn',onPress:()=>void makeBooking()}])}/>
      </>}
      <View style={{marginTop:12}}><Button title="↻  Làm mới sơ đồ và trạng thái ghế" kind="outline" disabled={busy||loading} onPress={()=>{setEntryStartedAt(Date.now());void load()}}/></View>
    </>}
  </SimpleScroll>;
}

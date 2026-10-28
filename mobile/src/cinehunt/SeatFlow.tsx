import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Alert,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {api,createKey,errorMessage,formatDate,formatMoney} from './api';
import {Button,C,Loader,Notice,S,SimpleScroll} from './ui';
import type {Booking,Hold,Seat,SeatMap,Showtime,User} from './types';

type Props={token:string|null;user:User|null;showtime:Showtime;onAuth:()=>void;onBooking:(id:string)=>void};
export default function SeatFlow({token,user,showtime,onAuth,onBooking}:Props){
  const [map,setMap]=useState<SeatMap|null>(null);
  const [holds,setHolds]=useState<Hold[]>([]);
  const [selected,setSelected]=useState<number[]>([]);
  const [existing,setExisting]=useState<Booking|null>(null);
  const [loading,setLoading]=useState(false);
  const [verified,setVerified]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [warning,setWarning]=useState('');
  const [combos,setCombos]=useState<{comboId:number;name:string;price:number|string}[]>([]);
  const [quantities,setQuantities]=useState<Record<number,number>>({});
  const [voucher,setVoucher]=useState('');
  const [now,setNow]=useState(Date.now());
  const inFlight=useRef(false);
  const bookingKey=useRef<string|null>(null);
  const uncertain=useRef(false);
  const expiredOnce=useRef('');
  useEffect(()=>{const i=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(i)},[]);
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
      setSelected([]);
      setExisting(b.find(x=>Number(x.showtimeId)===showtime.showtimeId&&x.status==='PENDING_PAYMENT'&&(!x.expiresAt||new Date(x.expiresAt).getTime()>Date.now()))??null);
      setVerified(true);
    }catch(e){setError(errorMessage(e));}finally{setLoading(false)}
  },[token,showtime.showtimeId]);
  useEffect(()=>{void load()},[load]);
  useEffect(()=>{let active=true;void api<{comboId:number;name:string;price:number|string}[]>('/concession-combos').then(data=>{if(active&&Array.isArray(data))setCombos(data)}).catch(()=>{});return ()=>{active=false};},[]);
  const rows=useMemo(()=>{
    const groups=new Map<string,Seat[]>();
    for(const s of map?.seats??[]){const row=s.seatRow??'?';groups.set(row,[...(groups.get(row)??[]),s]);}
    return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([row,seats])=>[row,seats.sort((a,b)=>(a.seatNumber??0)-(b.seatNumber??0))] as const);
  },[map]);
  const validHolds=holds.filter(h=>new Date(h.expiresAt).getTime()>now);
  const expires=validHolds.length?Math.min(...validHolds.map(h=>new Date(h.expiresAt).getTime())):0;
  const seconds=expires?Math.max(0,Math.ceil((expires-now)/1000)):0;
  const selectedItems=(map?.seats??[]).filter(s=>selected.includes(s.showtimeSeatId));
  const total=selectedItems.reduce((a,s)=>a+Number(s.price),0);
  useEffect(()=>{
    if(!holds.length||validHolds.length)return;
    const fingerprint=holds.map(h=>h.holdId).join('/');
    if(expiredOnce.current===fingerprint)return;
    expiredOnce.current=fingerprint;
    setWarning('Lượt giữ ghế đã hết hạn. Đang tải lại trạng thái từ server.');
    void load();
  },[now,holds,validHolds.length,load]);
  function toggle(s:Seat){
    if(!verified||busy||existing||validHolds.length||s.status!=='AVAILABLE')return;
    setSelected(v=>v.includes(s.showtimeSeatId)?v.filter(x=>x!==s.showtimeSeatId):v.length>=8?(Alert.alert('Giới hạn','Tối đa 8 ghế.'),v):[...v,s.showtimeSeatId]);
  }
  async function hold(){
    if(!token||inFlight.current||!verified||!map||existing||validHolds.length)return;
    if(!selected.length||selected.length>8){setError('Chỉ được chọn từ 1 đến 8 ghế.');return;}
    if(!selected.every(id=>map.seats.some(s=>s.showtimeSeatId===id&&s.status==='AVAILABLE'))){setError('Ghế không còn hợp lệ. Hãy tải lại.');return;}
    inFlight.current=true;setBusy(true);setError('');setWarning('');
    try{
      const r=await api<Hold[]>('/showtime-seats/hold-many',{method:'POST',token,body:{showtimeSeatIds:selected,holdMinutes:5},timeout:18000});
      if(!Array.isArray(r)||r.length!==selected.length)throw new Error('Phản hồi giữ ghế chưa được xác nhận.');
      setHolds(r);setSelected([]);
      await load();
    }catch(e){setWarning('Nếu mất mạng, request giữ ghế có thể đã thành công. Không bấm lại ngay.');setError(errorMessage(e));await load();}
    finally{inFlight.current=false;setBusy(false)}
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
        uncertain.current=true;setWarning('Chưa tìm thấy đơn theo khóa chống trùng. KHÔNG tạo lại ngay. Hãy kiểm tra lịch sử đơn.');
      }catch{uncertain.current=true;setWarning('Không xác định được kết quả, không gửi lại. Vào Đơn & vé để kiểm tra trước.');}
      setError(errorMessage(e));
    }finally{inFlight.current=false;setBusy(false)}
  }
  if(!token)return <SimpleScroll><Text style={S.title}>Chọn ghế</Text><Notice text="Đăng nhập để xem sơ đồ ghế và giữ ghế thật."/><Button title="Đăng nhập" onPress={onAuth}/></SimpleScroll>;
  return <SimpleScroll>
    <Text style={S.title}>Chọn ghế</Text>
    <Text style={[S.muted,{marginTop:7}]}>Suất #{showtime.showtimeId} · {formatDate(showtime.startTime)}</Text>
    {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}{!!warning&&<Notice text={warning} bad/>}
    {existing&&<View style={[S.card,{marginTop:16}]}><Text style={S.h2}>Đã có đơn chờ thanh toán</Text><Text style={[S.muted,{marginVertical:9}]}>{existing.bookingCode}</Text><Button title="Mở đơn đã tạo" onPress={()=>onBooking(String(existing.bookingId))}/></View>}
    {map&&<>
      <Text style={[S.h2,{marginTop:22}]}>{map.cinemaName||'CineHunt'}</Text>
      <Text style={[S.muted,{marginTop:6}]}>{map.roomName} · {map.totalSeats} ghế</Text>
      <View style={{backgroundColor:'#35405A',borderRadius:10,padding:14,alignItems:'center',marginTop:24,marginBottom:24}}><Text style={{color:C.white,letterSpacing:3}}>MÀN HÌNH CHIẾU</Text></View>
      {rows.map(([name,seats])=><View key={name} style={{flexDirection:'row',alignItems:'center',marginBottom:8}}><Text style={{color:C.purple,fontSize:16,fontWeight:'900',width:28}}>{name}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={{flexDirection:'row',gap:7}}>{seats.map(s=>{
        const active=selected.includes(s.showtimeSeatId);
        const can=s.status==='AVAILABLE';
        return <Pressable key={s.showtimeSeatId} disabled={!can||!!existing||validHolds.length>0||!verified} onPress={()=>toggle(s)} accessibilityRole="button" accessibilityLabel={`Ghế ${s.seatLabel}, ${s.status}`} style={{width:43,height:43,backgroundColor:active?C.purple:can?C.green:'#576178',borderRadius:9,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.bg,fontWeight:'900',fontSize:15}}>{s.seatNumber}</Text></Pressable>;
      })}</View></ScrollView></View>)}
      {!map.seatsGenerated&&<Notice text="Suất chiếu này chưa tạo sơ đồ ghế." bad/>}
      <Text style={[S.muted,{marginTop:14}]}>Xanh: còn trống · Tím: bạn chọn · Xám: đã giữ/bán/khóa</Text>
      <View style={[S.card,{marginTop:24}]}><Text style={S.h2}>Ghế đang chọn: {selected.length}/8</Text><Text style={{color:C.green,fontSize:25,fontWeight:'900',marginVertical:10}}>{formatMoney(total)}</Text><Text style={S.muted}>Chọn trên màn hình chưa có nghĩa là giữ ghế.</Text></View>
      {!!validHolds.length&&<View style={S.card}><Text style={{color:C.green,fontWeight:'800'}}>Đã giữ trên SQL Server</Text><Text style={[S.h2,{marginTop:10}]}>{validHolds.map(x=>x.seatLabel).join(', ')}</Text><Text style={{color:C.green,fontSize:23,fontWeight:'900',marginVertical:12}}>Còn {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</Text><Button title="Nhả các ghế đang giữ" kind="outline" disabled={busy} onPress={()=>Alert.alert('Nhả ghế?','Nhả toàn bộ lượt giữ hiện tại?', [{text:'Không',style:'cancel'},{text:'Nhả ghế',style:'destructive',onPress:()=>void release()}])}/></View>}
      {!existing&&<Button title={busy?'Đang xử lý...':`Giữ ${selected.length} ghế trong 5 phút`} disabled={!verified||busy||selected.length===0||validHolds.length>0||uncertain.current} onPress={()=>Alert.alert('Giữ ghế thật',`Giữ ${selected.length} ghế trong 5 phút?`,[{text:'Quay lại',style:'cancel'},{text:'Giữ ghế',onPress:()=>void hold()}])}/>}
      {!existing&&validHolds.length>0&&<View style={S.card}>
        <Text style={S.h2}>Combo và ưu đãi</Text>
        <Text style={[S.muted,{marginVertical:9}]}>Giá cuối cùng được Backend tính khi tạo đơn; mã giảm giá sẽ được xác thực tại server.</Text>
        {combos.map(co=><View key={co.comboId} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginVertical:5}}><View style={{flex:1}}><Text style={S.text}>{co.name}</Text><Text style={S.muted}>{formatMoney(co.price)}</Text></View><View style={{flexDirection:'row',alignItems:'center',gap:10}}><Pressable onPress={()=>setQuantities(v=>({...v,[co.comboId]:Math.max(0,(v[co.comboId]||0)-1)}))} style={S.pill}><Text style={S.text}>−</Text></Pressable><Text style={S.text}>{quantities[co.comboId]||0}</Text><Pressable onPress={()=>setQuantities(v=>({...v,[co.comboId]:Math.min(10,(v[co.comboId]||0)+1)}))} style={S.pill}><Text style={S.text}>+</Text></Pressable></View></View>)}
        <TextInput placeholder="Mã voucher (nếu có)" placeholderTextColor="#7E8DAA" value={voucher} onChangeText={setVoucher} autoCapitalize="characters" style={S.input}/>
      </View>}
      {!existing&&validHolds.length>0&&<Button title="Tiếp tục tạo đơn chờ thanh toán" disabled={!verified||busy||uncertain.current} onPress={()=>Alert.alert('Tạo đơn?',`Chuyển ${validHolds.length} ghế đang giữ thành đơn chờ thanh toán?`,[{text:'Không',style:'cancel'},{text:'Tạo đơn',onPress:()=>void makeBooking()}])}/>}
      <Button title="Tải lại ghế, lượt giữ và đơn hàng" kind="outline" disabled={busy||loading} onPress={()=>void load()}/>
    </>}
  </SimpleScroll>;
}

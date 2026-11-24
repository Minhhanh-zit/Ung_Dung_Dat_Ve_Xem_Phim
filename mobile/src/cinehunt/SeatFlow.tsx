import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Alert,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {api,createKey,errorMessage,formatDate,formatMoney} from '../services/apiClient';
import {Button,GlowPanel,Kicker,Loader,Notice,SectionHeading,SimpleScroll} from './ui';
import {AppIcon} from './icons';
import {useCineHuntTheme} from './theme';
import type {Booking,Hold,Seat,SeatMap,Showtime,User} from '../types';
import AgeAdmissionGate from './AgeAdmissionGate';

type Props={token:string|null;user:User|null;showtime:Showtime;onAuth:()=>void;onBooking:(id:string)=>void};
export default function SeatFlow(props:Props & {onBack:()=>void}){
  return <AgeAdmissionGate key={props.showtime.showtimeId} showtimeId={props.showtime.showtimeId} movieId={props.showtime.movieId} onBack={props.onBack}><SeatFlowContent {...props}/></AgeAdmissionGate>;
}

function SeatFlowContent({token,user,showtime,onAuth,onBooking}:Props){
  const {C,S}=useCineHuntTheme();
  // CINEHUNT_SEAT_SMOOTH_V2: one shared grid, stable refresh feedback.
  // CINEHUNT_SEAT120_FAST_V3: immediate feedback, authoritative hold response.
  // CINEHUNT_BETA_SEAT_V4: status legend and row-based seat shapes.
  const [gridWidth,setGridWidth]=useState(0);
  const [pendingSeat,setPendingSeat]=useState<number|null>(null);
  const [pendingIds,setPendingIds]=useState<number[]>([]);
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
  const loadingRef=useRef(false);
  useEffect(()=>{
    const tick=()=>{const time=Date.now();setNow(time);setEntryStartedAt(old=>old??time)};
    const initial=setTimeout(tick,0);
    const interval=setInterval(tick,1000);
    return ()=>{clearTimeout(initial);clearInterval(interval)};
  },[]);
  const load=useCallback(async()=>{
    if(!token||loadingRef.current)return;
    loadingRef.current=true;setLoading(true);setError('');setVerified(false);
    try{
      const [m,h,b]=await Promise.all([
        api<SeatMap>(`/showtime-seats/${showtime.showtimeId}`,{token}).then(m=>{if(Array.isArray(m.seats))setMap(m);return m;}),
        api<Hold[]>('/showtime-seats/my-holds/list',{token}),
        api<Booking[]>('/bookings/my',{token}),
      ]);
      if(!Array.isArray(m.seats)||!Array.isArray(h)||!Array.isArray(b))throw new Error('Phản hồi dữ liệu chưa hợp lệ');
      setMap(m);
      const ids=new Set(m.seats.map(s=>s.showtimeSeatId));
      setHolds(h.filter(x=>ids.has(Number(x.showtimeSeatId))&&new Date(x.expiresAt).getTime()>Date.now()));
      setExisting(b.find(x=>Number(x.showtimeId)===showtime.showtimeId&&x.status==='PENDING_PAYMENT'&&(!x.expiresAt||new Date(x.expiresAt).getTime()>Date.now()))??null);
      setVerified(true);
    }catch(e){setError(errorMessage(e));}finally{loadingRef.current=false;setLoading(false)}
  },[token,showtime.showtimeId]);
  useEffect(()=>{const timer=setTimeout(()=>{void load()},0);return ()=>clearTimeout(timer)},[load]);
  useEffect(()=>{let active=true;void api<{comboId:number;name:string;price:number|string}[]>('/concession-combos').then(data=>{if(active&&Array.isArray(data))setCombos(data)}).catch(()=>{});return ()=>{active=false};},[]);
  const rows=useMemo(()=>{
    const groups=new Map<string,Seat[]>();
    for(const s of map?.seats??[]){const row=s.seatRow??'?';groups.set(row,[...(groups.get(row)??[]),s]);}
    return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([row,seats])=>[row,seats.sort((a,b)=>(a.seatNumber??0)-(b.seatNumber??0))] as const);
  },[map]);
  const maxColumns=Math.max(1,...rows.map(([,seats])=>seats.length));
  const seatGap=2;
  const aisle=maxColumns===12?7:0;
  const seatWidth=Math.max(20,Math.min(40,Math.floor((gridWidth-24-aisle-(maxColumns-1)*seatGap)/maxColumns)));
  const contentWidth=24+maxColumns*seatWidth+(maxColumns-1)*seatGap+aisle;
  const seatKind=(seat:Seat)=>{const code=String(seat.seatTypeCode??seat.type??'').toUpperCase();return code.includes('COUPLE')?'couple':code.includes('VIP')?'vip':'standard';};
  // CINEHUNT_COUPLE_PAIR_V1: use actual type, never infer a legacy seat from its row alone.
  const isPair=(s:Seat)=>String(s.seatTypeCode??s.type??'')==='CH_COUPLE';
  const groupFor=(s:Seat):Seat[]=>{
    if(!isPair(s))return [s];
    const n=Number(s.seatNumber);const partner=n%2?n+1:n-1;
    const other=map?.seats.find(x=>isPair(x)&&x.seatRow===s.seatRow&&x.seatNumber===partner);
    return other?[s,other].sort((a,b)=>Number(a.seatNumber)-Number(b.seatNumber)):[s];
  };
  const palette={standard:{label:'Ghế thường'},vip:{label:'Ghế VIP'},couple:{label:'Ghế đôi'}};
  const priceLabel=(kind:keyof typeof palette)=>{const values=(map?.seats??[]).filter(x=>seatKind(x)===kind).map(x=>Number(x.price)).filter(Number.isFinite);return values.length?(Math.min(...values)===Math.max(...values)?formatMoney(values[0]):`${formatMoney(Math.min(...values))} – ${formatMoney(Math.max(...values))}`):'Chưa có';};
  const pairTotals=(map?.seats??[]).filter(x=>isPair(x)&&Number(x.seatNumber)%2===1).map(x=>groupFor(x)).filter(g=>g.length===2).map(g=>g.reduce((sum,x)=>sum+Number(x.price),0));
  const pairPrice=pairTotals.length?(Math.min(...pairTotals)===Math.max(...pairTotals)?formatMoney(pairTotals[0]):`${formatMoney(Math.min(...pairTotals))} – ${formatMoney(Math.max(...pairTotals))}`)+' / cặp':priceLabel('couple')+' / chỗ (lịch cũ)';
  const statusColors={free:C.seatFree,other:C.cyan,selected:C.purple,sold:C.red,blocked:C.seatBlocked};
  const validHolds=now===null?holds:holds.filter(h=>new Date(h.expiresAt).getTime()>now);
  const expires=validHolds.length?Math.min(...validHolds.map(h=>new Date(h.expiresAt).getTime())):0;
  const seconds=now===null?0:expires?Math.max(0,Math.ceil((expires-now)/1000)):0;
  // Selection timer starts on entering the screen, SQL holds only after tapping seats.
  const browsingSeconds=now===null||entryStartedAt===null?600:Math.max(0,Math.ceil((entryStartedAt+600000-now)/1000));
  const shownSeconds=validHolds.length?seconds:browsingSeconds;
  const total=validHolds.reduce((sum,h)=>sum+Number(h.price??map?.seats.find(s=>s.showtimeSeatId===Number(h.showtimeSeatId))?.price??0),0);
  useEffect(()=>{
    if(now===null||!holds.length||validHolds.length||inFlight.current||loadingRef.current)return;
    const fingerprint=holds.map(h=>h.holdId).join('/');
    if(expiredOnce.current===fingerprint)return;
    expiredOnce.current=fingerprint;
    setWarning('Lượt giữ ghế đã hết hạn. Đang tải lại trạng thái từ server.');
    void load();
  },[now,holds,validHolds.length,load]);
  async function toggle(s:Seat){
    if(!token||inFlight.current||loadingRef.current||!verified||!map||existing||busy)return;
    if(!validHolds.length && browsingSeconds===0){
      Alert.alert('Hết thời gian chọn ghế','Hãy tải lại sơ đồ để bắt đầu phiên chọn ghế mới.');
      return;
    }
    const group=groupFor(s);const ids=group.map(x=>x.showtimeSeatId);
    const own=validHolds.filter(h=>ids.includes(Number(h.showtimeSeatId)));
    if(!own.length&&(isPair(s)&&group.length!==2||group.some(x=>x.status!=='AVAILABLE')))return;
    if(!own.length&&validHolds.length+group.length>8){Alert.alert('Giới hạn','Tối đa 8 chỗ, ghế đôi tính 2 chỗ.');return;}
    inFlight.current=true;setBusy(true);setPendingSeat(s.showtimeSeatId);setPendingIds(ids);setError('');setWarning('');
    try{
      if(own.length){
        const released=await api<{releasedSeat:boolean}>(`/showtime-seats/release/${encodeURIComponent(String(own[0].holdId))}`,{token,method:'POST'});
        if(!released.releasedSeat)throw new Error('Chưa xác nhận nhả ghế');
        const ownIds=own.map(h=>Number(h.showtimeSeatId));
        setHolds(prev=>prev.filter(h=>!ownIds.includes(Number(h.showtimeSeatId))));
        setMap(prev=>prev?{...prev,seats:prev.seats.map(x=>ownIds.includes(x.showtimeSeatId)?{...x,status:'AVAILABLE' as const,heldByUserId:null}:x)}:prev);
      }else{
        const result=group.length===2?await api<Hold[]>('/showtime-seats/hold-many',{method:'POST',token,body:{showtimeSeatIds:ids,holdMinutes:10},timeout:18000}):[await api<Hold>('/showtime-seats/hold',{method:'POST',token,body:{showtimeSeatId:ids[0],holdMinutes:10},timeout:18000})];
        if(!Array.isArray(result)||result.length!==ids.length||ids.some(id=>!result.some(r=>Number(r.showtimeSeatId)===id&&r.holdId&&Number.isFinite(Date.parse(r.expiresAt))&&r.price!=null&&Number.isFinite(Number(r.price)))))throw new Error('Chưa xác nhận đủ ghế');
        setHolds(prev=>[...prev.filter(h=>!ids.includes(Number(h.showtimeSeatId))),...result]);
        setMap(prev=>prev?{...prev,seats:prev.seats.map(x=>{const r=result.find(h=>Number(h.showtimeSeatId)===x.showtimeSeatId);return r?{...x,status:'HELD' as const,price:Number(r.price),heldByUserId:user?.userId??null}:x;})}:prev);
      }
    }catch(e){
      const message=errorMessage(e);
      setVerified(false);
      await load();
      setError(message);
      setWarning('Kết nối bị gián đoạn. Hãy kiểm tra trạng thái ghế trước khi chạm tiếp.');
    }finally{inFlight.current=false;setPendingSeat(null);setPendingIds([]);setBusy(false)}
  }
  async function release(){
    if(!token||inFlight.current||!validHolds.length)return;
    inFlight.current=true;setBusy(true);setError('');
    const failed:string[]=[];
    try{
      const visited=new Set<number>();
      for(const h of validHolds){
        const id=Number(h.showtimeSeatId);if(visited.has(id))continue;
        const seat=map?.seats.find(x=>x.showtimeSeatId===id);
        (seat?groupFor(seat):[]).forEach(x=>visited.add(x.showtimeSeatId));visited.add(id);
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
    {/* CINEHUNT_SEAT_MOVIE_HEADER_V1 */}
    <GlowPanel from="#3B2866" to="#0D3041" style={{marginTop:8,marginBottom:13}}>
      <Kicker color={C.lavender}>ĐẶT VÉ THEO PHIM</Kicker>
      <Text style={{fontSize:24,color:C.hero,fontWeight:'900',marginTop:8}}>{map?.movieTitle?.trim()||'Đang cập nhật tên phim'}</Text>
      <Text style={{color:'#D2D3E8',fontSize:12,marginTop:7}}>{formatDate(showtime.startTime)}{!!map?.durationMinutes&&`  •  ${map.durationMinutes} phút`}{!!map?.ageRating&&`  •  ${map.ageRating}`}</Text>
      <Text style={{color:C.hero,fontWeight:'800',fontSize:15,marginTop:12}}>{map?.cinemaName||showtime.room?.cinema?.cinemaName||'CineHunt Cinema'}</Text>
      <Text style={{color:'#D2D3E8',fontSize:12,marginTop:4}}>{map?.roomName||showtime.room?.roomName||'Đang tải phòng'}  •  {map?.totalSeats??'—'} chỗ  •  Suất #{showtime.showtimeId}</Text>
    </GlowPanel>
    <View style={{padding:12,marginBottom:10,borderRadius:14,backgroundColor:C.panel,borderWidth:1,borderColor:C.stroke}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:8}}><AppIcon name="clock" size={19} color={C.white}/><Text style={{color:C.white,fontWeight:'900',fontSize:17}}>Thời gian còn lại: {Math.floor(shownSeconds/60)}:{String(shownSeconds%60).padStart(2,'0')}</Text></View>
      <Text style={{color:C.muted,fontSize:11,marginTop:5}}>{validHolds.length?'Ghế đã được giữ cho bạn. Hoàn tất đặt vé trước khi hết thời gian.':'Bạn có 10 phút chọn ghế. Hệ thống sẽ tự giữ ghế 10 phút kể từ khi bạn chạm; chỉ xem sơ đồ sẽ không chiếm ghế.'}</Text>
    </View>
    {loading&&!map&&<Loader/>}{!!error&&<Notice text={error} bad/>}{!!warning&&<Notice text={warning} bad/>}
    {existing&&<View style={S.card}><Text style={S.h2}>Bạn đã có đơn chờ thanh toán</Text><Text style={[S.muted,{marginVertical:9}]}>{existing.bookingCode}</Text><Button title="Mở đơn đã tạo" iconRight="forward" onPress={()=>onBooking(String(existing.bookingId))}/></View>}
    {map&&<>
      <View style={[S.card,{paddingHorizontal:12,paddingVertical:20,marginTop:6}]}>
        <View style={{flexDirection:'row',gap:10,paddingBottom:14,marginBottom:12,borderBottomWidth:1,borderBottomColor:C.stroke}}>
          <View style={{flex:1,gap:9}}>
            <Text style={{color:C.white,fontWeight:'900',fontSize:12}}>TRẠNG THÁI</Text>
            {([[statusColors.free,'Ghế trống'],[statusColors.other,'Đang được giữ'],[statusColors.selected,'Bạn đang chọn'],[statusColors.sold,'Đã bán'],[statusColors.blocked,'Bị khóa']] as const).map(([color,label])=><View key={label} style={{flexDirection:'row',alignItems:'center',gap:6}}><View style={{width:19,height:16,borderRadius:5,backgroundColor:color,borderBottomWidth:3,borderColor:C.stroke}}/><Text style={{color:C.muted,fontSize:11,flexShrink:1}}>{label}</Text></View>)}
          </View>
          <View style={{flex:1,gap:9}}>
            <Text style={{color:C.white,fontWeight:'900',fontSize:12}}>GIÁ VÉ</Text>
            {(['standard','vip','couple'] as const).map((kind,i)=><View key={kind} style={{flexDirection:'row',alignItems:'center',gap:7}}><View style={{width:kind==='couple'?30:19,height:18,borderRadius:kind==='standard'?9:4,borderBottomWidth:3,borderColor:C.stroke,backgroundColor:statusColors.free}}/><View style={{flex:1}}><Text style={{color:C.muted,fontSize:10}}>{palette[kind].label} · {['A–C','D–I','J'][i]}</Text><Text style={{color:C.white,fontWeight:'900',fontSize:12}}>{kind==='couple'?pairPrice:priceLabel(kind)}</Text></View></View>)}
          </View>
        </View>
        <Text style={{color:C.muted,fontSize:10,textAlign:'center',marginBottom:14}}>Ghế đôi: chạm một cặp để chọn cả 2 chỗ. Giá theo cặp.</Text>
        <View style={{alignItems:'center',marginHorizontal:14,marginBottom:14}}><View style={{height:9,width:'100%',borderTopWidth:4,borderTopColor:C.purple,borderTopLeftRadius:100,borderTopRightRadius:100}}/><Text style={{color:C.muted,fontSize:10,letterSpacing:3,marginTop:6,fontWeight:'800'}}>MÀN HÌNH CHIẾU</Text></View>
        <View onLayout={e=>setGridWidth(e.nativeEvent.layout.width)} style={{width:'100%'}}>
          <View style={{minHeight:25,marginBottom:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7}}>
            {loading&&<ActivityIndicator size="small" color={C.purple}/>}
            <Text accessibilityLiveRegion="polite" style={{color:C.muted,fontSize:11,textAlign:'center',flexShrink:1}}>{pendingSeat!==null?'Đang xác nhận ghế…':loading?'Đang tải dữ liệu…':validHolds.length?`${validHolds.map(h=>h.seatLabel).join(' · ')}  |  ${formatMoney(total)}`:'Chạm ghế để chọn · tối đa 8 ghế'}</Text>
          </View>
          {gridWidth>0&&<ScrollView horizontal scrollEnabled={contentWidth>gridWidth} showsHorizontalScrollIndicator={contentWidth>gridWidth} nestedScrollEnabled contentContainerStyle={{minWidth:gridWidth,alignItems:'center',paddingBottom:6}}>
            <View style={{width:contentWidth,gap:7}}>
              {rows.map(([name,seats])=><View key={name} style={{flexDirection:'row',alignItems:'center'}}>
                <Text style={{color:C.soft,fontSize:11,fontWeight:'900',width:20,marginRight:4,textAlign:'center'}}>{name}</Text>
                <View style={{flexDirection:'row',gap:seatGap}}>{seats.map((s,index)=>{
                  const group=groupFor(s);if(group.length===2&&group[0].showtimeSeatId!==s.showtimeSeatId)return null;
                  const ids=group.map(x=>x.showtimeSeatId);
                  const own=validHolds.filter(h=>ids.includes(Number(h.showtimeSeatId)));
                  const heldByMe=own.length===group.length;
                  const available=group.every(x=>x.status==='AVAILABLE')&&(!isPair(s)||group.length===2);
                  const pending=ids.some(id=>pendingIds.includes(id));
                  const selected=pending?!own.length:heldByMe;
                  const sold=group.some(x=>x.status==='SOLD');const other=group.some(x=>x.status==='HELD');
                  const seatColor=selected?statusColors.selected:available?statusColors.free:sold?statusColors.sold:other?statusColors.other:statusColors.blocked;
                  const disabled=(!available&&!own.length)||!!existing||!verified||busy;
                  const label=group.map(x=>x.seatLabel).join('–');const price=group.reduce((sum,x)=>sum+Number(x.price),0);
                  return <Pressable key={s.showtimeSeatId} disabled={disabled} onPress={()=>void toggle(s)} accessibilityRole="button" accessibilityState={{disabled,selected:heldByMe,busy:pending}} accessibilityLabel={`${label}, ${formatMoney(price)}`} style={({pressed})=>({width:group.length===2?seatWidth*2+seatGap:seatWidth,height:Math.max(37,seatWidth),marginLeft:maxColumns===12&&index===6?aisle:0,backgroundColor:seatColor,borderWidth:pending?2:1,borderColor:pending?C.purple:C.stroke,borderBottomWidth:3,borderRadius:seatKind(s)==='standard'?9:5,alignItems:'center',justifyContent:'center',opacity:pressed?.75:1})}>
                    <Text style={{color:selected||sold||other?'#FFFFFF':available?C.okText:C.muted,fontWeight:'900',fontSize:seatWidth<30?8:10}}>{label}</Text>
                  </Pressable>;
                })}</View>
              </View>)}
            </View>
          </ScrollView>}
          {gridWidth>0&&contentWidth>gridWidth&&<Text style={{color:C.muted,fontSize:11,textAlign:'center',marginTop:5}}>Vuốt ngang để xem tất cả các ghế.</Text>}
        </View>
        {!map.seatsGenerated&&<Notice text="Suất chiếu này chưa tạo sơ đồ ghế." bad/>}

      </View>
      <GlowPanel from="#2B285C" to="#103242" style={{marginBottom:16}}>
        <Kicker color={C.lavender}>ĐƠN ĐẶT VÉ</Kicker>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:8}}><Text style={{color:C.hero,fontSize:15,fontWeight:'700'}}>Đang giữ {validHolds.length}/8 ghế</Text><Text style={{color:C.heroGreen,fontSize:23,fontWeight:'900'}}>{formatMoney(total)}</Text></View>
        <Text style={{color:'#CACDE6',fontSize:11,marginTop:9}}>Chạm ghế để chọn hoặc bỏ chọn. Tổng tiền chỉ tính ghế đã được xác nhận. Ghế đôi tính theo cặp (2 chỗ).</Text>
      </GlowPanel>
      {!!validHolds.length&&<View style={S.card}>
        <View style={{flexDirection:'row',alignItems:'center',gap:7}}><AppIcon name="success" size={15} color={C.green}/><Kicker color={C.green}>GIỮ GHẾ THÀNH CÔNG</Kicker></View>
        <Text style={[S.h2,{marginTop:10}]}>{validHolds.map(x=>x.seatLabel).join(' · ')}</Text>
        <View style={{flexDirection:'row',alignItems:'center',gap:9,marginTop:12,marginBottom:13}}><AppIcon name="clock" size={26} color={C.cyan}/><Text style={{color:C.cyan,fontSize:29,fontWeight:'900'}}>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</Text></View>
        <Button title="Nhả các ghế đang giữ" kind="outline" disabled={busy} onPress={()=>Alert.alert('Nhả ghế?','Nhả toàn bộ lượt giữ hiện tại?', [{text:'Không',style:'cancel'},{text:'Nhả ghế',style:'destructive',onPress:()=>void release()}])}/>
      </View>}
      {!existing&&!validHolds.length&&<Notice text="Chạm một ghế trống để bắt đầu giữ tự động 10 phút. Đồng hồ bắt đầu khi server xác nhận giữ ghế, không phải khi mở sơ đồ."/>}
      {!existing&&validHolds.length>0&&<>
        <SectionHeading title="Bắp nước & ưu đãi" subtitle="Thêm combo cho trải nghiệm trọn vẹn"/>
        <View style={S.card}>
          {combos.map(co=><View key={co.comboId} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.stroke}}>
            <View style={{width:38,height:38,backgroundColor:C.iconC,borderRadius:12,alignItems:'center',justifyContent:'center'}}><AppIcon name="popcorn" size={20} color={C.purple}/></View>
            <View style={{flex:1}}><Text style={{color:C.white,fontWeight:'800',fontSize:13}}>{co.name}</Text><Text style={{color:C.green,fontSize:12,marginTop:5}}>{formatMoney(co.price)}</Text></View>
            <View style={{flexDirection:'row',alignItems:'center',gap:7}}><Pressable accessibilityRole="button" accessibilityLabel={`Giảm ${co.name}`} onPress={()=>setQuantities(v=>({...v,[co.comboId]:Math.max(0,(v[co.comboId]||0)-1)}))} style={[S.pill,{width:44,height:44,paddingHorizontal:0,paddingVertical:0,alignItems:'center',justifyContent:'center'}]}><AppIcon name="minus" size={18} color={C.white}/></Pressable><Text style={{color:C.white,fontWeight:'900',minWidth:15,textAlign:'center'}}>{quantities[co.comboId]||0}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Tăng ${co.name}`} onPress={()=>setQuantities(v=>({...v,[co.comboId]:Math.min(10,(v[co.comboId]||0)+1)}))} style={[S.pill,{width:44,height:44,paddingHorizontal:0,paddingVertical:0,alignItems:'center',justifyContent:'center'}]}><AppIcon name="plus" size={18} color={C.white}/></Pressable></View>
          </View>)}
          <TextInput placeholder="Mã giảm giá (nếu có)" placeholderTextColor={C.soft} value={voucher} onChangeText={setVoucher} autoCapitalize="characters" style={S.input}/>
        </View>
        <Button title="Tiếp tục tạo đơn chờ thanh toán" iconRight="forward" disabled={!verified||busy||uncertainUI} onPress={()=>Alert.alert('Xác nhận đặt vé',`Chuyển ${validHolds.length} ghế đang giữ thành đơn chờ thanh toán?`,[{text:'Không',style:'cancel'},{text:'Tạo đơn',onPress:()=>void makeBooking()}])}/>
      </>}
      <View style={{marginTop:12}}><Button title="Làm mới sơ đồ và trạng thái ghế" icon="refresh" kind="outline" disabled={busy||loading} onPress={()=>{setEntryStartedAt(Date.now());void load()}}/></View>
    </>}
  </SimpleScroll>;
}

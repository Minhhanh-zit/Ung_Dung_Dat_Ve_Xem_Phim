import {useCallback,useEffect,useRef,useState} from 'react';
import {Alert,Text,View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {api,ApiError,errorMessage,formatDate,formatMoney} from './api';
import {Button,C,GlowPanel,Kicker,Loader,Notice,S,SectionHeading,SimpleScroll,StatusPill} from './ui';
import type {Booking,Payment,PaymentMethod,Ticket} from './types';

type Props={bookingId:string;token:string|null;ticketsOnly?:boolean;onAuth:()=>void;onCancelled:()=>void;onTickets:()=>void};
export default function BookingView({bookingId,token,ticketsOnly=false,onAuth,onCancelled,onTickets}:Props){
  const [booking,setBooking]=useState<Booking|null>(null);
  const [payment,setPayment]=useState<Payment|null>(null);
  const [methods,setMethods]=useState<PaymentMethod[]>([]);
  const [selected,setSelected]=useState<'BANKING'|'CASH'>('BANKING');
  const [tickets,setTickets]=useState<Ticket[]>([]);
  const [loading,setLoading]=useState(false);
  const [verified,setVerified]=useState(false);
  const [error,setError]=useState('');
  const [warning,setWarning]=useState('');
  const inFlight=useRef(false);
  const load=useCallback(async()=>{
    if(!token)return;
    setLoading(true);setError('');setVerified(false);
    try{
      const [b,ms]=await Promise.all([
        api<Booking>(`/bookings/${encodeURIComponent(bookingId)}`,{token}),
        api<PaymentMethod[]>('/payments/methods'),
      ]);
      setBooking(b);setMethods(Array.isArray(ms)?ms.filter(x=>x.enabled&&['BANKING','CASH'].includes(x.code)):[]);
      try{const p=await api<Payment>(`/payments/booking/${encodeURIComponent(bookingId)}`,{token});setPayment(p);}catch(e){if(e instanceof ApiError&&e.status===404)setPayment(null);else throw e;}
      if(['PAID','CONFIRMED'].includes(b.status)){
        const ts=await api<Ticket[]>(`/bookings/${encodeURIComponent(bookingId)}/tickets`,{token});
        setTickets(Array.isArray(ts)?ts:[]);
      }else{setTickets([])}
      setVerified(true);
    }catch(e){setError(errorMessage(e))}finally{setLoading(false)}
  },[bookingId,token]);
  useEffect(()=>{void load()},[load]);
  async function createPayment(){
    if(!token||!verified||!booking||payment||inFlight.current||booking.status!=='PENDING_PAYMENT')return;
    if(!methods.some(m=>m.code===selected)){setError('Phương thức chưa được bật');return;}
    inFlight.current=true;setLoading(true);setError('');setWarning('');
    try{
      const p=await api<Payment>('/payments',{token,method:'POST',body:{bookingId:String(booking.bookingId),paymentMethod:selected}});
      if(!p.paymentId||p.paymentStatus!=='PENDING')throw new Error('Chưa xác nhận được kết quả giao dịch');
      setPayment(p);
    }catch(e){
      setWarning('Nếu mạng ngắt, giao dịch có thể đã tạo. Không bấm lại trước khi kiểm tra.');
      setError(errorMessage(e));
      try{const p=await api<Payment>(`/payments/booking/${encodeURIComponent(bookingId)}`,{token});setPayment(p);}catch{/* Giữ nguyên trạng thái chưa xác nhận */}
    }finally{inFlight.current=false;setLoading(false)}
  }
  async function cancelBooking(){
    if(!token||!booking||booking.status!=='PENDING_PAYMENT'||inFlight.current)return;
    inFlight.current=true;setLoading(true);setError('');
    try{
      const r=await api<{success:boolean}>(`/bookings/${encodeURIComponent(bookingId)}`,{token,method:'DELETE'});
      if(r.success!==true)throw new Error('Chưa xác nhận được trạng thái hủy');
      await load();onCancelled();
    }catch(e){setError(errorMessage(e));setWarning('Kiểm tra lại trạng thái đơn trước khi bấm hủy lần nữa.');await load()}
    finally{inFlight.current=false;setLoading(false)}
  }
  if(!token)return <SimpleScroll><Kicker>MY BOOKING</Kicker><Text style={[S.title,{marginTop:9}]}>Đơn đặt vé</Text><Notice text="Đăng nhập để xem đơn và vé của bạn."/><Button title="Đăng nhập" onPress={onAuth}/></SimpleScroll>;
  if(ticketsOnly)return <SimpleScroll>
    <View style={{marginTop:8,marginBottom:16}}><Kicker>DIGITAL CINEMA TICKET</Kicker><Text style={[S.title,{marginTop:8}]}>Vé điện tử</Text><Text style={[S.muted,{marginTop:7}]}>Xuất trình mã QR hợp lệ tại quầy soát vé.</Text></View>
    {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}
    {booking&&!['PAID','CONFIRMED'].includes(booking.status)&&<Notice text="Vé QR chỉ được phát hành sau khi Backend xác nhận thanh toán thành công."/>}
    {booking&&['PAID','CONFIRMED'].includes(booking.status)&&tickets.length===0&&!loading&&<Notice text="Đơn đã thanh toán nhưng Backend chưa trả vé. Hãy kiểm tra lại." bad/>}
    {tickets.map(t=><View key={String(t.ticketId)} style={[S.card,{padding:0,overflow:'hidden'}]}>
      <GlowPanel from="#4A317D" to="#152E48" style={{borderWidth:0,borderRadius:0}}>
        <Kicker color={C.lavender}>CINEHUNT ADMIT ONE</Kicker>
        <Text style={{color:C.white,fontWeight:'900',fontSize:23,marginTop:10,lineHeight:30}}>{t.movieTitle||'Vé CineHunt'}</Text>
        <Text style={{color:'#DDE0F2',fontSize:12,marginTop:10}}>{t.showDate||''} {t.showTime||''}  ·  Ghế {t.seatCode||'—'}</Text>
      </GlowPanel>
      <View style={{alignItems:'center',padding:22}}>
        {t.qrCode?<View style={{backgroundColor:'white',borderRadius:18,padding:16,marginVertical:6}}><QRCode value={String(t.qrCode)} size={190}/></View>:<Notice text="Không có dữ liệu QR hợp lệ" bad/>}
        <Text style={{color:C.cyan,fontWeight:'900',fontSize:15,marginTop:13,letterSpacing:.4}}>{t.ticketCode}</Text>
        <View style={{marginTop:13}}><StatusPill status={t.ticketStatus}/></View>
        <Text style={[S.muted,{textAlign:'center',fontSize:11,marginTop:18}]}>Vé có thể chỉ dùng một lần và chịu giới hạn thời gian check-in. Giữ kín mã vé của bạn.</Text>
      </View>
    </View>)}
    <Button title="↻  Làm mới vé từ hệ thống" kind="outline" disabled={loading} onPress={()=>void load()}/>
  </SimpleScroll>;
  return <SimpleScroll>
    <View style={{marginTop:7,marginBottom:17}}><Kicker>YOUR BOOKING</Kicker><Text style={[S.title,{marginTop:8}]}>Chi tiết đơn vé</Text><Text style={[S.muted,{marginTop:7}]}>Theo dõi trạng thái, thanh toán và vé điện tử.</Text></View>
    {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}{!!warning&&<Notice text={warning} bad/>}
    {booking&&<GlowPanel from="#442C69" to="#123047" style={{marginBottom:17}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Kicker color={C.cyan}>CINEHUNT BOOKING</Kicker><Text style={{color:'#E2D4FB',fontWeight:'900',fontSize:16}}>✦</Text></View>
      <Text style={{color:C.white,fontSize:23,fontWeight:'900',marginTop:14,lineHeight:28}}>{booking.showtime?.movie?.title||`Suất chiếu #${booking.showtimeId}`}</Text>
      <Text style={{color:'#C7CEE3',fontSize:11,marginTop:11}} numberOfLines={2}>Mã đơn: {booking.bookingCode}</Text>
      <View style={{marginTop:15}}><StatusPill status={booking.status}/></View>
      <View style={{height:1,backgroundColor:'#FFFFFF2B',marginVertical:16}}/>
      <View style={{flexDirection:'row',justifyContent:'space-between'}}><View><Text style={{color:'#C8CDE0',fontSize:11}}>SỐ GHẾ</Text><Text style={{color:C.white,fontWeight:'900',fontSize:17,marginTop:6}}>{booking.seatCount??booking.bookingDetails?.length??'—'}</Text></View><View style={{alignItems:'flex-end'}}><Text style={{color:'#C8CDE0',fontSize:11}}>TỔNG TIỀN</Text><Text style={{color:C.green,fontWeight:'900',fontSize:24,marginTop:4}}>{formatMoney(booking.totalAmount)}</Text></View></View>
      {!!booking.expiresAt&&<Text style={{color:'#C8CDE0',fontSize:11,marginTop:17}}>Hạn ghi trong đơn: {formatDate(booking.expiresAt)}</Text>}
      {payment?.paymentMethod==='CASH'&&<Text style={{color:'#C8CDE0',fontSize:11,marginTop:9}}>Thanh toán tiền mặt tại quầy có chính sách gia hạn riêng.</Text>}
      {booking.status==='PENDING_PAYMENT'&&<Notice text="Đơn chưa thanh toán thành công nên chưa có vé QR."/>}
      {['PAID','CONFIRMED'].includes(booking.status)&&<Button title="▣  Xem vé QR của bạn  →" onPress={onTickets}/>} 
    </GlowPanel>}
    {booking?.status==='PENDING_PAYMENT'&&verified&&<>
      <SectionHeading title="Phương thức thanh toán" subtitle="Chỉ sử dụng các lựa chọn Backend đang cho phép"/>
      <View style={S.card}>
        {payment?<>
          <Notice text="Đã ghi nhận yêu cầu thanh toán. Chưa có xác nhận đã nhận tiền."/>
          <Text style={[S.muted,{marginTop:7}]}>Phương thức: {payment.paymentMethod}</Text>
          <Text style={[S.muted,{marginTop:9}]}>Giao dịch: {payment.transactionCode||'Đang cập nhật'}</Text>
          <View style={{marginTop:14}}><StatusPill status={payment.paymentStatus}/></View>
          {payment.paymentMethod==='BANKING'&&<Notice text="Chưa có thông tin ngân hàng xác thực trong ứng dụng. Không tự chuyển tiền nếu rạp chưa hướng dẫn."/>}
          {payment.paymentMethod==='CASH'&&<Notice text="Vui lòng đến quầy CineHunt để nhân viên xác nhận thanh toán tiền mặt."/>}
        </>:<>
          <Text style={[S.muted,{marginBottom:12}]}>Tạo giao dịch không đồng nghĩa đã thanh toán. Không có trừ tiền tự động ở bước này.</Text>
          {methods.map(m=><Button key={m.code} title={`${selected===m.code?'◉':'○'}  ${m.name}`} kind={selected===m.code?'primary':'muted'} onPress={()=>setSelected(m.code as 'BANKING'|'CASH')}/>)}
          <Button title="Tạo giao dịch chờ xác nhận" disabled={loading||methods.length===0} onPress={()=>Alert.alert('Tạo giao dịch?',`Chọn ${selected}? Giao dịch chỉ ở trạng thái PENDING, chưa trừ tiền.`,[{text:'Quay lại',style:'cancel'},{text:'Tạo giao dịch',onPress:()=>void createPayment()}])}/>
        </>}
        <Button title="↻  Kiểm tra trạng thái thanh toán" kind="outline" disabled={loading} onPress={()=>void load()}/>
      </View>
      <Button title="Hủy đơn chưa thanh toán" kind="danger" disabled={loading} onPress={()=>Alert.alert('Xác nhận hủy','Đơn PENDING_PAYMENT sẽ bị hủy và ghế được giải phóng. Tiếp tục?', [{text:'Không',style:'cancel'},{text:'Hủy đơn',style:'destructive',onPress:()=>void cancelBooking()}])}/>
    </>}
    {booking&&!['PENDING_PAYMENT','PAID','CONFIRMED'].includes(booking.status)&&<Notice text={`Đơn hiện ở trạng thái ${booking.status}; không thể tự thanh toán tiếp.`}/>}
    <View style={{marginTop:15}}><Button title="↻  Làm mới từ SQL Server" kind="outline" disabled={loading} onPress={()=>void load()}/></View>
  </SimpleScroll>;
}

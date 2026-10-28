import {useCallback,useEffect,useRef,useState} from 'react';
import {Alert,Text,View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {api,ApiError,errorMessage,formatDate,formatMoney} from './api';
import {Button,C,Loader,Notice,S,SimpleScroll} from './ui';
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
  if(!token)return <SimpleScroll><Notice text="Vui lòng đăng nhập để xem đơn và vé."/><Button title="Đăng nhập" onPress={onAuth}/></SimpleScroll>;
  if(ticketsOnly)return <SimpleScroll>
    <Text style={S.title}>Vé điện tử</Text>{loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}
    {booking&&!['PAID','CONFIRMED'].includes(booking.status)&&<Notice text="Vé QR chỉ xuất hiện sau khi Backend xác nhận thanh toán thành công. Không tạo vé khi còn chờ tiền."/>}
    {booking&&['PAID','CONFIRMED'].includes(booking.status)&&tickets.length===0&&!loading&&<Notice text="Đơn đã thanh toán nhưng Backend chưa trả vé. Hãy kiểm tra lại." bad/>}
    {tickets.map(t=><View key={String(t.ticketId)} style={[S.card,{alignItems:'center'}]}>
      <Text style={[S.h2,{textAlign:'center'}]}>{t.movieTitle||'Vé CineHunt'}</Text>
      <Text style={[S.muted,{marginVertical:9}]}>{t.showDate||''} {t.showTime||''} · Ghế {t.seatCode||'—'}</Text>
      {t.qrCode?<View style={{padding:14,backgroundColor:'white',borderRadius:12,marginVertical:12}}><QRCode value={String(t.qrCode)} size={190}/></View>:<Notice text="Không có dữ liệu QR hợp lệ" bad/>}
      <Text style={{color:C.cyan,fontWeight:'900'}}>{t.ticketCode}</Text>
      <Text style={[S.muted,{marginTop:9}]}>Trạng thái: {t.ticketStatus}</Text>
      <Text style={[S.muted,{textAlign:'center',marginTop:8}]}>Chỉ xuất trình tại rạp theo điều kiện giờ soát vé. Không chia sẻ mã vé.</Text>
    </View>)}
    <Button title="Làm mới vé từ Backend" kind="outline" disabled={loading} onPress={()=>void load()}/>
  </SimpleScroll>;
  return <SimpleScroll>
    <Text style={S.title}>Đơn đặt vé</Text>
    {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}{!!warning&&<Notice text={warning} bad/>}
    {booking&&<View style={[S.card,{marginTop:16}]}>
      <Text style={S.muted}>Mã đơn</Text><Text style={{color:C.cyan,fontSize:17,fontWeight:'900',marginVertical:9}}>{booking.bookingCode}</Text>
      <Text style={S.text}>Trạng thái: {booking.status}</Text>
      <Text style={[S.muted,{marginTop:7}]}>Phim: {booking.showtime?.movie?.title||`Suất #${booking.showtimeId}`}</Text>
      <Text style={[S.muted,{marginTop:7}]}>Số ghế: {booking.seatCount??booking.bookingDetails?.length??'—'}</Text>
      <Text style={{fontSize:28,color:C.green,fontWeight:'900',marginVertical:12}}>{formatMoney(booking.totalAmount)}</Text>
      {!!booking.expiresAt&&<Text style={S.muted}>Hạn đơn ghi trong DB: {formatDate(booking.expiresAt)}</Text>}
      {payment?.paymentMethod==='CASH'&&<Notice text="Đơn tiền mặt tại quầy có chính sách gia hạn riêng. Hạn đơn hiển thị ở trên không phải hạn cuối của giao dịch tiền mặt."/>}
      {booking.status==='PENDING_PAYMENT'&&<Text style={[S.muted,{marginTop:12}]}>Chưa thanh toán thành công. Chưa phát hành vé QR.</Text>}
      {['PAID','CONFIRMED'].includes(booking.status)&&<Button title="Xem vé QR đã phát hành" onPress={onTickets}/>}
    </View>}
    {booking?.status==='PENDING_PAYMENT'&&verified&&<View style={S.card}>
      <Text style={S.h2}>Thanh toán</Text>
      {payment?<>
        <Notice text="Đã ghi nhận yêu cầu thanh toán. Chưa xác nhận đã nhận tiền."/>
        <Text style={S.muted}>Phương thức: {payment.paymentMethod}</Text>
        <Text style={[S.muted,{marginTop:8}]}>Mã giao dịch: {payment.transactionCode||'Đang cập nhật'}</Text>
        <Text style={{color:C.orange,fontWeight:'900',marginTop:12}}>Trạng thái: {payment.paymentStatus}</Text>
        {payment.paymentMethod==='BANKING'&&<Text style={[S.muted,{marginTop:12}]}>Ứng dụng chưa có thông tin số tài khoản ngân hàng đáng tin cậy. Không tự chuyển tiền nếu chưa được rạp cung cấp hướng dẫn chính thức.</Text>}
        {payment.paymentMethod==='CASH'&&<Text style={[S.muted,{marginTop:12}]}>Đến quầy CineHunt để nhân viên xác nhận thanh toán.</Text>}
      </>:<>
        <Text style={[S.muted,{marginTop:10,marginBottom:12}]}>Chọn phương thức đang được Backend cho phép. Không có thanh toán thật trong bước tạo giao dịch này.</Text>
        {methods.map(m=><Button key={m.code} title={`${selected===m.code?'◉':'○'} ${m.name}`} kind={selected===m.code?'primary':'muted'} onPress={()=>setSelected(m.code as 'BANKING'|'CASH')}/>)}
        <Button title="Tạo giao dịch chờ xác nhận" disabled={loading||methods.length===0} onPress={()=>Alert.alert('Tạo giao dịch?',`Chọn ${selected}? Giao dịch chỉ ở trạng thái PENDING, chưa trừ tiền.`,[{text:'Quay lại',style:'cancel'},{text:'Tạo giao dịch',onPress:()=>void createPayment()}])}/>
      </>}
      <Button title="Kiểm tra lại đơn và thanh toán" kind="outline" disabled={loading} onPress={()=>void load()}/>
      <Button title="Hủy đơn chưa thanh toán" kind="danger" disabled={loading} onPress={()=>Alert.alert('Xác nhận hủy','Đơn PENDING_PAYMENT sẽ bị hủy và ghế được giải phóng. Tiếp tục?', [{text:'Không',style:'cancel'},{text:'Hủy đơn',style:'destructive',onPress:()=>void cancelBooking()}])}/>
    </View>}
    {booking&&!['PENDING_PAYMENT','PAID','CONFIRMED'].includes(booking.status)&&<Notice text={`Đơn hiện đang ở trạng thái ${booking.status}, không thể tự thanh toán tiếp.`}/>}
    <Button title="Tải lại từ SQL Server" kind="outline" disabled={loading} onPress={()=>void load()}/>
  </SimpleScroll>;
}

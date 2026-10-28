import {useCallback,useEffect,useState} from 'react';
import {Text,View} from 'react-native';
import * as Location from 'expo-location';
import {api,errorMessage} from './api';
import {Button,C,Field,FilmArt,Loader,Notice,S,SimpleScroll} from './ui';
import type {Movie} from './types';

type Cinema={cinemaId:number;cinemaName:string;address?:string;latitude?:number|string|null;longitude?:number|string|null};
type Combo={comboId:number;name?:string;comboName?:string;price?:number|string};
type Props={token:string|null;favorites:number[];onOpen:(m:Movie)=>void;onAuth:()=>void};
export default function Discover({token,favorites,onOpen,onAuth}:Props){
  const [recommend,setRecommend]=useState<Movie[]>([]);const [source,setSource]=useState('');
  const [cinemas,setCinemas]=useState<Cinema[]>([]);const [combos,setCombos]=useState<Combo[]>([]);const [favoriteMovies,setFavoriteMovies]=useState<Movie[]>([]);
  const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  const [nearby,setNearby]=useState<{id:number;km:number}[]>([]);const [geoError,setGeoError]=useState('');
  const [query,setQuery]=useState('');const [messages,setMessages]=useState<{role:'user'|'assistant';content:string}[]>([]);
  const [chatBusy,setChatBusy]=useState(false);const [chatError,setChatError]=useState('');
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const [c,co,all]=await Promise.all([
        api<Cinema[]>('/cinemas'),api<Combo[]>('/concession-combos'),api<{items:Movie[]}>('/movies?page=1&limit=50'),
      ]);
      setCinemas(Array.isArray(c)?c:[]);setCombos(Array.isArray(co)?co:[]);
      setFavoriteMovies((all.items??[]).filter(m=>favorites.includes(m.movieId)));
      if(token){
        try{const r=await api<{items:Movie[];source:string;debug?:{upstreamSource?:string}}>('/recommendations?limit=10',{token});setRecommend(r.items??[]);setSource(`${r.source||'FALLBACK'}${r.debug?.upstreamSource?` (${r.debug.upstreamSource})`:''}`)}
        catch(e){setRecommend([]);setError(errorMessage(e))}
      }else{setRecommend([]);setSource('')}
    }catch(e){setError(errorMessage(e))}finally{setLoading(false)}
  },[token,favorites]);
  useEffect(()=>{void load()},[load]);
  async function locateCinemas(){
    setGeoError('');try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission.status!=='granted'){setGeoError('Bạn chưa cấp quyền vị trí.');return;}
      const loc=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      const rad=(d:number)=>d*Math.PI/180;
      const result=cinemas.filter(c=>c.latitude!=null&&c.longitude!=null).map(c=>{
        const lat=Number(c.latitude),lng=Number(c.longitude),a=loc.coords.latitude,b=loc.coords.longitude;
        const dLat=rad(lat-a),dLng=rad(lng-b);
        const z=Math.sin(dLat/2)**2+Math.cos(rad(a))*Math.cos(rad(lat))*Math.sin(dLng/2)**2;
        return {id:c.cinemaId,km:6371*2*Math.atan2(Math.sqrt(z),Math.sqrt(1-z))};
      }).filter(x=>Number.isFinite(x.km)).sort((a,b)=>a.km-b.km);
      setNearby(result);if(!result.length)setGeoError('Các rạp chưa có tọa độ GPS trong database.');
    }catch(e){setGeoError(errorMessage(e));}
  }
  async function sendChat(){
    if(!token||!query.trim()||chatBusy)return;
    const next=[...messages,{role:'user' as const,content:query.trim()}].slice(-30);
    setQuery('');setMessages(next);setChatBusy(true);setChatError('');
    try{const r=await api<{reply:string}>('/chat',{token,method:'POST',body:{messages:next}});
      if(!r.reply)throw new Error('Chatbot chưa trả lời');
      setMessages([...next,{role:'assistant',content:r.reply}]);
    }catch(e){setChatError(`${errorMessage(e)}. Chatbot có thể chưa cấu hình nhà cung cấp AI.`)}
    finally{setChatBusy(false)}
  }
  return <SimpleScroll>
    <Text style={S.title}>Khám phá CineHunt</Text>
    <Text style={[S.muted,{marginTop:10,marginBottom:18}]}>Gợi ý theo dữ liệu thật, thông tin rạp, combo và trợ lý điện ảnh.</Text>
    {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}
    <Text style={[S.h2,{marginBottom:11}]}>Dành cho bạn</Text>
    {!token?<Button title="Đăng nhập để nhận gợi ý AI" onPress={onAuth}/>:<>
      <Text style={[S.muted,{marginBottom:8}]}>Nguồn đề xuất: {source||'Đang kiểm tra'}. Nếu chưa có lịch sử đặt vé, hệ thống dùng gợi ý phổ biến.</Text>
      {recommend.map(m=><View key={m.movieId} style={[S.card,{flexDirection:'row',alignItems:'center',gap:12}]}><FilmArt movie={m} size={58}/><View style={{flex:1}}><Text style={S.text}>{m.title}</Text><Button kind="outline" title="Chi tiết phim" onPress={()=>onOpen(m)}/></View></View>)}
      {!loading&&!recommend.length&&<Text style={S.muted}>Chưa có dữ liệu gợi ý phù hợp.</Text>}
    </>}
    <Text style={[S.h2,{marginVertical:12}]}>Phim yêu thích</Text>
    <Text style={[S.muted,{marginBottom:10}]}>Danh sách yêu thích chỉ lưu trong phiên ứng dụng hiện tại, chưa đồng bộ lên SQL Server.</Text>
    {favoriteMovies.length?favoriteMovies.map(m=><View key={m.movieId} style={S.card}><Text style={S.text}>♥ {m.title}</Text><Button title="Xem phim" kind="outline" onPress={()=>onOpen(m)}/></View>):<Text style={S.muted}>Chưa đánh dấu phim nào.</Text>}
    <Text style={[S.h2,{marginTop:24,marginBottom:10}]}>Rạp CineHunt</Text>
    <Button title="Tìm rạp gần tôi (GPS)" kind="outline" onPress={()=>void locateCinemas()}/>
    {!!geoError&&<Notice text={geoError} bad/>}
    {(nearby.length?cinemas.slice().sort((a,b)=>(nearby.find(x=>x.id===a.cinemaId)?.km??Infinity)-(nearby.find(x=>x.id===b.cinemaId)?.km??Infinity)):cinemas).map(c=><View key={c.cinemaId} style={S.card}><Text style={[S.text,{fontWeight:'800'}]}>{c.cinemaName}</Text>{nearby.find(x=>x.id===c.cinemaId)&&<Text style={{color:C.cyan,marginTop:6}}>{nearby.find(x=>x.id===c.cinemaId)!.km.toFixed(1)} km đường chim bay</Text>}<Text style={[S.muted,{marginTop:7}]}>{c.address||'Chưa cập nhật địa chỉ'}</Text></View>)}
    <Text style={[S.h2,{marginTop:18,marginBottom:10}]}>Combo bắp nước</Text>
    {combos.map(co=><View key={co.comboId} style={S.card}><Text style={S.text}>{co.comboName||co.name||`Combo #${co.comboId}`}</Text><Text style={[S.muted,{marginTop:6}]}>{Number(co.price||0).toLocaleString('vi-VN')}đ</Text></View>)}
    <Text style={[S.h2,{marginTop:24}]}>Trợ lý phim AI</Text>
    <Text style={[S.muted,{marginVertical:9}]}>Chức năng phụ thuộc cấu hình Gemini/Groq của Backend. Không tạo câu trả lời giả khi API không khả dụng.</Text>
    {messages.map((m,i)=><View key={i} style={[S.card,{backgroundColor:m.role==='assistant'?'#242846':C.panel}]}><Text style={{color:C.cyan,fontWeight:'800'}}>{m.role==='assistant'?'Trợ lý':'Bạn'}</Text><Text style={[S.text,{marginTop:7,lineHeight:22}]}>{m.content}</Text></View>)}
    {token?<><Field label="Hỏi trợ lý" value={query} onChangeText={setQuery} placeholder="Gợi ý phim phù hợp tối nay..."/><Button title={chatBusy?'Đang trả lời...':'Gửi câu hỏi'} disabled={chatBusy||!query.trim()} onPress={()=>void sendChat()}/></>:<Button title="Đăng nhập để hỏi trợ lý" kind="outline" onPress={onAuth}/>}
    {!!chatError&&<Notice text={chatError} bad/>}
    <Button title="Tải lại nội dung khám phá" kind="outline" disabled={loading} onPress={()=>void load()}/>
  </SimpleScroll>;
}

import {useCallback,useEffect,useState} from 'react';
import {Pressable,Text,View,useWindowDimensions} from 'react-native';
import * as Location from 'expo-location';
import {api,errorMessage} from './api';
import {Button,C,Field,FilmArt,GlowPanel,Kicker,Loader,Notice,S,SectionHeading,SimpleScroll} from './ui';
import type {Movie} from './types';

type Cinema={cinemaId:number;cinemaName:string;address?:string;latitude?:number|string|null;longitude?:number|string|null};
type Combo={comboId:number;name?:string;comboName?:string;price?:number|string};
type Props={token:string|null;favorites:number[];onOpen:(m:Movie)=>void;onAuth:()=>void};
export default function Discover({token,favorites,onOpen,onAuth}:Props){
  const {width}=useWindowDimensions();
  const posterSize=Math.max(85,Math.min(125,Math.floor((width-40)*.484)-25));
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
  const fallback=source.toUpperCase().includes('FALLBACK')||source.toUpperCase().includes('POPULARITY');
  return <SimpleScroll refreshing={loading&&cinemas.length>0} onRefresh={()=>void load()}>
    <View style={{marginTop:7,marginBottom:16}}><Kicker>EXPLORE · DISCOVER</Kicker><Text style={[S.title,{fontSize:32,marginTop:8}]}>Khám phá<Text style={{color:C.purple}}> điều mới.</Text></Text><Text style={[S.muted,{marginTop:8}]}>Một thế giới phim và rạp chiếu dành riêng cho bạn.</Text></View>
    <GlowPanel from="#3A2B75" to="#0C3045" style={{marginBottom:10}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:15}}><View style={{width:54,height:54,borderRadius:20,backgroundColor:'#FFFFFF20',borderWidth:1,borderColor:'#FFFFFF35',alignItems:'center',justifyContent:'center'}}><Text style={{color:C.lavender,fontSize:28}}>✦</Text></View><View style={{flex:1}}><Kicker color={C.cyan}>CINEHUNT DISCOVERY</Kicker><Text style={{color:C.white,fontSize:19,fontWeight:'900',marginTop:6}}>Hôm nay xem gì?</Text><Text style={{color:'#DAD7EF',fontSize:12,marginTop:4}}>Tìm phim hay, rạp gần và combo hấp dẫn.</Text></View></View>
    </GlowPanel>
    {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}
    <SectionHeading title="Gợi ý dành cho bạn" subtitle={fallback?'Phim nổi bật đang được yêu thích':'Gợi ý từ dữ liệu phim CineHunt'}/>
    {!token?<Button title="Đăng nhập để nhận gợi ý" onPress={onAuth}/>:<>
      {source&&!fallback&&<Text style={[S.muted,{marginBottom:10,fontSize:11}]}>Kết quả phụ thuộc vào dữ liệu tương tác hiện có.</Text>}
      <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:12}}>
        {recommend.slice(0,8).map(m=><Pressable key={m.movieId} onPress={()=>onOpen(m)} accessibilityRole="button" style={{width:'48.4%',padding:11,borderRadius:18,borderWidth:1,borderColor:C.stroke,backgroundColor:C.panel}}>
          <View style={{alignItems:'center'}}><FilmArt movie={m} size={posterSize}/></View><Text style={{color:C.white,fontWeight:'800',marginTop:10,fontSize:13.5,minHeight:38}} numberOfLines={2}>{m.title}</Text><Text style={{color:C.cyan,fontSize:11,marginTop:7,fontWeight:'800'}}>Xem chi tiết  ↗</Text>
        </Pressable>)}
      </View>
      {!loading&&!recommend.length&&<Notice text="Chưa có gợi ý phù hợp. Bạn có thể chọn một bộ phim ở mục Phim."/>}
    </>}
    <SectionHeading title="Phim yêu thích" subtitle="Được lưu trong phiên đang mở"/>
    {favoriteMovies.length?favoriteMovies.map(m=><Pressable key={m.movieId} onPress={()=>onOpen(m)} style={[S.card,{flexDirection:'row',alignItems:'center',gap:12}]}><FilmArt movie={m} size={60}/><View style={{flex:1}}><Text style={{color:C.white,fontWeight:'800'}}>{m.title}</Text><Text style={{color:C.purple,fontSize:12,marginTop:8}}>♥  Xem phim</Text></View></Pressable>):<View style={[S.card,{paddingVertical:24,alignItems:'center'}]}><Text style={{color:C.red,fontSize:25}}>♡</Text><Text style={[S.muted,{textAlign:'center',marginTop:7}]}>Chạm biểu tượng trái tim tại một bộ phim để lưu lại.</Text></View>}
    <SectionHeading title="Rạp chiếu gần bạn" subtitle="Khám phá những điểm hẹn điện ảnh"/>
    <View style={{marginBottom:10}}><Button title="◎  Tìm rạp gần tôi bằng GPS" kind="outline" onPress={()=>void locateCinemas()}/></View>
    {!!geoError&&<Notice text={geoError} bad/>}
    {(nearby.length?cinemas.slice().sort((a,b)=>(nearby.find(x=>x.id===a.cinemaId)?.km??Infinity)-(nearby.find(x=>x.id===b.cinemaId)?.km??Infinity)):cinemas).map(c=><View key={c.cinemaId} style={[S.card,{flexDirection:'row',gap:13,alignItems:'center'}]}>
      <View style={{width:48,height:48,borderRadius:17,backgroundColor:'#202D4C',borderWidth:1,borderColor:'#3C658A',alignItems:'center',justifyContent:'center'}}><Text style={{color:C.cyan,fontSize:23}}>⌖</Text></View>
      <View style={{flex:1}}><Text style={{color:C.white,fontWeight:'900',fontSize:14.5}}>{c.cinemaName}</Text><Text style={[S.muted,{marginTop:6}]}>{c.address||'Chưa cập nhật địa chỉ'}</Text>{nearby.find(x=>x.id===c.cinemaId)&&<Text style={{color:C.green,fontSize:11,marginTop:7}}>◎  {nearby.find(x=>x.id===c.cinemaId)!.km.toFixed(1)} km đường chim bay</Text>}</View>
    </View>)}
    <SectionHeading title="Combo bắp nước" subtitle="Chọn thêm khi đặt vé"/>
    {combos.map((co,i)=><View key={co.comboId} style={[S.card,{flexDirection:'row',alignItems:'center',gap:13}]}>
      <View style={{width:56,height:56,borderRadius:17,backgroundColor:i%2===0?'#302544':'#1E3650',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:27}}>🍿</Text></View>
      <View style={{flex:1}}><Text style={{color:C.white,fontWeight:'900',fontSize:15}}>{co.comboName||co.name||`Combo #${co.comboId}`}</Text><Text style={{color:C.green,fontWeight:'900',fontSize:16,marginTop:7}}>{Number(co.price||0).toLocaleString('vi-VN')}đ</Text></View>
    </View>)}
    <SectionHeading title="Trợ lý điện ảnh AI" subtitle="Trò chuyện để khám phá phim hợp gu"/>
    <GlowPanel from="#31275D" to="#142B47" style={{marginBottom:15}}><View style={{flexDirection:'row',gap:12,alignItems:'center'}}><Text style={{fontSize:30,color:C.lavender}}>✧</Text><View style={{flex:1}}><Text style={{color:C.white,fontWeight:'900',fontSize:18}}>CineHunt Assistant</Text><Text style={{color:'#C9D4EF',fontSize:12,marginTop:5}}>Trả lời theo dữ liệu thật khi dịch vụ AI sẵn sàng.</Text></View></View></GlowPanel>
    {messages.map((m,i)=><View key={i} style={{backgroundColor:m.role==='assistant'?'#202746':C.panel,borderWidth:1,borderColor:m.role==='assistant'?'#595B93':C.stroke,borderRadius:18,padding:15,marginBottom:10,marginLeft:m.role==='user'?26:0,marginRight:m.role==='assistant'?26:0}}><Kicker color={m.role==='assistant'?C.purple:C.cyan}>{m.role==='assistant'?'✦  CINEHUNT AI':'BẠN'}</Kicker><Text style={{color:C.white,marginTop:8,lineHeight:22,fontSize:14}}>{m.content}</Text></View>)}
    {token?<><Field label="Nhắn cho CineHunt AI" value={query} onChangeText={setQuery} placeholder="Gợi ý phim vui cho tối nay..."/><Button title={chatBusy?'Đang trả lời...':'Gửi tin nhắn  →'} disabled={chatBusy||!query.trim()} onPress={()=>void sendChat()}/></>:<Button title="Đăng nhập để trò chuyện" onPress={onAuth}/>}
    {!!chatError&&<Notice text={chatError} bad/>}
    <Text style={[S.muted,{fontSize:11,marginTop:10}]}>AI có thể tạm không khả dụng khi nhà cung cấp giới hạn truy cập. Ứng dụng không tự đặt vé hoặc thanh toán nếu chưa xác nhận.</Text>
    <View style={{marginTop:13}}><Button title="↻  Làm mới trang khám phá" kind="outline" disabled={loading} onPress={()=>void load()}/></View>
  </SimpleScroll>;
}

import {useCallback,useEffect,useMemo,useState} from 'react';
import {Image,Linking,Pressable,ScrollView,Text,View,useWindowDimensions} from 'react-native';
import * as Location from 'expo-location';
import {api,errorMessage} from '../services/apiClient';
import {Button,C,FilmArt,GlowPanel,Kicker,Loader,Notice,S,SectionHeading,SimpleScroll} from './ui'; // CINEHUNT_FLOATING_AI_V1
import type {Movie} from '../types';

type Cinema={cinemaId:number;cinemaName:string;address?:string;latitude?:number|string|null;longitude?:number|string|null;imageUrl?:string|null;bannerUrl?:string|null;photoUrl?:string|null};
type Combo={comboId:number;name?:string;comboName?:string;price?:number|string};
type Props={token:string|null;favorites:number[];onOpen:(m:Movie)=>void;onAuth:()=>void};
export default function Discover({token,favorites,onOpen,onAuth}:Props){
  const {width}=useWindowDimensions();
  const posterSize=Math.max(85,Math.min(125,Math.floor((width-40)*.484)-25));
  const [recommend,setRecommend]=useState<Movie[]>([]);const [source,setSource]=useState('');
  const [cinemas,setCinemas]=useState<Cinema[]>([]);const [combos,setCombos]=useState<Combo[]>([]);const [favoriteMovies,setFavoriteMovies]=useState<Movie[]>([]);
  const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  // CINEHUNT_DISCOVER_DATA_STATUS_V1: separate unavailable API from missing coordinates.
  const [cinemaFetchStatus,setCinemaFetchStatus]=useState<'idle'|'ready'|'failed'>('idle');
  const [nearby,setNearby]=useState<{id:number;km:number}[]>([]);const [geoError,setGeoError]=useState('');
  // CINEHUNT_BETA_GPS_V1: nearby carousel and expandable city groups.
  const [activeTool,setActiveTool]=useState<'gps'|null>(null);
  const [expandedArea,setExpandedArea]=useState<string|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);setError('');setGeoError('');setNearby([]);
    try{
      // One failed endpoint must not erase successful results from other endpoints.
      const [cinemaResult,comboResult,movieResult]=await Promise.allSettled([
        api<Cinema[]>('/cinemas'),
        api<Combo[]>('/concession-combos'),
        api<{items:Movie[]}>('/movies?page=1&limit=50'),
      ]);
      const failures:string[]=[];
      if(cinemaResult.status==='fulfilled'&&Array.isArray(cinemaResult.value)){
        setCinemas(cinemaResult.value);
        setCinemaFetchStatus('ready');
      }else{
        setCinemas([]);
        setCinemaFetchStatus('failed');
        failures.push('rạp');
      }
      if(comboResult.status==='fulfilled'&&Array.isArray(comboResult.value)){
        setCombos(comboResult.value);
      }else{
        setCombos([]);
        failures.push('combo');
      }
      if(movieResult.status==='fulfilled'&&Array.isArray(movieResult.value.items)){
        setFavoriteMovies(movieResult.value.items.filter(m=>favorites.includes(m.movieId)));
      }else{
        setFavoriteMovies([]);
        failures.push('phim');
      }
      if(failures.length){
        setError(`Chưa tải được dữ liệu ${failures.join(', ')}. Kiểm tra kết nối Backend và thử làm mới.`);
      }
      if(token){
        try{
          const r=await api<{items:Movie[];source:string;debug?:{upstreamSource?:string}}>('/recommendations?limit=10',{token});
          setRecommend(r.items??[]);
          setSource(`${r.source||'FALLBACK'}${r.debug?.upstreamSource?` (${r.debug.upstreamSource})`:''}`);
        }catch(e){setRecommend([]);setError(errorMessage(e))}
      }else{setRecommend([]);setSource('')}
    }catch(e){setError(errorMessage(e))}finally{setLoading(false)}
  },[token,favorites]);
  useEffect(()=>{
    let active=true;
    void Promise.resolve().then(()=>{if(active)return load()});
    return ()=>{active=false};
  },[load]);
  async function locateCinemas(){
    setGeoError('');
    if(cinemaFetchStatus!=='ready'){
      setGeoError(cinemaFetchStatus==='failed'?'Chưa tải được danh sách rạp từ Backend. Hãy kiểm tra kết nối và làm mới.':'Đang tải dữ liệu rạp. Hãy thử lại sau khi tải xong.');
      return;
    }
    if(cinemas.length===0){setGeoError('Hệ thống hiện chưa có rạp đang hoạt động để tìm gần bạn.');return;}
    try{
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
      setNearby(result);if(!result.length)setGeoError('Đã tải được danh sách rạp, nhưng chưa có tọa độ GPS hợp lệ. Cần bổ sung tọa độ cho rạp trong hệ thống.');
    }catch(e){setGeoError(errorMessage(e));}
  }
  const orderedCinemas=useMemo(()=>cinemas.slice().sort((a,b)=>{
    const aKm=nearby.find(item=>item.id===a.cinemaId)?.km??Infinity;
    const bKm=nearby.find(item=>item.id===b.cinemaId)?.km??Infinity;
    return aKm-bKm;
  }),[cinemas,nearby]);
  const cinemaAreas=useMemo(()=>{
    const groups=new Map<string,Cinema[]>();
    cinemas.forEach(cinema=>{
      const segments=(cinema.address??'').split(',').map(v=>v.trim()).filter(Boolean);
      const areaSegments=segments.filter(v=>!['việt nam','vietnam'].includes(v.toLocaleLowerCase('vi-VN')));
      const area=areaSegments.at(-1)?.replace(/^(thành phố|tỉnh)\s+/i,'').trim()||'Chưa xác định khu vực';
      groups.set(area,[...(groups.get(area)??[]),cinema]);
    });
    return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b,'vi'));
  },[cinemas]);
  function distanceText(cinema:Cinema){
    const km=nearby.find(item=>item.id===cinema.cinemaId)?.km;
    return km===undefined?'Chưa xác định khoảng cách':`${km.toFixed(1)} km đường chim bay`;
  }
  async function openCinemaMap(cinema:Cinema){
    const lat=Number(cinema.latitude),lng=Number(cinema.longitude);
    const hasCoords=cinema.latitude!=null&&cinema.longitude!=null&&Number.isFinite(lat)&&Number.isFinite(lng);
    const destination=hasCoords?`${lat},${lng}`:[cinema.cinemaName,cinema.address].filter(Boolean).join(', ');
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`);
  }
  const fallback=source.toUpperCase().includes('FALLBACK')||source.toUpperCase().includes('POPULARITY');
  return <SimpleScroll refreshing={loading&&cinemas.length>0} onRefresh={()=>void load()}>
    <View style={{marginTop:7,marginBottom:16}}><Kicker>EXPLORE · DISCOVER</Kicker><Text style={[S.title,{fontSize:32,marginTop:8}]}>Khám phá<Text style={{color:C.purple}}> điều mới.</Text></Text><Text style={[S.muted,{marginTop:8}]}>Một thế giới phim và rạp chiếu dành riêng cho bạn.</Text></View>
    <GlowPanel from="#3A2B75" to="#0C3045" style={{marginBottom:10}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:15}}><View style={{width:54,height:54,borderRadius:20,backgroundColor:'#FFFFFF20',borderWidth:1,borderColor:'#FFFFFF35',alignItems:'center',justifyContent:'center'}}><Text style={{color:C.lavender,fontSize:28}}>✦</Text></View><View style={{flex:1}}><Kicker color={C.heroCyan}>CINEHUNT DISCOVERY</Kicker><Text style={{color:C.hero,fontSize:19,fontWeight:'900',marginTop:6}}>Hôm nay xem gì?</Text><Text style={{color:'#DAD7EF',fontSize:12,marginTop:4}}>Tìm phim hay, rạp gần và combo hấp dẫn.</Text></View></View>
    </GlowPanel>
    {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}
    <View style={{flexDirection:'row',gap:10,marginTop:16,marginBottom:14}}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tìm rạp gần tôi bằng GPS"
        accessibilityState={{expanded:activeTool==='gps'}}
        onPress={()=>{
          if(activeTool==='gps')setActiveTool(null);
          else{setActiveTool('gps');void locateCinemas()}
        }}
        style={{flex:1,minHeight:92,borderWidth:1,borderColor:activeTool==='gps'?C.purple:C.stroke,backgroundColor:activeTool==='gps'?C.panel2:C.panel,borderRadius:19,paddingVertical:14,paddingHorizontal:10,alignItems:'center',justifyContent:'center',gap:7}}
      >
        <Text style={{fontSize:25}}>📍</Text>
        <Text style={{color:C.white,fontWeight:'800',fontSize:13,textAlign:'center'}}>Rạp gần tôi</Text>
      </Pressable>
    </View>
    {activeTool==='gps'&&<View style={{marginBottom:16}}>
      <SectionHeading title="Rạp gần bạn" subtitle="Danh sách rạp CineHunt lấy từ hệ thống"/>
      <View style={{marginBottom:14}}><Button title="◎  Cập nhật vị trí GPS" kind="outline" onPress={()=>void locateCinemas()}/></View>
      {!!geoError&&<Notice text={geoError} bad/>}
      {!loading&&!geoError&&cinemaFetchStatus==='ready'&&cinemas.length===0&&<Notice text="Hệ thống chưa có rạp đang hoạt động để hiển thị."/>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:12,paddingVertical:6,paddingRight:18}}>
        {orderedCinemas.map(cinema=>{
          const image=cinema.imageUrl||cinema.bannerUrl||cinema.photoUrl;
          return <Pressable key={String(cinema.cinemaId)} accessibilityRole="button" accessibilityLabel={`Xem vị trí ${cinema.cinemaName}`} onPress={()=>void openCinemaMap(cinema)} style={{width:230,borderRadius:20,backgroundColor:C.panel,borderWidth:1,borderColor:C.stroke,overflow:'hidden'}}>
            {image?<Image source={{uri:image}} resizeMode="cover" style={{height:120,width:'100%'}}/>:
              <GlowPanel from="#43327B" to="#183D58" style={{height:120,borderRadius:0,justifyContent:'center',alignItems:'center'}}>
                <Text style={{fontSize:31,color:C.lavender}}>◈</Text>
                <Text style={{color:C.hero,fontWeight:'800',fontSize:13,marginTop:7}}>CINEHUNT CINEMA</Text>
              </GlowPanel>}
            <View style={{padding:13,gap:6}}>
              <Text numberOfLines={1} style={{fontSize:17,color:C.white,fontWeight:'900'}}>{cinema.cinemaName}</Text>
              <Text numberOfLines={2} style={{fontSize:12,color:C.muted,minHeight:30}}>{cinema.address||'Chưa có địa chỉ'}</Text>
              <Text style={{fontSize:13,color:C.cyan,fontWeight:'800'}}>{distanceText(cinema)}</Text>
              <Text style={{fontSize:12,color:C.purple,fontWeight:'800'}}>Xem bản đồ  ↗</Text>
            </View>
          </Pressable>;
        })}
      </ScrollView>
      <SectionHeading title="Chọn rạp theo khu vực" subtitle="Chạm vào khu vực để xem từng rạp"/>
      {cinemaAreas.map(([area,list])=><View key={area} style={{marginBottom:10,borderRadius:15,overflow:'hidden',borderWidth:1,borderColor:C.stroke,backgroundColor:C.panel}}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Khu vực ${area}, ${list.length} rạp`} accessibilityState={{expanded:expandedArea===area}} onPress={()=>setExpandedArea(expandedArea===area?null:area)} style={{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:17,gap:10}}>
          <Text style={{flex:1,color:C.white,fontSize:16,fontWeight:'700'}}>{area}</Text>
          <Text style={{color:C.cyan,fontWeight:'900',fontSize:15}}>{list.length}</Text>
          <Text style={{color:C.purple,fontWeight:'900',fontSize:18}}>{expandedArea===area?'⌃':'⌄'}</Text>
        </Pressable>
        {expandedArea===area&&<View style={{paddingHorizontal:14,paddingBottom:12,borderTopWidth:1,borderTopColor:C.stroke}}>
          {list.map(cinema=><Pressable key={String(cinema.cinemaId)} accessibilityRole="button" onPress={()=>void openCinemaMap(cinema)} style={{paddingVertical:13,borderBottomWidth:1,borderBottomColor:C.stroke,flexDirection:'row',alignItems:'center',gap:12}}>
            <Text style={{fontSize:21,color:C.purple}}>⌖</Text>
            <View style={{flex:1}}><Text style={{color:C.white,fontWeight:'800',fontSize:14}}>{cinema.cinemaName}</Text><Text style={{color:C.muted,fontSize:11,marginTop:5}}>{cinema.address||'Chưa có địa chỉ'}</Text><Text style={{color:C.cyan,fontSize:11,marginTop:4}}>{distanceText(cinema)}</Text></View>
            <Text style={{color:C.purple,fontSize:12,fontWeight:'800'}}>Bản đồ ↗</Text>
          </Pressable>)}
        </View>}
      </View>)}
    </View>}
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
    <SectionHeading title="Combo bắp nước" subtitle="Chọn thêm khi đặt vé"/>
    {combos.map((co,i)=><View key={co.comboId} style={[S.card,{flexDirection:'row',alignItems:'center',gap:13}]}>
      <View style={{width:56,height:56,borderRadius:17,backgroundColor:i%2===0?C.iconA:C.iconB,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:27}}>🍿</Text></View>
      <View style={{flex:1}}><Text style={{color:C.white,fontWeight:'900',fontSize:15}}>{co.comboName||co.name||`Combo #${co.comboId}`}</Text><Text style={{color:C.green,fontWeight:'900',fontSize:16,marginTop:7}}>{Number(co.price||0).toLocaleString('vi-VN')}đ</Text></View>
    </View>)}
    <View style={{marginTop:13}}><Button title="↻  Làm mới trang khám phá" kind="outline" disabled={loading} onPress={()=>void load()}/></View>
  </SimpleScroll>;
}

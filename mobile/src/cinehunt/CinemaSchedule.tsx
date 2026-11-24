import {useEffect,useMemo,useState} from 'react';
import {Pressable,ScrollView,Text,View} from 'react-native';
import {api,errorMessage,formatMoney} from '../services/apiClient';
import {Button,Loader,Notice,SectionHeading} from './ui';
import {AppIcon} from './icons';
import {useCineHuntTheme} from './theme';
import type {Movie,Showtime} from '../types';
import {loadPublicCatalog} from './publicCatalog';

type CinemaOption={cinemaId:number;cinemaName:string};
type Props={cinemas:CinemaOption[];onSeats:(showtime:Showtime)=>void};

function dayKey(value:Date){
  return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
}

export default function CinemaSchedule({cinemas,onSeats}:Props){
  const {C,S}=useCineHuntTheme();
  const [selectedCinema,setSelectedCinema]=useState<number|null>(null);
  const [selectedDay,setSelectedDay]=useState(dayKey(new Date()));
  const [shows,setShows]=useState<Showtime[]>([]);
  const [movies,setMovies]=useState<Movie[]>([]);
  const [loading,setLoading]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [clockNow,setClockNow]=useState<number|null>(null);
  const [error,setError]=useState('');
  const dates=useMemo(()=>Array.from({length:7},(_,i)=>{
    const date=new Date();date.setDate(date.getDate()+i);
    return {key:dayKey(date),label:i===0?'Hôm nay':`${date.getDate()}/${date.getMonth()+1}`};
  }),[]);
  async function refresh(){
    setLoading(true);setError('');
    try{
      const [s,m]=await Promise.all([
        api<Showtime[]>('/showtimes'),
        loadPublicCatalog(),
      ]);
      if(!Array.isArray(s)||!Array.isArray(m.items))throw new Error('Dữ liệu lịch chiếu chưa hợp lệ');
      setShows(s);setMovies(m.items);setLoaded(true);
    }catch(e){setError(errorMessage(e))}finally{setLoading(false)}
  }
  useEffect(()=>{
    if(selectedCinema===null||loaded||loading)return;
    const task=setTimeout(()=>{void refresh()},0);
    return()=>clearTimeout(task);
  // Select a cinema to lazy-load schedules once; manual button handles refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selectedCinema,loaded]);
  useEffect(()=>{
    const tick=()=>setClockNow(Date.now());
    const initial=setTimeout(tick,0);
    const interval=setInterval(tick,30000);
    return ()=>{clearTimeout(initial);clearInterval(interval)};
  },[]);
  const matching=useMemo(()=>{
    if(clockNow===null)return [];
    return shows.filter(s=>
      s.status==='OPEN' && Number(s.room?.cinema?.cinemaId)===selectedCinema &&
      dayKey(new Date(s.startTime))===selectedDay &&
      new Date(s.startTime).getTime()>clockNow
    ).sort((a,b)=>new Date(a.startTime).getTime()-new Date(b.startTime).getTime());
  },[shows,selectedCinema,selectedDay,clockNow]);
  const grouped=useMemo(()=>{
    const groups=new Map<number,Showtime[]>();
    matching.forEach(s=>{const id=s.movieId??0;groups.set(id,[...(groups.get(id)??[]),s])});
    return [...groups.entries()];
  },[matching]);
  return <View style={{marginTop:18}}>
    <SectionHeading title="Lịch chiếu theo rạp" subtitle="Lịch bán vé thực tế từ CineHunt, chọn ngày và suất chiếu"/>
    {!cinemas.length&&<Notice text="Chưa có rạp để xem lịch chiếu."/>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:9,paddingVertical:5,paddingRight:15}}>
      {cinemas.map(c=><Pressable key={c.cinemaId} accessibilityRole="button" accessibilityLabel={`Chọn lịch ${c.cinemaName}`} accessibilityState={{selected:selectedCinema===c.cinemaId}} onPress={()=>setSelectedCinema(c.cinemaId)} style={{minHeight:44,justifyContent:'center',padding:12,borderRadius:14,borderWidth:1,borderColor:selectedCinema===c.cinemaId?C.purple:C.stroke,backgroundColor:selectedCinema===c.cinemaId?C.panel2:C.panel,minWidth:156,maxWidth:225}}>
        <Text style={{color:selectedCinema===c.cinemaId?C.purple:C.white,fontWeight:'800',fontSize:13}}>{c.cinemaName}</Text>
      </Pressable>)}
    </ScrollView>
    {selectedCinema!==null&&<>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:14}}>
        {dates.map(d=><Pressable key={d.key} accessibilityRole="button" accessibilityLabel={`Lịch ngày ${d.key}`} accessibilityState={{selected:selectedDay===d.key}} onPress={()=>setSelectedDay(d.key)} style={{paddingHorizontal:16,paddingVertical:13,borderRadius:13,backgroundColor:selectedDay===d.key?C.purple:C.panel,borderWidth:1,borderColor:selectedDay===d.key?C.purple:C.stroke}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}><AppIcon name="calendar" size={15} color={selectedDay===d.key?C.bg:C.white}/><Text style={{color:selectedDay===d.key?C.bg:C.white,fontWeight:'800'}}>{d.label}</Text></View>
        </Pressable>)}
      </ScrollView>
      {loading&&<Loader/>}
      {!!error&&<Notice bad text={error}/>}
      {!loading&&loaded&&grouped.length===0&&<Notice text="Rạp chưa có suất chiếu mở bán cho ngày này. Admin có thể tạo suất chiếu trong CineHunt Web."/>}
      {grouped.map(([movieId,times])=>{
        const movie=movies.find(m=>m.movieId===movieId);
        return <View key={movieId} style={[S.card,{marginBottom:10}]}>
          <Text style={{fontSize:17,fontWeight:'900',color:C.white}}>{movie?.title||`Phim #${movieId}`}</Text>
          <Text style={{fontSize:12,color:C.muted,marginTop:5}}>{movie?.durationMinutes||'—'} phút · {movie?.ageRating||'P'}</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:9,marginTop:13}}>
            {times.map(s=>{
              const date=new Date(s.startTime);
              const hour=`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
              return <Pressable key={s.showtimeId} accessibilityRole="button" accessibilityLabel={`Đặt vé ${hour}`} onPress={()=>onSeats(s)} style={{borderRadius:13,borderWidth:1,borderColor:C.purple,backgroundColor:C.panel2,paddingHorizontal:14,paddingVertical:11}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}><AppIcon name="clock" size={14} color={C.purple}/><Text style={{color:C.white,fontWeight:'900',fontSize:15}}>{hour}</Text></View>
                <Text style={{color:C.green,fontSize:11,marginTop:4}}>Từ {formatMoney(s.basePrice)}</Text>
              </Pressable>
            })}
          </View>
        </View>
      })}
      <Button title="Làm mới lịch chiếu" icon="refresh" kind="outline" disabled={loading} onPress={()=>void refresh()}/>
    </>}
  </View>;
}

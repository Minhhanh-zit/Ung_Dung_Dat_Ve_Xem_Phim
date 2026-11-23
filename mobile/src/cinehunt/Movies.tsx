import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Pressable,Text,TextInput,View,useWindowDimensions} from 'react-native';
import {api,errorMessage,formatDate,formatMoney} from '../services/apiClient';
import {Button,C,FilmArt,GlowPanel,Kicker,Loader,Notice,S,SectionHeading,SimpleScroll} from './ui';
import type {Movie,Showtime} from '../types';
import {isCoreShowtime} from './cinemaScope';

type Props={mode:'list'|'detail';selectedMovie?:Movie;token?:string|null;favorites:number[];onToggleFav:(id:number)=>void;onOpen:(m:Movie)=>void;onSeats?:(s:Showtime)=>void;onAuth?:()=>void};
export default function Movies({mode,selectedMovie,token,favorites,onToggleFav,onOpen,onSeats,onAuth}:Props){
  const {width}=useWindowDimensions();
  const posterSize=Math.max(84,Math.min(126,Math.floor((width-44)/3)-13));
  const [movies,setMovies]=useState<Movie[]>([]);
  const [detail,setDetail]=useState<Movie|null>(null);
  const [shows,setShows]=useState<Showtime[]>([]);
  const [showDate,setShowDate]=useState('all');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  // CINEHUNT_BETA_MOVIE_V1: tabs backed by real movie/showtime records.
  const [filter,setFilter]=useState<'COMING_SOON'|'NOW_SHOWING'|'EARLY'>('NOW_SHOWING');
  const [earlyIds,setEarlyIds]=useState<number[]>([]);
  const [earlyChecking,setEarlyChecking]=useState(false);
  const [earlyChecked,setEarlyChecked]=useState(false);
  const earlyRequest=useRef(0);
  const [rating,setRating]=useState(0);
  const [ratingMessage,setRatingMessage]=useState('');
  const [now,setNow]=useState<number|null>(null);
  useEffect(()=>{
    const initial=setTimeout(()=>setNow(Date.now()),0);
    const interval=setInterval(()=>setNow(Date.now()),60000);
    return ()=>{clearTimeout(initial);clearInterval(interval)};
  },[]);
  const loadList=useCallback(async()=>{setLoading(true);setError('');try{
    const r=await api<{items:Movie[];total:number}>('/movies?page=1&limit=50');
    if(!Array.isArray(r.items))throw new Error('Danh sách phim không hợp lệ');earlyRequest.current+=1;setEarlyChecked(false);setEarlyChecking(false);setEarlyIds([]);setMovies(r.items);
  }catch(e){setError(errorMessage(e))}finally{setLoading(false)}},[]);
  useEffect(()=>{
    if(mode!=='list')return;
    let active=true;
    void Promise.resolve().then(()=>{if(active)return loadList()});
    return ()=>{active=false};
  },[mode,loadList]);
  const selectedMovieId=selectedMovie?.movieId;
  useEffect(()=>{
    if(mode!=='detail'||selectedMovieId==null)return;
    let active=true;
    void Promise.resolve().then(()=>{
      if(!active)return;
      setShowDate('all');setDetail(null);setShows([]);setLoading(true);setError('');setRatingMessage('');setRating(0);
      return Promise.all([api<Movie>(`/movies/${selectedMovieId}`),api<Showtime[]>(`/showtimes/movie/${selectedMovieId}`)])
        .then(([m,s])=>{if(active){setDetail(m);setShows(Array.isArray(s)?s:[]);}})
        .catch(e=>{if(active)setError(errorMessage(e))})
        .finally(()=>{if(active)setLoading(false)});
    });
    return ()=>{active=false};
  },[mode,selectedMovieId]);
  const filtered=useMemo(()=>movies.filter(m=>{
    const matching=filter==='EARLY'?earlyIds.includes(m.movieId):m.status===filter;
    return matching&&m.title.toLocaleLowerCase('vi-VN').includes(search.trim().toLocaleLowerCase('vi-VN'));
  }),[movies,filter,search,earlyIds]);
  async function chooseFilter(next:'COMING_SOON'|'NOW_SHOWING'|'EARLY'){
    setFilter(next);
    if(next!=='EARLY'||earlyChecked||earlyChecking||loading||now===null)return;
    setEarlyChecking(true);
    const currentRequest=++earlyRequest.current;
    const candidates=movies.filter(m=>m.status==='COMING_SOON'&&!!m.releaseDate);
    const found:number[]=[];
    const currentTime=now;
    // Read-only lookups, at most four parallel requests. Never invent an early screening.
    try{
      for(let i=0;i<candidates.length;i+=4){
        const batch=candidates.slice(i,i+4);
        const results=await Promise.allSettled(batch.map(m=>api<Showtime[]>(`/showtimes/movie/${m.movieId}`)));
        if(currentRequest!==earlyRequest.current)return;
        results.forEach((result,index)=>{
          if(result.status!=='fulfilled'||!Array.isArray(result.value))return;
          const movie=batch[index];
          const release=Date.parse(movie.releaseDate!);
          if(!Number.isFinite(release))return;
          if(result.value.some(show=>show.status==='OPEN'&&Number.isFinite(Date.parse(show.startTime))&&Date.parse(show.startTime)>currentTime&&Date.parse(show.startTime)<release)){
            found.push(movie.movieId);
          }
        });
      }
      if(currentRequest===earlyRequest.current){setEarlyIds(found);setEarlyChecked(true)}
    }finally{
      if(currentRequest===earlyRequest.current)setEarlyChecking(false);
    }
  }
  const featured=movies.find(m=>m.status==='NOW_SHOWING')??movies[0];
  async function sendRating(stars:number){
    if(!selectedMovie||!token){onAuth?.();return;}
    try{await api(`/movies/${selectedMovie.movieId}/rating`,{token,method:'PUT',body:{stars}});setRating(stars);setRatingMessage('Đã gửi đánh giá của bạn.');}
    catch(e){setRatingMessage(errorMessage(e))}
  }
  if(mode==='list')return <SimpleScroll refreshing={loading&&movies.length>0} onRefresh={()=>void loadList()}>
    <View style={{marginTop:7,marginBottom:14}}><Kicker>CINEHUNT · LỊCH CHIẾU THEO PHIM</Kicker><Text style={[S.title,{fontSize:32,marginTop:9}]}>Phim tại CineHunt<Text style={{color:C.purple}}>.</Text></Text><Text style={[S.muted,{marginTop:7}]}>Khám phá phim, chọn lịch chiếu phù hợp.</Text></View>
    <View style={{flexDirection:'row',marginBottom:16,borderBottomWidth:1,borderBottomColor:C.stroke}}>
      {([['COMING_SOON','SẮP CHIẾU'],['NOW_SHOWING','ĐANG CHIẾU'],['EARLY','SUẤT CHIẾU SỚM']] as const).map(([value,label])=>
        <Pressable key={value} accessibilityRole="tab" accessibilityState={{selected:filter===value}} onPress={()=>void chooseFilter(value)} style={{flex:1,minHeight:53,alignItems:'center',justifyContent:'center',paddingHorizontal:2,borderBottomWidth:3,borderBottomColor:filter===value?C.purple:'transparent'}}>
          <Text style={{fontSize:width<380?10:11,fontWeight:'900',textAlign:'center',color:filter===value?C.purple:C.muted}}>{label}</Text>
        </Pressable>
      )}
    </View>
    {featured&&<GlowPanel from="#513577" to="#0D2341" style={{marginBottom:22}}>
      <Pressable onPress={()=>onOpen(featured)} accessibilityRole="button" accessibilityLabel={`Khám phá phim ${featured.title}`} style={{flexDirection:'row',alignItems:'center',gap:14}}>
        <View style={{flex:1,justifyContent:'center',gap:10}}>
          <Kicker color="#98EFFF">PHIM NỔI BẬT</Kicker>
          <Text numberOfLines={3} style={{fontSize:24,fontWeight:'900',letterSpacing:-.8,color:C.hero,lineHeight:29}}>{featured.title}</Text>
          <Text style={{fontSize:11.5,color:'#DFD7EE'}}>{featured.durationMinutes} phút  ·  {featured.ageRating??'P'}  ·  {featured.genres?.[0]?.genreName??'Điện ảnh'}</Text>
          <View style={{backgroundColor:C.purple,alignSelf:'flex-start',paddingHorizontal:13,paddingVertical:10,borderRadius:12,marginTop:7}}><Text style={{color:C.bg,fontWeight:'900',fontSize:12}}>Khám phá ngay  ↗</Text></View>
        </View>
        <FilmArt movie={featured} size={123} radius={13}/>
      </Pressable>
    </GlowPanel>}
    <View style={{flexDirection:'row',backgroundColor:C.panel,borderRadius:17,borderWidth:1,borderColor:C.stroke,alignItems:'center',paddingLeft:15,marginBottom:17}}>
      <Text style={{color:C.purple,fontSize:23}}>⌕</Text>
      <TextInput placeholder="Bạn muốn xem phim gì?" placeholderTextColor={C.soft} style={{flex:1,color:C.white,fontSize:14,paddingHorizontal:11,paddingVertical:16}} value={search} onChangeText={setSearch}/>
    </View>

    <SectionHeading title={filter==='COMING_SOON'?'Phim sắp chiếu':filter==='EARLY'?'Suất chiếu sớm':'Phim đang chiếu'} subtitle={error?'Không thể tải danh sách, hãy thử lại':`${filtered.length} bộ phim`}/>
    {filter==='EARLY'&&earlyChecking&&<View style={{marginBottom:10}}><Loader/><Text style={[S.muted,{textAlign:'center',marginTop:8,fontSize:12}]}>Đang kiểm tra lịch chiếu sớm từ hệ thống...</Text></View>}
    {filter==='EARLY'&&!earlyChecking&&earlyChecked&&filtered.length===0&&<Notice text="Chưa tìm thấy suất chiếu mở bán trước ngày khởi chiếu trong dữ liệu hiện có."/>}
    {loading&&<Loader/>}{!!error&&<Notice bad text={error}/>}
    <View style={{flexDirection:'row',flexWrap:'wrap',columnGap:'2.75%',rowGap:20}}>
      {filtered.map(m=><View key={m.movieId} style={{width:'31.5%'}}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Xem phim ${m.title}`} onPress={()=>onOpen(m)} style={{borderRadius:13,overflow:'hidden'}}>
          <View style={{alignItems:'center',position:'relative'}}>
            <FilmArt movie={m} size={posterSize} radius={11}/>
            <View style={{position:'absolute',top:6,left:6,backgroundColor:m.ageRating==='T18'?'#D96A86':m.ageRating==='T16'?'#E5B642':'#7EC9B8',borderRadius:5,paddingHorizontal:5,paddingVertical:3}}>
              <Text style={{fontSize:10,fontWeight:'900',color:'#172039'}}>{m.ageRating??'P'}</Text>
            </View>
          </View>
          <Text numberOfLines={2} style={{color:C.white,textAlign:'center',fontWeight:'800',fontSize:12.5,lineHeight:17,minHeight:34,marginTop:9}}>{m.title}</Text>
          <Text style={{color:C.muted,textAlign:'center',fontSize:11.5,marginTop:4}}>{m.durationMinutes} phút</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={favorites.includes(m.movieId)?`Bỏ yêu thích ${m.title}`:`Yêu thích ${m.title}`} onPress={()=>onToggleFav(m.movieId)} style={{position:'absolute',right:2,top:Math.max(12,posterSize-26),backgroundColor:C.panel,borderRadius:15,paddingHorizontal:7,paddingVertical:3,borderWidth:1,borderColor:C.stroke}}>
          <Text style={{color:favorites.includes(m.movieId)?C.red:C.muted,fontSize:16}}>{favorites.includes(m.movieId)?'♥':'♡'}</Text>
        </Pressable>
      </View>)}
    </View>
    {!loading&&!error&&!filtered.length&&filter!=='EARLY'&&<Notice text="Không có phim phù hợp với bộ lọc này. Hãy thử mục khác."/>}
    <View style={{marginTop:21}}><Button title="↻  Tải lại danh sách phim" kind="outline" onPress={()=>void loadList()}/></View>
  </SimpleScroll>;
  const movie=detail??selectedMovie;
  const upcoming=now===null?[]:shows.filter(s=>s.status==='OPEN'&&isCoreShowtime(s)&&new Date(s.startTime).getTime()>now).sort((a,b)=>new Date(a.startTime).getTime()-new Date(b.startTime).getTime());
  const toDay=(value:string)=>{const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const scheduleDays=[...new Set(upcoming.map(s=>toDay(s.startTime)))];
  const visibleShows=showDate==='all'?upcoming:upcoming.filter(s=>toDay(s.startTime)===showDate);
  return <SimpleScroll>
    {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}
    {movie&&<>
      <GlowPanel from="#452B68" to="#10213B" style={{marginTop:5}}>
        <View style={{alignItems:'center'}}><FilmArt movie={movie} size={174} radius={19}/></View>
        <Text style={{fontSize:27,color:C.hero,fontWeight:'900',marginTop:19,letterSpacing:-.4,textAlign:'center'}}>{movie.title}</Text>
        {!!movie.originalTitle&&<Text style={[S.muted,{textAlign:'center',marginTop:4}]}>{movie.originalTitle}</Text>}
        <Text style={{color:'#D7D8F1',textAlign:'center',marginTop:13,fontSize:12}}>{movie.durationMinutes} phút  •  {movie.ageRating??'P'}  •  {movie.status==='NOW_SHOWING'?'Đang chiếu':'Sắp chiếu'}</Text>
        <View style={{flexDirection:'row',justifyContent:'center',marginTop:15,gap:17}}>
          <Text style={{color:C.orange,fontWeight:'800'}}>★  {movie.averageRating?Number(movie.averageRating).toFixed(1):'Mới'}</Text>
          <Text style={{color:C.heroCyan,fontWeight:'800'}}>◈  {movie.genres?.[0]?.genreName??'Điện ảnh'}</Text>
        </View>
        <Button title={favorites.includes(movie.movieId)?'♥  Đã thêm yêu thích':'♡  Thêm vào yêu thích'} kind="outline" onPress={()=>onToggleFav(movie.movieId)}/>
      </GlowPanel>
      <SectionHeading title="Câu chuyện" subtitle="Nội dung và thông tin phim"/>
      <Text style={{color:'#D7DEEF',lineHeight:24,fontSize:14.5}}>{movie.description??'Đang cập nhật nội dung phim.'}</Text>
      <View style={{marginTop:16,gap:9}}>
        <Text style={S.muted}>Thể loại: <Text style={{color:C.white}}>{movie.genres?.map(g=>g.genreName).join(', ')||'Đang cập nhật'}</Text></Text>
        {!!movie.director&&<Text style={S.muted}>Đạo diễn: <Text style={{color:C.white}}>{movie.director}</Text></Text>}
        {!!movie.actors&&<Text style={S.muted}>Diễn viên: <Text style={{color:C.white}}>{movie.actors}</Text></Text>}
      </View>
      <SectionHeading title="Lịch chiếu" subtitle="Chọn suất phù hợp để đặt vé"/>
      {!loading&&upcoming.length===0&&<Notice text="Chưa có suất chiếu sắp tới hoặc đã đóng bán. Vui lòng xem phim khác hoặc quay lại sau."/>}
      {upcoming.length>0&&<View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:12}}>
        <Pressable onPress={()=>setShowDate('all')} style={{backgroundColor:showDate==='all'?C.purple:C.panel,padding:10,borderRadius:12}}><Text style={{color:showDate==='all'?C.bg:C.white,fontWeight:'800'}}>Tất cả ngày</Text></Pressable>
        {scheduleDays.map(day=><Pressable key={day} onPress={()=>setShowDate(day)} style={{backgroundColor:showDate===day?C.purple:C.panel,padding:10,borderRadius:12}}><Text style={{color:showDate===day?C.bg:C.white,fontWeight:'800'}}>{day.split('-').reverse().join('/')}</Text></Pressable>)}
      </View>}
      {visibleShows.map(s=><View key={s.showtimeId} style={S.card}>
        <Kicker>RẠP CHIẾU</Kicker><Text style={{color:C.white,fontWeight:'900',fontSize:16,marginTop:8}}>{s.room?.cinema?.cinemaName||'Rạp CineHunt'}</Text>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:15}}>
          <View><Text style={{color:C.cyan,fontSize:16,fontWeight:'800'}}>{formatDate(s.startTime)}</Text><Text style={[S.muted,{marginTop:5}]}>Phòng {s.room?.roomName||'Đang cập nhật'}</Text></View>
          <View style={{alignItems:'flex-end'}}><Text style={{color:C.soft,fontSize:11}}>TỪ</Text><Text style={{color:C.green,fontSize:16,fontWeight:'900'}}>{formatMoney(s.basePrice)}</Text></View>
        </View>
        <View style={{marginTop:9}}><Button title="Chọn ghế & đặt vé  →" onPress={()=>onSeats?.(s)}/></View>
      </View>)}
      <SectionHeading title="Đánh giá phim" subtitle="Chấm điểm nếu tài khoản đáp ứng điều kiện"/>
      <View style={{flexDirection:'row',gap:11}}>{[1,2,3,4,5].map(stars=><Pressable key={stars} accessibilityRole="button" accessibilityLabel={`Đánh giá ${stars} sao`} onPress={()=>void sendRating(stars)} style={{backgroundColor:C.panel,borderWidth:1,borderColor:C.stroke,padding:10,borderRadius:13}}><Text style={{fontSize:21,color:stars<=rating?C.orange:C.soft}}>★</Text></Pressable>)}</View>
      {!!ratingMessage&&<Notice text={ratingMessage} bad={!rating}/>}
    </>}
  </SimpleScroll>;
}

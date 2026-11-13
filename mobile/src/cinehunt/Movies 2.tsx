import {useCallback,useEffect,useMemo,useState} from 'react';
import {Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {api,errorMessage,formatDate,formatMoney} from './api';
import {Button,C,FilmArt,Loader,Notice,S,SimpleScroll} from './ui';
import type {Movie,Showtime} from './types';

type Props={mode:'list'|'detail';selectedMovie?:Movie;token?:string|null;favorites:number[];onToggleFav:(id:number)=>void;onOpen:(m:Movie)=>void;onSeats?:(s:Showtime)=>void;onAuth?:()=>void};
export default function Movies({mode,selectedMovie,token,favorites,onToggleFav,onOpen,onSeats,onAuth}:Props) {
  const [movies,setMovies]=useState<Movie[]>([]);
  const [detail,setDetail]=useState<Movie|null>(null);
  const [shows,setShows]=useState<Showtime[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('ALL');
  const [rating,setRating]=useState(0);
  const [ratingMessage,setRatingMessage]=useState('');
  const loadList=useCallback(async()=>{setLoading(true);setError('');try{const r=await api<{items:Movie[];total:number}>('/movies?page=1&limit=50');if(!Array.isArray(r.items))throw new Error('Danh sách phim không hợp lệ');setMovies(r.items);}catch(e){setError(errorMessage(e));}finally{setLoading(false)}},[]);
  useEffect(()=>{if(mode==='list')void loadList()},[mode,loadList]);
  useEffect(()=>{
    if(mode!=='detail'||!selectedMovie)return;
    let active=true;setDetail(null);setShows([]);setLoading(true);setError('');setRatingMessage('');setRating(0);
    void Promise.all([api<Movie>(`/movies/${selectedMovie.movieId}`),api<Showtime[]>(`/showtimes/movie/${selectedMovie.movieId}`)])
      .then(([m,s])=>{if(active){setDetail(m);setShows(Array.isArray(s)?s:[]);}})
      .catch(e=>{if(active)setError(errorMessage(e))})
      .finally(()=>{if(active)setLoading(false)});
    return ()=>{active=false};
  },[mode,selectedMovie?.movieId]);
  const filtered=useMemo(()=>movies.filter(m=>(filter==='ALL'||m.status===filter)&&m.title.toLocaleLowerCase('vi-VN').includes(search.trim().toLocaleLowerCase('vi-VN'))),[movies,filter,search]);
  async function sendRating(stars:number) {
    if(!selectedMovie||!token){onAuth?.();return;}
    try{await api(`/movies/${selectedMovie.movieId}/rating`,{token,method:'PUT',body:{stars}});setRating(stars);setRatingMessage('Đã gửi đánh giá của bạn.');}
    catch(e){setRatingMessage(errorMessage(e))}
  }
  if(mode==='list') return <SimpleScroll>
    <Text style={[S.title,{color:C.purple,marginTop:8}]}>Khám phá phim</Text>
    <Text style={[S.muted,{marginTop:8}]}>Phim đang chiếu, sắp chiếu và suất chiếu thực tế.</Text>
    <TextInput placeholder="Tìm tên phim..." placeholderTextColor="#75839E" style={[S.input,{marginTop:20}]} value={search} onChangeText={setSearch}/>
    <View style={{flexDirection:'row',gap:7,marginVertical:19}}>
      {([['ALL','Tất cả'],['NOW_SHOWING','Đang chiếu'],['COMING_SOON','Sắp chiếu']] as const).map(([v,l])=><Pressable key={v} style={[S.pill,{backgroundColor:filter===v?C.purple:C.panel2}]} onPress={()=>setFilter(v)}><Text style={{color:filter===v?C.bg:C.muted,fontWeight:'800',fontSize:12}}>{l}</Text></Pressable>)}
    </View>
    <Text style={[S.h2,{marginBottom:15}]}>Danh sách phim ({filtered.length})</Text>
    {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}
    {filtered.map(m=><Pressable key={m.movieId} accessibilityRole="button" accessibilityLabel={`Chi tiết phim ${m.title}`} onPress={()=>onOpen(m)} style={[S.card,{flexDirection:'row',gap:13,alignItems:'center'}]}>
      <FilmArt movie={m}/>
      <View style={{flex:1,gap:7}}><Text style={{color:C.white,fontWeight:'800',fontSize:15}}>{m.title}</Text>
        <Text style={S.muted}>{m.durationMinutes} phút · {m.ageRating??'—'}</Text>
        <Text style={S.muted} numberOfLines={2}>{m.genres?.map(g=>g.genreName).join(', ')}</Text>
        <Text style={{color:m.status==='NOW_SHOWING'?C.green:C.orange,fontWeight:'800',fontSize:12}}>{m.status==='NOW_SHOWING'?'ĐANG CHIẾU':'SẮP CHIẾU'}</Text>
      </View><Pressable accessibilityRole="button" accessibilityLabel="Yêu thích" onPress={()=>onToggleFav(m.movieId)} style={{padding:6}}><Text style={{fontSize:19,color:C.purple}}>{favorites.includes(m.movieId)?'♥':'♡'}</Text></Pressable>
    </Pressable>)}
    {!loading&&!filtered.length&&<Text style={S.muted}>Không có phim phù hợp.</Text>}
    <Button title="Tải lại danh sách" kind="outline" onPress={()=>void loadList()}/>
  </SimpleScroll>;
  const movie=detail??selectedMovie;
  const upcoming=shows.filter(s=>s.status==='OPEN'&&new Date(s.startTime).getTime()>Date.now()).sort((a,b)=>new Date(a.startTime).getTime()-new Date(b.startTime).getTime());
  return <SimpleScroll>
    {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}
    {movie&&<>
      <View style={{alignItems:'center',marginTop:14}}><FilmArt movie={movie} size={168}/></View>
      <Text style={[S.title,{marginTop:20}]}>{movie.title}</Text>
      {!!movie.originalTitle&&<Text style={[S.muted,{fontSize:15,marginTop:8}]}>{movie.originalTitle}</Text>}
      <Text style={[S.muted,{marginTop:12}]}>{movie.durationMinutes} phút · {movie.ageRating} · {movie.status==='NOW_SHOWING'?'Đang chiếu':'Sắp chiếu'}</Text>
      <Button kind="outline" title={favorites.includes(movie.movieId)?'♥ Đã yêu thích':'♡ Thêm vào yêu thích (trong phiên)'} onPress={()=>onToggleFav(movie.movieId)}/>
      <Text style={[S.h2,{marginTop:22,marginBottom:8}]}>Nội dung phim</Text>
      <Text style={{color:'#D8E0EF',lineHeight:23,fontSize:14}}>{movie.description??'Đang cập nhật nội dung'}</Text>
      <Text style={[S.muted,{marginTop:12}]}>Thể loại: {movie.genres?.map(g=>g.genreName).join(', ')||'Đang cập nhật'}</Text>
      {!!movie.director&&<Text style={[S.muted,{marginTop:6}]}>Đạo diễn: {movie.director}</Text>}
      {!!movie.actors&&<Text style={[S.muted,{marginTop:6}]}>Diễn viên: {movie.actors}</Text>}
      <Text style={[S.h2,{marginTop:27,marginBottom:12}]}>Lịch chiếu sắp tới</Text>
      {!loading&&upcoming.length===0&&<Notice text="Chưa có suất chiếu sắp tới, hoặc suất đã đóng bán."/>}
      {upcoming.map(s=><View style={S.card} key={s.showtimeId}>
        <Text style={[S.h2,{fontSize:17}]}>{s.room?.cinema?.cinemaName||'Rạp CineHunt'}</Text>
        <Text style={{color:C.cyan,fontSize:16,fontWeight:'800',marginTop:10}}>{formatDate(s.startTime)}</Text>
        <Text style={[S.muted,{marginTop:8}]}>Phòng: {s.room?.roomName||'Đang cập nhật'}</Text>
        <Text style={{color:C.green,fontWeight:'800',marginVertical:9}}>Từ {formatMoney(s.basePrice)}</Text>
        <Button title="Xem sơ đồ ghế" onPress={()=>onSeats?.(s)}/>
      </View>)}
      <Text style={[S.h2,{marginTop:20}]}>Đánh giá phim</Text>
      <Text style={[S.muted,{marginTop:7}]}>Chỉ gửi đánh giá nếu tài khoản đủ điều kiện theo Backend.</Text>
      <View style={{flexDirection:'row',gap:7,marginTop:10}}>{[1,2,3,4,5].map(stars=><Pressable key={stars} accessibilityRole="button" onPress={()=>void sendRating(stars)} style={{padding:8,backgroundColor:C.panel2,borderRadius:10}}><Text style={{color:stars<=rating?C.orange:C.white,fontSize:19}}>★</Text></Pressable>)}</View>
      {!!ratingMessage&&<Notice text={ratingMessage} bad={!rating}/>}</>}
  </SimpleScroll>;
}

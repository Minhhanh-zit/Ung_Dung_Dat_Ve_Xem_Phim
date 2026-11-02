import {useCallback,useEffect,useMemo,useState} from 'react';
import {Pressable,ScrollView,Text,TextInput,View,useWindowDimensions} from 'react-native';
import {api,errorMessage,formatDate,formatMoney} from './api';
import {Button,C,FilmArt,GlowPanel,Kicker,Loader,Notice,S,SectionHeading,SimpleScroll} from './ui';
import type {Movie,Showtime} from './types';

type Props={mode:'list'|'detail';selectedMovie?:Movie;token?:string|null;favorites:number[];onToggleFav:(id:number)=>void;onOpen:(m:Movie)=>void;onSeats?:(s:Showtime)=>void;onAuth?:()=>void};
export default function Movies({mode,selectedMovie,token,favorites,onToggleFav,onOpen,onSeats,onAuth}:Props){
  const {width}=useWindowDimensions();
  const posterSize=Math.max(88,Math.min(143,Math.floor((width-40)*.484)-20));
  const [movies,setMovies]=useState<Movie[]>([]);
  const [detail,setDetail]=useState<Movie|null>(null);
  const [shows,setShows]=useState<Showtime[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('ALL');
  const [rating,setRating]=useState(0);
  const [ratingMessage,setRatingMessage]=useState('');
  const loadList=useCallback(async()=>{setLoading(true);setError('');try{
    const r=await api<{items:Movie[];total:number}>('/movies?page=1&limit=50');
    if(!Array.isArray(r.items))throw new Error('Danh sách phim không hợp lệ');setMovies(r.items);
  }catch(e){setError(errorMessage(e))}finally{setLoading(false)}},[]);
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
  const featured=movies.find(m=>m.status==='NOW_SHOWING')??movies[0];
  async function sendRating(stars:number){
    if(!selectedMovie||!token){onAuth?.();return;}
    try{await api(`/movies/${selectedMovie.movieId}/rating`,{token,method:'PUT',body:{stars}});setRating(stars);setRatingMessage('Đã gửi đánh giá của bạn.');}
    catch(e){setRatingMessage(errorMessage(e))}
  }
  if(mode==='list')return <SimpleScroll refreshing={loading&&movies.length>0} onRefresh={()=>void loadList()}>
    <View style={{marginTop:7,marginBottom:16}}><Kicker>NOW SHOWING · CINEHUNT</Kicker><Text style={[S.title,{fontSize:32,marginTop:9}]}>Thế giới điện ảnh<Text style={{color:C.purple}}>.</Text></Text><Text style={[S.muted,{marginTop:7}]}>Những câu chuyện đáng xem, ngay trong tầm tay.</Text></View>
    {featured&&<GlowPanel from="#513577" to="#0D2341" style={{marginBottom:22}}>
      <Pressable onPress={()=>onOpen(featured)} accessibilityRole="button" accessibilityLabel={`Khám phá phim ${featured.title}`} style={{flexDirection:'row',alignItems:'center',gap:14}}>
        <View style={{flex:1,justifyContent:'center',gap:10}}>
          <Kicker color="#98EFFF">PHIM NỔI BẬT</Kicker>
          <Text numberOfLines={3} style={{fontSize:24,fontWeight:'900',letterSpacing:-.8,color:C.white,lineHeight:29}}>{featured.title}</Text>
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:9,paddingBottom:3}}>
      {([['ALL','Tất cả'],['NOW_SHOWING','Đang chiếu'],['COMING_SOON','Sắp chiếu']] as const).map(([value,label])=><Pressable key={value} onPress={()=>setFilter(value)} style={{borderRadius:15,paddingVertical:11,paddingHorizontal:17,backgroundColor:filter===value?C.purple:C.panel2,borderWidth:1,borderColor:filter===value?C.purple:C.stroke}}><Text style={{color:filter===value?C.bg:C.muted,fontWeight:'800',fontSize:12}}>{label}</Text></Pressable>)}
    </ScrollView>
    <SectionHeading title="Phim dành cho bạn" subtitle={error?'Không thể tải danh sách, hãy thử lại':`${filtered.length} bộ phim trong danh sách`}/>
    {loading&&<Loader/>}{!!error&&<Notice bad text={error}/>}
    <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:17}}>
      {filtered.map(m=><View key={m.movieId} style={{width:'48.4%'}}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Xem phim ${m.title}`} onPress={()=>onOpen(m)} style={{borderRadius:19,backgroundColor:C.panel,borderWidth:1,borderColor:C.stroke,overflow:'hidden',paddingBottom:14}}>
          <View style={{alignItems:'center',paddingTop:8}}><FilmArt movie={m} size={posterSize} radius={14}/></View>
          <View style={{paddingHorizontal:12,paddingTop:11}}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Kicker color={m.status==='NOW_SHOWING'?C.green:C.orange}>{m.status==='NOW_SHOWING'?'ĐANG CHIẾU':'SẮP CHIẾU'}</Kicker><Text style={{color:C.soft,fontSize:11}}>{m.ageRating??'P'}</Text></View>
            <Text numberOfLines={2} style={{fontSize:14.5,fontWeight:'900',color:C.white,marginTop:7,minHeight:40,lineHeight:20}}>{m.title}</Text>
            <Text style={{fontSize:11.5,color:C.muted,marginTop:4}}>{m.durationMinutes} phút · {m.genres?.[0]?.genreName??'Phim'}</Text>
          </View>
        </Pressable>
        <Pressable accessibilityLabel="Yêu thích" accessibilityRole="button" onPress={()=>onToggleFav(m.movieId)} style={{position:'absolute',top:13,right:13,backgroundColor:'#0B0D20CF',borderRadius:15,width:30,height:30,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#FFFFFF35'}}><Text style={{fontSize:19,color:favorites.includes(m.movieId)?C.red:C.white}}>{favorites.includes(m.movieId)?'♥':'♡'}</Text></Pressable>
      </View>)}
    </View>
    {!loading&&!error&&!filtered.length&&<Notice text="Không tìm thấy phim phù hợp. Hãy thử từ khóa khác."/>}
    <View style={{marginTop:21}}><Button title="↻  Tải lại danh sách phim" kind="outline" onPress={()=>void loadList()}/></View>
  </SimpleScroll>;
  const movie=detail??selectedMovie;
  const upcoming=shows.filter(s=>s.status==='OPEN'&&new Date(s.startTime).getTime()>Date.now()).sort((a,b)=>new Date(a.startTime).getTime()-new Date(b.startTime).getTime());
  return <SimpleScroll>
    {loading&&<Loader/>}{!!error&&<Notice text={error} bad/>}
    {movie&&<>
      <GlowPanel from="#452B68" to="#10213B" style={{marginTop:5}}>
        <View style={{alignItems:'center'}}><FilmArt movie={movie} size={174} radius={19}/></View>
        <Text style={{fontSize:27,color:C.white,fontWeight:'900',marginTop:19,letterSpacing:-.4,textAlign:'center'}}>{movie.title}</Text>
        {!!movie.originalTitle&&<Text style={[S.muted,{textAlign:'center',marginTop:4}]}>{movie.originalTitle}</Text>}
        <Text style={{color:'#D7D8F1',textAlign:'center',marginTop:13,fontSize:12}}>{movie.durationMinutes} phút  •  {movie.ageRating??'P'}  •  {movie.status==='NOW_SHOWING'?'Đang chiếu':'Sắp chiếu'}</Text>
        <View style={{flexDirection:'row',justifyContent:'center',marginTop:15,gap:17}}>
          <Text style={{color:C.orange,fontWeight:'800'}}>★  {movie.averageRating?Number(movie.averageRating).toFixed(1):'Mới'}</Text>
          <Text style={{color:C.cyan,fontWeight:'800'}}>◈  {movie.genres?.[0]?.genreName??'Điện ảnh'}</Text>
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
      {upcoming.map(s=><View key={s.showtimeId} style={S.card}>
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

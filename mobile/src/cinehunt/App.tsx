import {useEffect,useState} from 'react';
import {Pressable, StatusBar, Text, View} from 'react-native';
import {SafeAreaView,useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Movie, Screen, Showtime, Tab, User} from '../types';
import {ApiError, api, configureSessionRefresh} from '../services/apiClient';
import {refreshNativeAccessToken,subscribeNativeTokenChanges} from '../services/authSession';
import {loadFavorites, loadSession, saveFavorites, saveSession, saveRefreshToken} from '../store/persist';
import {ThemeToggle} from './ui';
import {AppIcon, type IconName} from './icons';
import {ThemeTransitionVeil, useCineHuntTheme} from './theme';
import Movies from './Movies';
import SeatFlow from './SeatFlow';
import BookingView from './BookingView';
import Orders from './Orders';
import Discover from './Discover';
import ChatAssistant from './ChatAssistant'; // CINEHUNT_FLOATING_AI_V1
import Account from './Account';

const TABS: {id:Tab;icon:IconName;label:string}[]=[
  {id:'movies',icon:'movies',label:'Phim'},
  {id:'discover',icon:'discover',label:'Khám phá'},
  {id:'orders',icon:'tickets',label:'Đơn & vé'},
  {id:'account',icon:'account',label:'Tài khoản'},
];
export default function CineHuntApp(){
  const [chatOpen,setChatOpen]=useState(false);
  const [ready,setReady]=useState(false);
  const {C,S,isDark}=useCineHuntTheme();
  const insets=useSafeAreaInsets();
  const [tab,setTab]=useState<Tab>('movies');
  const [screen,setScreen]=useState<Screen>('main');
  const [token,setToken]=useState<string|null>(null);
  const [user,setUser]=useState<User|null>(null);
  const [movie,setMovie]=useState<Movie|null>(null);
  const [showtime,setShowtime]=useState<Showtime|null>(null);
  const [bookingId,setBookingId]=useState<string|null>(null);
  const [favorites,setFavorites]=useState<number[]>([]);
  const [returnScreen,setReturnScreen]=useState<Screen>('main');
  const [ordersRevision,setOrdersRevision]=useState(0);
  const [seatOrigin,setSeatOrigin]=useState<'detail'|'discover'>('detail');
  useEffect(()=>{
    const unsubscribe=subscribeNativeTokenChanges(next=>{
      setToken(next);
      if(next===null){setUser(null);setScreen('main');setTab('account');}
    });
    configureSessionRefresh(refreshNativeAccessToken);
    return ()=>{configureSessionRefresh(null);unsubscribe()};
  },[]);
  // Khôi phục yêu thích và phiên đăng nhập đã lưu khi mở app (theme do ThemeProvider khôi phục).
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      const [favs,session]=await Promise.all([loadFavorites(),loadSession()]);
      if(cancelled)return;
      setFavorites(favs);
      if(session){
        try{
          const me=await api<User>('/users/me',{token:session.token});
          if(!cancelled){
            const freshSession=await loadSession();
            setToken(freshSession?.token??session.token);setUser(me);
          }
        }catch(e){
          // Token hết hạn thì xóa; lỗi mạng thì giữ phiên để thử lại sau.
          if(e instanceof ApiError&&e.status===401)await saveSession(null);
          else if(!cancelled){setToken(session.token);setUser(session.user);}
        }
      }
      if(!cancelled)setReady(true);
    })();
    return()=>{cancelled=true};
  },[]);
  useEffect(()=>{if(ready)void saveSession(token&&user?{token,user}:null)},[ready,token,user]);
  useEffect(()=>{if(ready)void saveFavorites(favorites)},[ready,favorites]);
  function requestAuth(back:Screen){setReturnScreen(back);setScreen('auth')}
  function setLogin(nextToken:string,nextUser:User){setToken(nextToken);setUser(nextUser);setScreen(returnScreen)}
  function logout(){void saveRefreshToken(null);setToken(null);setUser(null);setScreen('main');setTab('account')}
  function selectTab(next:Tab){setTab(next);setScreen('main')}
  function openBooking(ref:string){setBookingId(ref);setScreen('booking');setOrdersRevision(n=>n+1)}
  function showSeats(item:Showtime){setSeatOrigin(screen==='main'&&tab==='discover'?'discover':'detail');setShowtime(item);setScreen(token?'seats':'auth');if(!token)setReturnScreen('seats')}
  const isHome=screen==='main';
  const toggleFav=(id:number)=>setFavorites(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
  function goBack(){
    if(screen==='seats')setScreen(seatOrigin==='discover'?'main':'detail');
    else if(screen==='booking')setScreen('main');
    else if(screen==='tickets')setScreen('booking');
    else if(screen==='auth')setScreen(returnScreen==='auth'?'main':returnScreen);
    else setScreen('main');
  }
  if(!ready)return <View style={{flex:1,backgroundColor:C.bg}}/>;
  return <SafeAreaView style={S.screen} edges={isHome?['top','left','right']:['top','left','right','bottom']}>
    <StatusBar barStyle={isDark?'light-content':'dark-content'}/>
    <View style={{height:65,paddingHorizontal:21,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:C.line}}>
      <Pressable accessibilityRole="button" onPress={()=>selectTab('movies')} style={{flexDirection:'row',alignItems:'center',gap:9}}>
        <View style={{width:30,height:30,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:C.logoBg,borderWidth:1,borderColor:C.logoLine}}><AppIcon name="assistant" size={17} color={C.brand}/></View>
        <View><Text style={{fontSize:19,color:C.brand,fontWeight:'900',letterSpacing:1.1}}>CINEHUNT</Text><Text style={{color:C.soft,fontSize:8,letterSpacing:3.2,fontWeight:'800'}}>CINEMA EXPERIENCE</Text></View>
      </Pressable>
      <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
      <ThemeToggle/>
      {isHome?<Pressable accessibilityRole="button" accessibilityLabel="Mở tài khoản" onPress={()=>selectTab('account')} style={{width:39,height:39,borderRadius:20,backgroundColor:C.avatarBg,borderWidth:1,borderColor:C.avatarLine,alignItems:'center',justifyContent:'center'}}><AppIcon name={token?'account':'user'} size={21} color={C.purple}/></Pressable>
      :<Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={goBack} hitSlop={6} style={{minHeight:44,flexDirection:'row',alignItems:'center',gap:6,borderWidth:1,borderColor:C.stroke,backgroundColor:C.panel,borderRadius:16,paddingVertical:10,paddingHorizontal:13}}><AppIcon name="back" size={16} color={C.white}/><Text style={{color:C.white,fontWeight:'700',fontSize:12}}>Quay lại</Text></Pressable>}
      </View>
    </View>
    <View style={{flex:1}}>
      {screen==='main'&&tab==='movies'&&<Movies mode="list" favorites={favorites} onToggleFav={toggleFav} onOpen={m=>{setMovie(m);setScreen('detail')}}/>}
      {screen==='main'&&tab==='discover'&&<Discover token={token} favorites={favorites} onOpen={m=>{setMovie(m);setScreen('detail')}} onAuth={()=>requestAuth('main')} onSeats={showSeats}/>}
      {screen==='main'&&tab==='orders'&&<Orders token={token} revision={ordersRevision} onOpen={openBooking} onAuth={()=>requestAuth('main')}/>}
      {screen==='main'&&tab==='account'&&<Account token={token} user={user} onLogin={(t,u)=>{setToken(t);setUser(u)}} onLogout={logout}/>}
      {screen==='detail'&&movie&&<Movies mode="detail" selectedMovie={movie} token={token} favorites={favorites} onToggleFav={toggleFav} onOpen={()=>{}} onSeats={showSeats} onAuth={()=>requestAuth('detail')}/>}
      {screen==='seats'&&showtime&&<SeatFlow token={token} user={user} showtime={showtime} onAuth={()=>requestAuth('seats')} onBooking={openBooking} onBack={goBack}/>}
      {screen==='booking'&&bookingId&&<BookingView bookingId={bookingId} token={token} onAuth={()=>requestAuth('booking')} onCancelled={()=>{setOrdersRevision(v=>v+1);setScreen('main');setTab('orders')}} onTickets={()=>setScreen('tickets')}/>}
      {screen==='tickets'&&bookingId&&<BookingView bookingId={bookingId} token={token} ticketsOnly onAuth={()=>requestAuth('tickets')} onCancelled={()=>{setScreen('main');setTab('orders')}} onTickets={()=>{}}/>}
      {screen==='auth'&&<Account forceAuth token={token} user={user} onLogin={setLogin} onLogout={logout}/>}
      {isHome&&<Pressable accessibilityRole="button" accessibilityLabel="Mở CineHunt AI" onPress={()=>setChatOpen(true)}
        style={{position:'absolute',right:17,bottom:16,zIndex:30,width:56,height:56,borderRadius:28,
          backgroundColor:C.purple,borderWidth:2,borderColor:C.lavender,alignItems:'center',justifyContent:'center',
          shadowColor:'#000',shadowOpacity:.35,shadowOffset:{width:0,height:5},shadowRadius:12,elevation:9}}>
        <AppIcon name="assistant" size={27} color={C.bg} strokeWidth={2.3}/>
      </Pressable>}
    </View>
    {isHome&&<View style={{flexDirection:'row',backgroundColor:C.tabBg,borderTopWidth:1,borderTopColor:C.tabLine,paddingTop:8,paddingBottom:6+insets.bottom,paddingHorizontal:9}}>
      {TABS.map(item=><Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{selected:tab===item.id}} onPress={()=>selectTab(item.id)} style={{flex:1,alignItems:'center',justifyContent:'center',paddingVertical:7,gap:3}}>
        {tab===item.id&&<View style={{position:'absolute',top:-9,width:33,height:3,borderRadius:5,backgroundColor:C.purple}}/>}
        <AppIcon name={item.icon} size={24} color={tab===item.id?C.purple:C.soft} strokeWidth={tab===item.id?2.4:1.9}/>
        <Text numberOfLines={1} style={{fontSize:10.5,fontWeight:tab===item.id?'900':'600',color:tab===item.id?C.white:C.soft}}>{item.label}</Text>
      </Pressable>)}
    </View>}
    <ChatAssistant key={user?.email??'guest'} visible={chatOpen&&isHome} token={token}
      onClose={()=>setChatOpen(false)} onAuth={()=>{setChatOpen(false);requestAuth('main')}}/>
    <ThemeTransitionVeil/>
  </SafeAreaView>;
}

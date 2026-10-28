import {useState} from 'react';
import {Alert, Pressable, StatusBar, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {Booking, Movie, Screen, Showtime, Tab, User} from './types';
import {C, S} from './ui';
import Movies from './Movies';
import SeatFlow from './SeatFlow';
import BookingView from './BookingView';
import Orders from './Orders';
import Discover from './Discover';
import Account from './Account';

export default function CineHuntApp() {
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
  function requestAuth(back:Screen) {setReturnScreen(back);setScreen('auth');}
  function setLogin(nextToken:string,nextUser:User) {setToken(nextToken);setUser(nextUser);setScreen(returnScreen);}
  function logout() {setToken(null);setUser(null);setScreen('main');setTab('account');}
  function selectTab(next:Tab) {setTab(next);setScreen('main');}
  function openBooking(ref:string) {setBookingId(ref);setScreen('booking');setOrdersRevision(n=>n+1);}
  function showSeats(item:Showtime) {setShowtime(item);setScreen(token?'seats':'auth');if(!token)setReturnScreen('seats');}
  const isHome=screen==='main';
  return <SafeAreaView style={S.screen} edges={['top','left','right','bottom']}>
    <StatusBar barStyle="light-content"/>
    <View style={{paddingHorizontal:18,paddingTop:8,paddingBottom:10,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
      <Pressable onPress={()=>{setScreen('main');setTab('movies')}}><Text style={{fontSize:23,fontWeight:'900',letterSpacing:2,color:C.purple}}>CINEHUNT</Text></Pressable>
      {!isHome && <Pressable accessibilityRole="button" onPress={()=>{
        if(screen==='seats')setScreen('detail');
        else if(screen==='booking')setScreen('main');
        else if(screen==='tickets')setScreen('booking');
        else if(screen==='auth')setScreen(returnScreen==='auth'?'main':returnScreen);
        else setScreen('main');
      }} style={{padding:9,backgroundColor:C.panel2,borderRadius:18}}><Text style={{color:C.white,fontSize:15}}>‹ Quay lại</Text></Pressable>}
    </View>
    <View style={{flex:1}}>
      {screen==='main'&&tab==='movies'&&<Movies mode="list" favorites={favorites} onToggleFav={id=>setFavorites(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])} onOpen={m=>{setMovie(m);setScreen('detail')}}/>}
      {screen==='main'&&tab==='discover'&&<Discover token={token} favorites={favorites} onOpen={m=>{setMovie(m);setScreen('detail')}} onAuth={()=>requestAuth('main')}/>}
      {screen==='main'&&tab==='orders'&&<Orders token={token} revision={ordersRevision} onOpen={openBooking} onAuth={()=>requestAuth('main')}/>}
      {screen==='main'&&tab==='account'&&<Account token={token} user={user} onLogin={(t,u)=>{setToken(t);setUser(u)}} onLogout={logout}/>}
      {screen==='detail'&&movie&&<Movies mode="detail" selectedMovie={movie} token={token} favorites={favorites} onToggleFav={id=>setFavorites(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])} onOpen={()=>{}} onSeats={showSeats} onAuth={()=>requestAuth('detail')}/>}
      {screen==='seats'&&showtime&&<SeatFlow token={token} user={user} showtime={showtime} onAuth={()=>requestAuth('seats')} onBooking={openBooking}/>}
      {screen==='booking'&&bookingId&&<BookingView bookingId={bookingId} token={token} onAuth={()=>requestAuth('booking')} onCancelled={()=>{setOrdersRevision(v=>v+1);setScreen('main');setTab('orders')}} onTickets={()=>setScreen('tickets')}/>}
      {screen==='tickets'&&bookingId&&<BookingView bookingId={bookingId} token={token} ticketsOnly onAuth={()=>requestAuth('tickets')} onCancelled={()=>{setScreen('main');setTab('orders')}} onTickets={()=>{}}/>}
      {screen==='auth'&&<Account forceAuth token={token} user={user} onLogin={setLogin} onLogout={logout}/>}
    </View>
    {isHome&&<View style={{flexDirection:'row',borderTopWidth:1,borderColor:C.stroke,backgroundColor:'#0E1524',paddingTop:8,paddingBottom:7}}>
      {([['movies','🎬','Phim'],['discover','✨','Khám phá'],['orders','🎟️','Đơn & vé'],['account','👤','Tài khoản']] as const).map(([id,emoji,title])=><Pressable accessibilityRole="tab" accessibilityState={{selected:tab===id}} key={id} style={{flex:1,alignItems:'center',gap:4,paddingVertical:5}} onPress={()=>selectTab(id)}><Text style={{fontSize:22}}>{emoji}</Text><Text style={{color:tab===id?C.cyan:C.muted,fontSize:11,fontWeight:'800'}}>{title}</Text></Pressable>)}
    </View>}
  </SafeAreaView>;
}

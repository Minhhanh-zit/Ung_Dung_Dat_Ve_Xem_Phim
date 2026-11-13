import {useState} from 'react';
import {Pressable, StatusBar, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {Movie, Screen, Showtime, Tab, User} from './types';
import {C, S} from './ui';
import Movies from './Movies';
import SeatFlow from './SeatFlow';
import BookingView from './BookingView';
import Orders from './Orders';
import Discover from './Discover';
import Account from './Account';

const TABS: {id:Tab;glyph:string;label:string}[]=[
  {id:'movies',glyph:'◉',label:'Phim'},
  {id:'discover',glyph:'✦',label:'Khám phá'},
  {id:'orders',glyph:'▣',label:'Đơn & vé'},
  {id:'account',glyph:'♙',label:'Tài khoản'},
];
export default function CineHuntApp(){
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
  function requestAuth(back:Screen){setReturnScreen(back);setScreen('auth')}
  function setLogin(nextToken:string,nextUser:User){setToken(nextToken);setUser(nextUser);setScreen(returnScreen)}
  function logout(){setToken(null);setUser(null);setScreen('main');setTab('account')}
  function selectTab(next:Tab){setTab(next);setScreen('main')}
  function openBooking(ref:string){setBookingId(ref);setScreen('booking');setOrdersRevision(n=>n+1)}
  function showSeats(item:Showtime){setShowtime(item);setScreen(token?'seats':'auth');if(!token)setReturnScreen('seats')}
  const isHome=screen==='main';
  const toggleFav=(id:number)=>setFavorites(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
  function goBack(){
    if(screen==='seats')setScreen('detail');
    else if(screen==='booking')setScreen('main');
    else if(screen==='tickets')setScreen('booking');
    else if(screen==='auth')setScreen(returnScreen==='auth'?'main':returnScreen);
    else setScreen('main');
  }
  return <SafeAreaView style={S.screen} edges={['top','left','right','bottom']}>
    <StatusBar barStyle="light-content"/>
    <View style={{height:65,paddingHorizontal:21,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#242B42'}}>
      <Pressable accessibilityRole="button" onPress={()=>selectTab('movies')} style={{flexDirection:'row',alignItems:'center',gap:9}}>
        <View style={{width:30,height:30,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#3B2C67',borderWidth:1,borderColor:'#7763B3'}}><Text style={{color:C.lavender,fontWeight:'900',fontSize:15}}>✦</Text></View>
        <View><Text style={{fontSize:19,color:C.lavender,fontWeight:'900',letterSpacing:1.1}}>CINEHUNT</Text><Text style={{color:C.soft,fontSize:8,letterSpacing:3.2,fontWeight:'800'}}>CINEMA EXPERIENCE</Text></View>
      </Pressable>
      {isHome?<Pressable accessibilityRole="button" accessibilityLabel="Mở tài khoản" onPress={()=>selectTab('account')} style={{width:39,height:39,borderRadius:20,backgroundColor:'#25203B',borderWidth:1,borderColor:'#574D7F',alignItems:'center',justifyContent:'center'}}><Text style={{color:C.purple,fontSize:18}}>{token?'♙':'○'}</Text></Pressable>
      :<Pressable accessibilityRole="button" onPress={goBack} style={{borderWidth:1,borderColor:C.stroke,backgroundColor:C.panel,borderRadius:16,paddingVertical:10,paddingHorizontal:13}}><Text style={{color:C.white,fontWeight:'700',fontSize:12}}>‹  Quay lại</Text></Pressable>}
    </View>
    <View style={{flex:1}}>
      {screen==='main'&&tab==='movies'&&<Movies mode="list" favorites={favorites} onToggleFav={toggleFav} onOpen={m=>{setMovie(m);setScreen('detail')}}/>}
      {screen==='main'&&tab==='discover'&&<Discover token={token} favorites={favorites} onOpen={m=>{setMovie(m);setScreen('detail')}} onAuth={()=>requestAuth('main')}/>}
      {screen==='main'&&tab==='orders'&&<Orders token={token} revision={ordersRevision} onOpen={openBooking} onAuth={()=>requestAuth('main')}/>}
      {screen==='main'&&tab==='account'&&<Account token={token} user={user} onLogin={(t,u)=>{setToken(t);setUser(u)}} onLogout={logout}/>}
      {screen==='detail'&&movie&&<Movies mode="detail" selectedMovie={movie} token={token} favorites={favorites} onToggleFav={toggleFav} onOpen={()=>{}} onSeats={showSeats} onAuth={()=>requestAuth('detail')}/>}
      {screen==='seats'&&showtime&&<SeatFlow token={token} user={user} showtime={showtime} onAuth={()=>requestAuth('seats')} onBooking={openBooking}/>}
      {screen==='booking'&&bookingId&&<BookingView bookingId={bookingId} token={token} onAuth={()=>requestAuth('booking')} onCancelled={()=>{setOrdersRevision(v=>v+1);setScreen('main');setTab('orders')}} onTickets={()=>setScreen('tickets')}/>}
      {screen==='tickets'&&bookingId&&<BookingView bookingId={bookingId} token={token} ticketsOnly onAuth={()=>requestAuth('tickets')} onCancelled={()=>{setScreen('main');setTab('orders')}} onTickets={()=>{}}/>}
      {screen==='auth'&&<Account forceAuth token={token} user={user} onLogin={setLogin} onLogout={logout}/>}
    </View>
    {isHome&&<View style={{flexDirection:'row',backgroundColor:'#0E1324',borderTopWidth:1,borderTopColor:'#38405C',paddingTop:8,paddingBottom:6,paddingHorizontal:9}}>
      {TABS.map(item=><Pressable key={item.id} accessibilityRole="tab" accessibilityState={{selected:tab===item.id}} onPress={()=>selectTab(item.id)} style={{flex:1,alignItems:'center',justifyContent:'center',paddingVertical:7,gap:3}}>
        {tab===item.id&&<View style={{position:'absolute',top:-9,width:33,height:3,borderRadius:5,backgroundColor:C.purple}}/>}
        <Text style={{fontSize:23,color:tab===item.id?C.purple:C.soft,fontWeight:'700'}}>{item.glyph}</Text>
        <Text numberOfLines={1} style={{fontSize:10.5,fontWeight:tab===item.id?'900':'600',color:tab===item.id?C.white:C.soft}}>{item.label}</Text>
      </Pressable>)}
    </View>}
  </SafeAreaView>;
}

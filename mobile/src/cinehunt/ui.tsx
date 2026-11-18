import {useState, type ReactNode} from 'react';
import {ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle} from 'react-native';
import type {Movie} from '../types';

export type ThemeMode='light'|'dark';
const DARK={
  bg:'#080B16', bgSoft:'#0E1324', panel:'#141A30', panel2:'#1C2540',
  stroke:'#303957', purple:'#C2A5FF', violet:'#9267F5',
  cyan:'#59D7FF', green:'#45DBB1', white:'#FAFAFF', muted:'#A4AEC9',
  soft:'#7785A6', orange:'#FFD087', red:'#FF879F',
  brand:'#E4C8FF', line:'#242B42', tabBg:'#0E1324', tabLine:'#38405C',
  logoBg:'#3B2C67', logoLine:'#7763B3', avatarBg:'#25203B', avatarLine:'#574D7F',
  outlineBg:'#0A1830', outlineLine:'#467EB1', dangerBg:'#3A1F32', dangerLine:'#9C4862',
  okBg:'#163635', okLine:'#24564E', okText:'#9EF0DB', badBg:'#3A2235', badLine:'#764154', badText:'#FFBDC9',
  chipBg:'#202D4C', chipLine:'#3C658A', iconA:'#302544', iconB:'#1E3650', iconC:'#322947',
  assistBg:'#202746', assistLine:'#595B93',
  seatFree:'#294D52', seatBlocked:'#3A3B50', seatOff:'#464760', cancelBar:'#774662',
  glow:'#C2A5FF',
};
const LIGHT:typeof DARK={
  bg:'#FBF5E8', bgSoft:'#F5ECD8', panel:'#FFFDF8', panel2:'#F5ECD8',
  stroke:'#E2D5BA', purple:'#6C3FD1', violet:'#5226B5',
  cyan:'#1F5FE0', green:'#0F7A4F', white:'#2B2236', muted:'#5F5370',
  soft:'#85789A', orange:'#A8620A', red:'#B42318',
  brand:'#5226B5', line:'#E8DBC0', tabBg:'#FFFCF5', tabLine:'#E2D5BA',
  logoBg:'#E7DDFB', logoLine:'#B9A2F0', avatarBg:'#E7DDFB', avatarLine:'#B9A2F0',
  outlineBg:'#EEF3FF', outlineLine:'#7B97F5', dangerBg:'#FBE4E0', dangerLine:'#E0968D',
  okBg:'#E3F5EB', okLine:'#9BD3B5', okText:'#0B5C3B', badBg:'#FBE4E0', badLine:'#E0968D', badText:'#8A1C12',
  chipBg:'#E4ECFF', chipLine:'#9DB5F5', iconA:'#EBE1FC', iconB:'#DDE8FF', iconC:'#EBE1FC',
  assistBg:'#EFE8FD', assistLine:'#C9B8F3',
  seatFree:'#BFE3D0', seatBlocked:'#D9CFB8', seatOff:'#C9BEA5', cancelBar:'#D9877A',
  glow:'#6C3FD1',
};
// Màu dùng bên trong thẻ gradient tím–xanh: luôn sáng ở cả hai chế độ.
const FIXED={lavender:'#E4C8FF', hero:'#FAFAFF', heroCyan:'#59D7FF', heroGreen:'#45DBB1'};
export const C:typeof DARK&typeof FIXED={...LIGHT,...FIXED};
function makeStyles(){
  return StyleSheet.create({
    screen:{flex:1,backgroundColor:C.bg},
    scroll:{paddingHorizontal:20,paddingTop:12,paddingBottom:48},
    title:{color:C.white,fontSize:30,fontWeight:'900',letterSpacing:-.8},
    h2:{color:C.white,fontSize:21,fontWeight:'800',letterSpacing:-.35},
    text:{color:C.white,fontSize:15},
    muted:{color:C.muted,fontSize:13.5,lineHeight:21},
    card:{backgroundColor:C.panel,borderRadius:23,padding:18,borderWidth:1,borderColor:C.stroke,marginBottom:14},
    input:{backgroundColor:C.panel2,color:C.white,borderColor:C.stroke,borderWidth:1,borderRadius:17,paddingHorizontal:17,paddingVertical:15,fontSize:15,marginTop:9},
    pill:{paddingHorizontal:15,paddingVertical:11,borderRadius:14,backgroundColor:C.panel2},
    row:{flexDirection:'row',alignItems:'center',gap:10},
  });
}
export const S=makeStyles();
// Đổi bảng màu tại chỗ; App gọi khi render nên mọi màn hình đọc màu mới.
export function applyTheme(mode:ThemeMode){
  Object.assign(C,mode==='dark'?DARK:LIGHT,FIXED);
  Object.assign(S,makeStyles());
}

export function GradientFill({from=C.violet,to='#12304B',accent=C.purple}: {from?:string;to?:string;accent?:string}){
  // Decoration is strictly absolute-positioned. It cannot change the height of
  // GlowPanel, and avoids the percentage-size SVG issue on iOS/Expo Go.
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <View style={[StyleSheet.absoluteFill,{backgroundColor:to}]}/>
    <View style={{position:'absolute',width:260,height:260,borderRadius:130,top:-145,left:-100,backgroundColor:from,opacity:0.65}}/>
    <View style={{position:'absolute',width:195,height:195,borderRadius:100,top:-125,right:-80,backgroundColor:accent,opacity:0.12}}/>
    <View style={{position:'absolute',width:170,height:170,borderRadius:85,bottom:-125,left:-65,backgroundColor:'#59D7FF',opacity:0.10}}/>
    <View style={{position:'absolute',top:0,right:0,bottom:0,width:2,backgroundColor:accent,opacity:0.24}}/>
  </View>;
}
export function GlowPanel({children,style,from,to,accent}: {children:ReactNode;style?:ViewStyle;from?:string;to?:string;accent?:string}){
  return <View style={[{borderRadius:26,overflow:'hidden',backgroundColor:C.panel,borderColor:'#69609166',borderWidth:1},style]}>
    <GradientFill from={from} to={to} accent={accent}/>
    <View style={{padding:20}}>{children}</View>
  </View>;
}
export function Kicker({children,color=C.cyan}: {children:ReactNode;color?:string}){
  return <Text style={{color,fontWeight:'800',letterSpacing:2.2,fontSize:10.5,textTransform:'uppercase'}}>{children}</Text>;
}
export function SectionHeading({title,subtitle,right}: {title:string;subtitle?:string;right?:ReactNode}){
  return <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:25,marginBottom:15,gap:9}}>
    <View style={{flex:1}}><Text style={S.h2}>{title}</Text>{subtitle?<Text style={[S.muted,{marginTop:4}]}>{subtitle}</Text>:null}</View>{right}
  </View>;
}
export function Button({title,onPress,kind='primary',disabled=false}: {title:string;onPress:()=>void;kind?:'primary'|'outline'|'danger'|'muted';disabled?:boolean}){
  const style=kind==='primary'?{backgroundColor:C.purple,borderColor:C.purple,shadowColor:C.glow,shadowOpacity:.45,shadowRadius:12,shadowOffset:{width:0,height:4},elevation:4}:
    kind==='outline'?{backgroundColor:C.outlineBg,borderColor:C.outlineLine}:
    kind==='danger'?{backgroundColor:C.dangerBg,borderColor:C.dangerLine}:
    {backgroundColor:C.panel2,borderColor:C.stroke};
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[{minHeight:49,paddingHorizontal:16,paddingVertical:13,borderRadius:15,borderWidth:1,justifyContent:'center',alignItems:'center',opacity:disabled?.42:1,marginVertical:5},style]}>
    <Text style={{fontSize:14,fontWeight:'900',letterSpacing:.15,color:kind==='primary'?C.bg:kind==='danger'?C.red:kind==='outline'?C.cyan:C.white,textAlign:'center'}}>{title}</Text>
  </Pressable>;
}
export function Label({children}:{children:ReactNode}) {return <Text style={[S.muted,{fontWeight:'700',marginTop:8}]}>{children}</Text>}
export function Field({label,value,onChangeText,placeholder,secure=false,keyboardType='default'}: {label:string;value:string;onChangeText:(value:string)=>void;placeholder?:string;secure?:boolean;keyboardType?:'default'|'email-address'|'phone-pad'}) {
  return <View style={{marginBottom:13}}><Label>{label}</Label><TextInput style={S.input} value={value} onChangeText={onChangeText} placeholder={placeholder??label} placeholderTextColor={C.soft} secureTextEntry={secure} autoCorrect={false} autoCapitalize={keyboardType==='email-address'?'none':'sentences'} keyboardType={keyboardType}/></View>;
}
export function Notice({text,bad=false}:{text:string;bad?:boolean}){
  return <View style={{backgroundColor:bad?C.badBg:C.okBg,borderWidth:1,borderColor:bad?C.badLine:C.okLine,padding:15,borderRadius:17,marginVertical:10}}><Text style={{color:bad?C.badText:C.okText,lineHeight:22,fontSize:13.5}}>{text}</Text></View>;
}
export function Loader(){return <ActivityIndicator size="large" color={C.purple} style={{marginVertical:32}}/>}

export function posterUri(url?:string|null){
  const value=(url??'').trim();
  if(!value||value.includes('example.com'))return null;
  if(/^https?:\/\//i.test(value))return value;
  const base=(process.env.EXPO_PUBLIC_API_URL??'').trim().replace(/\/+$/,'');
  if(base&&value.startsWith('/')&&!value.startsWith('//'))return `${base}${value}`;
  return null;
}
export function FilmArt({movie,size=85,radius=15}: {movie:Movie;size?:number;radius?:number}) {
  const [failed,setFailed]=useState(false);
  const src=posterUri(movie.posterUrl);
  const seed=movie.movieId%5;
  const palettes:[string,string,string][]=[
    ['#48255E','#101C4E','#FFB98A'],['#0B5A73','#122851','#73E6E0'],
    ['#54264D','#120F37','#FDA3C7'],['#665039','#0F2745','#FFD6A1'],
    ['#202C69','#5E2B70','#C4B2FF']
  ];
  const [from,to,accent]=palettes[seed];
  return <View style={{width:size,height:size*1.46,borderRadius:radius,overflow:'hidden',backgroundColor:to,borderWidth:1,borderColor:'#FFFFFF24'}}>
    <GradientFill from={from} to={to} accent={accent}/>
    <View style={{position:'absolute',right:-size*.25,top:size*.05,width:size*.8,height:size*.8,borderRadius:size*.5,borderWidth:size*.11,borderColor:'#FFFFFF12'}}/>
    {src&&!failed?<Image source={{uri:src}} onError={()=>setFailed(true)} resizeMode="cover" style={StyleSheet.absoluteFill}/>:<>
      <View style={{position:'absolute',left:10,right:9,top:size*.15,alignItems:'center'}}><Text style={{color:'#FFFFFF73',fontSize:size*.30,fontWeight:'300'}}>✦</Text></View>
      <View style={{position:'absolute',left:9,right:9,bottom:10}}><Text style={{color:'#FFFFFFAA',fontSize:8,fontWeight:'800',letterSpacing:2,marginBottom:4}}>CINEHUNT</Text><Text numberOfLines={3} style={{color:'white',fontSize:Math.max(11,size*.12),fontWeight:'900',lineHeight:Math.max(14,size*.135),textShadowColor:'#00000080',textShadowRadius:5}}>{movie.title.toUpperCase()}</Text></View>
    </>}
  </View>;
}
export function SimpleScroll({children,refreshing=false,onRefresh}: {children:ReactNode;refreshing?:boolean;onRefresh?:()=>void}){
  return <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={S.scroll} refreshControl={onRefresh?<RefreshControl tintColor={C.purple} refreshing={refreshing} onRefresh={onRefresh}/>:undefined}>{children}</ScrollView>;
}
export function StatusPill({status}: {status:string}){
  const presets:Record<string,[string,string,string]>={
    PENDING_PAYMENT:['Chờ thanh toán','#FFDBA0','#59432C'],PENDING:['Đang chờ','#FFDBA0','#59432C'],
    PAID:['Đã thanh toán','#88F0C5','#205144'],CONFIRMED:['Đã xác nhận','#88F0C5','#205144'],
    CANCELLED:['Đã hủy','#FFB2C2','#4A293B'],EXPIRED:['Hết hạn','#FFB2C2','#4A293B'],
    ISSUED:['Đã phát hành','#88F0C5','#205144'],USED:['Đã sử dụng','#B5BFE1','#2C3554'],
  };
  const [name,color,bg]=presets[status]??[status,C.muted,C.panel2];
  return <View style={{backgroundColor:bg,borderRadius:30,paddingHorizontal:12,paddingVertical:6,alignSelf:'flex-start'}}><Text style={{color,fontSize:11,fontWeight:'800'}}>{name}</Text></View>;
}

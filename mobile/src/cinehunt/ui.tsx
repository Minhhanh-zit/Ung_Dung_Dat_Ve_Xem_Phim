import {useState, type ReactNode} from 'react';
import {ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle} from 'react-native';
import type {Movie} from './types';

export const C = {
  bg:'#080B16', bgSoft:'#0E1324', panel:'#141A30', panel2:'#1C2540',
  stroke:'#303957', purple:'#C2A5FF', lavender:'#E4C8FF', violet:'#9267F5',
  cyan:'#59D7FF', green:'#45DBB1', white:'#FAFAFF', muted:'#A4AEC9',
  soft:'#7785A6', orange:'#FFD087', red:'#FF879F',
};
export const S=StyleSheet.create({
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
  const style=kind==='primary'?{backgroundColor:C.purple,borderColor:C.purple}:
    kind==='outline'?{backgroundColor:'#0A1830',borderColor:'#467EB1'}:
    kind==='danger'?{backgroundColor:'#3A1F32',borderColor:'#9C4862'}:
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
  return <View style={{backgroundColor:bad?'#3A2235':'#163635',borderWidth:1,borderColor:bad?'#764154':'#24564E',padding:15,borderRadius:17,marginVertical:10}}><Text style={{color:bad?'#FFBDC9':'#9EF0DB',lineHeight:22,fontSize:13.5}}>{text}</Text></View>;
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

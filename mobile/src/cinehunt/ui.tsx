import {useState, type ReactNode} from 'react';
import {ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle} from 'react-native';
import Animated, {interpolate, interpolateColor, useAnimatedStyle} from 'react-native-reanimated';
import type {Movie} from '../types';
import {AppIcon, type IconName} from './icons';
import {useCineHuntTheme} from './theme';

export function GradientFill({from,to='#12304B',accent}: {from?:string;to?:string;accent?:string}){
  const {C}=useCineHuntTheme();
  from=from??C.violet; accent=accent??C.purple;
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
  const {C}=useCineHuntTheme();
  return <View style={[{borderRadius:26,overflow:'hidden',backgroundColor:C.panel,borderColor:'#69609166',borderWidth:1},style]}>
    <GradientFill from={from} to={to} accent={accent}/>
    <View style={{padding:20}}>{children}</View>
  </View>;
}
export function Kicker({children,color}: {children:ReactNode;color?:string}){
  const {C}=useCineHuntTheme();
  color=color??C.cyan;
  return <Text style={{color,fontWeight:'800',letterSpacing:2.2,fontSize:10.5,textTransform:'uppercase'}}>{children}</Text>;
}
export function SectionHeading({title,subtitle,right}: {title:string;subtitle?:string;right?:ReactNode}){
  const {S}=useCineHuntTheme();
  return <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:25,marginBottom:15,gap:9}}>
    <View style={{flex:1}}><Text style={S.h2}>{title}</Text>{subtitle?<Text style={[S.muted,{marginTop:4}]}>{subtitle}</Text>:null}</View>{right}
  </View>;
}
export function Button({title,onPress,kind='primary',disabled=false,icon,iconRight,iconFilled=false,accessibilityLabel}: {title:string;onPress:()=>void;kind?:'primary'|'outline'|'danger'|'muted';disabled?:boolean;icon?:IconName;iconRight?:IconName;iconFilled?:boolean;accessibilityLabel?:string}){
  const {C}=useCineHuntTheme();
  const style=kind==='primary'?{backgroundColor:C.purple,borderColor:C.purple,shadowColor:C.glow,shadowOpacity:.45,shadowRadius:12,shadowOffset:{width:0,height:4},elevation:4}:
    kind==='outline'?{backgroundColor:C.outlineBg,borderColor:C.outlineLine}:
    kind==='danger'?{backgroundColor:C.dangerBg,borderColor:C.dangerLine}:
    {backgroundColor:C.panel2,borderColor:C.stroke};
  const color=kind==='primary'?C.bg:kind==='danger'?C.red:kind==='outline'?C.cyan:C.white;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel??title} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>[{minHeight:49,paddingHorizontal:16,paddingVertical:13,borderRadius:15,borderWidth:1,justifyContent:'center',alignItems:'center',opacity:disabled?.42:pressed?.85:1,transform:[{scale:pressed&&!disabled?.97:1}],marginVertical:5},style]}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8}}>
      {icon?<AppIcon name={icon} size={18} color={color} filled={iconFilled}/>:null}
      <Text style={{fontSize:14,fontWeight:'900',letterSpacing:.15,color,textAlign:'center',flexShrink:1}}>{title}</Text>
      {iconRight?<AppIcon name={iconRight} size={18} color={color}/>:null}
    </View>
  </Pressable>;
}
export function Label({children}:{children:ReactNode}) {const {S}=useCineHuntTheme();return <Text style={[S.muted,{fontWeight:'700',marginTop:8}]}>{children}</Text>}
export function Field({label,value,onChangeText,placeholder,secure=false,keyboardType='default'}: {label:string;value:string;onChangeText:(value:string)=>void;placeholder?:string;secure?:boolean;keyboardType?:'default'|'email-address'|'phone-pad'}) {
  const {C,S}=useCineHuntTheme();
  const [reveal,setReveal]=useState(false);
  return <View style={{marginBottom:13}}><Label>{label}</Label>
    <View>
      <TextInput style={[S.input,secure?{paddingRight:52}:null]} value={value} onChangeText={onChangeText} placeholder={placeholder??label} placeholderTextColor={C.soft} secureTextEntry={secure&&!reveal} autoCorrect={false} autoCapitalize={keyboardType==='email-address'?'none':'sentences'} keyboardType={keyboardType}/>
      {secure?<Pressable accessibilityRole="button" accessibilityLabel={reveal?'Ẩn mật khẩu':'Hiện mật khẩu'} onPress={()=>setReveal(v=>!v)} style={{position:'absolute',right:4,bottom:3,width:44,height:44,alignItems:'center',justifyContent:'center'}}><AppIcon name={reveal?'eyeOff':'eye'} size={20} color={C.soft}/></Pressable>:null}
    </View>
  </View>;
}
export function Notice({text,bad=false}:{text:string;bad?:boolean}){
  const {C}=useCineHuntTheme();
  const tint=bad?C.badText:C.okText;
  return <View accessibilityRole={bad?'alert':undefined} style={{flexDirection:'row',alignItems:'flex-start',gap:10,backgroundColor:bad?C.badBg:C.okBg,borderWidth:1,borderColor:bad?C.badLine:C.okLine,padding:15,borderRadius:17,marginVertical:10}}>
    <View style={{marginTop:2}}><AppIcon name={bad?'error':'success'} size={18} color={tint}/></View>
    <Text style={{flex:1,color:tint,lineHeight:22,fontSize:13.5}}>{text}</Text>
  </View>;
}
export function Loader(){const {C}=useCineHuntTheme();return <ActivityIndicator size="large" color={C.purple} style={{marginVertical:32}}/>}

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
      <View style={{position:'absolute',left:10,right:9,top:size*.15,alignItems:'center'}}><AppIcon name="assistant" size={size*.3} color="#FFFFFF73" strokeWidth={1.5}/></View>
      <View style={{position:'absolute',left:9,right:9,bottom:10}}><Text style={{color:'#FFFFFFAA',fontSize:8,fontWeight:'800',letterSpacing:2,marginBottom:4}}>CINEHUNT</Text><Text numberOfLines={3} style={{color:'white',fontSize:Math.max(11,size*.12),fontWeight:'900',lineHeight:Math.max(14,size*.135),textShadowColor:'#00000080',textShadowRadius:5}}>{movie.title.toUpperCase()}</Text></View>
    </>}
  </View>;
}
export function SimpleScroll({children,refreshing=false,onRefresh}: {children:ReactNode;refreshing?:boolean;onRefresh?:()=>void}){
  const {C,S}=useCineHuntTheme();
  return <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={S.scroll} refreshControl={onRefresh?<RefreshControl tintColor={C.purple} refreshing={refreshing} onRefresh={onRefresh}/>:undefined}>{children}</ScrollView>;
}
export function StatusPill({status}: {status:string}){
  const {C}=useCineHuntTheme();
  const presets:Record<string,[string,string,string]>={
    PENDING_PAYMENT:['Chờ thanh toán','#FFDBA0','#59432C'],PENDING:['Đang chờ','#FFDBA0','#59432C'],
    PAID:['Đã thanh toán','#88F0C5','#205144'],CONFIRMED:['Đã xác nhận','#88F0C5','#205144'],
    CANCELLED:['Đã hủy','#FFB2C2','#4A293B'],EXPIRED:['Hết hạn','#FFB2C2','#4A293B'],
    ISSUED:['Đã phát hành','#88F0C5','#205144'],USED:['Đã sử dụng','#B5BFE1','#2C3554'],
  };
  const [name,color,bg]=presets[status]??[status,C.muted,C.panel2];
  return <View style={{backgroundColor:bg,borderRadius:30,paddingHorizontal:12,paddingVertical:6,alignSelf:'flex-start'}}><Text style={{color,fontSize:11,fontWeight:'800'}}>{name}</Text></View>;
}

/** Công tắc Sáng/Tối: track đổi màu bằng interpolateColor, thumb trượt theo tiến trình theme. */
export function ThemeToggle() {
  const {C,isDark,toggleTheme,progress}=useCineHuntTheme();
  const TRACK_W=58, TRACK_H=32, THUMB=26;
  const track=useAnimatedStyle(()=>({backgroundColor:interpolateColor(progress.value,[0,1],['#E7DDFB','#3B2C67']),borderColor:interpolateColor(progress.value,[0,1],['#B9A2F0','#7763B3'])}));
  const thumb=useAnimatedStyle(()=>({transform:[{translateX:interpolate(progress.value,[0,1],[0,TRACK_W-THUMB-6])}]}));
  const sunFade=useAnimatedStyle(()=>({opacity:interpolate(progress.value,[0,1],[1,0])}));
  const moonFade=useAnimatedStyle(()=>({opacity:interpolate(progress.value,[0,1],[0,1])}));
  return <Pressable accessibilityRole="switch" accessibilityLabel="Chế độ tối" accessibilityState={{checked:isDark}} onPress={toggleTheme} hitSlop={{top:8,bottom:8,left:6,right:6}} style={{minHeight:44,justifyContent:'center'}}>
    <Animated.View style={[{width:TRACK_W,height:TRACK_H,borderRadius:TRACK_H/2,borderWidth:1,padding:2,justifyContent:'center'},track]}>
      <Animated.View style={[{width:THUMB,height:THUMB,borderRadius:THUMB/2,backgroundColor:C.purple,alignItems:'center',justifyContent:'center'},thumb]}>
        <Animated.View style={[{position:'absolute'},sunFade]}><AppIcon name="sun" size={15} color={C.bg} strokeWidth={2.4}/></Animated.View>
        <Animated.View style={[{position:'absolute'},moonFade]}><AppIcon name="moon" size={15} color={C.bg} strokeWidth={2.4}/></Animated.View>
      </Animated.View>
    </Animated.View>
  </Pressable>;
}

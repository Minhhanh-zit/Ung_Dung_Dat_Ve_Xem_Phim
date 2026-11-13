import type { ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Movie } from './types';

export const C = {bg:'#090E1B',panel:'#171F33',panel2:'#232C44',stroke:'#323C59',purple:'#BDA1FF',cyan:'#57D5FF',green:'#45DEB2',white:'#FCFDFF',muted:'#A6B2C9',orange:'#F3C27A',red:'#FF8999'};
export const S = StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg}, scroll:{padding:18,paddingBottom:120},
  title:{color:C.white,fontSize:27,fontWeight:'900'},h2:{color:C.white,fontSize:20,fontWeight:'800'},
  text:{color:C.white,fontSize:15},muted:{color:C.muted,fontSize:13,lineHeight:21},
  card:{backgroundColor:C.panel,borderRadius:17,padding:16,borderWidth:1,borderColor:C.stroke,marginBottom:12},
  input:{backgroundColor:C.panel2,color:C.white,borderColor:C.stroke,borderWidth:1,borderRadius:12,paddingHorizontal:14,paddingVertical:13,fontSize:15,marginTop:8},
  pill:{paddingHorizontal:13,paddingVertical:10,borderRadius:12,backgroundColor:C.panel2},
  row:{flexDirection:'row',alignItems:'center',gap:10},
});
export function Button({title,onPress,kind='primary',disabled=false}: {title:string;onPress:()=>void;kind?:'primary'|'outline'|'danger'|'muted';disabled?:boolean}) {
  const styles = {
    primary:{backgroundColor:C.purple,borderColor:C.purple},
    outline:{backgroundColor:'transparent',borderColor:C.cyan},
    danger:{backgroundColor:'transparent',borderColor:C.red},
    muted:{backgroundColor:C.panel2,borderColor:C.panel2},
  };
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[{padding:14,borderRadius:12,borderWidth:1,alignItems:'center',justifyContent:'center',opacity:disabled?0.45:1,marginVertical:5},styles[kind]]}>
    <Text style={{fontWeight:'800',fontSize:14,color:kind==='primary'?C.bg:kind==='danger'?C.red:kind==='outline'?C.cyan:C.white}}>{title}</Text>
  </Pressable>;
}
export function Label({children}: {children:ReactNode}) {return <Text style={[S.muted,{marginTop:8}]}>{children}</Text>}
export function Field({label,value,onChangeText,placeholder,secure=false,keyboardType='default'}: {label:string;value:string;onChangeText:(value:string)=>void;placeholder?:string;secure?:boolean;keyboardType?:'default'|'email-address'|'phone-pad'}) {
  return <View style={{marginBottom:9}}><Label>{label}</Label><TextInput style={S.input} value={value} onChangeText={onChangeText} placeholder={placeholder??label} placeholderTextColor="#7E8DAA" secureTextEntry={secure} autoCorrect={false} autoCapitalize={keyboardType==='email-address'?'none':'sentences'} keyboardType={keyboardType}/></View>
}
export function Notice({text,bad=false}: {text:string;bad?:boolean}) {return <View style={{backgroundColor:bad?'#402633':'#183535',padding:13,borderRadius:12,marginVertical:10}}><Text style={{color:bad?'#FFB7C1':'#8DEBD0',lineHeight:21}}>{text}</Text></View>}
export function Loader() {return <ActivityIndicator size="large" color={C.purple} style={{marginVertical:28}}/>}
export function FilmArt({movie,size=85}: {movie:Movie;size?:number}) {
  const [failed,setFailed] = importReactState(false);
  const src = movie.posterUrl;
  const good = !!src && /^(https?:\/\/)/.test(src) && !src.includes('example.com');
  return <View style={{width:size,height:size*1.4,backgroundColor:'#27284B',borderRadius:12,alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
    {good&&!failed?<Image source={{uri:src!}} onError={()=>setFailed(true)} resizeMode="cover" style={{width:'100%',height:'100%'}}/>:<Text style={{fontSize:size*0.33}}>🎬</Text>}
  </View>;
}
import { useState as importReactState } from 'react';
export function SimpleScroll({children,refreshing=false,onRefresh}: {children:ReactNode;refreshing?:boolean;onRefresh?:()=>void}) {
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={S.scroll}>{children}</ScrollView>;
}

// CINEHUNT_FLOATING_AI_V1: Shared assistant for main CineHunt tabs.
import {useRef,useState} from 'react';
import {KeyboardAvoidingView,Linking,Modal,Platform,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import * as Location from 'expo-location';
import type {ScrollViewInstance} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {api,errorMessage} from '../services/apiClient';
import {AppIcon, type IconName} from './icons';
import {ThemeTransitionVeil, useCineHuntTheme} from './theme';

type ChatLink={label:string;url:string};
type ChatHeading={icon:IconName;text:string};
type ChatMessage={role:'user'|'assistant';content:string;heading?:ChatHeading;routeLinks?:ChatLink[]};
type NearbyCinema={cinemaId:number;cinemaName:string;address:string|null;ward:string;distanceKm:number|null;durationMinutes:number|null;mapsUrl:string};
type NearbyResult={method:'DRIVING'|'STRAIGHT_LINE'|'UNRANKED';note:string;cinemas:NearbyCinema[]};
const plain=(s:string)=>s.toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
function asksForNearestCinema(s:string){
  const t=plain(s);
  return /\b(rap|cinema)\b/.test(t)&&/\b(gan|quanh|lan can|nearest)\b/.test(t);
}
function namedOrigin(s:string):string|null{
  const t=plain(s);
  // Known place queries are NOT equivalent to current phone GPS.
  if(t.includes('tan mai'))return 'Khu vực Tân Mai, Hoàng Mai, Hà Nội, Việt Nam';
  if(t.includes('thanh xuan'))return 'Phường Thanh Xuân, Hà Nội, Việt Nam';
  if(t.includes('ha dong'))return 'Phường Hà Đông, Hà Nội, Việt Nam';
  if(t.includes('cau giay'))return 'Phường Cầu Giấy, Hà Nội, Việt Nam';
  return null;
}
type Props={visible:boolean;token:string|null;onClose:()=>void;onAuth:()=>void};

export default function ChatAssistant({visible,token,onClose,onAuth}:Props){
  const {C}=useCineHuntTheme();
  // Component stays mounted when changing main tabs. Parent keys it by account.
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [draft,setDraft]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const sending=useRef(false);
  const scroll=useRef<ScrollViewInstance|null>(null);

  async function deliver(conversation:ChatMessage[]){
    if(sending.current||!token)return;
    sending.current=true;
    setBusy(true);
    setError('');
    try{
      // DTO accepts at most 30 messages and 4000 characters per message.
      const question=conversation.at(-1)?.content??'';
      if(asksForNearestCinema(question)){
        const origin=namedOrigin(question);
        let body: Record<string,unknown>;
        if(origin){
          body={originAddress:origin};
        }else{
          const permission=await Location.requestForegroundPermissionsAsync();
          if(permission.status!=='granted')throw new Error('Cần cho phép vị trí để tìm rạp gần bạn.');
          const gps=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
          body={latitude:gps.coords.latitude,longitude:gps.coords.longitude};
        }
        const result=await api<NearbyResult>('/cinemas/nearest',{
          token,method:'POST',body,timeout:25000,
        });
        const rows=result.cinemas??[];
        const ranked=result.method!=='UNRANKED'&&rows.length>0&&rows.every(c=>c.distanceKm!=null);
        const first=ranked?rows[0]:undefined;
        const describe=(c:NearbyCinema)=>{
          const km=c.distanceKm==null?'':` · ${c.distanceKm.toLocaleString('vi-VN')} km`;
          const duration=c.durationMinutes!=null?` · ${c.durationMinutes} phút`:'';
          return `${c.cinemaName}${km}${duration}`;
        };
        const heading:ChatHeading=ranked&&result.method==='DRIVING'?{icon:'car',text:'Rạp gần nhất theo đường ô tô'}:
          ranked&&result.method==='STRAIGHT_LINE'?{icon:'pin',text:'Rạp gần nhất theo vị trí GPS'}:
          {icon:'pin',text:'Rạp CineHunt'};
        const reply=first?[
          `${describe(first)}${result.method==='STRAIGHT_LINE'?' (đường thẳng, ước tính)':''}.`,
          first.address||first.ward,
          ...(rows.length>1?['Các lựa chọn khác:',...rows.slice(1).map(describe)]:[]),
          result.method==='STRAIGHT_LINE'?'Mở Chỉ đường để xem km đi xe thực tế.':'Khoảng cách và thời gian theo tuyến ô tô có thể thay đổi.',
          ...(!origin?['Kết quả theo vị trí điện thoại hiện tại, không phải địa chỉ nhà đã lưu.']:[]),
        ].join('\n'):rows.length?[
          'Chưa đủ dữ liệu để xác định rạp gần nhất.',...rows.map(describe),result.note,
        ].join('\n'):'Hiện chưa có rạp CineHunt hoạt động trong phạm vi tìm kiếm.';
        setMessages([...conversation,{
          role:'assistant' as const,content:reply,heading,
          routeLinks:rows.map((c)=>({label:`Chỉ đường · ${c.cinemaName}`,url:c.mapsUrl})),
        }].slice(-30));
        return;
      }
      const payload=conversation.slice(-24).map(m=>({role:m.role,content:m.content.slice(0,4000)}));
      const response=await api<{reply:string}>('/chat',{
        token,method:'POST',body:{messages:payload},timeout:30000,
      });
      if(!response||typeof response.reply!=='string'||!response.reply.trim()){
        throw new Error('Trợ lý chưa có phản hồi. Bạn có thể thử lại.');
      }
      setMessages([...conversation,{role:'assistant' as const,content:response.reply}].slice(-30));
    }catch(e){
      setError(`${errorMessage(e)} Bạn có thể gửi lại mà không mất hội thoại.`);
    }finally{
      sending.current=false;
      setBusy(false);
    }
  }

  function send(){
    const content=draft.trim().slice(0,4000);
    if(!token||!content||sending.current)return;
    const next=[...messages,{role:'user' as const,content}].slice(-30);
    setMessages(next);
    setDraft('');
    void deliver(next);
  }
  function retry(){
    if(!token||sending.current||messages.at(-1)?.role!=='user')return;
    void deliver(messages);
  }

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
    <KeyboardAvoidingView style={{flex:1,justifyContent:'flex-end'}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <Pressable accessibilityRole="button" accessibilityLabel="Đóng CineHunt AI" onPress={onClose}
        style={{position:'absolute',left:0,right:0,top:0,bottom:0,backgroundColor:'rgba(5,9,22,.78)'}}/>
      <SafeAreaView edges={['bottom']} style={{height:'82%',maxHeight:820,backgroundColor:C.bg,
        borderTopLeftRadius:25,borderTopRightRadius:25,borderWidth:1,borderColor:C.stroke,overflow:'hidden'}}>
        <View style={{paddingHorizontal:18,paddingTop:17,paddingBottom:13,borderBottomWidth:1,borderBottomColor:C.stroke,
          flexDirection:'row',alignItems:'center',gap:12}}>
          <View style={{width:43,height:43,borderRadius:22,backgroundColor:C.purple,alignItems:'center',justifyContent:'center'}}>
            <AppIcon name="assistant" size={24} color={C.bg} strokeWidth={2.3}/>
          </View>
          <View style={{flex:1}}>
            <Text style={{color:C.white,fontWeight:'900',fontSize:18}}>CineHunt AI</Text>
            <Text style={{color:C.muted,fontSize:11,marginTop:3}}>Gợi ý phim đang chiếu, suất chiếu sớm và rạp</Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Đóng cửa sổ chat"
            style={{width:44,height:44,borderRadius:22,borderWidth:1,borderColor:C.stroke,
              backgroundColor:C.panel,justifyContent:'center',alignItems:'center'}}>
            <AppIcon name="close" size={20} color={C.white}/>
          </Pressable>
        </View>
        <ScrollView ref={scroll} style={{flex:1}} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{padding:15,paddingBottom:20,flexGrow:1}}
          onContentSizeChange={()=>scroll.current?.scrollToEnd({animated:true})}>
          {token&&messages.length===0&&<Pressable accessibilityRole="button" accessibilityLabel="Tìm rạp gần tôi"
            onPress={()=>void deliver([{role:'user',content:'Tìm rạp gần tôi'}])}
            style={{alignSelf:'flex-start',minHeight:44,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,marginBottom:10,borderRadius:11,backgroundColor:C.panel}}>
            <AppIcon name="pin" size={17} color={C.purple}/><Text style={{color:C.purple,fontWeight:'800'}}>Tìm rạp gần tôi</Text>
          </Pressable>}
          {messages.length===0&&<View style={{backgroundColor:C.panel,borderRadius:17,padding:15,borderWidth:1,borderColor:C.stroke}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}><AppIcon name="assistant" size={16} color={C.purple}/><Text style={{color:C.white,fontWeight:'800',fontSize:14}}>Chào bạn, CineHunt AI đây!</Text></View>
            <Text style={{color:C.muted,lineHeight:21,marginTop:8}}>Bạn muốn tìm phim hay, chọn rạp hay hỏi lịch chiếu hôm nay?</Text>
          </View>}
          {messages.map((m,i)=><View key={`${i}-${m.role}`} style={{alignSelf:m.role==='user'?'flex-end':'flex-start',
            maxWidth:'89%',paddingHorizontal:14,paddingVertical:11,borderRadius:17,marginTop:12,
            backgroundColor:m.role==='user'?C.purple:C.panel,borderWidth:1,borderColor:m.role==='user'?C.purple:C.stroke}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:5,marginBottom:6}}>
              {m.role==='assistant'&&<AppIcon name="assistant" size={11} color={C.cyan}/>}
              <Text style={{fontSize:10,fontWeight:'900',color:m.role==='user'?C.bg:C.cyan}}>{m.role==='user'?'BẠN':'CINEHUNT AI'}</Text>
            </View>
            {m.heading&&<View style={{flexDirection:'row',alignItems:'center',gap:7,marginBottom:6}}>
              <AppIcon name={m.heading.icon} size={16} color={C.purple}/>
              <Text style={{flex:1,color:C.white,fontSize:14,lineHeight:21,fontWeight:'700'}}>{m.heading.text}</Text>
            </View>}
            <Text style={{color:m.role==='user'?C.bg:C.white,fontSize:14,lineHeight:21}}>{m.content}</Text>
            {m.routeLinks?.map((link,j)=><Pressable key={j} accessibilityRole="link"
              onPress={()=>{if(link.url.startsWith('https://www.google.com/maps/dir/?api=1'))void Linking.openURL(link.url)}}
              style={{marginTop:10,minHeight:44,flexDirection:'row',alignItems:'center',gap:6,justifyContent:'center',borderRadius:10,backgroundColor:C.bg,paddingHorizontal:10}}>
              <Text style={{fontWeight:'800',color:C.purple,flexShrink:1}}>{link.label}</Text><AppIcon name="external" size={15} color={C.purple}/>
            </Pressable>)}
          </View>)}
          {busy&&<View accessibilityLiveRegion="polite" style={{flexDirection:'row',alignItems:'center',gap:7,marginTop:13}}><AppIcon name="assistant" size={13} color={C.purple}/><Text style={{color:C.purple,fontSize:12}}>Đang trả lời...</Text></View>}
          {!!error&&<View style={{marginTop:12,backgroundColor:C.panel,borderRadius:13,padding:12}}>
            <Text style={{color:C.white,fontSize:12,lineHeight:18}}>{error}</Text>
            {messages.at(-1)?.role==='user'&&<Pressable onPress={retry} disabled={busy} accessibilityRole="button"
              style={{minHeight:44,flexDirection:'row',alignItems:'center',gap:7}}><AppIcon name="refresh" size={16} color={C.cyan}/><Text style={{color:C.cyan,fontWeight:'900'}}>Thử gửi lại</Text></Pressable>}
          </View>}
        </ScrollView>
        <View style={{paddingHorizontal:15,paddingTop:12,paddingBottom:12,borderTopWidth:1,borderTopColor:C.stroke}}>
          {!token?<Pressable accessibilityRole="button" onPress={onAuth} style={{backgroundColor:C.purple,borderRadius:13,padding:15,alignItems:'center'}}>
            <Text style={{color:C.bg,fontWeight:'900'}}>Đăng nhập để trò chuyện</Text>
          </Pressable>:<View style={{flexDirection:'row',alignItems:'center',gap:9}}>
            <TextInput value={draft} onChangeText={setDraft} editable={!busy} maxLength={4000}
              placeholder="Hỏi CineHunt AI..." placeholderTextColor={C.muted} returnKeyType="send"
              onSubmitEditing={send} accessibilityLabel="Nhập tin nhắn cho CineHunt AI"
              style={{flex:1,minHeight:47,maxHeight:110,borderRadius:14,borderWidth:1,
                borderColor:C.stroke,backgroundColor:C.panel,color:C.white,paddingHorizontal:13,fontSize:14}}/>
            <Pressable disabled={busy||!draft.trim()} onPress={send} accessibilityRole="button"
              accessibilityLabel="Gửi tin nhắn" accessibilityState={{disabled:busy||!draft.trim()}}
              style={{height:47,paddingHorizontal:15,borderRadius:14,flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center',
                backgroundColor:busy||!draft.trim()?C.panel:C.purple}}>
              <Text style={{color:busy||!draft.trim()?C.muted:C.bg,fontWeight:'900'}}>Gửi</Text><AppIcon name="send" size={16} color={busy||!draft.trim()?C.muted:C.bg}/>
            </Pressable>
          </View>}
          <Text style={{color:C.muted,fontSize:10,textAlign:'center',marginTop:9}}>
            AI chỉ tư vấn, không tự đặt vé hoặc thanh toán.</Text>
        </View>
        <ThemeTransitionVeil/>
      </SafeAreaView>
    </KeyboardAvoidingView>
  </Modal>;
}

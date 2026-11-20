// CINEHUNT_FLOATING_AI_V1: Shared assistant for main CineHunt tabs.
import {useRef,useState} from 'react';
import {KeyboardAvoidingView,Modal,Platform,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {api,errorMessage} from '../services/apiClient';
import {C} from './ui';

type ChatMessage={role:'user'|'assistant';content:string};
type Props={visible:boolean;token:string|null;onClose:()=>void;onAuth:()=>void};

export default function ChatAssistant({visible,token,onClose,onAuth}:Props){
  // Component stays mounted when changing main tabs. Parent keys it by account.
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [draft,setDraft]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const sending=useRef(false);
  const scroll=useRef<ScrollView|null>(null);

  async function deliver(conversation:ChatMessage[]){
    if(sending.current||!token)return;
    sending.current=true;
    setBusy(true);
    setError('');
    try{
      // DTO accepts at most 30 messages and 4000 characters per message.
      const payload=conversation.slice(-24).map(m=>({role:m.role,content:m.content.slice(0,4000)}));
      const response=await api<{reply:string}>('/chat',{
        token,method:'POST',body:{messages:payload},timeout:30000,
      });
      if(!response||typeof response.reply!=='string'||!response.reply.trim()){
        throw new Error('Trợ lý chưa có phản hồi. Bạn có thể thử lại.');
      }
      setMessages([...conversation,{role:'assistant',content:response.reply}].slice(-30));
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
            <Text style={{fontSize:23,color:C.bg,fontWeight:'900'}}>✦</Text>
          </View>
          <View style={{flex:1}}>
            <Text style={{color:C.white,fontWeight:'900',fontSize:18}}>CineHunt AI</Text>
            <Text style={{color:C.muted,fontSize:11,marginTop:3}}>Gợi ý phim, rạp và thông tin xem phim</Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Đóng cửa sổ chat"
            style={{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:C.stroke,
              backgroundColor:C.panel,justifyContent:'center',alignItems:'center'}}>
            <Text style={{color:C.white,fontSize:20}}>×</Text>
          </Pressable>
        </View>
        <ScrollView ref={scroll} style={{flex:1}} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{padding:15,paddingBottom:20,flexGrow:1}}
          onContentSizeChange={()=>scroll.current?.scrollToEnd({animated:true})}>
          {messages.length===0&&<View style={{backgroundColor:C.panel,borderRadius:17,padding:15,borderWidth:1,borderColor:C.stroke}}>
            <Text style={{color:C.white,fontWeight:'800',fontSize:14}}>✦  Chào bạn, CineHunt AI đây!</Text>
            <Text style={{color:C.muted,lineHeight:21,marginTop:8}}>Bạn muốn tìm phim hay, chọn rạp hay hỏi lịch chiếu hôm nay?</Text>
          </View>}
          {messages.map((m,i)=><View key={`${i}-${m.role}`} style={{alignSelf:m.role==='user'?'flex-end':'flex-start',
            maxWidth:'89%',paddingHorizontal:14,paddingVertical:11,borderRadius:17,marginTop:12,
            backgroundColor:m.role==='user'?C.purple:C.panel,borderWidth:1,borderColor:m.role==='user'?C.purple:C.stroke}}>
            <Text style={{fontSize:10,fontWeight:'900',marginBottom:6,color:m.role==='user'?C.bg:C.cyan}}>
              {m.role==='user'?'BẠN':'✦  CINEHUNT AI'}</Text>
            <Text style={{color:m.role==='user'?C.bg:C.white,fontSize:14,lineHeight:21}}>{m.content}</Text>
          </View>)}
          {busy&&<Text style={{color:C.purple,marginTop:13,fontSize:12}}>✦  Đang trả lời...</Text>}
          {!!error&&<View style={{marginTop:12,backgroundColor:C.panel,borderRadius:13,padding:12}}>
            <Text style={{color:C.white,fontSize:12,lineHeight:18}}>{error}</Text>
            {messages.at(-1)?.role==='user'&&<Pressable onPress={retry} disabled={busy} accessibilityRole="button"
              style={{paddingVertical:10}}><Text style={{color:C.cyan,fontWeight:'900'}}>↻  Thử gửi lại</Text></Pressable>}
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
              style={{height:47,paddingHorizontal:15,borderRadius:14,alignItems:'center',justifyContent:'center',
                backgroundColor:busy||!draft.trim()?C.panel:C.purple}}>
              <Text style={{color:busy||!draft.trim()?C.muted:C.bg,fontWeight:'900'}}>Gửi ➤</Text>
            </Pressable>
          </View>}
          <Text style={{color:C.muted,fontSize:10,textAlign:'center',marginTop:9}}>
            AI chỉ tư vấn, không tự đặt vé hoặc thanh toán.</Text>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  </Modal>;
}

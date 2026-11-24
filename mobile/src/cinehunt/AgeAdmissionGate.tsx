import {useEffect,useState,type ReactNode} from 'react';
import {Modal,Text,View} from 'react-native';
import {api,errorMessage} from '../services/apiClient';
import {Button,Loader,Notice,SimpleScroll} from './ui';
import {useCineHuntTheme} from './theme';

type Admission={showtimeId:number;movieId:number;movieTitle:string;rating:string;action:'ALLOW'|'CONFIRM'|'BLOCK';message:string;confirmLabel:string|null};

export default function AgeAdmissionGate({showtimeId,movieId,onBack,children}:{showtimeId:number;movieId?:number;onBack:()=>void;children:ReactNode}){
  const {C,S}=useCineHuntTheme();
  const [policy,setPolicy]=useState<Admission|null>(null);
  const [accepted,setAccepted]=useState(false);
  const [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;
    void (async()=>{
      try{
        if(!Number.isSafeInteger(showtimeId)||showtimeId<=0)throw new Error('Chưa chọn suất chiếu hợp lệ.');
        const p=await api<Admission>(`/showtimes/${showtimeId}/age-policy`);
        if(p?.showtimeId!==showtimeId||(movieId!=null&&p.movieId!==movieId)||!['ALLOW','CONFIRM','BLOCK'].includes(p.action)||typeof p.message!=='string'||(p.action==='CONFIRM'&&!p.confirmLabel))throw new Error('Không xác minh được phân loại của suất chiếu.');
        if(active)setPolicy(p);
      }catch(e){if(active)setError(errorMessage(e));}
    })();
    return()=>{active=false};
  },[showtimeId,movieId,attempt]);
  if(policy&&(policy.action==='ALLOW'||(policy.action==='CONFIRM'&&accepted)))return <>{children}</>;
  return <SimpleScroll>
    <Text style={S.title}>Xác nhận độ tuổi</Text>
    {!policy&&!error&&<><Loader/><Text style={S.muted}>Đang kiểm tra phân loại phim...</Text></>}
    {!!error&&<View style={{gap:12,marginTop:18}}><Notice text={error}/><Button title="Thử lại" onPress={()=>{setError('');setAttempt(n=>n+1)}}/><Button title="Quay lại" kind="outline" onPress={onBack}/></View>}
    {!!policy&&<Modal visible transparent animationType="fade" onRequestClose={onBack}>
      <View style={{flex:1,justifyContent:'center',padding:24,backgroundColor:'rgba(0,0,0,0.55)'}}>
        <View accessibilityViewIsModal style={{backgroundColor:C.panel,borderColor:C.stroke,borderWidth:1,borderRadius:24,padding:22,gap:14}}>
          <Text style={S.h2}>Xác nhận độ tuổi</Text>
          <View style={{alignSelf:'flex-start',borderRadius:8,backgroundColor:C.purple,paddingHorizontal:10,paddingVertical:5}}><Text style={{color:C.bg,fontWeight:'900'}}>{policy.rating}</Text></View>
          <Text style={{color:C.white,fontSize:18,fontWeight:'800'}}>{policy.movieTitle}</Text>
          <Text style={{color:C.white,fontSize:15,lineHeight:23}}>{policy.message}</Text>
          {policy.action==='CONFIRM'&&<><Text style={S.muted}>Rạp có thể kiểm tra độ tuổi khi vào phòng chiếu.</Text><Button title={policy.confirmLabel??'Xác nhận'} onPress={()=>setAccepted(true)}/></>}
          <Button title={policy.action==='CONFIRM'?'Chưa đủ điều kiện / Quay lại':'Quay lại'} kind="outline" onPress={onBack}/>
        </View>
      </View>
    </Modal>}
  </SimpleScroll>;
}

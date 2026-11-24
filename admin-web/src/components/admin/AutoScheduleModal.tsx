import { useEffect, useRef, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { Btn, Field, Modal, inputClass } from './AdminUI';

const BASE='/showtimes/admin/auto-schedule';
const CINEMAS=['CineHunt Thanh Xuân','CineHunt Hà Đông','CineHunt Cầu Giấy'];
type MovieOption={movieId:number;title:string;duration:number;releaseDate:string|null;eligible?:boolean;reason?:string|null;endDate?:string|null};
type Options={today:string;cinemas:{name:string;rooms:number}[];earlyMovies:MovieOption[];regularMovies:MovieOption[]};
type Config={startDate:string;days:number;cinemaNames:string[];opens:string;closes:string;gapMinutes:number;weekdayPrice:number;weekendPrice:number;early:{movieIds:number[];maxPerCinemaDay:number;price:number}};
type Row={movieId:number;title:string;roomId:number;roomName:string;cinemaName:string;startTime:string;endTime:string;basePrice:number;early:boolean;seats:number};
type Plan={rows:Row[];warnings:string[];regular:number;early:number;seatCount:number;digest:string};
type Result={created:number;seatCount:number;early:number};
const vietnamTime=(s:string)=>new Date(s).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const money=(n:number)=>n.toLocaleString('vi-VN')+' đ';
const message=(e:unknown)=>e instanceof Error?e.message:typeof e==='object'&&e&&'message' in e?String(e.message):'Không xử lý được yêu cầu.';

export default function AutoScheduleModal({onClose,onCreated}:{onClose:()=>void;onCreated:(result:Result)=>void}){
  const [options,setOptions]=useState<Options|null>(null);
  const [config,setConfig]=useState<Config>({startDate:'',days:7,cinemaNames:[...CINEMAS],opens:'09:00',closes:'23:00',gapMinutes:20,weekdayPrice:70000,weekendPrice:70000,early:{movieIds:[],maxPerCinemaDay:1,price:90000}});
  const [plan,setPlan]=useState<Plan|null>(null);
  const [busy,setBusy]=useState<'loading'|'preview'|'apply'|null>('loading');
  const [error,setError]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const inFlight=useRef(false);
  useEffect(()=>{let active=true;void axiosClient.get(BASE+'/options').then(raw=>{if(!active)return;const data=raw as unknown as Options;setOptions(data);setConfig(c=>({...c,startDate:data.today}));}).catch(e=>{if(active)setError(message(e));}).finally(()=>{if(active)setBusy(null);});return()=>{active=false;};},[]);
  // CINEHUNT_EARLY_UPCOMING_V2: show all upcoming films; eligibility follows the chosen start date.
  function earlyReason(m:MovieOption,startDate=config.startDate){
    if(m.eligible===false)return m.reason||'Dữ liệu phim chưa hợp lệ';
    if(!m.releaseDate)return 'Chưa có ngày khởi chiếu';
    if(m.releaseDate<=startDate)return 'Ngày khởi chiếu phải sau ngày bắt đầu lập lịch';
    if(m.endDate&&m.endDate<startDate)return 'Đã hết thời gian chiếu';
    return null;
  }
  function update(patch:Partial<Config>){setConfig(c=>{const next={...c,...patch};return {...next,early:{...next.early,movieIds:next.early.movieIds.filter(id=>options?.earlyMovies.some(m=>m.movieId===id&&!earlyReason(m,next.startDate)))}};});setPlan(null);setConfirmed(false);setError('');}
  function earlyUpdate(patch:Partial<Config['early']>){update({early:{...config.early,...patch}});}
  async function preview(){if(inFlight.current)return;inFlight.current=true;setBusy('preview');setError('');setPlan(null);setConfirmed(false);try{const p=await axiosClient.post(BASE+'/preview',config) as unknown as Plan;setPlan(p);}catch(e){setError(message(e));}finally{inFlight.current=false;setBusy(null);}}
  async function apply(){if(!plan||!confirmed||inFlight.current)return;inFlight.current=true;setBusy('apply');setError('');try{const result=await axiosClient.post(BASE+'/apply',{config,digest:plan.digest},{timeout:300000}) as unknown as Result;onCreated(result);}catch(e){setError(message(e)+' Hãy xem trước lại để kiểm tra lịch thực tế trước khi thử tiếp.');setPlan(null);setConfirmed(false);}finally{inFlight.current=false;setBusy(null);}}
  return <Modal title="Tạo lịch chiếu tự động" onClose={()=>{if(!busy)onClose();}} footer={<><Btn onClick={onClose} disabled={!!busy}>Đóng</Btn><Btn variant="primary" onClick={()=>void preview()} disabled={!!busy||!options||!config.cinemaNames.length}>Xem trước</Btn><Btn variant="primary" onClick={()=>void apply()} disabled={!!busy||!confirmed||!plan?.rows.length}>Tạo suất chiếu</Btn></>}>
    <p className="text-sm text-gray-300">Lập lịch theo giờ Việt Nam (UTC+7), thời lượng phim và phòng có ghế. Không ghi đè hoặc hủy suất cũ. Ghế được sinh cùng suất chiếu.</p>
    {error&&<p role="alert" className="text-sm text-red-300 bg-red-950/40 p-3 rounded-lg">{error}</p>}
    {busy==='loading'&&<p role="status" className="text-sm text-gray-400">Đang tải phim và phòng chiếu...</p>}
    {options&&<fieldset disabled={!!busy} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ngày bắt đầu"><input className={inputClass} type="date" min={options.today} value={config.startDate} onChange={e=>update({startDate:e.target.value})}/></Field>
        <Field label="Số ngày (1–14)"><input className={inputClass} type="number" min={1} max={14} value={config.days} onChange={e=>update({days:Number(e.target.value)})}/></Field>
        <Field label="Giờ mở cửa"><input className={inputClass} type="time" value={config.opens} onChange={e=>update({opens:e.target.value})}/></Field>
        <Field label="Giờ đóng cửa"><input className={inputClass} type="time" value={config.closes} onChange={e=>update({closes:e.target.value})}/></Field>
        <Field label="Nghỉ giữa suất (phút)"><input className={inputClass} type="number" min={20} max={60} value={config.gapMinutes} onChange={e=>update({gapMinutes:Number(e.target.value)})}/></Field>
        <Field label="Giá ngày thường"><input className={inputClass} type="number" min={1000} max={1000000} step={1000} value={config.weekdayPrice} onChange={e=>update({weekdayPrice:Number(e.target.value)})}/></Field>
        <Field label="Giá cuối tuần"><input className={inputClass} type="number" min={1000} max={1000000} step={1000} value={config.weekendPrice} onChange={e=>update({weekendPrice:Number(e.target.value)})}/></Field>
      </div>
      <div className="border border-gray-700 rounded-xl p-3 space-y-2"><h4 className="text-sm font-semibold text-white">Rạp áp dụng</h4>{options.cinemas.map(c=><label key={c.name} className="flex gap-2 items-center text-sm text-gray-200"><input type="checkbox" checked={config.cinemaNames.includes(c.name)} onChange={e=>update({cinemaNames:e.target.checked?[...config.cinemaNames,c.name]:config.cinemaNames.filter(n=>n!==c.name)})}/><span>{c.name} <span className="text-gray-400">({c.rooms} phòng có ghế)</span></span></label>)}</div>
      <div className="border border-gray-700 rounded-xl p-3 space-y-3"><h4 className="text-sm font-semibold text-white">Phim đang chiếu ({options.regularMovies.length})</h4><p className="text-xs text-gray-400">{options.regularMovies.map(m=>m.title).join(' · ')||'Chưa có phim đủ điều kiện.'}</p></div>
      <div className="border border-gray-700 rounded-xl p-3 space-y-3"><h4 className="text-sm font-semibold text-white">Suất chiếu sớm · chọn từ phim sắp chiếu</h4><p className="text-xs text-gray-400">Chỉ chọn phim SẮP CHIẾU; phim ĐANG CHIẾU được xếp lịch thường. Phim bị khóa cần chỉnh thông tin tại Quản lý phim trước. Không đổi ngày khởi chiếu tự động.</p>
        <div className="text-xs text-gray-300">{options.earlyMovies.length} phim sắp chiếu · {options.earlyMovies.filter(m=>!earlyReason(m)).length} phim đủ điều kiện · {config.early.movieIds.length} đã chọn</div>
        <div className="max-h-64 overflow-y-auto space-y-2">{options.earlyMovies.length===0?<p className="text-sm text-gray-400">Chưa có phim ở trạng thái SẮP CHIẾU.</p>:options.earlyMovies.map(m=>{const reason=earlyReason(m);return <label className={`flex gap-2 items-start text-sm text-gray-200 border border-gray-700 rounded-lg p-2 ${reason?'opacity-70':'cursor-pointer'}`} key={m.movieId}><input type="checkbox" className="mt-1" disabled={!!reason} checked={config.early.movieIds.includes(m.movieId)&&!reason} onChange={e=>earlyUpdate({movieIds:e.target.checked?[...config.early.movieIds,m.movieId]:config.early.movieIds.filter(id=>id!==m.movieId)})}/><span>{m.title}<span className="block text-xs text-gray-400">{m.duration} phút · Khởi chiếu {m.releaseDate||'chưa cập nhật'}</span>{reason&&<span className="block text-xs text-amber-300">{reason}</span>}</span></label>;})}</div>
        <div className="grid grid-cols-2 gap-3"><Field label="Tối đa suất sớm/rạp/ngày"><input type="number" min={1} max={3} className={inputClass} value={config.early.maxPerCinemaDay} onChange={e=>earlyUpdate({maxPerCinemaDay:Number(e.target.value)})}/></Field><Field label="Giá suất chiếu sớm"><input type="number" min={1000} max={1000000} step={1000} className={inputClass} value={config.early.price} onChange={e=>earlyUpdate({price:Number(e.target.value)})}/></Field></div>
      </div>
    </fieldset>}
    {busy==='preview'&&<p role="status" className="text-sm text-gray-300">Đang xếp lịch...</p>}{busy==='apply'&&<p role="status" className="text-sm text-gray-300">Đang tạo suất và ghế trong một giao dịch. Không đóng trang.</p>}
    {plan&&<div className="border border-gray-700 rounded-xl p-3 space-y-3"><h4 className="text-white font-semibold">Xem trước: {plan.rows.length} suất mới</h4><p className="text-sm text-gray-300">{plan.regular} thường · {plan.early} sớm · {plan.seatCount.toLocaleString('vi-VN')} ghế dự kiến</p>
      {plan.warnings.length>0&&<div className="max-h-32 overflow-auto text-xs text-amber-300 space-y-1">{plan.warnings.map(w=><p key={w}>{w}</p>)}</div>}
      <div className="max-h-64 overflow-auto divide-y divide-gray-700">{plan.rows.map(r=><div className="py-2 text-xs text-gray-300" key={`${r.roomId}-${r.startTime}`}><p className="font-semibold text-white">{r.title} {r.early&&<span className="text-amber-300">· CHIẾU SỚM</span>}</p><p>{r.cinemaName} · {r.roomName}</p><p>{vietnamTime(r.startTime)} → {vietnamTime(r.endTime)} · {money(r.basePrice)}</p></div>)}</div>
      {plan.rows.length===0?<p className="text-sm text-gray-400">Không còn khoảng trống phù hợp hoặc chưa có phim đủ điều kiện.</p>:<label className="flex gap-2 text-sm text-gray-200"><input type="checkbox" disabled={!!busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Tôi đã kiểm tra và xác nhận tạo {plan.rows.length} suất chiếu mở bán.</label>}
    </div>}
  </Modal>;
}

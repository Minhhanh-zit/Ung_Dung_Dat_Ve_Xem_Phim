export const CORE_CINEMAS = ['CineHunt Thanh Xuân', 'CineHunt Hà Đông', 'CineHunt Cầu Giấy'] as const;
const MINUTE = 60_000;
const DAY = 86_400_000;
const OFFSET = 7 * 60 * MINUTE;
const RATINGS = new Set(['P', 'K', 'T13', 'T16', 'T18']);
export interface ScheduleConfig {
  startDate: string; days: number; cinemaNames: string[]; opens: string; closes: string;
  gapMinutes: number; weekdayPrice: number; weekendPrice: number;
  early: { movieIds: number[]; maxPerCinemaDay: number; price: number };
}
export interface MovieRow { movieId: number; title: string; duration: number; status: string; releaseDate: string | null; endDate: string | null; ageRating: string | null }
export interface RoomRow { roomId: number; roomName: string; cinemaName: string; seats: number; activeSeats: number }
export interface ExistingRow { roomId: number; movieId: number; startTime: string; endTime: string; status: string }
export interface PlannedRow { movieId: number; title: string; roomId: number; roomName: string; cinemaName: string; startTime: string; endTime: string; basePrice: number; early: boolean; seats: number }
export function localDay(ms: number): string { return new Date(ms + OFFSET).toISOString().slice(0, 10); }
function dateMs(s: string): number { return Date.parse(s + 'T00:00:00+07:00'); }
function validDate(s: unknown): s is string { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(dateMs(s)) && localDay(dateMs(s)) === s; }
function integer(n: unknown, min: number, max: number): n is number { return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max; }
function clock(s: unknown): s is string { return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }
function clockMinutes(s: string): number { const [h,m] = s.split(':').map(Number); return h*60+m; }
function asRecord(x: unknown): Record<string, unknown> { if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('Cấu hình không hợp lệ'); return x as Record<string, unknown>; }
export function parseConfig(input: unknown, now = Date.now()): ScheduleConfig {
  const x = asRecord(input); const e = asRecord(x.early);
  const {startDate, days, opens, closes, gapMinutes, weekdayPrice, weekendPrice} = x;
  if (!validDate(startDate) || startDate < localDay(now) || dateMs(startDate) > dateMs(localDay(now)) + 90*DAY) throw new Error('Ngày bắt đầu phải trong 90 ngày tới');
  if (!integer(days,1,14) || !clock(opens) || !clock(closes) || clockMinutes(closes)-clockMinutes(opens)<60 || !integer(gapMinutes,20,60)) throw new Error('Số ngày 1–14, giờ hợp lệ, nghỉ 20–60 phút');
  if (!integer(weekdayPrice,1000,1000000) || !integer(weekendPrice,1000,1000000)) throw new Error('Giá vé phải từ 1.000 đến 1.000.000 đồng');
  if (!Array.isArray(x.cinemaNames) || !x.cinemaNames.length || x.cinemaNames.some(n=>!CORE_CINEMAS.includes(n as typeof CORE_CINEMAS[number])) || new Set(x.cinemaNames).size!==x.cinemaNames.length) throw new Error('Chọn ít nhất một rạp hợp lệ, không trùng');
  if (!Array.isArray(e.movieIds) || e.movieIds.length>20 || e.movieIds.some(n=>!integer(n,1,2147483647)) || new Set(e.movieIds).size!==e.movieIds.length || !integer(e.maxPerCinemaDay,1,3) || !integer(e.price,1000,1000000)) throw new Error('Cấu hình suất chiếu sớm không hợp lệ');
  return {startDate,days,opens,closes,gapMinutes,weekdayPrice,weekendPrice,cinemaNames:CORE_CINEMAS.filter(n=>(x.cinemaNames as string[]).includes(n)),early:{movieIds:[...(e.movieIds as number[])].sort((a,b)=>a-b),maxPerCinemaDay:e.maxPerCinemaDay,price:e.price}};
}
export function isEligible(m: MovieRow): boolean { return RATINGS.has(String(m.ageRating).trim().toUpperCase()) && integer(m.duration,1,840) && (!m.releaseDate || validDate(m.releaseDate)) && (!m.endDate || validDate(m.endDate)); }
export function planSchedule(config: ScheduleConfig, movies: MovieRow[], rooms: RoomRow[], existing: ExistingRow[], now: number) {
  const sortedRooms=rooms.filter(r=>config.cinemaNames.includes(r.cinemaName)&&r.activeSeats>0).sort((a,b)=>a.roomId-b.roomId);
  const selected = new Set(config.early.movieIds);
  const eligible = movies.filter(isEligible).sort((a,b)=>a.movieId-b.movieId);
  for(const id of selected) if(!eligible.some(m=>m.movieId===id&&m.status==='COMING_SOON'&&m.releaseDate&&m.releaseDate>config.startDate)) throw new Error(`Phim chiếu sớm #${id} không hợp lệ hoặc đã đến ngày phát hành`);
  const missing=config.cinemaNames.filter(n=>!sortedRooms.some(r=>r.cinemaName===n));
  if(missing.length) throw new Error('Rạp chưa có phòng/ghế hoạt động: '+missing.join(', '));
  const roomMap=new Map(sortedRooms.map(r=>[r.roomId,r]));
  const movieMap=new Map(movies.map(m=>[m.movieId,m]));
  const occupied=new Map<number,{a:number;b:number}[]>();
  const counts=new Map<string,number>(); const earlyCounts=new Map<string,number>();
  const bump=(map:Map<string,number>,key:string)=>map.set(key,(map.get(key)??0)+1);
  const key=(cinema:string,day:string,id:number)=>`${cinema}|${day}|${id}`;
  const earlyKey=(cinema:string,day:string)=>`${cinema}|${day}`;
  for(const s of existing){
    const room=roomMap.get(s.roomId); if(!room||s.status==='CANCELLED') continue;
    const a=Date.parse(s.startTime),b=Date.parse(s.endTime);
    if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a) throw new Error('Dữ liệu lịch cũ không hợp lệ');
    const list=occupied.get(s.roomId)??[]; list.push({a,b}); occupied.set(s.roomId,list);
    if(s.status==='OPEN'){const day=localDay(a);bump(counts,key(room.cinemaName,day,s.movieId));const m=movieMap.get(s.movieId); if(m?.status==='COMING_SOON'&&m.releaseDate&&day<m.releaseDate)bump(earlyCounts,earlyKey(room.cinemaName,day));}
  }
  const rows:PlannedRow[]=[]; const warnings:string[]=[]; const coverage=new Set<string>();
  const gap=config.gapMinutes*MINUTE;
  for(let d=0;d<config.days;d++){
    const midnight=dateMs(config.startDate)+d*DAY, day=localDay(midnight);
    const opening=midnight+clockMinutes(config.opens)*MINUTE, closing=midnight+clockMinutes(config.closes)*MINUTE;
    const weekday=new Date(midnight+OFFSET).getUTCDay();
    const round=(t:number)=>Math.ceil(t/(5*MINUTE))*5*MINUTE;
    const normal=eligible.filter(m=>m.status==='NOW_SHOWING'&&(!m.releaseDate||m.releaseDate<=day)&&(!m.endDate||m.endDate>=day));
    const early=eligible.filter(m=>selected.has(m.movieId)&&m.status==='COMING_SOON'&&m.releaseDate&&day<m.releaseDate&&(!m.endDate||m.endDate>=day));
    for(const room of sortedRooms){
      const list=occupied.get(room.roomId)??[]; occupied.set(room.roomId,list);
      let at=round(Math.max(opening,now+16*MINUTE));
      const ek=earlyKey(room.cinemaName,day);
      while(at<closing){
        const ranked=(ms:MovieRow[])=>[...ms].sort((a,b)=>(counts.get(key(room.cinemaName,day,a.movieId))??0)-(counts.get(key(room.cinemaName,day,b.movieId))??0)||a.movieId-b.movieId);
        // Reserve selected early screenings first, up to a cinema-wide daily quota.
        const candidates=[...( (earlyCounts.get(ek)??0)<config.early.maxPerCinemaDay ? ranked(early):[]),...ranked(normal)];
        const movie=candidates.find(m=>{const end=at+m.duration*MINUTE;return end<=closing&&!list.some(s=>at<s.b+gap&&end+gap>s.a);});
        if(!movie){
          if(!candidates.length)break;
          at+=5*MINUTE; continue;
        }
        const end=at+movie.duration*MINUTE, isEarly=movie.status==='COMING_SOON';
        rows.push({movieId:movie.movieId,title:movie.title,roomId:room.roomId,roomName:room.roomName,cinemaName:room.cinemaName,startTime:new Date(at).toISOString(),endTime:new Date(end).toISOString(),basePrice:isEarly?config.early.price:(weekday===0||weekday===6?config.weekendPrice:config.weekdayPrice),early:isEarly,seats:room.seats});
        if(rows.length>1000)throw new Error('Vượt 1.000 suất; hãy giảm số ngày hoặc số rạp');
        list.push({a:at,b:end}); bump(counts,key(room.cinemaName,day,movie.movieId)); if(isEarly)bump(earlyCounts,ek);
        at=round(end+gap);
      }
    }
    for(const cinema of config.cinemaNames){
      for(const m of [...normal,...early]) if((counts.get(key(cinema,day,m.movieId))??0)>0)coverage.add(`${cinema}|${m.movieId}`);
    }
  }
  const activeMovies=eligible.filter(m=>m.status==='NOW_SHOWING'||selected.has(m.movieId));
  for(const cinema of config.cinemaNames)for(const m of activeMovies)if(!coverage.has(`${cinema}|${m.movieId}`))warnings.push(`${cinema}: chưa có suất cho ${m.title} trong kỳ`);
  for(const m of movies)if(m.status==='NOW_SHOWING'&&!isEligible(m))warnings.push(`Bỏ qua ${m.title}: thiếu phân loại hoặc thời lượng/ngày không hợp lệ`);
  return {rows,warnings,regular:rows.filter(r=>!r.early).length,early:rows.filter(r=>r.early).length,seatCount:rows.reduce((n,r)=>n+r.seats,0)};
}

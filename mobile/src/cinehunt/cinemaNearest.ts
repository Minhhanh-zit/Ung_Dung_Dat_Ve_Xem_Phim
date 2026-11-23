// CineHunt free, on-device proximity ranking. NO billable routing API.
export type CinemaPosition = {
  cinemaId: number; cinemaName: string; address?: string|null;
  city?: string|null; district?: string|null; status?: string|null;
  latitude?: number|string|null; longitude?: number|string|null;
};
export type NearbyCinema = CinemaPosition & { straightLineKm: number|null; mapsUrl: string; ward: string };
export type LocationPoint = { latitude: number; longitude: number };

const WARD_BY_NAME:Record<string,string>={
  'CineHunt Thanh Xuân':'Phường Thanh Xuân',
  'CineHunt Hà Đông':'Phường Hà Đông',
  'CineHunt Cầu Giấy':'Phường Cầu Giấy',
};
export const KNOWN_CINEMAS = Object.keys(WARD_BY_NAME);

function numericCoord(lat:unknown,lon:unknown):{lat:number;lon:number}|null{
  if(lat===null||lat===undefined||lon===null||lon===undefined||lat===''||lon==='')return null;
  const a=Number(lat),b=Number(lon);
  return Number.isFinite(a)&&Number.isFinite(b)&&a>=-90&&a<=90&&b>=-180&&b<=180?{lat:a,lon:b}:null;
}
export function straightLineKm(a:LocationPoint,b:LocationPoint):number{
  const rad=(v:number)=>v*Math.PI/180;
  const dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude);
  const h=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
function destination(cinema:CinemaPosition):string{
  // Thanh Xuân uses the location of Beta Cinemas at Golden West as a demo venue.
  if(cinema.cinemaName==='CineHunt Thanh Xuân')
    return 'Beta Cinemas Thanh Xuân, B1 Golden West, 2 Lê Văn Thiêm, Thanh Xuân, Hà Nội, Việt Nam';
  return [cinema.address,cinema.city||'Hà Nội','Việt Nam'].filter(Boolean).join(', ');
}
export function directionsUrl(cinema:CinemaPosition,origin?:LocationPoint|string):string{
  let url='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(destination(cinema))+'&travelmode=driving';
  if(typeof origin==='string'&&origin.trim())url+='&origin='+encodeURIComponent(origin.trim());
  else if(origin&&typeof origin==='object'){
    const point=numericCoord(origin.latitude,origin.longitude);
    if(point)url+='&origin='+encodeURIComponent(`${point.lat},${point.lon}`);
  }
  return url;
}
export function filterCoreCinemas(rows:CinemaPosition[]):CinemaPosition[]{
  if(!Array.isArray(rows))return [];
  const seen=new Set<string>();
  return rows.filter(c=>c&&c.status!=='INACTIVE'&&Object.prototype.hasOwnProperty.call(WARD_BY_NAME,c.cinemaName))
    .filter(c=>{if(seen.has(c.cinemaName))return false;seen.add(c.cinemaName);return true;});
}
export function rankNearbyCinemas(rows:CinemaPosition[],origin:LocationPoint):NearbyCinema[]{
  const me=numericCoord(origin.latitude,origin.longitude);
  if(!me)return [];
  return filterCoreCinemas(rows).map(c=>{
    const point=numericCoord(c.latitude,c.longitude);
    const km=point?straightLineKm({latitude:me.lat,longitude:me.lon},{latitude:point.lat,longitude:point.lon}):null;
    return {...c,ward:WARD_BY_NAME[c.cinemaName],straightLineKm:km===null?null:Math.round(km*10)/10,mapsUrl:directionsUrl(c,origin)};
  }).sort((a,b)=>(a.straightLineKm??Infinity)-(b.straightLineKm??Infinity));
}
export function cinemasFromNamedPlace(rows:CinemaPosition[],origin:string):NearbyCinema[]{
  return filterCoreCinemas(rows).map(c=>({
    ...c,ward:WARD_BY_NAME[c.cinemaName],straightLineKm:null,mapsUrl:directionsUrl(c,origin),
  }));
}
function ascii(input:string):string{
  return input.toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
}
export function nearestIntent(message:string):{kind:'gps'|'named';origin?:string}|null{
  const text=ascii(String(message||''));
  if(!/(\brap\b|cinema|rap phim)/.test(text)||!/(gan|gan nhat|quanh|lan can|nearest)/.test(text))return null;
  const entries:[string,string][]=[
    ['tan mai','Phường Tân Mai, Hà Nội, Việt Nam'],
    ['thanh xuan','Phường Thanh Xuân, Hà Nội, Việt Nam'],
    ['ha dong','Phường Hà Đông, Hà Nội, Việt Nam'],
    ['cau giay','Phường Cầu Giấy, Hà Nội, Việt Nam'],
  ];
  for(const [term,address] of entries)if(text.includes(term))return {kind:'named',origin:address};
  return {kind:'gps'};
}

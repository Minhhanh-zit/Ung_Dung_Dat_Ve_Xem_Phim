// Three-cinema pilot scope. Ward labels are explicit, not parsed from street addresses.
// Historical cinema records remain in SQL Server for old bookings/tickets.
import type {Showtime} from '../types';

type CinemaLike={cinemaName?:string|null};
export const CORE_CINEMA_WARDS=[
  {name:'CineHunt Thanh Xuân',ward:'Phường Thanh Xuân'},
  {name:'CineHunt Hà Đông',ward:'Phường Hà Đông'},
  {name:'CineHunt Cầu Giấy',ward:'Phường Cầu Giấy'},
] as const;
const normalize=(value:string)=>value.trim().normalize('NFC').toLocaleLowerCase('vi-VN');

export function scopeWard(cinema:CinemaLike):string|null {
  const name=normalize(cinema.cinemaName??'');
  return CORE_CINEMA_WARDS.find(item=>normalize(item.name)===name)?.ward??null;
}
export function isCoreCinema(cinema:CinemaLike):boolean{
  return scopeWard(cinema)!==null;
}
export function isCoreShowtime(showtime:Showtime):boolean{
  return isCoreCinema({cinemaName:showtime.room?.cinema?.cinemaName});
}
export function sortScopeWards(a:string,b:string):number{
  const i=CORE_CINEMA_WARDS.findIndex(item=>item.ward===a);
  const j=CORE_CINEMA_WARDS.findIndex(item=>item.ward===b);
  return (i===-1?99:i)-(j===-1?99:j);
}

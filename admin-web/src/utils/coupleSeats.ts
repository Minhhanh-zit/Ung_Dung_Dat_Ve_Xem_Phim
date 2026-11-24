// CINEHUNT_COUPLE_PAIR_V1
import type { SeatDto } from '../types/seat.types';
export const isCouple = (s:SeatDto) => s.type === 'CH_COUPLE';
export function seatGroup(seats:SeatDto[],s:SeatDto):SeatDto[]{
  if(!isCouple(s))return [s];
  const partner=s.seatNumber%2?s.seatNumber+1:s.seatNumber-1;
  const other=seats.find(x=>isCouple(x)&&x.rowName===s.rowName&&x.seatNumber===partner);
  return other?[s,other].sort((a,b)=>a.seatNumber-b.seatNumber):[s];
}

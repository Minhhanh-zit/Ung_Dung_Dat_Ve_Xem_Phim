// CINEHUNT_COUPLE_PAIR_V1: new-layout couples are always two consecutive places.
export function couplePartner(number: number): number {
  return number % 2 === 1 ? number + 1 : number - 1;
}
export type PairSeat = { showtimeId: number; seat?: { seatRow: string; seatNumber: number; seatType?: { typeCode: string } } };
export function completeCoupleSelection(seats: PairSeat[]): boolean {
  return seats.every(s => {
    const a = s.seat;
    if (a?.seatType?.typeCode !== 'CH_COUPLE') return true;
    return a.seatRow === 'J' && a.seatNumber >= 1 && a.seatNumber <= 12 &&
      seats.some(t => t.showtimeId === s.showtimeId && t.seat?.seatType?.typeCode === 'CH_COUPLE' &&
        t.seat.seatRow === a.seatRow && t.seat.seatNumber === couplePartner(a.seatNumber));
  });
}

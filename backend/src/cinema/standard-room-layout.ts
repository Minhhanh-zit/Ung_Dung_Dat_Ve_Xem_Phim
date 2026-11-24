export type StandardRoomSeatType = 'CH_STANDARD' | 'CH_VIP' | 'CH_COUPLE';

export function standardRoomLayout() {
  return Array.from({ length: 120 }, (_, index) => {
    const rowIndex = Math.floor(index / 12);
    const seatRow = String.fromCharCode(65 + rowIndex);
    const seatNumber = index % 12 + 1;
    const typeCode: StandardRoomSeatType = rowIndex < 3
      ? 'CH_STANDARD' : rowIndex === 9 ? 'CH_COUPLE' : 'CH_VIP';
    return { seatRow, seatNumber, seatLabel: `${seatRow}${seatNumber}`, typeCode };
  });
}

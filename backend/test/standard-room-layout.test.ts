import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { standardRoomLayout } from '../src/cinema/standard-room-layout';
import { completeCoupleSelection } from '../src/showtime/couple-pair';

test('standard layout contains 120 unique positions in A-J, 12 per row', () => {
  const seats = standardRoomLayout();
  assert.equal(seats.length, 120);
  assert.equal(new Set(seats.map(s => s.seatLabel)).size, 120);
  for (const row of 'ABCDEFGHIJ') {
    assert.equal(seats.filter(s => s.seatRow === row).length, 12);
  }
  assert.equal(seats.filter(s => s.typeCode === 'CH_STANDARD').length, 36);
  assert.equal(seats.filter(s => s.typeCode === 'CH_VIP').length, 72);
  assert.equal(seats.filter(s => s.typeCode === 'CH_COUPLE').length, 12);
  assert.equal(seats[0].seatLabel, 'A1');
  assert.equal(seats[119].seatLabel, 'J12');
});

test('last row has six valid adjacent couple pairs', () => {
  const seats = standardRoomLayout().filter(s => s.typeCode === 'CH_COUPLE');
  for (let i = 0; i < seats.length; i += 2) {
    const pair = seats.slice(i, i + 2).map(s => ({
      showtimeId: 1, seat: { seatRow: s.seatRow, seatNumber: s.seatNumber, seatType: { typeCode: s.typeCode } },
    }));
    assert.equal(completeCoupleSelection(pair), true);
    assert.equal(completeCoupleSelection(pair.slice(0, 1)), false);
  }
});

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { couplePartner, completeCoupleSelection } from '../src/showtime/couple-pair';
const seat=(n:number,showtimeId=1,typeCode='CH_COUPLE')=>({showtimeId,seat:{seatRow:'J',seatNumber:n,seatType:{typeCode}}});
test('all six couples are symmetric',()=>{for(let n=1;n<=12;n++)assert.equal(couplePartner(couplePartner(n)),n)});
test('a complete pair is accepted',()=>assert.equal(completeCoupleSelection([seat(1),seat(2)]),true));
test('single or wrong pair is rejected',()=>{assert.equal(completeCoupleSelection([seat(1)]),false);assert.equal(completeCoupleSelection([seat(2),seat(3)]),false)});
test('different showtimes cannot form a couple',()=>assert.equal(completeCoupleSelection([seat(1),seat(2,2)]),false));
test('normal or legacy seats remain unchanged',()=>assert.equal(completeCoupleSelection([seat(1,1,'VIP')]),true));

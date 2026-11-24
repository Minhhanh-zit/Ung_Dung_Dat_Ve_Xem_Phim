import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { cinehuntSeatPrice } from '../src/showtime/seat-pricing';
test('fixed surcharge at 70000 and 90000',()=>{
  for(const base of [70000,90000]){
    assert.equal(cinehuntSeatPrice(base,'CH_STANDARD',1.3),base);
    assert.equal(cinehuntSeatPrice(base,'CH_VIP',1.3),base+5000);
    assert.equal(cinehuntSeatPrice(base,'CH_COUPLE',1.3),base+20000);
  }
});
test('legacy types retain their existing rule',()=>assert.equal(cinehuntSeatPrice(90000,'VIP',1.3),117000));

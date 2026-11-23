import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {findCinemasNearby} from '../src/cinema/cinema-distance';

const cinemas=[
  {cinemaId:1,cinemaName:'CineHunt Cầu Giấy',address:'11 Duy Tân',city:'Hà Nội',latitude:21.0309,longitude:105.7828},
  {cinemaId:2,cinemaName:'CineHunt Hà Đông',address:'2 Trần Phú',city:'Hà Nội',latitude:20.9801,longitude:105.7909},
  {cinemaId:3,cinemaName:'CineHunt Thanh Xuân',address:'2 Lê Văn Thiêm',city:'Hà Nội',latitude:21.0022,longitude:105.80277},
];
test('GPS fallback never claims road km without a Routes API key', async()=>{
  const result=await findCinemasNearby(cinemas,{latitude:21.001,longitude:105.8},undefined);
  assert.equal(result.method,'STRAIGHT_LINE');
  assert.equal(result.cinemas.length,3);
  assert.ok(result.cinemas.every(c=>c.durationMinutes===null));
  assert.match(result.note,/đường thẳng/);
});
test('named origin without a Routes key is not falsely ranked', async()=>{
  const result=await findCinemasNearby(cinemas,{originAddress:'Tân Mai, Hà Nội'},undefined);
  assert.equal(result.method,'UNRANKED');
  assert.ok(result.cinemas.every(c=>c.distanceKm===null));
  assert.ok(result.cinemas.every(c=>c.mapsUrl.includes('origin=')));
});
test('invalid GPS is rejected', async()=>{
  await assert.rejects(()=>findCinemasNearby(cinemas,{latitude:199,longitude:105},undefined));
});

import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { ShowtimeService } from '../src/showtime/showtime.service';
import { Showtime } from '../src/entities/showtime.entity';
import { ShowtimeSeat } from '../src/entities/showtime-seat.entity';
import { Room } from '../src/entities/room.entity';
import { Seat } from '../src/entities/seat.entity';

function fixture() {
  const show = { showtimeId: 3, movieId: 4, roomId: 2, basePrice: 75000, status: 'OPEN', startTime: new Date(Date.now()+3600000), room: { status:'ACTIVE', cinema: {status:'ACTIVE'} }, movie: {title:'Film', ageRating:'T16'} };
  const state = { current: show as typeof show | null, room: show.room as typeof show.room | null, lock: 0, total: 2, existing: [] as {seatId:number}[], seats: [{seatId:1,status:'ACTIVE',seatType:{typeCode:'CH_VIP',priceMultiplier:1}},{seatId:2,status:'INACTIVE',seatType:{typeCode:'CH_STANDARD',priceMultiplier:1}}] };
  const saved: object[] = [];
  const repo = { findOne: async () => show, find: async () => [show] } as unknown as Repository<Showtime>;
  const seatRepo = { count: async () => state.total } as unknown as Repository<ShowtimeSeat>;
  const manager = {
    findOne: async (entity: unknown) => entity === Room ? state.room : state.current,
    query: async () => [{lock_result: state.lock}],
    find: async (entity: unknown) => entity === Seat ? state.seats : state.existing,
    create: (_entity: unknown, value: object) => value,
    save: async (_entity: unknown, value: object[]) => {saved.push(...value); return value;},
  } as unknown as EntityManager;
  const db = {transaction: async (work: (m: EntityManager) => Promise<unknown>) => work(manager)} as unknown as DataSource;
  return {service:new ShowtimeService(repo,seatRepo,db), state, saved, show};
}

test('showtime age policy exposes real rating and public lists', async () => {
  const {service}=fixture();
  const p=await service.getAgePolicy(3);
  assert.equal(p.showtimeId,3);
  assert.equal(p.movieTitle,'Film');
  assert.equal(p.rating,'T16');
  assert.equal((await service.findByMovie(4)).length,1);
  assert.equal((await service.findByRoom(2)).length,1);
});

test('showtime generation creates only missing seats with fixed prices and blocked status', async () => {
  const {service,state,saved}=fixture();
  const result=await service.generateSeats(3);
  assert.equal(result.created,2);
  assert.deepEqual(saved.map(s=>{const row=s as {seatId:number;price:number;status:string};return [row.seatId,row.price,row.status];}), [[1,80000,'AVAILABLE'],[2,75000,'BLOCKED']]);
  state.existing=[{seatId:1},{seatId:2}];
  assert.equal((await service.generateSeats(3)).created,0);
  assert.equal(saved.length,2);
  state.total=0;
  await assert.rejects(service.generateSeats(3),/chưa có ghế/);
});

test('showtime generation checks fresh row, schedule lock, room, and active seats', async () => {
  const {service,state,show,saved}=fixture();
  state.current=null;
  await assert.rejects(service.generateSeats(3),/không còn hợp lệ/);
  state.current={...show,status:'CLOSED'};
  await assert.rejects(service.generateSeats(3),/không còn hợp lệ/);
  state.current={...show,roomId:99};
  await assert.rejects(service.generateSeats(3),/không còn hợp lệ/);
  state.current={...show,startTime:new Date(0)};
  await assert.rejects(service.generateSeats(3),/không còn hợp lệ/);
  state.current=show;
  state.lock=-1;
  await assert.rejects(service.generateSeats(3),/Không lấy được khóa/);
  state.lock=0;
  state.room=null;
  await assert.rejects(service.generateSeats(3),/Không tìm thấy phòng/);
  state.room=show.room;
  state.seats=[];
  await assert.rejects(service.generateSeats(3),/chưa có ghế hoạt động/);
  assert.equal(saved.length,0);
});

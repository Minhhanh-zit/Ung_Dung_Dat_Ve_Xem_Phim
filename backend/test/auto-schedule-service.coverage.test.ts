import 'reflect-metadata';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { DataSource } from 'typeorm';
import { AutoScheduleService } from '../src/showtime/auto-schedule.service';
import { CORE_CINEMAS, localDay } from '../src/showtime/auto-schedule-plan';
import { AutoScheduleController } from '../src/showtime/auto-schedule.controller';
const day = (n: number) => localDay(Date.now() + n * 86400000);
const config = () => ({ startDate: day(2), days: 1, cinemaNames: [CORE_CINEMAS[0]], opens: '09:00', closes: '13:00', gapMinutes: 20, weekdayPrice: 70000, weekendPrice: 90000, early: { movieIds: [2], maxPerCinemaDay: 1, price: 100000 } });
function fixture(opts: { lock?: number; total?: number; available?: number; changed?: boolean; empty?: boolean } = {}) {
  const movies = [
    {movieId:1,title:'Regular',duration:90,status:'NOW_SHOWING',releaseDate:day(-2),endDate:null,ageRating:'P'},
    {movieId:2,title:'Early',duration:90,status:'COMING_SOON',releaseDate:day(5),endDate:null,ageRating:'T13'},
    {movieId:3,title:'Invalid',duration:0,status:'COMING_SOON',releaseDate:day(5),endDate:null,ageRating:'C'},
    {movieId:4,title:'Missing',duration:90,status:'COMING_SOON',releaseDate:null,endDate:null,ageRating:'P'},
    {movieId:5,title:'Past',duration:90,status:'COMING_SOON',releaseDate:day(-1),endDate:null,ageRating:'P'},
  ];
  const rooms = [{roomId:1,roomName:'Room 1',cinemaName:CORE_CINEMAS[0],seats:120,activeSeats:120}];
  const locks: string[] = []; const saved: object[] = []; let roomReads=0;
  const manager = {
    query: async (q:string, params:unknown[] = []) => {
      if(q.includes('sp_getapplock')) { locks.push(String(params[0])); return [{result:opts.lock ?? 0}]; }
      if(q.includes('FROM dbo.movies')) return movies;
      if(q.includes('FROM dbo.rooms r JOIN')) { roomReads++; return opts.changed && roomReads>=3 ? [...rooms,{...rooms[0],roomId:2}] : rooms; }
      if(q.includes('INSERT INTO dbo.showtime_seats')) return [{total:opts.total??120,available:opts.available??120}];
      if(q.includes('FROM dbo.showtimes st')) return opts.empty ? [{roomId:1,movieId:1,startTime:new Date(config().startDate+'T08:00:00+07:00'),endTime:new Date(config().startDate+'T14:00:00+07:00'),status:'OPEN'}] : [];
      throw new Error('Unexpected SQL');
    },
    create: (_:unknown, value:object) => value,
    save: async (_:unknown, value:object) => {saved.push(value);return {...value,showtimeId:saved.length};},
  };
  const db = {manager,transaction: async (work:(m:typeof manager)=>Promise<unknown>)=>work(manager)} as unknown as DataSource;
  return {service:new AutoScheduleService(db),locks,saved};
}
test('schedule options distinguish eligible, invalid, missing and past films',async()=>{
  const {service}=fixture(); const options=await service.options();
  assert.equal(options.cinemas[0].rooms,1); assert.equal(options.cinemas[1].rooms,0);
  assert.equal(options.regularMovies.length,1); assert.equal(options.earlyMovies[0].reason,null);
  assert.equal(options.earlyMovies[1].eligible,false); assert.match(options.earlyMovies[2].reason??'',/Chưa có/); assert.match(options.earlyMovies[3].reason??'',/đã qua/);
});
test('preview and apply produce matching showtimes, seat counts and ordered locks',async()=>{
  const {service,locks,saved}=fixture(); const c=config(); const p=await service.preview(c);
  assert.ok(p.rows.length>0); assert.match(p.digest,/^[a-f0-9]{64}$/);
  const r=await service.apply(c,p.digest,9); assert.equal(r.created,p.rows.length); assert.equal(r.seatCount,120*r.created); assert.equal(r.early,p.early);
  assert.deepEqual(locks,['CineHunt.AutoSchedule','CineHunt.ShowtimeRoom.1']); assert.equal(saved.length,r.created);
  assert.equal((saved[0] as {createdBy:number}).createdBy,9);
});
test('invalid config, digest and unavailable cinema are rejected',async()=>{
  const {service}=fixture(); await assert.rejects(service.preview({...config(),days:0})); await assert.rejects(service.apply(config(),'bad',1));
  await assert.rejects(service.preview({...config(),cinemaNames:[CORE_CINEMAS[1]]}));
});
test('stale preview, lock conflict, inventory drift and bad seat count reject apply',async()=>{
  for(const opts of [{lock:-1},{changed:true},{total:119},{available:0}]){
    const {service}=fixture(opts); const c=config();const p=await service.preview(c);await assert.rejects(service.apply(c,p.digest,1));
  }
  const {service}=fixture(); await assert.rejects(service.apply(config(),'a'.repeat(64),1));
});
test('controller delegates read, preview and apply to service',async()=>{
  const {service}=fixture();const c=new AutoScheduleController(service);const p=await c.preview(config());assert.ok((await c.options()).regularMovies.length);const r=await c.apply(config(),p.digest,{userId:9} as Parameters<AutoScheduleController['apply']>[2]);assert.equal(r.created,p.rows.length);
});

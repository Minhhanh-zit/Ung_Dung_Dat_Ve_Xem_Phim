import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Repository } from 'typeorm';
import { CinemaService } from '../src/cinema/cinema.service';
import { Cinema } from '../src/entities/cinema.entity';
import { Room } from '../src/entities/room.entity';
import { Seat } from '../src/entities/seat.entity';
import { SeatType } from '../src/entities/seat-type.entity';

function fixture() {
  const cinema = { cinemaId: 7, cinemaName: 'Test Cinema', updatedAt: new Date('2026-01-01T00:00:00Z') };
  const room = { roomId: 12, cinemaId: 7, totalSeats: 120, status: 'ACTIVE', roomName: 'Test Room' };
  const state = { cinema: cinema as typeof cinema | null, room: room as typeof room | null, count: 0, lock: 0, inactiveType: false, existingTypes: false };
  const writes: { entity: unknown; data: unknown }[] = [];
  const queries: unknown[][] = [];
  let nextType = 0;
  const qb = {
    where: (...args: unknown[]) => { queries.push(args); return qb; },
    loadRelationCountAndMap: (...args: unknown[]) => { queries.push(args); return qb; },
    orderBy: (...args: unknown[]) => { queries.push(args); return qb; },
    getMany: async () => [room],
  };
  const manager = {
    query: async (_sql: string, args: unknown[]) => { queries.push(args); return [{ result: state.lock }]; },
    findOne: async (entity: unknown, opts: { where: { typeCode?: string } }) => {
      if (entity === Room) return state.room;
      if (entity === SeatType && (state.inactiveType || state.existingTypes)) return { typeCode: opts.where.typeCode, seatTypeId: ++nextType, status: state.inactiveType ? 'INACTIVE' : 'ACTIVE' };
      return null;
    },
    count: async () => state.count,
    create: (_entity: unknown, data: object) => ({ ...data }),
    save: async (entity: unknown, data: object) => {
      writes.push({ entity, data });
      if (entity === Room) return { ...data, roomId: room.roomId };
      if (entity === SeatType) return { ...data, seatTypeId: ++nextType };
      return data;
    },
    update: async (entity: unknown, _where: object, data: object) => { writes.push({ entity, data }); },
  };
  const cinemas = {
    find: async (opts: unknown) => { queries.push([opts]); return [cinema]; },
    findOne: async () => state.cinema,
    update: async (_where: object, data: object) => { writes.push({ entity: Cinema, data }); },
    create: (data: object) => data,
    save: async (data: object) => data,
  } as unknown as Repository<Cinema>;
  const rooms = {
    find: async (opts: unknown) => { queries.push([opts]); return [room]; },
    findOne: async () => state.room,
    createQueryBuilder: () => qb,
    update: async (_where: object, data: object) => { writes.push({ entity: Room, data }); },
    manager: { transaction: async (work: (m: typeof manager) => Promise<unknown>) => work(manager) },
  } as unknown as Repository<Room>;
  return { service: new CinemaService(cinemas, rooms), state, writes, queries, room };
}

test('cinema queries scope public records and count actual seats for admin', async () => {
  const { service, queries, state } = fixture();
  assert.equal((await service.findAllCinemas()).length, 1);
  assert.equal((await service.findRoomsByCinema(7)).length, 1);
  assert.equal((await service.adminFindRoomsByCinema(7)).length, 1);
  assert.ok(queries.some(q => q[0] === 'room.actualSeats' && q[1] === 'room.seats'));
  assert.equal((await service.findCinemaById(7)).cinemaId, 7);
  state.cinema = null;
  await assert.rejects(service.findCinemaById(7), /không tồn tại/);
});

test('cinema update checks stale timestamp and disables rather than deletes', async () => {
  const { service, writes } = fixture();
  assert.equal((await service.createCinema({ cinemaName: 'New' })).cinemaName, 'New');
  await assert.rejects(service.updateCinema(7, { expectedUpdatedAt: '2025-01-01T00:00:00Z' }), /đã được người khác cập nhật/);
  await service.updateCinema(7, { cinemaName: 'Updated', expectedUpdatedAt: '2026-01-01T00:00:00Z' });
  assert.deepEqual(writes[0]?.data, { cinemaName: 'Updated' });
  await service.deleteCinema(7);
  assert.deepEqual(writes[1]?.data, { status: 'INACTIVE' });
});

test('create room validates capacity and creates 120 uniquely typed seats', async () => {
  const { service, writes } = fixture();
  await assert.rejects(service.createRoom(7, { roomName: 'X', totalSeats: 90 }), /120 ghế/);
  await assert.rejects(service.createRoom(7, { roomName: '   ' }), /tên phòng/);
  const room = await service.createRoom(7, { roomName: '  Room 1  ' });
  assert.equal(room.roomName, 'Room 1');
  assert.equal(room.totalSeats, 120);
  const seats = writes.find(w => w.entity === Seat)?.data as { seatLabel: string; seatTypeId: number; roomId: number }[];
  assert.equal(seats.length, 120);
  assert.equal(new Set(seats.map(s => s.seatLabel)).size, 120);
  assert.deepEqual([...new Set(seats.map(s => s.seatTypeId))], [1, 2, 3]);
  assert.ok(seats.every(s => s.roomId === 12));
  assert.equal(seats.filter(s => s.seatTypeId === 1).length, 36);
  assert.equal(seats.filter(s => s.seatTypeId === 2).length, 72);
  assert.equal(seats.filter(s => s.seatTypeId === 3).length, 12);
});

test('room update preserves capacity and validates ownership and name', async () => {
  const { service, state, writes } = fixture();
  await assert.rejects(service.findRoomById(99, 12), /không thuộc/);
  await assert.rejects(service.updateRoom(7, 12, { totalSeats: 80 }), /sức chứa/);
  await assert.rejects(service.updateRoom(7, 12, { roomName: ' ' }), /tên phòng/);
  await service.updateRoom(7, 12, {});
  assert.equal(writes.length, 0);
  await service.updateRoom(7, 12, { roomName: '  VIP  ', roomType: 'VIP', status: 'ACTIVE' });
  assert.deepEqual(writes[0]?.data, { roomName: 'VIP', roomType: 'VIP', status: 'ACTIVE' });
  await service.deleteRoom(7, 12);
  assert.deepEqual(writes[1]?.data, { status: 'INACTIVE' });
  state.room = null;
  await assert.rejects(service.findRoomById(7, 12), /không tồn tại/);
});

test('room seat generation is idempotent and refuses partial layouts or inactive rooms', async () => {
  const { service, state, room, writes } = fixture();
  state.count = 120;
  assert.deepEqual(await service.generateRoomSeats(7, 12), { created: 0, total: 120 });
  state.count = 10;
  await assert.rejects(service.generateRoomSeats(7, 12), /không ghi đè/);
  state.count = 0;
  room.totalSeats = 90;
  await assert.rejects(service.generateRoomSeats(7, 12), /không ghi đè/);
  room.totalSeats = 0;
  room.status = 'INACTIVE';
  await assert.rejects(service.generateRoomSeats(7, 12), /không hoạt động/);
  room.status = 'ACTIVE';
  state.room = null;
  await assert.rejects(service.generateRoomSeats(7, 12), /không tồn tại/);
  state.room = room;
  assert.equal(writes.length, 0);
  state.existingTypes = true;
  assert.deepEqual(await service.generateRoomSeats(7, 12), { created: 120, total: 120 });
  assert.equal(writes.filter(w => w.entity === SeatType).length, 0);
  assert.deepEqual(writes.at(-1)?.data, { totalSeats: 120 });
});

test('room seat generation rejects failed locks and inactive seat types before seat write', async () => {
  const { service, state, writes } = fixture();
  state.lock = -1;
  await assert.rejects(service.generateRoomSeats(7, 12), /đang được cập nhật/);
  state.lock = 0;
  state.inactiveType = true;
  await assert.rejects(service.generateRoomSeats(7, 12), /vô hiệu hóa/);
  assert.equal(writes.filter(w => w.entity === Seat).length, 0);
});

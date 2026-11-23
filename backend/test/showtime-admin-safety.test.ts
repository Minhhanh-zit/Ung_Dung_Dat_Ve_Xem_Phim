import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { DataSource, EntityManager, FindManyOptions, Repository } from 'typeorm';
import { ShowtimeService } from '../src/showtime/showtime.service';
import { Showtime } from '../src/entities/showtime.entity';
import { Room } from '../src/entities/room.entity';
import { ShowtimeSeat } from '../src/entities/showtime-seat.entity';
import { Seat } from '../src/entities/seat.entity';
import type { CreateShowtimeDto } from '../src/showtime/dto/create-showtime.dto';

function serviceWithRepo(repo: Partial<Repository<Showtime>>, db?: DataSource): ShowtimeService {
  return new ShowtimeService(
    repo as Repository<Showtime>,
    {} as Repository<ShowtimeSeat>,
    {} as Repository<Room>,
    {} as Repository<Seat>,
    db ?? ({} as DataSource),
  );
}

test('admin gets all showtimes while public endpoint filters out CANCELLED', async () => {
  const observed: Array<FindManyOptions<Showtime>> = [];
  const repo = {
    find: async (opts: FindManyOptions<Showtime>) => {
      observed.push(opts);
      return [];
    },
  } as Partial<Repository<Showtime>>;
  const service = serviceWithRepo(repo);

  await service.findAllForAdmin();
  await service.findAll();

  assert.equal(observed.length, 2);
  assert.equal(observed[0]?.where, undefined, 'Admin query must not hide cancelled showtimes');
  assert.ok(observed[1]?.where, 'Public query must continue filtering cancelled showtimes');
});

test('do not regenerate seats for CANCELLED showtimes', async () => {
  const repo = {
    findOne: async () => ({
      showtimeId: 17,
      roomId: 2,
      status: 'CANCELLED',
      basePrice: 75000,
      room: { status: 'ACTIVE', cinema: { status: 'ACTIVE' } },
    } as Showtime),
  } as Partial<Repository<Showtime>>;
  await assert.rejects(serviceWithRepo(repo).generateSeats(17), /đã hủy/);
});

test('do not regenerate seats for a room under maintenance', async () => {
  const repo = {
    findOne: async () => ({
      showtimeId: 18,
      roomId: 2,
      status: 'OPEN',
      basePrice: 75000,
      room: { status: 'MAINTENANCE', cinema: { status: 'ACTIVE' } },
    } as Showtime),
  } as Partial<Repository<Showtime>>;
  await assert.rejects(serviceWithRepo(repo).generateSeats(18), /không hoạt động|bảo trì/);
});

test('do not create a new showtime in an INACTIVE cinema', async () => {
  const database = {
    transaction: async (work: (m: EntityManager) => Promise<Showtime>) => work({
      findOne: async () => ({ status: 'ACTIVE', cinema: { status: 'INACTIVE' } }),
    } as unknown as EntityManager),
  } as unknown as DataSource;
  const dto = {
    movieId: 1,
    roomId: 2,
    startTime: '2027-05-14T14:00:00+07:00',
    endTime: '2027-05-14T16:00:00+07:00',
    basePrice: 100000,
  } as CreateShowtimeDto;
  await assert.rejects(serviceWithRepo({},database).create(dto), /không hoạt động|bảo trì/);
});

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { CORE_CINEMA_NAMES } from '../common/catalog-scope';
import { ConfigService } from '@nestjs/config';
import { findCinemasNearby, type OriginInput } from './cinema-distance';
import { Cinema } from '../entities/cinema.entity';
import { Room } from '../entities/room.entity';
import { Seat } from '../entities/seat.entity';
import { SeatType } from '../entities/seat-type.entity';
import { standardRoomLayout } from './standard-room-layout';
import { assertNotStale } from '../common/utils/optimistic-lock.util';

@Injectable()
export class CinemaService {
  constructor(
    @InjectRepository(Cinema) private cinemaRepo: Repository<Cinema>,
    @InjectRepository(Room) private roomRepo: Repository<Room>,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async findNearestCinemas(input: OriginInput) {
    const rows = await this.findAllCinemas();
    return findCinemasNearby(rows, input,
      this.configService?.get<string>('GOOGLE_MAPS_ROUTES_API_KEY'));
  }

  findAllCinemas() {
    return this.cinemaRepo.find({
      where: { status: 'ACTIVE', cinemaName: In(CORE_CINEMA_NAMES) },
      order: { cinemaName: 'ASC' },
    });
  }

  async findCinemaById(id: number) {
    const cinema = await this.cinemaRepo.findOne({ where: { cinemaId: id } });
    if (!cinema) throw new NotFoundException(`Cinema #${id} không tồn tại`);
    return cinema;
  }

  findRoomsByCinema(cinemaId: number) {
    return this.roomRepo.find({
      where: { cinemaId, status: 'ACTIVE' },
    });
  }

  async createCinema(data: Partial<Cinema>) {
    const cinema = this.cinemaRepo.create(data);
    return this.cinemaRepo.save(cinema);
  }

  async updateCinema(
    id: number,
    data: Partial<Cinema> & { expectedUpdatedAt?: string },
  ) {
    const existing = await this.findCinemaById(id);

    const { expectedUpdatedAt, ...patch } = data;
    assertNotStale(existing.updatedAt, expectedUpdatedAt, 'Rạp này');

    await this.cinemaRepo.update({ cinemaId: id }, patch);
    return this.findCinemaById(id);
  }

  async deleteCinema(id: number) {
    await this.findCinemaById(id);
    await this.cinemaRepo.update({ cinemaId: id }, { status: 'INACTIVE' });
    return { message: `Cinema #${id} đã bị vô hiệu hóa` };
  }


  async adminFindRoomsByCinema(cinemaId: number) {
    await this.findCinemaById(cinemaId);
    return this.roomRepo.createQueryBuilder('room')
      .where('room.cinemaId = :cinemaId', { cinemaId })
      .loadRelationCountAndMap('room.actualSeats', 'room.seats')
      .orderBy('room.roomName', 'ASC')
      .getMany();
  }

  async findRoomById(cinemaId: number, roomId: number) {
    const room = await this.roomRepo.findOne({ where: { roomId } });
    if (!room) throw new NotFoundException(`Room #${roomId} không tồn tại`);
    if (room.cinemaId !== cinemaId) {
      throw new BadRequestException(
        `Room #${roomId} không thuộc rạp #${cinemaId}`,
      );
    }
    return room;
  }

  async createRoom(cinemaId: number, data: Partial<Room>) {
    await this.findCinemaById(cinemaId);
    if (data.totalSeats !== undefined && data.totalSeats !== 120) {
      throw new BadRequestException('Phòng mới sử dụng sơ đồ cố định 120 ghế');
    }
    const roomName = data.roomName?.trim();
    if (!roomName) throw new BadRequestException('Vui lòng nhập tên phòng');
    return this.roomRepo.manager.transaction(async (manager) => {
      const room = await manager.save(Room, manager.create(Room, {
        roomName,
        roomType: data.roomType ?? 'STANDARD',
        cinemaId,
        totalSeats: 120,
        status: data.status ?? 'ACTIVE',
      }));
      await this.insertStandardSeats(manager, room.roomId);
      return room;
    });
  }

  async updateRoom(cinemaId: number, roomId: number, data: Partial<Room>) {
    const existing = await this.findRoomById(cinemaId, roomId);
    if (data.totalSeats !== undefined && data.totalSeats !== existing.totalSeats) {
      throw new BadRequestException('Không thể sửa sức chứa độc lập với sơ đồ ghế');
    }
    const patch: Partial<Room> = {};
    if (data.roomName !== undefined) {
      patch.roomName = data.roomName.trim();
      if (!patch.roomName) throw new BadRequestException('Vui lòng nhập tên phòng');
    }
    if (data.roomType !== undefined) patch.roomType = data.roomType;
    if (data.status !== undefined) patch.status = data.status;
    if (Object.keys(patch).length) await this.roomRepo.update({ roomId }, patch);
    return this.findRoomById(cinemaId, roomId);
  }

  private async lock(manager: EntityManager, resource: string) {
    const result = await manager.query(
      `DECLARE @r int; EXEC @r = sys.sp_getapplock
       @Resource=@0, @LockMode='Exclusive', @LockOwner='Transaction',
       @LockTimeout=10000; SELECT @r AS result;`, [resource],
    ) as Array<{ result: number }>;
    if (Number(result[0]?.result ?? -999) < 0) {
      throw new ConflictException('Dữ liệu đang được cập nhật, vui lòng thử lại');
    }
  }

  private async insertStandardSeats(manager: EntityManager, roomId: number) {
    // Serialize type provisioning for fresh databases; existing prices/types are preserved.
    await this.lock(manager, 'CineHunt.StandardRoomSeatTypes');
    const definitions = [
      { typeCode: 'CH_STANDARD', typeName: 'Ghế thường' },
      { typeCode: 'CH_VIP', typeName: 'Ghế VIP' },
      { typeCode: 'CH_COUPLE', typeName: 'Ghế đôi' },
    ];
    const typeIds = new Map<string, number>();
    for (const definition of definitions) {
      const existing = await manager.findOne(SeatType, { where: { typeCode: definition.typeCode } });
      if (existing && existing.status !== 'ACTIVE') {
        throw new ConflictException(`Loại ghế ${definition.typeCode} đang bị vô hiệu hóa`);
      }
      const type = existing ?? await manager.save(SeatType, manager.create(SeatType, {
        ...definition, priceMultiplier: 1, status: 'ACTIVE',
      }));
      typeIds.set(type.typeCode, type.seatTypeId);
    }
    const seats = standardRoomLayout().map(({ typeCode, ...position }) => {
      const seatTypeId = typeIds.get(typeCode);
      if (seatTypeId === undefined) throw new ConflictException('Thiếu loại ghế');
      return manager.create(Seat, { ...position, roomId, seatTypeId, status: 'ACTIVE' });
    });
    await manager.save(Seat, seats, { chunk: 120 });
    return seats.length;
  }

  async generateRoomSeats(cinemaId: number, roomId: number) {
    return this.roomRepo.manager.transaction(async (manager) => {
      await this.lock(manager, `CineHunt.ShowtimeRoom.${roomId}`);
      const room = await manager.findOne(Room, { where: { roomId, cinemaId } });
      if (!room) throw new NotFoundException('Phòng không tồn tại trong rạp này');
      if (room.status !== 'ACTIVE') throw new ConflictException('Phòng không hoạt động');
      const existing = await manager.count(Seat, { where: { roomId } });
      if (existing === 120) return { created: 0, total: existing };
      if (existing > 0 || ![0, 120].includes(room.totalSeats)) {
        throw new ConflictException('Phòng đã có sơ đồ hoặc sức chứa khác 120; không ghi đè ghế cũ');
      }
      const created = await this.insertStandardSeats(manager, roomId);
      await manager.update(Room, { roomId }, { totalSeats: created });
      return { created, total: created };
    });
  }

  async deleteRoom(cinemaId: number, roomId: number) {
    await this.findRoomById(cinemaId, roomId);
    await this.roomRepo.update({ roomId }, { status: 'INACTIVE' });
    return { success: true, message: `Room #${roomId} đã bị vô hiệu hoá` };
  }
}

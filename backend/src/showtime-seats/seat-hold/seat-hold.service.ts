import { completeCoupleSelection, couplePartner } from '../../showtime/couple-pair'; // CINEHUNT_COUPLE_PAIR_V1
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { SeatHold, SeatHoldStatus } from '../../entities/seat-hold.entity';
import { ShowtimeSeat } from '../../entities/showtime-seat.entity';
import { HoldSeatDto, HoldSeatsDto, HoldResponseDto } from './dto';

@Injectable()
export class SeatHoldService {
  constructor(
    @InjectRepository(SeatHold)
    private readonly seatHoldRepository: Repository<SeatHold>,
    @InjectRepository(ShowtimeSeat)
    private readonly showtimeSeatRepository: Repository<ShowtimeSeat>,
    private readonly dataSource: DataSource,
  ) {}

  async holdSingleSeat(userId: number, dto: HoldSeatDto): Promise<HoldResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { showtimeSeatId, holdMinutes = 10 } = dto;

      const showtimeSeat = await queryRunner.manager.findOne(ShowtimeSeat, {
        where: { showtimeSeatId },
        relations: ['showtime', 'showtime.movie', 'showtime.room', 'showtime.room.cinema', 'seat', 'seat.seatType'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!showtimeSeat) throw new NotFoundException('Ghế không tồn tại');
      if (!completeCoupleSelection([showtimeSeat])) throw new BadRequestException('Ghế đôi phải được giữ cả cặp bằng hold-many');

      if (showtimeSeat.status !== 'AVAILABLE') {
        throw new BadRequestException('Ghế không còn trống');
      }

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + holdMinutes);

      await queryRunner.manager.update(ShowtimeSeat, { showtimeSeatId }, {
        status: 'HELD',
        heldByUserId: userId,
        holdExpiresAt: expiresAt,
      });

      const hold = queryRunner.manager.create(SeatHold, {
        userId,
        showtimeSeatId,
        expiresAt,
        status: SeatHoldStatus.ACTIVE,
      });

      let savedHold: SeatHold;
      try {
        savedHold = await queryRunner.manager.save(SeatHold, hold);
      } catch (err: any) {
        if (err?.number === 2601 || err?.number === 2627 || err?.code === 'ER_DUP_ENTRY') {
          throw new ConflictException('Ghế đang được giữ bởi người dùng khác');
        }
        throw err;
      }

      await queryRunner.commitTransaction();

      return {
        holdId: savedHold.holdId,
        holdToken: savedHold.holdToken,
        expiresAt: savedHold.expiresAt,
        status: savedHold.status,
        showtimeSeatId,
        seatLabel: showtimeSeat.seat?.seatLabel ??
          `${showtimeSeat.seat?.seatRow ?? ''}${showtimeSeat.seat?.seatNumber ?? ''}`,
        price: Number(showtimeSeat.price),
        showtimeInfo: {
          movieTitle: showtimeSeat.showtime?.movie?.title ?? '',
          startTime: showtimeSeat.showtime?.startTime,
          cinemaName: showtimeSeat.showtime?.room?.cinema?.cinemaName,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async holdMultipleSeats(userId: number, dto: HoldSeatsDto): Promise<HoldResponseDto[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { showtimeSeatIds, holdMinutes = 10 } = dto;

      if (!showtimeSeatIds || showtimeSeatIds.length === 0) {
        throw new BadRequestException('Danh sách ghế không hợp lệ');
      }

      const showtimeSeats = await queryRunner.manager.find(ShowtimeSeat, {
        where: { showtimeSeatId: In(showtimeSeatIds) },
        relations: ['showtime', 'showtime.movie', 'showtime.room', 'showtime.room.cinema', 'seat', 'seat.seatType'],
        lock: { mode: 'pessimistic_write' },
      });

      if (showtimeSeats.length !== showtimeSeatIds.length) {
        throw new NotFoundException('Một hoặc nhiều ghế không tồn tại');
      }

      const showtimeId = showtimeSeats[0].showtimeId;
      const sameShowtime = showtimeSeats.every((seat) => seat.showtimeId === showtimeId);

      if (!sameShowtime) {
        throw new BadRequestException('Tất cả ghế phải thuộc cùng một suất chiếu');
      }

      if (!completeCoupleSelection(showtimeSeats)) throw new BadRequestException('Vui lòng chọn đủ hai chỗ của mỗi ghế đôi');
      if (showtimeSeats.length > 8) throw new BadRequestException('Tối đa 8 chỗ');
      const notAvailable = showtimeSeats.filter((seat) => seat.status !== 'AVAILABLE');

      if (notAvailable.length > 0) {
        throw new BadRequestException(
          `Các ghế không còn trống: ${notAvailable
            .map((seat) => seat.seat?.seatLabel ?? `${seat.seat?.seatRow ?? ''}${seat.seat?.seatNumber ?? ''}`)
            .join(', ')}`,
        );
      }

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + holdMinutes);

      const responses: HoldResponseDto[] = [];

      for (const showtimeSeat of showtimeSeats) {
        await queryRunner.manager.update(ShowtimeSeat, { showtimeSeatId: showtimeSeat.showtimeSeatId }, {
          status: 'HELD',
          heldByUserId: userId,
          holdExpiresAt: expiresAt,
        });

        const hold = queryRunner.manager.create(SeatHold, {
          userId,
          showtimeSeatId: showtimeSeat.showtimeSeatId,
          expiresAt,
          status: SeatHoldStatus.ACTIVE,
        });

        let savedHold: SeatHold;
        try {
          savedHold = await queryRunner.manager.save(SeatHold, hold);
        } catch (err: any) {
          if (err?.number === 2601 || err?.number === 2627 || err?.code === 'ER_DUP_ENTRY') {
            throw new ConflictException(
              `Ghế ${showtimeSeat.seat?.seatLabel ?? showtimeSeat.showtimeSeatId} đang được giữ bởi người dùng khác`,
            );
          }
          throw err;
        }

        responses.push({
          holdId: savedHold.holdId,
          holdToken: savedHold.holdToken,
          expiresAt: savedHold.expiresAt,
          status: savedHold.status,
          showtimeSeatId: showtimeSeat.showtimeSeatId,
          seatLabel: showtimeSeat.seat?.seatLabel ??
            `${showtimeSeat.seat?.seatRow ?? ''}${showtimeSeat.seat?.seatNumber ?? ''}`,
          price: Number(showtimeSeat.price),
          showtimeInfo: {
            movieTitle: showtimeSeat.showtime?.movie?.title ?? '',
            startTime: showtimeSeat.showtime?.startTime,
            cinemaName: showtimeSeat.showtime?.room?.cinema?.cinemaName,
          },
        });
      }

      await queryRunner.commitTransaction();
      return responses;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getUserHolds(userId: number) {
    const holds = await this.seatHoldRepository.find({
      where: { userId, status: SeatHoldStatus.ACTIVE },
      relations: [
        'showtimeSeat',
        'showtimeSeat.seat',
        'showtimeSeat.showtime',
        'showtimeSeat.showtime.movie',
        'showtimeSeat.showtime.room',
        'showtimeSeat.showtime.room.cinema',
      ],
      order: { createdAt: 'DESC' },
    });

    return holds.map((hold) => ({
      holdId: hold.holdId,
      holdToken: hold.holdToken,
      expiresAt: hold.expiresAt,
      status: hold.status,
      showtimeSeatId: hold.showtimeSeat?.showtimeSeatId,
      seatLabel:
        hold.showtimeSeat?.seat?.seatLabel ??
        `${hold.showtimeSeat?.seat?.seatRow ?? ''}${hold.showtimeSeat?.seat?.seatNumber ?? ''}`,
      price: hold.showtimeSeat ? Number(hold.showtimeSeat.price) : 0,
      showtimeInfo: hold.showtimeSeat?.showtime
        ? {
            movieTitle: hold.showtimeSeat.showtime.movie?.title ?? '',
            startTime: hold.showtimeSeat.showtime.startTime,
            cinemaName: hold.showtimeSeat.showtime.room?.cinema?.cinemaName,
          }
        : undefined,
    }));
  }

  async getActiveHoldsForSeats(
    userId: number,
    showtimeSeatIds: number[],
  ): Promise<SeatHold[]> {
    if (!showtimeSeatIds.length) return [];

    const now = new Date();
    const holds = await this.seatHoldRepository.find({
      where: {
        userId,
        showtimeSeatId: In(showtimeSeatIds),
        status: SeatHoldStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });

    const latestBySeat = new Map<number, SeatHold>();
    for (const hold of holds) {
      if (new Date(hold.expiresAt) <= now) continue;
      if (!latestBySeat.has(hold.showtimeSeatId)) {
        latestBySeat.set(hold.showtimeSeatId, hold);
      }
    }

    return [...latestBySeat.values()];
  }

  async getHoldDetails(holdId: string, userId: number) {
    const hold = await this.seatHoldRepository.findOne({
      where: { holdId, userId },
      relations: [
        'showtimeSeat',
        'showtimeSeat.seat',
        'showtimeSeat.showtime',
        'showtimeSeat.showtime.movie',
        'showtimeSeat.showtime.room',
        'showtimeSeat.showtime.room.cinema',
      ],
    });

    if (!hold) throw new NotFoundException('Không tìm thấy thông tin hold');

    return {
      holdId: hold.holdId,
      holdToken: hold.holdToken,
      expiresAt: hold.expiresAt,
      releasedAt: hold.releasedAt,
      status: hold.status,
      showtimeSeatId: hold.showtimeSeat?.showtimeSeatId,
      seatLabel:
        hold.showtimeSeat?.seat?.seatLabel ??
        `${hold.showtimeSeat?.seat?.seatRow ?? ''}${hold.showtimeSeat?.seat?.seatNumber ?? ''}`,
      price: hold.showtimeSeat ? Number(hold.showtimeSeat.price) : 0,
      showtimeInfo: hold.showtimeSeat?.showtime
        ? {
            movieTitle: hold.showtimeSeat.showtime.movie?.title ?? '',
            startTime: hold.showtimeSeat.showtime.startTime,
            cinemaName: hold.showtimeSeat.showtime.room?.cinema?.cinemaName,
          }
        : undefined,
    };
  }

  async releaseHold(holdId: string, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const snapshot = await queryRunner.manager.findOne(SeatHold, {
        where: { holdId, userId, status: SeatHoldStatus.ACTIVE },
      });

      if (!snapshot) {
        throw new NotFoundException('Không tìm thấy hold hợp lệ');
      }

      const first = await queryRunner.manager.findOne(ShowtimeSeat, {
        where: { showtimeSeatId: snapshot.showtimeSeatId }, relations: ['seat', 'seat.seatType'],
      });
      if (!first) throw new NotFoundException('Ghế của hold không còn tồn tại');
      const ids = [first.showtimeSeatId];
      const couple = first.seat?.seatType?.typeCode === 'CH_COUPLE';
      if (couple) {
        const partner = await queryRunner.manager.findOne(ShowtimeSeat, {
          where: { showtimeId: first.showtimeId, seat: { seatRow: first.seat.seatRow, seatNumber: couplePartner(first.seat.seatNumber), seatType: { typeCode: 'CH_COUPLE' } } },
          relations: ['seat', 'seat.seatType'],
        });
        if (partner) ids.push(partner.showtimeSeatId);
      }
      // Same seat -> hold locking order as booking; never release somebody else's hold.
      for (const id of ids.sort((a,b)=>a-b)) {
        const locked = await queryRunner.manager.findOne(ShowtimeSeat, { where: { showtimeSeatId: id }, lock: { mode: 'pessimistic_write' } });
        if (!locked) throw new NotFoundException('Ghế không còn tồn tại');
      }
      const holds = await queryRunner.manager.find(SeatHold, {
        where: { showtimeSeatId: In(ids), userId, status: SeatHoldStatus.ACTIVE },
      });
      if (!holds.some(h=>String(h.holdId)===String(holdId))) throw new ConflictException('Hold đã được xử lý');
      let releasedSeat = false;
      for (const hold of holds.sort((a,b)=>Number(a.showtimeSeatId)-Number(b.showtimeSeatId))) {
        const cancelled = await queryRunner.manager.update(SeatHold,
          { holdId: hold.holdId, userId, status: SeatHoldStatus.ACTIVE },
          { status: SeatHoldStatus.CANCELLED, releasedAt: new Date() });
        if ((cancelled.affected ?? 0) !== 1) throw new ConflictException('Hold đã thay đổi trạng thái');
        const releasedRows = (await queryRunner.manager.query(
        `
          UPDATE ss
          SET
            ss.status = 'AVAILABLE',
            ss.held_by_user_id = NULL,
            ss.hold_expires_at = NULL
          OUTPUT INSERTED.showtime_seat_id AS showtime_seat_id
          FROM dbo.showtime_seats AS ss WITH (UPDLOCK, ROWLOCK)
          WHERE ss.showtime_seat_id = @0
            AND ss.status = 'HELD'
            AND ss.held_by_user_id = @1
            AND NOT EXISTS (
              SELECT 1
              FROM dbo.seat_holds AS active_hold
              WHERE active_hold.showtime_seat_id = ss.showtime_seat_id
                AND active_hold.status = 'ACTIVE'
            )
            AND NOT EXISTS (
              SELECT 1
              FROM dbo.booking_details AS bd
              INNER JOIN dbo.booking_orders AS bo
                ON bo.booking_id = bd.booking_id
              WHERE bd.showtime_seat_id = ss.showtime_seat_id
                AND bd.status = 'ACTIVE'
                AND bo.status IN ('PENDING_PAYMENT', 'PAID', 'ISSUED', 'CONFIRMED')
            );
        `,
        [hold.showtimeSeatId, userId],
      )) as Array<{ showtime_seat_id: number }>;

        if (couple && releasedRows.length !== 1) throw new ConflictException('Không thể nhả đủ cặp ghế');
        if (String(hold.holdId)===String(holdId)) releasedSeat = releasedRows.length === 1;
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        holdId,
        releasedSeat,
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, In } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { BookingOrder } from '../entities/booking-order.entity';
import { BookingDetail } from '../entities/booking-detail.entity';
import { ShowtimeSeat } from '../entities/showtime-seat.entity';
import { SeatHold, SeatHoldStatus } from '../entities/seat-hold.entity';
import { Ticket } from '../entities/ticket.entity';
import { Voucher } from '../entities/voucher.entity';
import { BookingService } from '../booking/booking.service';
import { COUNTER_PAYMENT_GRACE_MINUTES } from '../booking/booking-state.policy';
import { PaymentRepository } from './payment.repository';
import { CreatePaymentDto, PaymentResponse } from './dto';
import { hasVoucherUsageRemaining } from './voucher-usage.policy';
import { canSwitchPendingPaymentMethod } from './payment-method-switch.policy';

type CounterPaymentCheckRow = {
  booking_id: string; booking_status: string; payment_id: string | null;
  payment_method: string | null; payment_status: string | null; can_check_in: boolean | number;
};

@Injectable()
export class PaymentService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly bookingService: BookingService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async createPayment(userId: number, dto: CreatePaymentDto): Promise<PaymentResponse> {
    if (dto.paymentMethod === 'MOCK' && !this.isDemoPaymentEnabled()) {
      throw new ForbiddenException('Thanh toán giả lập chỉ được bật trong môi trường phát triển.');
    }
    const validatedBooking = await this.bookingService.validateBookingForPayment(
      dto.bookingId, userId, { skipExpiryCheck: true },
    );
    const bookingId = String(validatedBooking.bookingId);
    return this.dataSource.transaction(async (manager) => {
      const booking = await manager.findOne(BookingOrder, {
        where: { bookingId, userId }, lock: { mode: 'pessimistic_write' },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy booking');
      if (booking.status !== 'PENDING_PAYMENT') {
        throw new BadRequestException(`Booking đang ở trạng thái ${booking.status}, không thể thanh toán`);
      }
      const existingPending = await manager.findOne(Payment, {
        where: { bookingId, paymentStatus: 'PENDING' }, lock: { mode: 'pessimistic_write' },
      });
      if (existingPending?.paymentMethod === 'CASH' && dto.paymentMethod === 'CASH') {
        const retryWindowRows = (await manager.query(
          `SELECT TOP (1) CAST(CASE WHEN DATEADD(MINUTE, @1, st.start_time) >
             CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS DATETIME2)
             THEN 1 ELSE 0 END AS BIT) AS within_grace
           FROM dbo.showtimes AS st WHERE st.showtime_id = @0;`,
          [booking.showtimeId, COUNTER_PAYMENT_GRACE_MINUTES],
        )) as Array<{ within_grace: boolean | number }>;
        if (!Boolean(retryWindowRows[0]?.within_grace)) {
          throw new BadRequestException('Đơn thanh toán tại quầy đã quá thời gian giữ');
        }
        return this.toPaymentResponse(existingPending);
      }
      if (booking.expiresAt && new Date(booking.expiresAt) <= new Date()) {
        throw new BadRequestException('Booking đã hết hạn thanh toán');
      }
      if (existingPending) {
        if (existingPending.paymentMethod === dto.paymentMethod) return this.toPaymentResponse(existingPending);
        if (!canSwitchPendingPaymentMethod(existingPending.paymentMethod, dto.paymentMethod)) {
          throw new BadRequestException('Đơn đã chọn thanh toán tiền mặt tại quầy. Hãy hủy đơn nếu muốn đổi phương thức thanh toán.');
        }
        const reason = `User switched payment method from ${existingPending.paymentMethod} to ${dto.paymentMethod}`;
        await manager.update(Payment, { paymentId: existingPending.paymentId, paymentStatus: 'PENDING' }, {
          paymentStatus: 'FAILED', failedReason: reason, providerResponse: reason,
        });
      }
      const payment = await manager.save(Payment, manager.create(Payment, {
        bookingId, paymentMethod: dto.paymentMethod, provider: dto.provider ?? null,
        amount: Number(booking.totalAmount), transactionCode: this.paymentRepository.generatePaymentCode(),
        paymentStatus: 'PENDING', providerResponse: null, failedReason: null, paidAt: null,
      }));
      return this.toPaymentResponse(payment);
    });
  }

  private toPaymentResponse(payment: Payment): PaymentResponse {
    return {
      paymentId: payment.paymentId, bookingId: payment.bookingId, amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod, paymentStatus: payment.paymentStatus,
      transactionCode: payment.transactionCode ?? '', createdAt: payment.createdAt,
    };
  }

  async confirmPendingCashPaymentForCheckIn(bookingCode: string) {
    const normalized = String(bookingCode ?? '').trim().toUpperCase();
    if (!/^BK-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(normalized)) {
      throw new BadRequestException('Mã đơn tại quầy không hợp lệ');
    }
    const rows = (await this.dataSource.query(
      `SELECT TOP (1)
         CONVERT(VARCHAR(30), bo.booking_id) AS booking_id, bo.status AS booking_status,
         CONVERT(VARCHAR(30), latest_payment.payment_id) AS payment_id,
         latest_payment.payment_method, latest_payment.payment_status,
         CAST(CASE WHEN CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS DATETIME2)
           >= DATEADD(MINUTE, -30, st.start_time)
           AND CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS DATETIME2)
           < DATEADD(MINUTE, @1, st.start_time) THEN 1 ELSE 0 END AS BIT) AS can_check_in
       FROM dbo.booking_orders AS bo
       INNER JOIN dbo.showtimes AS st ON st.showtime_id = bo.showtime_id
       OUTER APPLY (SELECT TOP (1) p.payment_id, p.payment_method, p.payment_status
         FROM dbo.payments AS p WHERE p.booking_id = bo.booking_id
         ORDER BY p.created_at DESC, p.payment_id DESC) AS latest_payment
       WHERE bo.booking_code = @0;`,
      [normalized, COUNTER_PAYMENT_GRACE_MINUTES],
    )) as CounterPaymentCheckRow[];
    const row = rows[0];
    if (!row) throw new NotFoundException(`Đơn ${normalized} không tồn tại`);
    if (row.booking_status !== 'PENDING_PAYMENT') {
      return { confirmed: false, bookingId: row.booking_id, bookingStatus: row.booking_status };
    }
    if (!Boolean(row.can_check_in)) {
      throw new BadRequestException('Đơn tại quầy chỉ được xác nhận từ 30 phút trước đến 10 phút sau giờ chiếu');
    }
    if (row.payment_method !== 'CASH' || row.payment_status !== 'PENDING' || !row.payment_id) {
      throw new BadRequestException('Đơn này chưa được chọn thanh toán tiền mặt tại quầy');
    }
    await this.processPaymentSuccess(row.payment_id, { cashCollection: true });
    return { confirmed: true, bookingId: row.booking_id, paymentId: row.payment_id };
  }

  async processPaymentSuccess(
    paymentId: string,
    options: {
      allowExpiredCounterPayment?: boolean;
      cashCollection?: boolean;
      bankingProof?: { verifiedBy: number; bankReference: string };
    } = {},
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const paymentSnapshot = await queryRunner.manager.findOne(Payment, { where: { paymentId } });
      if (!paymentSnapshot) throw new NotFoundException('Không tìm thấy payment');
      const booking = await queryRunner.manager.findOne(BookingOrder, {
        where: { bookingId: paymentSnapshot.bookingId }, lock: { mode: 'pessimistic_write' },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy booking');
      if (booking.status !== 'PENDING_PAYMENT') {
        throw new BadRequestException('Booking không ở trạng thái chờ thanh toán');
      }
      const payment = await queryRunner.manager.findOne(Payment, {
        where: { paymentId }, lock: { mode: 'pessimistic_write' },
      });
      if (!payment) throw new NotFoundException('Không tìm thấy payment');
      if (payment.bookingId !== booking.bookingId) {
        throw new BadRequestException('Payment không thuộc booking đang xử lý');
      }
      if (payment.paymentStatus !== 'PENDING') {
        throw new BadRequestException(`Payment status là ${payment.paymentStatus}, chỉ PENDING mới được xử lý`);
      }
      if (options.cashCollection === true) {
        if (payment.paymentMethod !== 'CASH') {
          throw new BadRequestException('Chức năng này chỉ xác nhận tiền mặt tại quầy');
        }
        const rows = (await queryRunner.manager.query(
          `SELECT TOP (1) CAST(CASE WHEN DATEADD(MINUTE, @1, st.start_time) >
             CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS DATETIME2)
             THEN 1 ELSE 0 END AS BIT) AS within_grace
           FROM dbo.showtimes AS st WITH (HOLDLOCK) WHERE st.showtime_id = @0;`,
          [booking.showtimeId, COUNTER_PAYMENT_GRACE_MINUTES],
        )) as Array<{ within_grace: boolean | number }>;
        if (!Boolean(rows[0]?.within_grace)) {
          throw new BadRequestException('Đơn tiền mặt đã quá thời gian giữ tại quầy');
        }
      } else {
        // Compatibility for existing internal callers; public CASH collection uses cashCollection.
        const mayConfirmExpiredCounterPayment = options.allowExpiredCounterPayment === true
          && payment.paymentMethod === 'CASH' && payment.paymentStatus === 'PENDING';
        if (!mayConfirmExpiredCounterPayment && booking.expiresAt && new Date(booking.expiresAt) <= new Date()) {
          throw new BadRequestException('Booking đã hết hạn');
        }
      }
      if (payment.paymentMethod === 'BANKING') {
        const proof = options.bankingProof;
        if (!proof || !Number.isInteger(proof.verifiedBy) || proof.verifiedBy <= 0
          || !proof.bankReference?.trim() || proof.bankReference.trim().length < 6
          || proof.bankReference.trim().length > 100) {
          throw new BadRequestException('Chuyển khoản BANKING phải được STAFF/ADMIN đối chiếu giao dịch ngân hàng trước khi xác nhận.');
        }
      }
      if (Number(payment.amount) !== Number(booking.totalAmount)) {
        throw new BadRequestException('Số tiền payment không khớp tổng tiền booking');
      }
      const bookingDetails = await queryRunner.manager.find(BookingDetail, {
        where: { bookingId: booking.bookingId, status: 'ACTIVE' },
        relations: ['showtimeSeat', 'showtimeSeat.seat'],
      });
      if (!bookingDetails.length) throw new BadRequestException('Không tìm thấy ghế trong booking');
      if (booking.promotionId) {
        const voucher = await queryRunner.manager.findOne(Voucher, {
          where: { promotionId: booking.promotionId }, lock: { mode: 'pessimistic_write' },
        });
        if (!voucher) throw new BadRequestException('Voucher của booking không còn tồn tại');
        if (!hasVoucherUsageRemaining(voucher.usedCount, voucher.usageLimit)) {
          throw new BadRequestException('Voucher đã hết lượt sử dụng');
        }
        await queryRunner.manager.increment(Voucher, { promotionId: booking.promotionId }, 'usedCount', 1);
      }
      const proof = payment.paymentMethod === 'BANKING' ? options.bankingProof : undefined;
      if (proof) {
        const lockRows = (await queryRunner.manager.query(
          `DECLARE @result INT;
           EXEC @result = sys.sp_getapplock @Resource = @0, @LockMode = 'Exclusive',
             @LockOwner = 'Transaction', @LockTimeout = 10000;
           SELECT @result AS lock_result;`,
          [`CineHunt.BankRef.${proof.bankReference.trim().toUpperCase()}`],
        )) as Array<{ lock_result: number }>;
        if (Number(lockRows[0]?.lock_result ?? -999) < 0) {
          throw new BadRequestException('Không thể khóa mã giao dịch để đối soát. Hãy thử lại.');
        }
        const reused = (await queryRunner.manager.query(
          `SELECT TOP (1) payment_id FROM dbo.payments WITH (UPDLOCK, HOLDLOCK)
           WHERE payment_method = 'BANKING' AND payment_status = 'SUCCESS'
             AND CASE WHEN ISJSON(provider_response) = 1
               THEN UPPER(JSON_VALUE(provider_response, '$.bankReference')) ELSE NULL END = UPPER(@0)
             AND payment_id <> @1`,
          [proof.bankReference.trim(), paymentId],
        )) as Array<{ payment_id: string }>;
        if (reused.length) throw new BadRequestException('Mã giao dịch ngân hàng này đã xác nhận cho đơn khác.');
      }
      await queryRunner.manager.update(Payment, { paymentId }, {
        paymentStatus: 'SUCCESS', failedReason: null, paidAt: new Date(),
        providerResponse: proof ? JSON.stringify({
          verifiedManually: true, bankReference: proof.bankReference.trim(), verifiedBy: proof.verifiedBy,
        }) : payment.providerResponse,
      });
      const seatIds = bookingDetails.map((d) => d.showtimeSeatId);
      const soldResult = await queryRunner.manager.createQueryBuilder().update(ShowtimeSeat)
        .set({ status: 'SOLD', holdExpiresAt: null, heldByUserId: null })
        .where('showtime_seat_id IN (:...ids)', { ids: seatIds })
        .andWhere('status = :held', { held: 'HELD' })
        .andWhere('held_by_user_id = :userId', { userId: booking.userId }).execute();
      if ((soldResult.affected ?? 0) !== seatIds.length) {
        throw new BadRequestException('Một hoặc nhiều ghế không còn được giữ bởi booking này');
      }
      await queryRunner.manager.update(BookingOrder, { bookingId: booking.bookingId }, {
        status: 'PAID', paidAt: new Date(), issuedAt: new Date(),
      });
      await queryRunner.manager.update(SeatHold, {
        showtimeSeatId: In(seatIds), userId: booking.userId, status: SeatHoldStatus.CONVERTED,
      }, { status: SeatHoldStatus.CONFIRMED, releasedAt: new Date() });
      const tickets: any[] = [];
      for (const detail of bookingDetails) {
        const seatLabel = detail.showtimeSeat?.seat
          ? `${detail.showtimeSeat.seat.seatRow}${detail.showtimeSeat.seat.seatNumber}` : null;
        const existing = await queryRunner.manager.findOne(Ticket, {
          where: { bookingDetailId: String(detail.bookingDetailId) },
        });
        if (existing) {
          tickets.push({ ticketId: existing.ticketId, ticketCode: existing.ticketCode,
            qrCode: existing.qrCode, seatLabel, price: Number(detail.seatPrice) });
          continue;
        }
        const newTicket = await queryRunner.manager.save(queryRunner.manager.create(Ticket, {
          bookingDetailId: String(detail.bookingDetailId), ticketCode: this.paymentRepository.generateTicketCode(),
          qrCode: this.paymentRepository.generateQrCode(), ticketStatus: 'VALID', issuedAt: new Date(),
          checkedInAt: null, checkedInBy: null,
        }));
        tickets.push({ ticketId: newTicket.ticketId, ticketCode: newTicket.ticketCode,
          qrCode: newTicket.qrCode, seatLabel, price: Number(detail.seatPrice) });
      }
      if (proof) {
        await queryRunner.manager.query(
          `INSERT INTO dbo.audit_logs
            (user_id, action, entity_type, entity_id, old_values, new_values)
           VALUES (@0, 'BANK_TRANSFER_VERIFIED', 'Payment', @1, @2, @3)`,
          [proof.verifiedBy, paymentId, JSON.stringify({ paymentStatus: 'PENDING' }), JSON.stringify({
            paymentStatus: 'SUCCESS', bookingId: booking.bookingId, amount: Number(payment.amount),
            bankReference: proof.bankReference.trim(), verifiedBy: proof.verifiedBy,
          })],
        );
      }
      await queryRunner.commitTransaction();
      return { success: true, paymentId, bookingId: booking.bookingId, tickets };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async processPaymentFailed(paymentId: string) {
    const payment = await this.paymentRepository.findPaymentById(paymentId);
    if (!payment) throw new NotFoundException('Không tìm thấy payment');
    if (payment.paymentStatus === 'FAILED') {
      return { success: true, idempotent: true, paymentId, status: 'FAILED' };
    }
    if (payment.paymentStatus !== 'PENDING') {
      throw new BadRequestException(`Payment status là ${payment.paymentStatus}, chỉ PENDING mới được hủy`);
    }
    const booking = await this.dataSource.getRepository(BookingOrder).findOne({
      where: { bookingId: payment.bookingId },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy booking');
    try {
      await this.bookingService.cancelBooking(payment.bookingId, booking.userId);
    } catch (error) {
      const latest = await this.paymentRepository.findPaymentById(paymentId);
      if (latest?.paymentStatus === 'FAILED') {
        return { success: true, idempotent: true, paymentId, status: 'FAILED' };
      }
      throw error;
    }
    return { success: true, idempotent: false, paymentId, status: 'FAILED' };
  }

  async getPaymentByBookingId(bookingId: string) {
    const ref = String(bookingId ?? '').trim();
    if (!/^\d+$/.test(ref)) {
      throw new BadRequestException('bookingId phải là ID số của đơn đặt vé (không phải mã BK-xxx)');
    }
    const payment = await this.paymentRepository.findLatestByBookingId(ref);
    if (!payment) throw new NotFoundException('Không tìm thấy payment của booking');
    return { paymentId: payment.paymentId, bookingId: payment.bookingId, amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod, paymentStatus: payment.paymentStatus,
      transactionCode: payment.transactionCode, failedReason: payment.failedReason,
      paidAt: payment.paidAt, createdAt: payment.createdAt };
  }

  private isDemoPaymentEnabled(): boolean {
    return this.configService.get<string>('NODE_ENV') !== 'production'
      && this.configService.get<string>('ALLOW_DEMO_PAYMENT') === 'true';
  }
}

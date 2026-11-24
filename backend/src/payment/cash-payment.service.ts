import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentService } from './payment.service';
import { COUNTER_PAYMENT_GRACE_MINUTES } from '../booking/booking-state.policy';

type CashPaymentRow = {
  payment_method: string;
  payment_status: string;
  booking_status: string;
  within_grace: boolean | number;
};

@Injectable()
export class CashPaymentService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly paymentService: PaymentService,
  ) {}

  async confirm(paymentId: string) {
    if (!/^[1-9]\d*$/.test(paymentId)) {
      throw new BadRequestException('paymentId phải là ID số dương');
    }

    const rows = (await this.dataSource.query(
      `SELECT TOP (1)
         p.payment_method, p.payment_status, bo.status AS booking_status,
         CAST(CASE WHEN DATEADD(MINUTE, @1, st.start_time) >
           CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS DATETIME2)
           THEN 1 ELSE 0 END AS BIT) AS within_grace
       FROM dbo.payments AS p
       INNER JOIN dbo.booking_orders AS bo ON bo.booking_id = p.booking_id
       INNER JOIN dbo.showtimes AS st ON st.showtime_id = bo.showtime_id
       WHERE p.payment_id = @0;`,
      [paymentId, COUNTER_PAYMENT_GRACE_MINUTES],
    )) as CashPaymentRow[];

    const payment = rows[0];
    if (!payment) {
      throw new NotFoundException('Không tìm thấy giao dịch hoặc suất chiếu của đơn');
    }
    if (payment.payment_method !== 'CASH') {
      throw new BadRequestException('Chức năng này chỉ xác nhận tiền mặt tại quầy');
    }
    if (payment.payment_status !== 'PENDING' || payment.booking_status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Đơn hoặc giao dịch không còn chờ thanh toán');
    }
    if (!Boolean(payment.within_grace)) {
      throw new BadRequestException('Đơn tiền mặt đã quá thời gian giữ tại quầy');
    }

    // Existing transaction re-locks booking/payment and validates amount and seats.
    // Cash collection is independent of check-in and uses the counter deadline.
    return this.paymentService.processPaymentSuccess(paymentId, {
      allowExpiredCounterPayment: true,
    });
  }
}

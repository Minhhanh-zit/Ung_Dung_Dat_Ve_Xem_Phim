import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentRepository } from './payment.repository';
import { PaymentAccessGuard } from './payment-access.guard';
import { CashPaymentController } from './cash-payment.controller';
import { CashPaymentService } from './cash-payment.service';
import { BookingModule } from '../booking/booking.module';
import { Payment } from '../entities/payment.entity';
import { Ticket } from '../entities/ticket.entity';
import { BookingDetail } from '../entities/booking-detail.entity';
import { ShowtimeSeat } from '../entities/showtime-seat.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Ticket, BookingDetail, ShowtimeSeat]),
    BookingModule,
  ],
  controllers: [PaymentController, CashPaymentController],
  providers: [PaymentService, PaymentRepository, PaymentAccessGuard, CashPaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}

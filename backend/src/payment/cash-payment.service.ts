import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Injectable()
export class CashPaymentService {
  constructor(private readonly paymentService: PaymentService) {}

  async confirm(paymentId: string) {
    if (!/^[1-9]\d*$/.test(paymentId)) {
      throw new BadRequestException('paymentId phải là ID số dương');
    }
    return this.paymentService.processPaymentSuccess(paymentId, { cashCollection: true });
  }
}

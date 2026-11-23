import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { PaymentService } from '../src/payment/payment.service';
import { Payment } from '../src/entities/payment.entity';
import { BookingOrder } from '../src/entities/booking-order.entity';

test('BANKING: refuse success without a verified bank reference', async () => {
  let rollback = false;
  let release = false;
  const manager = {
    findOne: async (entity: unknown) => {
      if (entity === Payment) return { paymentId: '99', bookingId: '11', amount: 100000, paymentMethod: 'BANKING', paymentStatus: 'PENDING' };
      if (entity === BookingOrder) return { bookingId: '11', userId: 1, status: 'PENDING_PAYMENT', expiresAt: null, totalAmount: 100000 };
      return null;
    },
  };
  const runner = {
    manager,
    connect: async () => {}, startTransaction: async () => {},
    commitTransaction: async () => { throw new Error('Must not commit'); },
    rollbackTransaction: async () => { rollback = true; },
    release: async () => { release = true; },
  };
  const service = new PaymentService({} as any,{} as any,{createQueryRunner:()=>runner} as any,{get:()=>undefined} as any);
  await assert.rejects(() => service.processPaymentSuccess('99'),(e:unknown) => e instanceof BadRequestException && /đối chiếu giao dịch/.test(e.message));
  assert.equal(rollback,true);
  assert.equal(release,true);
});

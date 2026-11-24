import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { CashPaymentService } from '../src/payment/cash-payment.service';
import { PaymentService } from '../src/payment/payment.service';
import { Payment } from '../src/entities/payment.entity';
import { BookingOrder } from '../src/entities/booking-order.entity';

test('cash endpoint delegates all business validation to the payment transaction', async () => {
  const calls: unknown[][] = [];
  const service = new CashPaymentService({ processPaymentSuccess: async (...args: unknown[]) => {
    calls.push(args); return { success: true };
  } } as any);
  assert.equal((await service.confirm('901')).success, true);
  assert.deepEqual(calls, [['901', { cashCollection: true }]]);
  await assert.rejects(() => service.confirm('BK-invalid'), BadRequestException);
  assert.equal(calls.length, 1);
});

function makeService(withinGrace: number, method = 'CASH', paymentStatus = 'PENDING', bookingStatus = 'PENDING_PAYMENT') {
  const calls: string[] = [];
  let writes = 0;
  let rollback = false;
  const manager = {
    findOne: async (entity: unknown, options: any) => {
      if (entity === Payment) {
        calls.push(options.lock ? 'payment-lock' : 'snapshot');
        return { paymentId: '901', bookingId: '101', paymentMethod: method, paymentStatus, amount: 120000 };
      }
      if (entity === BookingOrder) {
        calls.push('booking-lock');
        return { bookingId: '101', userId: 25, showtimeId: 10, status: bookingStatus,
          totalAmount: 120000, expiresAt: new Date('2020-01-01T00:00:00Z') };
      }
      return null;
    },
    query: async (sql: string, params: unknown[]) => {
      calls.push('deadline');
      assert.deepEqual(calls.slice(0, 4), ['snapshot', 'booking-lock', 'payment-lock', 'deadline']);
      assert.deepEqual(params, [10, 10]);
      assert.match(sql, /DATEADD\(MINUTE, @1, st\.start_time\) >/);
      assert.match(sql, /SE Asia Standard Time/);
      return [{ within_grace: withinGrace }];
    },
    find: async () => { calls.push('details'); return []; },
    update: async () => { writes += 1; },
  };
  const runner = { manager, connect: async () => undefined, startTransaction: async () => undefined,
    commitTransaction: async () => undefined, release: async () => undefined,
    rollbackTransaction: async () => { rollback = true; } };
  const service = new PaymentService({} as any, {} as any, { createQueryRunner: () => runner } as any, {} as any);
  return { service, calls, writes: () => writes, rollback: () => rollback };
}

test('expired at the post-lock SQL check is rejected before any writes', async () => {
  const fixture = makeService(0);
  await assert.rejects(() => fixture.service.processPaymentSuccess('901', { cashCollection: true }),
    (e: unknown) => e instanceof BadRequestException && /quá thời gian giữ/.test(e.message));
  assert.equal(fixture.calls.includes('details'), false);
  assert.equal(fixture.writes(), 0);
  assert.equal(fixture.rollback(), true);
});

test('CASH within grace ignores the expired online deadline and reaches seat validation', async () => {
  const fixture = makeService(1);
  await assert.rejects(() => fixture.service.processPaymentSuccess('901', { cashCollection: true }),
    (e: unknown) => e instanceof BadRequestException && /Không tìm thấy ghế/.test(e.message));
  assert.equal(fixture.calls.includes('details'), true);
});

for (const [label, method, paymentStatus, bookingStatus] of [
  ['BANKING', 'BANKING', 'PENDING', 'PENDING_PAYMENT'],
  ['already paid', 'CASH', 'SUCCESS', 'PENDING_PAYMENT'],
  ['cancelled booking', 'CASH', 'PENDING', 'CANCELLED'],
] as const) {
  test(`cash collection rejects ${label} before deadline query or writes`, async () => {
    const fixture = makeService(1, method, paymentStatus, bookingStatus);
    await assert.rejects(() => fixture.service.processPaymentSuccess('901', { cashCollection: true }), BadRequestException);
    assert.equal(fixture.calls.includes('deadline'), false);
    assert.equal(fixture.writes(), 0);
  });
}

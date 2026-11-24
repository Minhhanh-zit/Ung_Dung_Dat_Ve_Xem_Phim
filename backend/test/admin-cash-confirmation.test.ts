import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CashPaymentService } from '../src/payment/cash-payment.service';

const valid = { payment_method: 'CASH', payment_status: 'PENDING', booking_status: 'PENDING_PAYMENT', within_grace: 1 };

function makeService(rows: unknown[]) {
  const confirmations: unknown[][] = [];
  const queries: unknown[][] = [];
  const service = new CashPaymentService(
    { query: async (sql: string, params: unknown[]) => {
      queries.push([sql, params]);
      return rows;
    } } as any,
    { processPaymentSuccess: async (...args: unknown[]) => {
      confirmations.push(args);
      return { success: true, paymentId: '901', bookingId: '101', tickets: [] };
    } } as any,
  );
  return { service, confirmations, queries };
}

test('admin CASH delegates ticket issuance without requiring the online deadline', async () => {
  const { service, confirmations, queries } = makeService([valid]);
  assert.equal((await service.confirm('901')).success, true);
  assert.deepEqual(confirmations, [['901', { allowExpiredCounterPayment: true }]]);
  assert.deepEqual(queries[0][1], ['901', 10]);
  assert.match(String(queries[0][0]), /SE Asia Standard Time/);
});

for (const [label, change] of [
  ['BANKING', { payment_method: 'BANKING' }],
  ['successful payment', { payment_status: 'SUCCESS' }],
  ['expired booking', { booking_status: 'EXPIRED' }],
  ['outside counter grace', { within_grace: 0 }],
] as const) {
  test(`admin CASH rejects ${label} before confirmation`, async () => {
    const { service, confirmations } = makeService([{ ...valid, ...change }]);
    await assert.rejects(() => service.confirm('901'), BadRequestException);
    assert.equal(confirmations.length, 0);
  });
}

test('admin CASH rejects missing payment', async () => {
  const { service, confirmations } = makeService([]);
  await assert.rejects(() => service.confirm('901'), NotFoundException);
  assert.equal(confirmations.length, 0);
});

test('admin CASH rejects malformed payment ID without querying SQL', async () => {
  const { service, queries } = makeService([valid]);
  await assert.rejects(() => service.confirm('BK-INVALID'), BadRequestException);
  assert.equal(queries.length, 0);
});

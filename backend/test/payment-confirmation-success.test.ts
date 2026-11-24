import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { PaymentService } from '../src/payment/payment.service';
import { CashPaymentController } from '../src/payment/cash-payment.controller';
import { Payment } from '../src/entities/payment.entity';
import { BookingOrder } from '../src/entities/booking-order.entity';
import { Ticket } from '../src/entities/ticket.entity';
import { Voucher } from '../src/entities/voucher.entity';

test('cash controller delegates the exact payment ID', async () => {
  const controller = new CashPaymentController({ confirm: async (id: string) => ({ success: true, paymentId: id }) } as any);
  assert.equal((await controller.confirm('901')).paymentId, '901');
});

for (const method of ['CASH', 'BANKING'] as const) {
  test(`${method} transaction updates payment, seats, booking, holds and tickets together`, async () => {
    const events: string[] = [];
    let ticketData: any;
    const queryBuilder: any = {};
    for (const name of ['update', 'set', 'where', 'andWhere']) queryBuilder[name] = () => queryBuilder;
    queryBuilder.execute = async () => { events.push('seats'); return { affected: 2 }; };
    const manager = {
      findOne: async (entity: unknown, options: any) => {
        if (entity === Payment) {
          events.push(options.lock ? 'payment-lock' : 'snapshot');
          return { paymentId: '901', bookingId: '101', paymentMethod: method, paymentStatus: 'PENDING', amount: 120000, providerResponse: null };
        }
        if (entity === BookingOrder) {
          events.push('booking-lock');
          return { bookingId: '101', userId: 25, showtimeId: 10, status: 'PENDING_PAYMENT', totalAmount: 120000, promotionId: 1, expiresAt: new Date(method === 'CASH' ? '2020-01-01' : '2099-01-01') };
        }
        if (entity === Voucher) return { usedCount: 0, usageLimit: 10 };
        if (entity === Ticket && options.where.bookingDetailId === '11') return { ticketId: '81', ticketCode: 'TK-OLD', qrCode: 'QR-OLD' };
        return null;
      },
      find: async () => [11, 12].map(id => ({ bookingDetailId: String(id), showtimeSeatId: String(id), seatPrice: 60000, showtimeSeat: { seat: { seatRow: 'A', seatNumber: id } } })),
      query: async (sql: string) => {
        if (sql.includes('within_grace')) {
          assert.deepEqual(events.slice(0, 3), ['snapshot', 'booking-lock', 'payment-lock']);
          events.push('deadline'); return [{ within_grace: 1 }];
        }
        if (sql.includes('sp_getapplock')) return [{ lock_result: 0 }];
        if (sql.includes('INSERT INTO dbo.audit_logs')) events.push('audit');
        return [];
      },
      update: async (entity: unknown, _where: unknown, values: any) => {
        if (entity === Payment) { assert.equal(values.paymentStatus, 'SUCCESS'); events.push('payment-success'); }
        if (entity === BookingOrder) { assert.equal(values.status, 'PAID'); events.push('booking-paid'); }
      },
      increment: async () => { events.push('voucher'); },
      createQueryBuilder: () => queryBuilder,
      create: (_entity: unknown, values: unknown) => values,
      save: async (values: any) => { ticketData = values; return { ...values, ticketId: '82' }; },
    };
    const runner = { manager, connect: async () => undefined, startTransaction: async () => undefined,
      commitTransaction: async () => { events.push('commit'); },
      rollbackTransaction: async () => { throw new Error('unexpected rollback'); },
      release: async () => { events.push('release'); } };
    const service = new PaymentService({ generateTicketCode: () => 'TK-NEW', generateQrCode: () => 'QR-NEW' } as any, {} as any, { createQueryRunner: () => runner } as any, {} as any);
    const result = await service.processPaymentSuccess('901', method === 'CASH'
      ? { cashCollection: true } : { bankingProof: { verifiedBy: 42, bankReference: 'BANK-REF-123456' } });
    assert.equal(result.success, true);
    assert.equal(result.tickets.length, 2);
    assert.equal(result.tickets[0].ticketCode, 'TK-OLD');
    assert.equal(result.tickets[1].ticketCode, 'TK-NEW');
    assert.equal(ticketData.checkedInAt, null);
    assert.equal(ticketData.checkedInBy, null);
    assert.ok(events.includes('payment-success'));
    assert.ok(events.includes('booking-paid'));
    assert.ok(events.includes('seats'));
    assert.ok(events.includes('voucher'));
    if (method === 'BANKING') assert.ok(events.indexOf('audit') < events.indexOf('commit'));
    else assert.ok(events.indexOf('deadline') < events.indexOf('payment-success'));
    assert.deepEqual(events.slice(-2), ['commit', 'release']);
  });
}

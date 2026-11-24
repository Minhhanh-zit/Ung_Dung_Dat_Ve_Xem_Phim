import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaymentConfirmationButton from '../src/components/admin/PaymentConfirmationButton';
import BookingTable from '../src/components/admin/BookingTable';
import { cashPaymentApi } from '../src/api/cashPaymentApi';
import type { AdminBooking } from '../src/types/admin';

const mocks = vi.hoisted(() => ({ getPayment: vi.fn(), post: vi.fn() }));
vi.mock('../src/api/adminApi', () => ({ adminBookingApi: { getPayment: mocks.getPayment } }));
vi.mock('../src/api/axiosClient', () => ({ default: { post: mocks.post } }));
const booking = { bookingId: 501, bookingCode: 'BK-TEST-501', customerName: 'Khách thử', movieTitle: 'Phim thử', showtime: '2026-12-01T19:00:00', seats: ['A1'], totalAmount: 150000, status: 'PENDING_PAYMENT', paymentStatus: 'PENDING' } as AdminBooking;
const payment = { paymentId: '901', bookingId: '501', amount: 150000, paymentMethod: 'CASH', paymentStatus: 'PENDING' };
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra thanh toán' }));
const confirm = () => screen.getByRole('button', { name: 'Xác nhận đã thu tiền mặt' });

beforeEach(() => { vi.resetAllMocks(); mocks.getPayment.mockResolvedValue(payment); });

it('opens CASH details, requires receipt checkbox, and closes without writing', async () => {
  render(<PaymentConfirmationButton booking={booking} onConfirmBank={vi.fn()} />);
  open();
  await screen.findByText('Xác nhận thu tiền mặt');
  expect(screen.getByText(/Tiền mặt phải thu/)).toHaveTextContent('150.000');
  expect(confirm()).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox')); expect(confirm()).toBeEnabled();
  fireEvent.click(screen.getByRole('checkbox')); expect(confirm()).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
  expect(screen.queryByText('Xác nhận thu tiền mặt')).toBeNull();
  expect(mocks.post).not.toHaveBeenCalled();
});

it('routes BANKING to the existing bank modal without a cash request', async () => {
  mocks.getPayment.mockResolvedValue({ ...payment, paymentMethod: 'BANKING' });
  const onBank = vi.fn();
  render(<PaymentConfirmationButton booking={booking} onConfirmBank={onBank} />);
  open();
  await waitFor(() => expect(onBank).toHaveBeenCalledWith(booking));
  expect(screen.queryByText('Xác nhận thu tiền mặt')).toBeNull();
  expect(mocks.post).not.toHaveBeenCalled();
});

for (const [label, response, message] of [
  ['processed', { ...payment, paymentStatus: 'SUCCESS' }, /không còn chờ thanh toán/],
  ['unsupported', { ...payment, paymentMethod: 'MOCK' }, /Chỉ xác nhận thủ công/],
] as const) {
  it(`rejects ${label} without enabling confirmation`, async () => {
    mocks.getPayment.mockResolvedValue(response);
    render(<PaymentConfirmationButton booking={booking} onConfirmBank={vi.fn()} />);
    open(); await screen.findByText(message);
    expect(confirm()).toBeDisabled(); expect(mocks.post).not.toHaveBeenCalled();
  });
}

it('shows API lookup error and permits closing with the modal close control', async () => {
  mocks.getPayment.mockRejectedValue(new Error('Không tải được đơn'));
  render(<PaymentConfirmationButton booking={booking} onConfirmBank={vi.fn()} />);
  open(); await screen.findByText('Không tải được đơn');
  fireEvent.click(screen.getByRole('button', { name: '×' }));
  expect(screen.queryByText('Không tải được đơn')).toBeNull();
});

it('prevents repeated lookup while a request is in flight', async () => {
  let resolve!: (value: typeof payment) => void;
  mocks.getPayment.mockReturnValue(new Promise<typeof payment>((done) => { resolve = done; }));
  render(<PaymentConfirmationButton booking={booking} onConfirmBank={vi.fn()} />);
  open();
  expect(screen.getByRole('button', { name: 'Đang kiểm tra...' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Đang kiểm tra...' }));
  expect(mocks.getPayment).toHaveBeenCalledTimes(1);
  resolve(payment); await screen.findByText('Xác nhận thu tiền mặt');
});

it('posts only the cash endpoint and displays a failure without claiming payment succeeded', async () => {
  mocks.post.mockRejectedValue(new Error('Đơn tiền mặt đã quá thời gian giữ tại quầy'));
  render(<PaymentConfirmationButton booking={booking} onConfirmBank={vi.fn()} />);
  open(); await screen.findByText('Xác nhận thu tiền mặt');
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(confirm());
  await screen.findByText('Đơn tiền mặt đã quá thời gian giữ tại quầy');
  expect(mocks.post).toHaveBeenCalledWith('/payments/901/admin-cash-confirm');
  await waitFor(() => expect(confirm()).toBeEnabled());
});

it('treats a false success response as an error', async () => {
  mocks.post.mockResolvedValue({ success: false });
  render(<PaymentConfirmationButton booking={booking} onConfirmBank={vi.fn()} />);
  open(); await screen.findByText('Xác nhận thu tiền mặt');
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(confirm());
  await screen.findByText('Chưa xác nhận được thanh toán');
});

it('cash API preserves encoded payment ID and returns the successful backend response', async () => {
  mocks.post.mockResolvedValue({ success: true, paymentId: '901', bookingId: '501' });
  expect((await cashPaymentApi.confirm('901')).success).toBe(true);
  expect(mocks.post).toHaveBeenCalledWith('/payments/901/admin-cash-confirm');
});

it('renders desktop/mobile actions only for pending bookings and retains booking fields', () => {
  render(<BookingTable bookings={[booking, { ...booking, bookingId: 502, bookingCode: 'BK-PAID', status: 'PAID', paymentStatus: 'PAID' }]} onConfirmBank={vi.fn()} />);
  expect(screen.getAllByRole('button', { name: 'Kiểm tra thanh toán' })).toHaveLength(2);
  expect(screen.getAllByText('BK-TEST-501')).toHaveLength(2);
  expect(screen.getAllByText('A1')).toHaveLength(4);
});

it('does not expose actions without a confirmation callback', () => {
  render(<BookingTable bookings={[{ ...booking, seats: [] }]} />);
  expect(screen.queryByRole('button', { name: 'Kiểm tra thanh toán' })).toBeNull();
  expect(screen.getAllByText('—')).toHaveLength(2);
});

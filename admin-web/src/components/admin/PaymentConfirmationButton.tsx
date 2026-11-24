import { useRef, useState } from 'react';
import { adminBookingApi } from '../../api/adminApi';
import { cashPaymentApi } from '../../api/cashPaymentApi';
import type { AdminBooking } from '../../types/admin';
import { Btn, ErrorBanner, Modal, formatVnd } from './AdminUI';

interface Props {
  booking: AdminBooking;
  onConfirmBank: (booking: AdminBooking) => void;
}

type Payment = Awaited<ReturnType<typeof adminBookingApi.getPayment>>;

export default function PaymentConfirmationButton({ booking, onConfirmBank }: Props) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  const inspect = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setChecked(false);
    setPayment(null);
    try {
      const current = await adminBookingApi.getPayment(booking.bookingId);
      if (current.paymentStatus !== 'PENDING') {
        throw new Error('Giao dịch không còn chờ thanh toán. Vui lòng làm mới danh sách.');
      }
      if (current.paymentMethod === 'BANKING') {
        onConfirmBank(booking);
        return;
      }
      if (current.paymentMethod !== 'CASH') {
        throw new Error('Chỉ xác nhận thủ công tiền mặt hoặc chuyển khoản ngân hàng.');
      }
      setPayment(current);
      setOpen(true);
    } catch (e) {
      setError((e as { message?: string }).message || 'Không tải được giao dịch');
      setOpen(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const confirmCash = async () => {
    if (!payment || payment.paymentMethod !== 'CASH' || !checked || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await cashPaymentApi.confirm(payment.paymentId);
      if (!result.success) throw new Error('Chưa xác nhận được thanh toán');
      window.location.reload();
    } catch (e) {
      setError((e as { message?: string }).message || 'Không xác nhận được tiền mặt. Hãy kiểm tra trạng thái trước khi thử lại.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" disabled={busy} onClick={() => void inspect()}
        className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-50">
        {busy ? 'Đang kiểm tra...' : 'Kiểm tra thanh toán'}
      </button>
      {open && (
        <Modal title={payment ? 'Xác nhận thu tiền mặt' : 'Kiểm tra thanh toán'}
          onClose={() => { if (!inFlight.current) setOpen(false); }}>
          <p className="text-sm text-gray-300">Mã đơn: {booking.bookingCode}</p>
          <p className="text-sm text-gray-300">Khách: {booking.customerName}</p>
          {payment && (
            <>
              <p className="rounded-xl bg-gray-800 p-3 text-sm text-white">
                Tiền mặt phải thu: <strong>{formatVnd(Number(payment.amount))}</strong>
              </p>
              <p className="text-xs text-yellow-300">
                Chỉ xác nhận sau khi đã nhận đủ tiền mặt. Thao tác này phát hành vé, không tự check-in.
              </p>
              <label className="flex items-start gap-2 text-sm text-gray-200">
                <input type="checkbox" checked={checked} disabled={busy}
                  onChange={(e) => setChecked(e.target.checked)} />
                Tôi đã trực tiếp nhận đủ tiền mặt từ khách.
              </label>
            </>
          )}
          <ErrorBanner message={error} />
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Đóng</Btn>
            <Btn variant="primary" disabled={!payment || !checked || busy}
              onClick={() => void confirmCash()}>
              {busy ? 'Đang xác nhận...' : 'Xác nhận đã thu tiền mặt'}
            </Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

import React, { useCallback, useEffect, useRef, useState } from 'react';
import BookingTable from '../../components/admin/BookingTable';
import {
  Btn,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  PageHeader,
  Pagination,
  inputClass,
} from '../../components/admin/AdminUI';
import { Modal } from '../../components/admin/AdminUI';
import { useBookings } from '../../hooks/useBookings';
import { adminBookingApi } from '../../api/adminApi';
import type { AdminBooking } from '../../types/admin';

const EMPTY_FILTERS = {
  bookingCode: '',
  customerName: '',
  movieTitle: '',
  paymentStatus: '',
};

const PAGE_SIZE = 20;

const AdminBookingsPage: React.FC = () => {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const { bookings, total, loading, error, fetchBookings } = useBookings();
  const [bankBooking, setBankBooking] = useState<AdminBooking | null>(null);
  const [bankPayment, setBankPayment] = useState<Awaited<ReturnType<typeof adminBookingApi.getPayment>> | null>(null);
  const [bankReference, setBankReference] = useState('');
  const [bankChecked, setBankChecked] = useState(false);
  const [bankBusy, setBankBusy] = useState(false);
  const [bankError, setBankError] = useState('');

  const closeBank = () => {
    if (bankBusy) return;
    setBankBooking(null);
    setBankPayment(null);
    setBankReference('');
    setBankChecked(false);
    setBankError('');
  };
  const openBank = async (booking: AdminBooking) => {
    setBankBooking(booking);
    setBankPayment(null);
    setBankError('');
    setBankReference('');
    setBankChecked(false);
    try {
      const payment = await adminBookingApi.getPayment(booking.bookingId);
      if (payment.paymentMethod !== 'BANKING' || payment.paymentStatus !== 'PENDING') {
        throw new Error('Đơn này chưa có giao dịch BANKING đang chờ. Chỉ đối soát đúng phương thức chuyển khoản.');
      }
      setBankPayment(payment);
    } catch (e) {
      setBankError((e as {message?:string}).message || 'Không tải được giao dịch thanh toán');
    }
  };
  const confirmBank = async () => {
    if (!bankBooking || !bankPayment || !bankChecked || bankReference.trim().length < 6 || bankBusy) return;
    setBankBusy(true);
    setBankError('');
    try {
      await adminBookingApi.confirmBankTransfer(bankPayment.paymentId, bankReference.trim());
      setBankBooking(null);
      setBankPayment(null);
      setBankReference('');
      setBankChecked(false);
      await fetchRef.current({ ...filters, page, limit: PAGE_SIZE });
    } catch (e) {
      setBankError((e as {message?:string}).message || 'Không xác nhận được giao dịch. Kiểm tra lại trạng thái trước khi thử tiếp.');
    } finally {
      setBankBusy(false);
    }
  };

  const fetchRef = useRef(fetchBookings);
  useEffect(() => {
    fetchRef.current = fetchBookings;
  }, [fetchBookings]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void fetchRef.current({ ...filters, page, limit: PAGE_SIZE });
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [filters, page]);

  const handleFilterChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1); // đổi bộ lọc thì quay lại trang đầu
  };

  const handleClearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }, []);

  const hasFilter = Object.values(filters).some(Boolean);

  return (
    <div>
      <PageHeader
        title="Quản lý Đơn Đặt Vé"
        subtitle={`Tổng: ${total.toLocaleString('vi-VN')} đơn`}
        actions={
          <Btn
            variant="ghost"
            onClick={() => void fetchRef.current({ ...filters, page, limit: PAGE_SIZE })}
            disabled={loading}
          >
            🔄 Làm mới
          </Btn>
        }
      />

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Mã đơn">
            <input
              type="text"
              name="bookingCode"
              value={filters.bookingCode}
              onChange={handleFilterChange}
              placeholder="BK20260624001"
              className={inputClass}
            />
          </Field>
          <Field label="Tên khách hàng">
            <input
              type="text"
              name="customerName"
              value={filters.customerName}
              onChange={handleFilterChange}
              placeholder="Nguyen Van A"
              className={inputClass}
            />
          </Field>
          <Field label="Phim">
            <input
              type="text"
              name="movieTitle"
              value={filters.movieTitle}
              onChange={handleFilterChange}
              placeholder="Tên phim"
              className={inputClass}
            />
          </Field>
          <Field label="Trạng thái thanh toán">
            <select
              name="paymentStatus"
              value={filters.paymentStatus}
              onChange={handleFilterChange}
              className={inputClass}
            >
              <option value="">Tất cả</option>
              <option value="PAID">Đã thanh toán</option>
              <option value="PENDING">Chờ thanh toán</option>
              <option value="FAILED">Thanh toán lỗi</option>
              <option value="REFUNDED">Đã hoàn tiền</option>
            </select>
          </Field>
        </div>

        <div className="flex justify-end mt-4">
          <Btn variant="ghost" onClick={handleClearFilters} disabled={!hasFilter}>
            Xóa bộ lọc
          </Btn>
        </div>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <Loading label="Đang tải đơn đặt vé..." />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon="🎟️"
          label={hasFilter ? 'Không có đơn nào khớp bộ lọc.' : 'Chưa có đơn đặt vé nào.'}
        />
      ) : (
        <>
          <BookingTable bookings={bookings} onConfirmBank={(booking) => void openBank(booking)} />
          <Pagination
            page={page}
            limit={PAGE_SIZE}
            total={total}
            onChange={setPage}
            disabled={loading}
          />
        </>
      )}
      {bankBooking && (
        <Modal title="Đối soát chuyển khoản ngân hàng" onClose={closeBank}>
          <p className="text-sm text-gray-300">Mã đơn: <strong className="text-white">{bankBooking.bookingCode}</strong></p>
          <p className="text-sm text-gray-300">Khách: {bankBooking.customerName}</p>
          <p className="text-sm text-gray-300">Phim: {bankBooking.movieTitle}</p>
          {bankPayment ? (
            <>
              <p className="rounded-xl bg-gray-800 p-3 text-sm text-white">
                Số tiền phải nhận: <strong>{Number(bankPayment.amount).toLocaleString('vi-VN')} ₫</strong>
              </p>
              <p className="text-xs text-gray-400">Mã giao dịch nội bộ: {bankPayment.transactionCode || bankPayment.paymentId}</p>
              <p className="text-xs text-yellow-300">
                Chỉ xác nhận sau khi kiểm tra giao dịch CÓ trên sao kê/app ngân hàng,
                đúng số tiền và nội dung chuyển khoản. Khách bấm đã chuyển tiền không phải bằng chứng.
              </p>
              <Field label="Mã tham chiếu giao dịch thực tế từ ngân hàng (tối thiểu 6 ký tự)">
                <input className={inputClass} type="text" maxLength={100}
                  value={bankReference} onChange={(e) => setBankReference(e.target.value)}
                  placeholder="Mã giao dịch trên sao kê" autoComplete="off" />
              </Field>
              <label className="flex items-start gap-2 text-sm text-gray-200">
                <input type="checkbox" className="mt-1" checked={bankChecked}
                  onChange={(e) => setBankChecked(e.target.checked)} />
                Tôi đã trực tiếp đối chiếu giao dịch tiền vào ngân hàng và đúng số tiền.
              </label>
            </>
          ) : !bankError ? <Loading label="Đang kiểm tra thanh toán..." /> : null}
          <ErrorBanner message={bankError} />
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={closeBank} disabled={bankBusy}>Đóng</Btn>
            <Btn variant="primary" onClick={() => void confirmBank()}
              disabled={!bankPayment || bankBusy || !bankChecked || bankReference.trim().length < 6}>
              {bankBusy ? 'Đang xác nhận...' : 'Xác nhận đã nhận tiền'}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminBookingsPage;

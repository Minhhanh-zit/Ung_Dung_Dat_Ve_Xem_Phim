export type AdmissionAction = 'ALLOW' | 'CONFIRM' | 'BLOCK';
export interface AdmissionPolicy {
  rating: string;
  action: AdmissionAction;
  message: string;
  confirmLabel: string | null;
}

// No default-to-P: missing or unrecognized classifications cannot be confirmed.
export function ageAdmissionPolicy(raw: unknown): AdmissionPolicy {
  const rating = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (rating === 'P') return { rating, action: 'ALLOW', message: 'Phim dành cho mọi lứa tuổi.', confirmLabel: null };
  if (rating === 'K') return { rating, action: 'CONFIRM', message: 'Khán giả dưới 13 tuổi cần có cha, mẹ hoặc người giám hộ đi cùng. Bạn xác nhận đáp ứng điều kiện này chứ?', confirmLabel: 'Tôi đáp ứng điều kiện' };
  if (rating === 'T13' || rating === 'T16' || rating === 'T18') {
    const age = rating.slice(1);
    return { rating, action: 'CONFIRM', message: `Phim chỉ dành cho khán giả từ đủ ${age} tuổi. Bạn xác nhận tất cả người xem đều đủ ${age} tuổi chứ?`, confirmLabel: `Tôi xác nhận đủ ${age} tuổi` };
  }
  if (rating === 'C') return { rating, action: 'BLOCK', message: 'Phim không được phổ biến. Không thể tiếp tục đặt vé.', confirmLabel: null };
  return { rating: rating || 'UNKNOWN', action: 'BLOCK', message: 'Phim chưa có phân loại độ tuổi hợp lệ. Vui lòng liên hệ rạp.', confirmLabel: null };
}

import { useEffect, useRef, useState } from 'react';
import BookingPayment from './booking-payment';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Hold = {
  holdId: string;
  showtimeSeatId: number;
  seatLabel: string;
  expiresAt: string;
  status: string;
};

type Booking = {
  bookingId: string;
  bookingCode: string;
  showtimeId: number;
  seatCount: number;
  totalAmount: number;
  status: string;
  expiresAt: string | null;
  idempotencyKey?: string | null;
};

type Props = {
  token: string;
  showtimeId: number;
  holds: Hold[];
  onRefresh: () => Promise<void>;
};

const API = (
  process.env.EXPO_PUBLIC_API_URL ?? ''
).replace(/\/+$/, '');

const money = (value: number) =>
  `${Number(value).toLocaleString('vi-VN')}đ`;

async function request(
  path: string,
  token: string,
  method = 'GET',
  data?: object,
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = Array.isArray(body.message)
        ? body.message.join(', ')
        : body.message || 'Yêu cầu thất bại';

      throw new Error(`HTTP ${response.status}: ${message}`);
    }

    return body;
  } finally {
    clearTimeout(timer);
  }
}

export default function BookingCheckout({
  token,
  showtimeId,
  holds,
  onRefresh,
}: Props) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [verified, setVerified] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const keyRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  async function findExisting(): Promise<Booking | null> {
    const data = await request('/bookings/my', token);

    if (!Array.isArray(data)) {
      throw new Error('Danh sách đơn không hợp lệ');
    }

    return data.find((item: Booking) =>
      Number(item.showtimeId) === showtimeId &&
      item.status === 'PENDING_PAYMENT' &&
      (!item.expiresAt ||
        new Date(item.expiresAt).getTime() > Date.now())
    ) ?? null;
  }

  useEffect(() => {
    let active = true;

    setChecking(true);
    setVerified(false);

    void findExisting()
      .then((found) => {
        if (!active) return;
        setBooking(found);
        setVerified(true);
      })
      .catch(() => {
        if (active) {
          setError('Chưa kiểm tra được đơn đang chờ thanh toán.');
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => { active = false; };
  }, [token, showtimeId]);

  async function recheck() {
    setChecking(true);
    setError('');

    try {
      const found = await findExisting();
      setBooking(found);
      setVerified(true);
      setUncertain(false);
      if (found) void onRefresh();
    } catch {
      setVerified(false);
      setError('Không kiểm tra được đơn. Hãy thử lại khi mạng ổn định.');
    } finally {
      setChecking(false);
    }
  }

  async function createBooking() {
    if (busyRef.current || booking || !verified || uncertain) return;

    const ids = [...new Set(holds.map(h => String(h.holdId)))];

    if (
      ids.length < 1 ||
      ids.length > 8 ||
      holds.some(h => new Date(h.expiresAt).getTime() <= Date.now())
    ) {
      setError('Lượt giữ ghế đã hết hạn hoặc không hợp lệ.');
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError('');

    if (!keyRef.current) {
      keyRef.current =
        `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    try {
      const result: Booking = await request(
        '/bookings',
        token,
        'POST',
        {
          holdIds: ids,
          idempotencyKey: keyRef.current,
        },
      );

      if (!result.bookingId || result.status !== 'PENDING_PAYMENT') {
        throw new Error('Phản hồi tạo đơn chưa được xác nhận');
      }

      setBooking(result);
      setUncertain(false);
      void onRefresh();
    } catch {
      try {
        const found = await findExisting();

        if (found) {
          setBooking(found);
          setUncertain(false);
          setError('Đã tìm thấy đơn được tạo trước đó.');
          void onRefresh();
        } else {
          setUncertain(true);
          setError(
            'Chưa xác định được kết quả tạo đơn. ' +
            'Hãy kiểm tra lại đơn trước khi thử tiếp.',
          );
        }
      } catch {
        setUncertain(true);
        setError(
          'Mất kết nối khi tạo đơn. Không gửi lại ngay. ' +
          'Hãy kiểm tra trạng thái đơn trước.',
        );
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function cancelBooking() {
    if (!booking || busyRef.current) return;

    busyRef.current = true;
    setBusy(true);
    setError('');

    try {
      const result = await request(
        `/bookings/${encodeURIComponent(String(booking.bookingId))}`,
        token,
        'DELETE',
      );

      if (result.success !== true) {
        throw new Error('Chưa xác nhận được việc hủy đơn');
      }

      setBooking(null);
      keyRef.current = null;
      void onRefresh();
    } catch {
      setError(
        'Chưa xác nhận được trạng thái hủy đơn. ' +
        'Hãy kiểm tra lại trước khi thao tác tiếp.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Đơn đặt vé</Text>

      {checking && <ActivityIndicator color="#BDA1FF" />}

      {booking ? (
        <>
          <Text style={styles.label}>Mã đơn</Text>
          <Text style={styles.code}>{booking.bookingCode}</Text>

          <Text style={styles.label}>
            Trạng thái: Chờ thanh toán
          </Text>

          <Text style={styles.label}>
            Số ghế: {booking.seatCount}
          </Text>

          <Text style={styles.price}>
            {money(booking.totalAmount)}
          </Text>

          {booking.expiresAt && (
            <Text style={styles.label}>
              Hạn thanh toán:{' '}
              {new Date(booking.expiresAt).toLocaleString(
                'vi-VN',
                { timeZone: 'Asia/Ho_Chi_Minh' },
              )}
            </Text>
          )}

          <Text style={styles.note}>
            Đây là đơn chờ thanh toán. Chưa phát hành vé QR.
          </Text>

          <BookingPayment
            bookingId={String(booking.bookingId)}
            token={token}
          />

          <Pressable
            disabled={busy}
            style={styles.cancel}
            onPress={() =>
              Alert.alert(
                'Hủy đơn đặt vé',
                'Bạn có chắc muốn hủy đơn chưa thanh toán?',
                [
                  { text: 'Không', style: 'cancel' },
                  {
                    text: 'Hủy đơn',
                    style: 'destructive',
                    onPress: () => void cancelBooking(),
                  },
                ],
              )
            }
          >
            <Text style={styles.cancelText}>Hủy đơn</Text>
          </Pressable>
        </>
      ) : verified && holds.length > 0 && !uncertain ? (
        <>
          <Text style={styles.label}>
            Ghế: {holds.map(h => h.seatLabel).join(', ')}
          </Text>

          <Pressable
            disabled={busy || checking}
            style={styles.button}
            onPress={() =>
              Alert.alert(
                'Xác nhận tạo đơn',
                `Tạo đơn cho ${holds.length} ghế đang giữ? ` +
                'Đơn sẽ ở trạng thái chờ thanh toán.',
                [
                  { text: 'Quay lại', style: 'cancel' },
                  {
                    text: 'Tạo đơn',
                    onPress: () => void createBooking(),
                  },
                ],
              )
            }
          >
            <Text style={styles.buttonText}>
              {busy ? 'Đang tạo đơn...' : 'Tiếp tục tạo đơn đặt vé'}
            </Text>
          </Pressable>
        </>
      ) : !checking && !uncertain && verified ? (
        <Text style={styles.note}>
          Hãy giữ ghế trước khi tạo đơn.
        </Text>
      ) : null}

      {!!error && <Text style={styles.error}>{error}</Text>}

      {(uncertain || !verified || !!booking) && !checking && (
        <Pressable style={styles.check} onPress={() => void recheck()}>
          <Text style={styles.checkText}>
            Kiểm tra lại trạng thái đơn
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#171F33',
    padding: 18,
    borderRadius: 16,
    marginTop: 24,
    gap: 12,
  },
  title: { color: 'white', fontSize: 20, fontWeight: '800' },
  label: { color: '#C4CDE0', fontSize: 14 },
  code: { color: '#57D5FF', fontSize: 16, fontWeight: '800' },
  price: { color: '#45DEB2', fontSize: 24, fontWeight: '900' },
  note: { color: '#A5B1C8', lineHeight: 21 },
  button: {
    backgroundColor: '#BDA1FF',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  buttonText: { color: '#101629', fontWeight: '800' },
  cancel: {
    borderColor: '#FF8999',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  cancelText: { color: '#FF8999', fontWeight: '800' },
  check: { paddingVertical: 12, alignItems: 'center' },
  checkText: { color: '#57D5FF', fontWeight: '700' },
  error: { color: '#FF9FAE', lineHeight: 22 },
});

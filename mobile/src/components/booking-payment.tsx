import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type PaymentMethod = {
  code: string;
  name: string;
  enabled: boolean;
  note?: string;
};

type Payment = {
  paymentId: string;
  bookingId: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  transactionCode: string;
};

type Props = {
  bookingId: string;
  token: string;
};

const API = (
  process.env.EXPO_PUBLIC_API_URL ?? ''
).replace(/\/+$/, '');

async function api(
  path: string,
  token: string,
  method = 'GET',
  payload?: object,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });

    const body = await response.json().catch(() => null);

    return {
      status: response.status,
      ok: response.ok,
      body,
    };
  } finally {
    clearTimeout(timer);
  }
}

export default function BookingPayment({
  bookingId,
  token,
}: Props) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selected, setSelected] = useState('BANKING');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [checking, setChecking] = useState(true);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  const checkPayment = useCallback(async () => {
    setChecking(true);
    setError('');

    try {
      const methodResult = await api(
        '/payments/methods',
        token,
      );

      if (!methodResult.ok ||
          !Array.isArray(methodResult.body)) {
        throw new Error('Không tải được phương thức thanh toán');
      }

      const available = (
        methodResult.body as PaymentMethod[]
      ).filter(
        item =>
          item.enabled &&
          (item.code === 'BANKING' || item.code === 'CASH'),
      );

      setMethods(available);

      const paymentResult = await api(
        `/payments/booking/${encodeURIComponent(bookingId)}`,
        token,
      );

      if (paymentResult.status === 404) {
        setPayment(null);
      } else if (paymentResult.ok &&
                 paymentResult.body?.paymentId) {
        setPayment(paymentResult.body as Payment);
      } else {
        throw new Error(
          `Không kiểm tra được giao dịch (HTTP ${paymentResult.status})`,
        );
      }

      setVerified(true);
      setUncertain(false);
    } catch (err) {
      setVerified(false);
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể kiểm tra giao dịch',
      );
    } finally {
      setChecking(false);
    }
  }, [bookingId, token]);

  useEffect(() => {
    void checkPayment();
  }, [checkPayment]);

  async function createPayment() {
    if (
      inFlight.current ||
      !verified ||
      uncertain ||
      payment ||
      !methods.some(item => item.code === selected)
    ) return;

    inFlight.current = true;
    setBusy(true);
    setError('');

    try {
      const result = await api(
        '/payments',
        token,
        'POST',
        {
          bookingId,
          paymentMethod: selected,
        },
      );

      if (
        !result.ok ||
        !result.body?.paymentId ||
        result.body.paymentStatus !== 'PENDING'
      ) {
        throw new Error('Chưa xác nhận được giao dịch chờ thanh toán');
      }

      setPayment(result.body as Payment);
    } catch {
      setUncertain(true);
      setError(
        'Chưa xác nhận được kết quả tạo giao dịch. ' +
        'Không gửi lại ngay. Hãy kiểm tra trạng thái giao dịch.',
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const selectedMethod = methods.find(
    item => item.code === selected,
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>
        Phương thức thanh toán
      </Text>

      {checking && (
        <ActivityIndicator color="#BDA1FF" />
      )}

      {payment ? (
        <View style={styles.receipt}>
          <Text style={styles.success}>
            ✓ Đã ghi nhận yêu cầu thanh toán
          </Text>

          <Text style={styles.label}>
            Phương thức: {payment.paymentMethod}
          </Text>

          <Text style={styles.label}>
            Mã giao dịch: {payment.transactionCode}
          </Text>

          <Text style={styles.amount}>
            {Number(payment.amount).toLocaleString('vi-VN')}đ
          </Text>

          <Text style={styles.pending}>
            {payment.paymentStatus === 'PENDING'
              ? 'Đang chờ xác nhận thanh toán'
              : `Trạng thái: ${payment.paymentStatus}`}
          </Text>

          <Text style={styles.note}>
            Chưa xác nhận đã nhận tiền.
            Vé QR chỉ được phát hành sau khi
            thanh toán được xác nhận hợp lệ.
          </Text>

          {payment.paymentMethod === 'CASH' && (
            <Text style={styles.note}>
              Thanh toán tiền mặt tại quầy theo
              thời hạn và quy trình xác nhận của rạp.
            </Text>
          )}
        </View>
      ) : verified && !uncertain ? (
        <>
          {methods.map(item => (
            <Pressable
              key={item.code}
              style={[
                styles.method,
                selected === item.code && styles.methodActive,
              ]}
              onPress={() => setSelected(item.code)}
              accessibilityRole="radio"
              accessibilityState={{
                checked: selected === item.code,
              }}
            >
              <Text style={styles.methodName}>
                {selected === item.code ? '◉' : '○'} {item.name}
              </Text>

              {!!item.note && (
                <Text style={styles.note}>
                  {item.note}
                </Text>
              )}
            </Pressable>
          ))}

          {methods.length === 0 ? (
            <Text style={styles.error}>
              Chưa có phương thức thanh toán khả dụng.
            </Text>
          ) : (
            <Pressable
              style={[
                styles.button,
                busy && styles.disabled,
              ]}
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  'Xác nhận phương thức thanh toán',
                  `Tạo giao dịch ${selectedMethod?.name}? ` +
                  'Giao dịch sẽ ở trạng thái chờ xác nhận, chưa trừ tiền.',
                  [
                    { text: 'Quay lại', style: 'cancel' },
                    {
                      text: 'Tạo giao dịch',
                      onPress: () => void createPayment(),
                    },
                  ],
                )
              }
            >
              <Text style={styles.buttonText}>
                {busy
                  ? 'Đang xử lý...'
                  : 'Tạo giao dịch chờ thanh toán'}
              </Text>
            </Pressable>
          )}
        </>
      ) : null}

      {!!error && (
        <Text style={styles.error}>{error}</Text>
      )}

      <Pressable
        disabled={checking || busy}
        onPress={() => void checkPayment()}
        style={styles.refresh}
      >
        <Text style={styles.refreshText}>
          Kiểm tra trạng thái thanh toán
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
    gap: 13,
  },
  heading: {
    color: 'white',
    fontSize: 19,
    fontWeight: '800',
  },
  method: {
    padding: 15,
    backgroundColor: '#242D43',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#343F59',
    gap: 7,
  },
  methodActive: {
    borderColor: '#BDA1FF',
    backgroundColor: '#2D294A',
  },
  methodName: {
    color: 'white',
    fontWeight: '800',
    fontSize: 15,
  },
  note: {
    color: '#A5B1C8',
    fontSize: 13,
    lineHeight: 21,
  },
  button: {
    backgroundColor: '#BDA1FF',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  buttonText: {
    color: '#101629',
    fontWeight: '800',
    textAlign: 'center',
  },
  receipt: {
    backgroundColor: '#242D43',
    padding: 16,
    borderRadius: 13,
    gap: 12,
  },
  success: {
    color: '#45DEB2',
    fontWeight: '800',
  },
  label: { color: '#D0D7E6' },
  amount: {
    color: '#45DEB2',
    fontSize: 23,
    fontWeight: '900',
  },
  pending: {
    color: '#FFCA78',
    fontWeight: '800',
  },
  error: {
    color: '#FF9FAE',
    lineHeight: 22,
  },
  refresh: {
    borderWidth: 1,
    borderColor: '#57D5FF',
    borderRadius: 12,
    padding: 13,
    alignItems: 'center',
  },
  refreshText: {
    color: '#57D5FF',
    fontWeight: '800',
  },
});

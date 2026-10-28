import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import BookingCheckout from './booking-checkout';

type Seat = {
  showtimeSeatId: number;
  seatLabel: string | null;
  seatRow: string | null;
  seatNumber: number | null;
  status: 'AVAILABLE' | 'HELD' | 'SOLD' | 'BLOCKED';
  price: number;
};

type SeatMap = {
  showtimeId: number;
  cinemaName: string | null;
  roomName: string | null;
  totalSeats: number;
  seatsGenerated: boolean;
  seats: Seat[];
};

type HoldRecord = {
  holdId: string;
  showtimeSeatId: number;
  seatLabel: string;
  expiresAt: string;
  status: string;
};

type Props = {
  showtimeId: number;
  onBack: () => void;
};

const API = (
  process.env.EXPO_PUBLIC_API_URL ?? ''
).replace(/\/+$/, '');

const money = (value: number) =>
  `${value.toLocaleString('vi-VN')}đ`;

export default function SeatMapPanel({
  showtimeId,
  onBack,
}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [map, setMap] = useState<SeatMap | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [holding, setHolding] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [holdError, setHoldError] = useState('');
  const [holds, setHolds] = useState<HoldRecord[]>([]);
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    if (!holds.length) return;
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, [holds.length]);

  const expiresAt = holds.length
    ? Math.min(...holds.map(h => new Date(h.expiresAt).getTime()))
    : 0;

  const remainingSeconds = Math.max(
    0,
    Math.ceil((expiresAt - clock) / 1000),
  );

  async function holdSelectedSeats() {
    if (!token || !map || holding || remainingSeconds > 0) return;

    const ids = [...new Set(selected)];

    if (ids.length < 1 || ids.length > 8) {
      setHoldError('Hãy chọn từ 1 đến 8 ghế.');
      return;
    }

    if (!ids.every(id => map.seats.some(
      seat => seat.showtimeSeatId === id &&
              seat.status === 'AVAILABLE'
    ))) {
      setHoldError('Trạng thái ghế đã thay đổi. Hãy tải lại.');
      return;
    }

    setHolding(true);
    setHoldError('');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(
        `${API}/showtime-seats/hold-many`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            showtimeSeatIds: ids,
            holdMinutes: 5,
          }),
          signal: controller.signal,
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message || 'Không giữ được ghế';

        throw new Error(`HTTP ${response.status}: ${message}`);
      }

      if (!Array.isArray(data) || data.length !== ids.length) {
        throw new Error(
          'Phản hồi không đúng định dạng. Cần kiểm tra ghế đã giữ.',
        );
      }

      setHolds(data);
      setClock(Date.now());

      await loadSeats(token);
    } catch (err) {
      setHoldError(
        (err instanceof Error ? err.message : 'Lỗi kết nối') +
        '. Nếu mạng bị ngắt, không gửi lại ngay vì ghế có thể đã được giữ.',
      );

      await loadSeats(token);
    } finally {
      clearTimeout(timer);
      setHolding(false);
    }
  }


  async function releaseHeldSeats() {
    if (!token || releasing || holds.length === 0) return;

    setReleasing(true);
    setHoldError('');
    const failed: string[] = [];

    try {
      for (const hold of holds) {
        try {
          const response = await fetch(
            `${API}/showtime-seats/release/${encodeURIComponent(
              String(hold.holdId)
            )}`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch {
          failed.push(hold.seatLabel);
        }
      }

      await loadSeats(token);

      if (failed.length) {
        setHoldError(
          `Chưa xác nhận nhả ghế ${failed.join(', ')}. ` +
          'Hãy kiểm tra lại trước khi thao tác tiếp.'
        );
      }
    } finally {
      setReleasing(false);
    }
  }

  async function loadSeats(accessToken: string) {
    setLoading(true);
    setError('');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(
        `${API}/showtime-seats/${showtimeId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(
          `Không tải được sơ đồ ghế (HTTP ${response.status})`,
        );
      }

      const result: SeatMap = await response.json();

      if (!Array.isArray(result.seats)) {
        throw new Error('Dữ liệu sơ đồ ghế không hợp lệ');
      }


      const holdsResponse = await fetch(
        `${API}/showtime-seats/my-holds/list`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: controller.signal,
        },
      );

      if (!holdsResponse.ok) {
        throw new Error('Không kiểm tra được các ghế đang giữ');
      }

      const allHolds: HoldRecord[] = await holdsResponse.json();

      if (!Array.isArray(allHolds)) {
        throw new Error('Danh sách giữ ghế không hợp lệ');
      }

      const seatIds = new Set(
        result.seats.map(seat => seat.showtimeSeatId)
      );

      const activeHolds = allHolds.filter(
        hold =>
          seatIds.has(Number(hold.showtimeSeatId)) &&
          new Date(hold.expiresAt).getTime() > Date.now()
      );

      setHolds(activeHolds);
      setClock(Date.now());

      setMap(result);
      setSelected([]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tải sơ đồ ghế',
      );
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  async function login() {
    if (!email.trim() || !password) {
      setError('Vui lòng nhập email và mật khẩu.');
      return;
    }

    if (!API) {
      setError('Chưa cấu hình địa chỉ Backend.');
      return;
    }

    setLoading(true);
    setError('');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? 'Email hoặc mật khẩu không đúng.'
            : `Đăng nhập thất bại (HTTP ${response.status})`,
        );
      }

      const result = await response.json();

      if (typeof result.accessToken !== 'string') {
        throw new Error('Backend không trả accessToken.');
      }

      setToken(result.accessToken);
      setPassword('');
      await loadSeats(result.accessToken);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể đăng nhập',
      );
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    const grouped = new Map<string, Seat[]>();

    for (const seat of map?.seats ?? []) {
      const row = seat.seatRow || '?';
      const existing = grouped.get(row) ?? [];
      existing.push(seat);
      grouped.set(row, existing);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([row, seats]) => ({
        row,
        seats: seats.sort(
          (a, b) =>
            (a.seatNumber ?? 0) - (b.seatNumber ?? 0),
        ),
      }));
  }, [map]);

  const selectedSeats = (map?.seats ?? []).filter(
    (seat) => selected.includes(seat.showtimeSeatId),
  );

  const totalPrice = selectedSeats.reduce(
    (sum, seat) => sum + Number(seat.price),
    0,
  );

  function toggleSeat(seat: Seat) {
    if (seat.status !== 'AVAILABLE' || remainingSeconds > 0) return;

    const id = seat.showtimeSeatId;

    if (selected.includes(id)) {
      setSelected(selected.filter((item) => item !== id));
      return;
    }

    if (selected.length >= 8) {
      Alert.alert('Giới hạn', 'Chỉ được chọn tối đa 8 ghế.');
      return;
    }

    setSelected([...selected, id]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Pressable onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>‹ Quay lại phim</Text>
        </Pressable>

        <Text style={styles.title}>Chọn ghế</Text>
        <Text style={styles.subtitle}>
          Suất chiếu #{showtimeId}
        </Text>

        {!token ? (
          <View style={styles.card}>
            <Text style={styles.heading}>
              Đăng nhập CineHunt
            </Text>

            <Text style={styles.muted}>
              Đăng nhập để xem trạng thái ghế thực tế.
            </Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#8792AD"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Mật khẩu"
              placeholderTextColor="#8792AD"
              secureTextEntry
              style={styles.input}
            />

            <Pressable
              disabled={loading}
              onPress={() => void login()}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>
                Đăng nhập và xem ghế
              </Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Text style={styles.success}>
              ✓ Đã xác thực JWT
            </Text>

            {map && (
              <>
                <Text style={styles.heading}>
                  {map.cinemaName || 'Rạp CineHunt'}
                </Text>

                <Text style={styles.muted}>
                  {map.roomName || 'Phòng chiếu'}
                  {' · '}
                  {map.totalSeats} ghế
                </Text>

                <View style={styles.screen}>
                  <Text style={styles.screenText}>
                    MÀN HÌNH CHIẾU
                  </Text>
                </View>

                {rows.map(({ row, seats }) => (
                  <View style={styles.seatRow} key={row}>
                    <Text style={styles.rowLabel}>{row}</Text>

                    <ScrollView horizontal>
                      <View style={styles.seatList}>
                        {seats.map((seat) => {
                          const active = selected.includes(
                            seat.showtimeSeatId,
                          );

                          const available =
                            seat.status === 'AVAILABLE';

                          return (
                            <Pressable
                              key={seat.showtimeSeatId}
                              disabled={!available || remainingSeconds > 0}
                              accessibilityRole="button"
                              accessibilityLabel={
                                `Ghế ${seat.seatLabel ?? ''}, ` +
                                `trạng thái ${seat.status}`
                              }
                              onPress={() => toggleSeat(seat)}
                              style={[
                                styles.seat,
                                !available && styles.unavailable,
                                active && styles.selected,
                              ]}
                            >
                              <Text style={styles.seatText}>
                                {seat.seatNumber ?? '?'}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                ))}

                {!map.seatsGenerated && (
                  <Text style={styles.error}>
                    Suất chiếu chưa có sơ đồ ghế.
                  </Text>
                )}

                <Text style={styles.muted}>
                  Xanh: còn trống · Tím: đã chọn ·
                  Xám: không thể chọn
                </Text>

                <View style={styles.summary}>
                  <Text style={styles.heading}>
                    Ghế đang chọn mới: {selected.length}/8
                  </Text>

                  <Text style={styles.price}>
                    {money(totalPrice)}
                  </Text>

                  <Text style={styles.muted}>
                    Chỉ chọn tạm thời trên điện thoại.
                    Chưa giữ ghế và chưa tạo đơn.
                  </Text>
                </View>

                {remainingSeconds > 0 && (
                  <View style={styles.summary}>
                    <Text style={styles.success}>
                      Đã giữ ghế trên SQL Server
                    </Text>
                    <Text style={styles.heading}>
                      {holds.map(h => h.seatLabel).join(', ')}
                    </Text>
                    <Text style={styles.price}>
                      Còn {Math.floor(remainingSeconds / 60)}:
                      {String(remainingSeconds % 60).padStart(2, '0')}
                    </Text>
                    <Text style={styles.muted}>
                      Ghế sẽ tự hết hạn nếu không tiếp tục đặt vé.
                    </Text>
                  </View>
                )}


                {remainingSeconds > 0 && (
                  <Pressable
                    disabled={releasing || loading}
                    style={styles.secondary}
                    onPress={() =>
                      Alert.alert(
                        'Nhả ghế đang giữ',
                        'Bạn muốn giải phóng các ghế này?',
                        [
                          { text: 'Không', style: 'cancel' },
                          {
                            text: 'Nhả ghế',
                            style: 'destructive',
                            onPress: () => void releaseHeldSeats(),
                          },
                        ],
                      )
                    }
                  >
                    <Text style={styles.secondaryText}>
                      {releasing
                        ? 'Đang nhả ghế...'
                        : 'Nhả các ghế đang giữ'}
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  disabled={
                    loading ||
                    holding ||
                    selected.length === 0 ||
                    remainingSeconds > 0
                  }
                  onPress={() => void holdSelectedSeats()}
                  style={[
                    styles.primary,
                    {
                      marginTop: 18,
                      opacity: (
                        loading ||
                        holding ||
                        selected.length === 0 ||
                        remainingSeconds > 0
                      ) ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text style={styles.primaryText}>
                    {holding
                      ? 'Đang giữ ghế...'
                      : remainingSeconds > 0
                        ? 'Đã giữ ghế'
                        : `Giữ ${selected.length} ghế trong 5 phút`}
                  </Text>
                </Pressable>

                {!!holdError && (
                  <Text style={styles.error}>{holdError}</Text>
                )}

                <Pressable
                  onPress={() => void loadSeats(token)}
                  style={styles.secondary}
                >
                  <Text style={styles.secondaryText}>
                    Tải lại trạng thái ghế
                  </Text>
                </Pressable>

                <BookingCheckout
                  token={token}
                  showtimeId={showtimeId}
                  holds={holds}
                  onRefresh={() => loadSeats(token)}
                />
              </>
            )}
          </View>
        )}

        {loading && (
          <ActivityIndicator
            color="#BDA1FF"
            style={{ marginTop: 20 }}
          />
        )}

        {!!error && (
          <Text style={styles.error}>{error}</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090E1B' },
  content: { padding: 20, paddingBottom: 80 },
  back: { marginBottom: 18 },
  backText: {
    color: '#57D5FF',
    fontSize: 16,
    fontWeight: '700',
  },
  title: { color: 'white', fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#A5B1C8', marginTop: 8 },
  card: {
    backgroundColor: '#171F33',
    padding: 20,
    borderRadius: 18,
    marginTop: 24,
    gap: 14,
  },
  heading: {
    color: 'white',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 8,
  },
  muted: {
    color: '#A5B1C8',
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#252D44',
    padding: 15,
    borderRadius: 12,
    color: 'white',
    fontSize: 15,
  },
  primary: {
    backgroundColor: '#BDA1FF',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#101629', fontWeight: '800' },
  success: {
    color: '#45DEB2',
    marginTop: 22,
    marginBottom: 18,
  },
  screen: {
    backgroundColor: '#303C58',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 28,
  },
  screenText: {
    color: '#CED8ED',
    fontSize: 12,
    letterSpacing: 2,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  rowLabel: {
    color: '#BDA1FF',
    width: 23,
    fontWeight: '800',
  },
  seatList: { flexDirection: 'row', gap: 7 },
  seat: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#30CDA1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailable: { backgroundColor: '#525B70' },
  selected: { backgroundColor: '#BDA1FF' },
  seatText: { color: '#101629', fontWeight: '800' },
  summary: {
    backgroundColor: '#171F33',
    padding: 18,
    borderRadius: 15,
    marginTop: 25,
  },
  price: {
    color: '#45DEB2',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
  },
  secondary: {
    borderWidth: 1,
    borderColor: '#57D5FF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  secondaryText: {
    color: '#57D5FF',
    fontWeight: '800',
  },
  error: { color: '#FF9FAE', marginTop: 15 },
});

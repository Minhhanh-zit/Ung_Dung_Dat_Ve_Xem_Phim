import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import SeatMapPanel from './seat-map-panel';

type Genre = {
  genreId: number;
  genreName: string;
};

type Movie = {
  movieId: number;
  title: string;
  originalTitle?: string | null;
  description?: string | null;
  durationMinutes: number;
  ageRating?: string | null;
  releaseDate?: string | null;
  director?: string | null;
  actors?: string | null;
  status: string;
  genres?: Genre[];
};

type Showtime = {
  showtimeId: number;
  startTime: string;
  endTime: string;
  basePrice: number | string;
  status: string;
  room?: {
    roomName?: string;
    cinema?: {
      cinemaName?: string;
      address?: string;
    };
  };
};

type Props = {
  movieId: number | null;
  onClose: () => void;
};

const API = (
  process.env.EXPO_PUBLIC_API_URL ?? ''
).replace(/\/+$/, '');

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));

const formatPrice = (value: number | string) =>
  `${Number(value).toLocaleString('vi-VN')}đ`;

export default function MovieDetailModal({
  movieId,
  onClose,
}: Props) {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [selectedShowtime, setSelectedShowtime] = useState<Showtime | null>(null);

  useEffect(() => {
    if (movieId === null) return;

    const controller = new AbortController();

    async function loadDetail() {
      setMovie(null);
      setShowtimes([]);
      setError('');
      setScheduleError('');
      setLoading(true);

      try {
        if (!API) {
          throw new Error('Chưa cấu hình API Backend');
        }

        const movieResponse = await fetch(
          `${API}/movies/${movieId}`,
          { signal: controller.signal },
        );

        if (!movieResponse.ok) {
          throw new Error(
            `Không tải được phim (HTTP ${movieResponse.status})`,
          );
        }

        const movieData: Movie = await movieResponse.json();

        if (controller.signal.aborted) return;
        setMovie(movieData);

        try {
          const response = await fetch(
            `${API}/showtimes/movie/${movieId}`,
            { signal: controller.signal },
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data: Showtime[] = await response.json();

          if (!Array.isArray(data)) {
            throw new Error('Lịch chiếu không đúng định dạng');
          }

          if (!controller.signal.aborted) {
            setShowtimes(data);
          }
        } catch (err) {
          if (!controller.signal.aborted) {
            setScheduleError(
              err instanceof Error
                ? err.message
                : 'Không tải được lịch chiếu',
            );
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Không tải được chi tiết phim',
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDetail();

    return () => controller.abort();
  }, [movieId]);

  const upcoming = showtimes
    .filter(
      (item) =>
        item.status === 'OPEN' &&
        new Date(item.startTime).getTime() > Date.now(),
    )
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() -
        new Date(b.startTime).getTime(),
    );

  return (
    <Modal
      visible={movieId !== null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />

        <View style={styles.header}>
          <Text style={styles.brand}>CINEHUNT</Text>

          <Pressable
            onPress={() => {
            setSelectedShowtime(null);
            onClose();
          }}
            accessibilityRole="button"
            accessibilityLabel="Đóng chi tiết phim"
            style={styles.close}
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        {selectedShowtime ? (
          <SeatMapPanel
            showtimeId={selectedShowtime.showtimeId}
            onBack={() => setSelectedShowtime(null)}
          />
        ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {loading && (
            <ActivityIndicator
              size="large"
              color="#BDA1FF"
              style={{ marginVertical: 35 }}
            />
          )}

          {!!error && (
            <Text style={styles.error}>{error}</Text>
          )}

          {movie && (
            <>
              <View style={styles.poster}>
                <Text style={styles.posterIcon}>🎬</Text>
              </View>

              <Text style={styles.title}>{movie.title}</Text>

              {!!movie.originalTitle && (
                <Text style={styles.subTitle}>
                  {movie.originalTitle}
                </Text>
              )}

              <View style={styles.tags}>
                <Text style={styles.tag}>
                  {movie.durationMinutes} phút
                </Text>

                {!!movie.ageRating && (
                  <Text style={styles.tag}>
                    {movie.ageRating}
                  </Text>
                )}

                <Text style={styles.tag}>
                  {movie.status === 'NOW_SHOWING'
                    ? 'Đang chiếu'
                    : 'Sắp chiếu'}
                </Text>
              </View>

              <Text style={styles.heading}>Nội dung phim</Text>

              <Text style={styles.description}>
                {movie.description || 'Đang cập nhật nội dung.'}
              </Text>

              <Text style={styles.info}>
                Thể loại: {movie.genres
                  ?.map((genre) => genre.genreName)
                  .join(', ') || 'Đang cập nhật'}
              </Text>

              {!!movie.director && (
                <Text style={styles.info}>
                  Đạo diễn: {movie.director}
                </Text>
              )}

              {!!movie.actors && (
                <Text style={styles.info}>
                  Diễn viên: {movie.actors}
                </Text>
              )}

              <Text style={styles.heading}>Lịch chiếu</Text>

              {!!scheduleError && (
                <Text style={styles.error}>
                  Không tải được lịch chiếu: {scheduleError}
                </Text>
              )}

              {!loading &&
                !scheduleError &&
                upcoming.length === 0 && (
                  <Text style={styles.empty}>
                    Hiện chưa có suất chiếu sắp tới.
                  </Text>
                )}

              {upcoming.map((showtime) => (
                <View
                  style={styles.showtimeCard}
                  key={showtime.showtimeId}
                >
                  <Text style={styles.cinema}>
                    {showtime.room?.cinema?.cinemaName ||
                      'Đang cập nhật tên rạp'}
                  </Text>

                  <Text style={styles.time}>
                    {formatDate(showtime.startTime)}
                  </Text>

                  <Text style={styles.info}>
                    Phòng: {showtime.room?.roomName ||
                      'Đang cập nhật'}
                  </Text>

                  <Text style={styles.price}>
                    Giá cơ bản: {formatPrice(showtime.basePrice)}
                  </Text>

                  <Pressable
                    style={styles.button}
                    accessibilityRole="button"
                    onPress={() => setSelectedShowtime(showtime)}
                  >
                    <Text style={styles.buttonText}>
                      Xem sơ đồ ghế
                    </Text>
                  </Pressable>
                </View>
              ))}
            </>
          )}
        </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090E1B' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    color: '#BDA1FF',
    fontWeight: '900',
    fontSize: 20,
    letterSpacing: 2,
  },
  close: {
    backgroundColor: '#26314C',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: 'white', fontSize: 17 },
  content: { padding: 20, paddingBottom: 80 },
  poster: {
    height: 170,
    backgroundColor: '#25284A',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  posterIcon: { fontSize: 68 },
  title: {
    color: 'white',
    fontSize: 27,
    fontWeight: '900',
  },
  subTitle: {
    color: '#A5B1C8',
    fontSize: 14,
    marginTop: 6,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  tag: {
    color: '#C9B4FF',
    backgroundColor: '#242143',
    padding: 10,
    borderRadius: 10,
    fontSize: 12,
  },
  heading: {
    color: 'white',
    fontSize: 21,
    fontWeight: '800',
    marginTop: 30,
    marginBottom: 14,
  },
  description: {
    color: '#D0D7E6',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 18,
  },
  info: {
    color: '#A5B1C8',
    fontSize: 14,
    marginBottom: 9,
  },
  showtimeCard: {
    backgroundColor: '#171F33',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#303B56',
    padding: 18,
    marginBottom: 14,
  },
  cinema: {
    color: 'white',
    fontWeight: '800',
    fontSize: 17,
    marginBottom: 10,
  },
  time: {
    color: '#57D5FF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  price: {
    color: '#48E3B4',
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#BDA1FF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#101629',
    fontWeight: '800',
  },
  error: { color: '#FF9FAE', marginVertical: 16 },
  empty: { color: '#A5B1C8', marginBottom: 20 },
});

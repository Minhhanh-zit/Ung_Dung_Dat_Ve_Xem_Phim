export type User = { userId: number; fullName?: string; email?: string; phone?: string; role?: string; avatarUrl?: string };
export type Genre = { genreId: number; genreName: string };
export type Movie = {
  movieId: number; title: string; originalTitle?: string | null;
  description?: string | null; durationMinutes: number; ageRating?: string | null;
  status: string; posterUrl?: string | null; releaseDate?: string | null;
  genres?: Genre[]; director?: string | null; actors?: string | null;
  averageRating?: number | null;
};
export type Showtime = {
  showtimeId: number; startTime: string; endTime?: string; status: string;
  basePrice: number | string; room?: { roomName?: string; cinema?: { cinemaName?: string; address?: string } };
};
export type Seat = {
  showtimeSeatId: number; seatId: number; seatLabel: string; seatRow: string | null;
  seatNumber: number | null; status: 'AVAILABLE'|'HELD'|'SOLD'|'BLOCKED';
  price: number | string; heldByUserId?: number | null;
};
export type SeatMap = {
  showtimeId: number; movieTitle?: string; cinemaName?: string; roomName?: string;
  totalSeats: number; seatsGenerated: boolean; seats: Seat[];
};
export type Hold = {
  holdId: string; showtimeSeatId: number; seatLabel: string; status: string;
  expiresAt: string; price?: number | string;
};
export type Booking = {
  bookingId: string; bookingCode: string; showtimeId: number; status: string;
  seatCount?: number; totalAmount: number | string; expiresAt?: string | null;
  idempotencyKey?: string | null; showtime?: { movie?: Movie; room?: Showtime['room']; startTime?: string };
  bookingDetails?: { showtimeSeat?: { seat?: {seatLabel?: string} } }[];
};
export type PaymentMethod = {code: string; name: string; enabled: boolean; note?: string};
export type Payment = {
  paymentId: string; bookingId: string; paymentMethod: string; paymentStatus: string;
  transactionCode?: string; amount: number; createdAt?: string;
};
export type Ticket = {
  ticketId: string; ticketCode: string; qrCode: string;
  ticketStatus: string; movieTitle?: string; seatCode?: string;
  showDate?: string; showTime?: string; orderCode?: string;
};
export type Screen = 'main'|'detail'|'seats'|'booking'|'tickets'|'auth';
export type Tab = 'movies'|'discover'|'orders'|'account';

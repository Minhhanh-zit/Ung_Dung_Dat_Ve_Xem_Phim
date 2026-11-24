import React from 'react';
import { Alert, Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import Account from '../src/cinehunt/Account';
import CinemaSchedule from '../src/cinehunt/CinemaSchedule';
import SeatFlow from '../src/cinehunt/SeatFlow';
import { api, createKey } from '../src/services/apiClient';
import { saveRefreshToken } from '../src/store/persist';
import { loadPublicCatalog } from '../src/cinehunt/publicCatalog';
import type { Booking, Hold, Movie, Seat, SeatMap, Showtime, User } from '../src/types';

jest.mock('../src/services/apiClient', () => ({
  ...jest.requireActual('../src/services/apiClient'), api: jest.fn(), createKey: jest.fn(() => 'cinehunt-test-order'),
}));
jest.mock('../src/store/persist', () => ({ saveRefreshToken: jest.fn(async () => {}) }));
jest.mock('../src/cinehunt/publicCatalog', () => ({ loadPublicCatalog: jest.fn() }));
jest.mock('../src/cinehunt/theme', () => ({
  useCineHuntTheme: () => ({ C: jest.requireActual('../src/cinehunt/themeTokens').PALETTES.light, S: {}, isDark: false }),
}));
jest.mock('../src/cinehunt/icons', () => ({ AppIcon: () => null }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: jest.requireActual('react-native').View },
  interpolate: jest.fn(() => 0), interpolateColor: jest.fn(() => '#ffffff'), useAnimatedStyle: jest.fn(() => ({})),
}));
const request = api as jest.Mock;
const catalog = loadPublicCatalog as jest.Mock;
const user: User = { userId: 7, fullName: 'Test Customer', email: 'customer@example.test', role: 'CUSTOMER' };
const movie: Movie = { movieId: 5, title: 'Phim kiểm thử lịch', durationMinutes: 100, ageRating: 'P', status: 'NOW_SHOWING' };
const cinema = { cinemaId: 1, cinemaName: 'CineHunt Cầu Giấy' };
function tomorrow(hour: number) { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(hour,0,0,0); return d; }
function dayKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
const showtime: Showtime = { showtimeId: 41, movieId: 5, startTime: tomorrow(14).toISOString(), status: 'OPEN', basePrice: 90000, room: { cinema } };
const booking: Booking = { bookingId: 'B-41', bookingCode: 'CH-41', showtimeId: 41, status: 'PENDING_PAYMENT', totalAmount: 90000 };
const seat = (id: number, label: string, row: string, n: number, status: Seat['status']='AVAILABLE', type='STANDARD'): Seat => ({ showtimeSeatId:id,seatId:id,seatLabel:label,seatRow:row,seatNumber:n,status,price:90000,seatTypeCode:type });
const seats = [seat(1,'A1','A',1), seat(2,'A2','A',2,'SOLD'), seat(3,'J1','J',1,'AVAILABLE','CH_COUPLE'), seat(4,'J2','J',2,'AVAILABLE','CH_COUPLE')];
const map: SeatMap = { showtimeId:41, movieTitle:movie.title, totalSeats:4, seatsGenerated:true, seats };
const hold = (s: Seat): Hold => ({ holdId:`H-${s.showtimeSeatId}`,showtimeSeatId:s.showtimeSeatId,seatLabel:s.seatLabel,status:'HELD',expiresAt:new Date(Date.now()+600000).toISOString(),price:s.price });
function apiRoutes(options: { holds?: Hold[]; orders?: Booking[]; failBooking?: boolean; recover?: boolean } = {}) {
  let orders = options.orders ?? [];
  let currentHolds = options.holds ?? [];
  request.mockImplementation(async (path: string, opts?: {method?: string; body?: unknown}) => {
    if (path === '/showtimes/41/age-policy') return {showtimeId:41,movieId:5,movieTitle:movie.title,rating:'P',action:'ALLOW',message:'Được xem',confirmLabel:null};
    if (path === '/concession-combos') return [{comboId:8,name:'Combo test',price:45000}];
    if (path === '/showtime-seats/41') return {...map,seats:seats.map(s=>currentHolds.some(h=>h.showtimeSeatId===s.showtimeSeatId)?{...s,status:'HELD'}:s)};
    if (path === '/showtime-seats/my-holds/list') return currentHolds;
    if (path === '/bookings/my') return orders;
    if (path === '/showtime-seats/hold') { const h=hold(seats[0]); currentHolds=[...currentHolds,h]; return h; }
    if (path === '/showtime-seats/hold-many') { const hs=seats.slice(2).map(hold); currentHolds=[...currentHolds,...hs]; return hs; }
    if (path.startsWith('/showtime-seats/release/')) { currentHolds=[]; return {releasedSeat:true}; }
    if (path === '/bookings' && opts?.method === 'POST') {
      if (options.failBooking) { if (options.recover) orders=[{...booking,idempotencyKey:'cinehunt-test-order'}]; throw Error('Mất kết nối khi tạo đơn'); }
      return booking;
    }
    throw Error(`Unexpected mock API: ${path}`);
  });
}
async function confirmAlert(label: string, spy: jest.SpyInstance) {
  const args = spy.mock.calls[spy.mock.calls.length-1] as Parameters<typeof Alert.alert>;
  const callback = args?.[2]?.find(b=>b.text===label)?.onPress;
  expect(callback).toBeDefined();
  await act(async () => { callback?.(); });
}
beforeEach(()=>{request.mockReset();catalog.mockReset();});
afterEach(()=>jest.restoreAllMocks());

describe('Account production screen',()=>{
  test('validates required credentials without sending a request',async()=>{
    const ui=await render(<Account token={null} user={null} onLogin={jest.fn()} onLogout={jest.fn()}/>);
    await fireEvent.press(ui.getByLabelText('Đăng nhập'));
    expect(ui.getByText('Nhập email và mật khẩu.')).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
  });
  test('logs in with trimmed email and stores native refresh token',async()=>{
    request.mockResolvedValue({accessToken:'access-test',refreshToken:'refresh-test',user});
    const onLogin=jest.fn();
    const ui=await render(<Account token={null} user={null} onLogin={onLogin} onLogout={jest.fn()}/>);
    await fireEvent.changeText(ui.getByPlaceholderText('Email'),'  customer@example.test  ');
    await fireEvent.changeText(ui.getByPlaceholderText('Mật khẩu'),'Password123');
    await fireEvent.press(ui.getByLabelText('Đăng nhập'));
    await waitFor(()=>expect(onLogin).toHaveBeenCalledWith('access-test',user));
    expect(request).toHaveBeenCalledWith(Platform.OS==='web'?'/auth/login':'/auth/native/login',{method:'POST',body:{email:'customer@example.test',password:'Password123'}});
    if(Platform.OS!=='web')expect(saveRefreshToken).toHaveBeenCalledWith('refresh-test');
  });
  test('registers with trimmed input and returns to login',async()=>{
    request.mockResolvedValue({});
    const ui=await render(<Account token={null} user={null} onLogin={jest.fn()} onLogout={jest.fn()}/>);
    await fireEvent.press(ui.getByLabelText('Chưa có tài khoản? Đăng ký'));
    await fireEvent.changeText(ui.getByPlaceholderText('Email'),'new@example.test');
    await fireEvent.changeText(ui.getByPlaceholderText('Mật khẩu'),'Password123');
    await fireEvent.press(ui.getByLabelText('Tạo tài khoản'));
    expect(ui.getByText('Nhập họ và tên.')).toBeTruthy();
    await fireEvent.changeText(ui.getByPlaceholderText('Họ và tên'),'  New Customer  ');
    await fireEvent.press(ui.getByLabelText('Tạo tài khoản'));
    await waitFor(()=>expect(ui.getByText('Đăng ký thành công. Vui lòng đăng nhập.')).toBeTruthy());
    expect(request).toHaveBeenCalledWith('/auth/register',{method:'POST',body:{fullName:'New Customer',email:'new@example.test',password:'Password123',phone:undefined}});
  });
  test('loads customer profile and membership, saves profile, and logs out even offline',async()=>{
    request.mockImplementation(async (path:string, opts?:{method?:string})=>{
      if(path==='/users/me')return opts?.method==='PATCH'?{...user,fullName:'Updated'}:user;
      if(path==='/notifications')return [{notificationId:'N1',title:'Test thông báo'}];
      if(path==='/users/me/membership')return {tier:'Gold',points:120,progressPercent:150,paidBookings:2};
      if(path==='/auth/logout')throw Error('offline');
      throw Error(path);
    });
    const onLogout=jest.fn();const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});
    const ui=await render(<Account token="access" user={user} onLogin={jest.fn()} onLogout={onLogout}/>);
    await waitFor(()=>expect(ui.getByText('Test thông báo')).toBeTruthy());
    expect(ui.getByText('Gold')).toBeTruthy();expect(ui.getByText('Tiến độ: 100%')).toBeTruthy();
    expect(ui.queryByText('Nhân viên · Soát vé')).toBeNull();
    await fireEvent.changeText(ui.getByPlaceholderText('Họ và tên'),' Updated ');
    await fireEvent.press(ui.getByLabelText('Lưu thay đổi'));
    await waitFor(()=>expect(ui.getByText('Đã lưu thông tin tài khoản.')).toBeTruthy());
    expect(request).toHaveBeenCalledWith('/users/me',{method:'PATCH',token:'access',body:{fullName:'Updated',phone:''}});
    await fireEvent.press(ui.getByLabelText('Đăng xuất'));await confirmAlert('Đăng xuất',alert);
    await waitFor(()=>expect(onLogout).toHaveBeenCalledTimes(1));expect(saveRefreshToken).toHaveBeenCalledWith(null);
  });
  test('staff confirms ticket check-in, customer does not get the staff control',async()=>{
    const staff={...user,role:'STAFF'};
    request.mockImplementation(async(path:string)=>{
      if(path==='/users/me')return staff;
      if(path==='/notifications')return [];
      if(path==='/users/me/membership')return {};
      if(path==='/tickets/TICKET-41/checkin')return {message:'Soát vé thành công'};
      throw Error(path);
    });
    const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});
    const ui=await render(<Account token="staff" user={staff} onLogin={jest.fn()} onLogout={jest.fn()}/>);
    await waitFor(()=>expect(ui.getByText('Bạn chưa có thông báo mới.')).toBeTruthy());
    await fireEvent.changeText(ui.getByPlaceholderText('TICKET-... hoặc BK-...'),'TICKET-41');
    await waitFor(()=>expect(ui.getByLabelText('Kiểm tra và check-in').props.accessibilityState.disabled).toBe(false));
    await fireEvent.press(ui.getByLabelText('Kiểm tra và check-in'));await confirmAlert('Check-in',alert);
    await waitFor(()=>expect(ui.getByText('Soát vé thành công')).toBeTruthy());
    expect(request).toHaveBeenCalledWith('/tickets/TICKET-41/checkin',{method:'POST',token:'staff'});
  });
});

describe('CinemaSchedule production screen',()=>{
  test('no cinema does not fetch schedules',async()=>{
    const ui=await render(<CinemaSchedule cinemas={[]} onSeats={jest.fn()}/>);
    expect(ui.getByText('Chưa có rạp để xem lịch chiếu.')).toBeTruthy();expect(request).not.toHaveBeenCalled();
  });
  test('loads on demand and filters by date, cinema, OPEN status; forwards the selected showtime',async()=>{
    request.mockResolvedValue([showtime,{...showtime,showtimeId:42,status:'CLOSED',startTime:tomorrow(15).toISOString()},{...showtime,showtimeId:43,room:{cinema:{cinemaId:2}},startTime:tomorrow(16).toISOString()}]);
    catalog.mockResolvedValue({items:[movie],total:1});const onSeats=jest.fn();
    const ui=await render(<CinemaSchedule cinemas={[cinema]} onSeats={onSeats}/>);
    expect(request).not.toHaveBeenCalled();
    await fireEvent.press(ui.getByLabelText(`Chọn lịch ${cinema.cinemaName}`));
    await fireEvent.press(ui.getByLabelText(`Lịch ngày ${dayKey(tomorrow(14))}`));
    await waitFor(()=>expect(ui.getByLabelText('Đặt vé 14:00')).toBeTruthy());
    expect(ui.queryByLabelText('Đặt vé 15:00')).toBeNull();expect(ui.queryByLabelText('Đặt vé 16:00')).toBeNull();
    await fireEvent.press(ui.getByLabelText('Đặt vé 14:00'));expect(onSeats).toHaveBeenCalledWith(showtime);
  });
  test('shows backend error then reloads successfully',async()=>{
    request.mockRejectedValueOnce(Error('Lỗi lịch chiếu')).mockResolvedValue([]);catalog.mockResolvedValue({items:[],total:0});
    const ui=await render(<CinemaSchedule cinemas={[cinema]} onSeats={jest.fn()}/>);
    await fireEvent.press(ui.getByLabelText(`Chọn lịch ${cinema.cinemaName}`));
    await waitFor(()=>expect(ui.getByText('Lỗi lịch chiếu')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('Làm mới lịch chiếu'));
    await waitFor(()=>expect(ui.getByText(/Rạp chưa có suất chiếu mở bán/)).toBeTruthy());
  });
});

describe('SeatFlow production screen',()=>{
  const props={user,showtime,onBack:jest.fn(),onAuth:jest.fn(),onBooking:jest.fn()};
  test('guest must authenticate after age policy is verified',async()=>{
    apiRoutes();const ui=await render(<SeatFlow {...props} token={null}/>);
    await waitFor(()=>expect(ui.getByLabelText('Đăng nhập để chọn ghế')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('Đăng nhập để chọn ghế'));expect(props.onAuth).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalledWith('/showtime-seats/41',expect.anything());
  });
  test('selects a free seat, blocks sold seat, and holds a couple as two seats',async()=>{
    apiRoutes();const ui=await render(<SeatFlow {...props} token="access"/>);
    await waitFor(()=>expect(ui.getByText('Chạm ghế để chọn · tối đa 8 ghế')).toBeTruthy());
    await fireEvent(ui.getByText('Chạm ghế để chọn · tối đa 8 ghế'),'layout',{nativeEvent:{layout:{width:400,height:100,x:0,y:0}}});
    await waitFor(()=>expect(ui.getByLabelText(/^A1, /).props.accessibilityState.disabled).toBe(false));
    expect(ui.getByLabelText(/^A2, /).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(ui.getByLabelText(/^A1, /));
    await waitFor(()=>expect(ui.getByText('Đang giữ 1/8 ghế')).toBeTruthy());
    expect(request).toHaveBeenCalledWith('/showtime-seats/hold',expect.objectContaining({body:{showtimeSeatId:1,holdMinutes:10}}));
    await fireEvent.press(ui.getByLabelText(/^J1–J2, /));
    await waitFor(()=>expect(ui.getByText('Đang giữ 3/8 ghế')).toBeTruthy());
    expect(request).toHaveBeenCalledWith('/showtime-seats/hold-many',expect.objectContaining({body:{showtimeSeatIds:[3,4],holdMinutes:10}}));
  });
  test('existing pending order is opened rather than creating another',async()=>{
    apiRoutes({orders:[booking]});const onBooking=jest.fn();const ui=await render(<SeatFlow {...props} onBooking={onBooking} token="access"/>);
    await waitFor(()=>expect(ui.getByText('Bạn đã có đơn chờ thanh toán')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('Mở đơn đã tạo'));expect(onBooking).toHaveBeenCalledWith('B-41');
    expect(request).not.toHaveBeenCalledWith('/bookings',expect.anything());
  });
  test('creates a booking from valid holds with combo, voucher and idempotency key',async()=>{
    apiRoutes({holds:[hold(seats[0])]});const onBooking=jest.fn();const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});
    const ui=await render(<SeatFlow {...props} onBooking={onBooking} token="access"/>);
    await waitFor(()=>expect(ui.getByText('Đang giữ 1/8 ghế')).toBeTruthy());
    await waitFor(()=>expect(ui.getByLabelText('Tăng Combo test')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('Tăng Combo test'));await fireEvent.changeText(ui.getByPlaceholderText('Mã giảm giá (nếu có)'),' SAVE10 ');
    await waitFor(()=>expect(ui.getByLabelText('Tiếp tục tạo đơn chờ thanh toán').props.accessibilityState.disabled).toBe(false));
    await fireEvent.press(ui.getByLabelText('Tiếp tục tạo đơn chờ thanh toán'));await confirmAlert('Tạo đơn',alert);
    await waitFor(()=>expect(onBooking).toHaveBeenCalledWith('B-41'));
    expect(createKey).toHaveBeenCalled();expect(request).toHaveBeenCalledWith('/bookings',{method:'POST',token:'access',body:{holdIds:['H-1'],idempotencyKey:'cinehunt-test-order',products:[{productId:8,quantity:1}],voucherCode:'SAVE10'}});
  });
  test('recovers uncertain booking by matching its idempotency key',async()=>{
    apiRoutes({holds:[hold(seats[0])],failBooking:true,recover:true});const onBooking=jest.fn();const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});
    const ui=await render(<SeatFlow {...props} token="access" onBooking={onBooking}/>);
    await waitFor(()=>expect(ui.getByText('Đang giữ 1/8 ghế')).toBeTruthy());
    await waitFor(()=>expect(ui.getByLabelText('Tiếp tục tạo đơn chờ thanh toán').props.accessibilityState.disabled).toBe(false));
    await fireEvent.press(ui.getByLabelText('Tiếp tục tạo đơn chờ thanh toán'));await confirmAlert('Tạo đơn',alert);
    await waitFor(()=>expect(onBooking).toHaveBeenCalledWith('B-41'));
    expect(request.mock.calls.filter(([path])=>path==='/bookings')).toHaveLength(1);
  });
  test('unconfirmed booking disables repeated creation rather than resending',async()=>{
    apiRoutes({holds:[hold(seats[0])],failBooking:true});const onBooking=jest.fn();const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});
    const ui=await render(<SeatFlow {...props} token="access" onBooking={onBooking}/>);
    await waitFor(()=>expect(ui.getByText('Đang giữ 1/8 ghế')).toBeTruthy());
    await waitFor(()=>expect(ui.getByLabelText('Tiếp tục tạo đơn chờ thanh toán').props.accessibilityState.disabled).toBe(false));
    await fireEvent.press(ui.getByLabelText('Tiếp tục tạo đơn chờ thanh toán'));await confirmAlert('Tạo đơn',alert);
    await waitFor(()=>expect(ui.getByText(/KHÔNG tạo lại ngay/)).toBeTruthy());
    expect(ui.getByLabelText('Tiếp tục tạo đơn chờ thanh toán').props.accessibilityState.disabled).toBe(true);expect(onBooking).not.toHaveBeenCalled();
  });
  test('releases confirmed holds using the existing hold ID',async()=>{
    apiRoutes({holds:[hold(seats[0])]});const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});
    const ui=await render(<SeatFlow {...props} token="access"/>);
    await waitFor(()=>expect(ui.getByText('Đang giữ 1/8 ghế')).toBeTruthy());
    await waitFor(()=>expect(ui.getByLabelText('Nhả các ghế đang giữ').props.accessibilityState.disabled).toBe(false));
    await fireEvent.press(ui.getByLabelText('Nhả các ghế đang giữ'));await confirmAlert('Nhả ghế',alert);
    await waitFor(()=>expect(ui.getByText('Đang giữ 0/8 ghế')).toBeTruthy());
    expect(request).toHaveBeenCalledWith('/showtime-seats/release/H-1',{token:'access',method:'POST'});
  });
});

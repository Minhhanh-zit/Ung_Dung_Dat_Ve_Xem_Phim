import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminCinemasPage from '../src/pages/admin/AdminCinemasPage';

const api=vi.hoisted(()=>({getAll:vi.fn(),getRooms:vi.fn(),create:vi.fn(),update:vi.fn(),remove:vi.fn(),createRoom:vi.fn(),updateRoom:vi.fn(),generateRoomSeats:vi.fn(),removeRoom:vi.fn()}));
vi.mock('../src/api/adminApi',()=>({cinemaApi:api}));
const cinema={cinemaId:7,cinemaName:'Test Cinema',address:'Test Address'};
const room={roomId:12,roomName:'Room A',roomType:'STANDARD',status:'ACTIVE',totalSeats:120,actualSeats:0};
const click=(name:string)=>fireEvent.click(screen.getByRole('button',{name,exact:true}));
const input=(label:string,value:string)=>fireEvent.change(screen.getByLabelText(label),{target:{value}});
const roomRow=()=>screen.getByText('Room A').closest('tr') as HTMLTableRowElement;
const roomButton=(name:string)=>fireEvent.click(within(roomRow()).getByRole('button',{name,exact:true}));

beforeEach(()=>{
  vi.resetAllMocks();
  api.getAll.mockResolvedValue([cinema]);
  api.getRooms.mockResolvedValue([room]);
});

it('shows room capacity and generates missing seats only after a click',async()=>{
  render(<AdminCinemasPage/>);
  await screen.findByText('Test Cinema');
  click('Phòng chiếu');
  await screen.findByText('Room A');
  expect(screen.getByText('0 / 120')).toBeInTheDocument();
  api.generateRoomSeats.mockResolvedValueOnce({created:120,total:120});
  api.getRooms.mockResolvedValue([{...room,actualSeats:120}]);
  roomButton('Sinh 120 ghế');
  expect(await screen.findByText('Đã sinh 120 ghế cho phòng')).toBeInTheDocument();
  expect(await screen.findByText('120 / 120')).toBeInTheDocument();
  expect(api.generateRoomSeats).toHaveBeenCalledWith(7,12);
  expect(screen.queryByRole('button',{name:'Sinh 120 ghế'})).toBeNull();
});

it('creates rooms with fixed 120 seats and updates name without rewriting capacity',async()=>{
  render(<AdminCinemasPage/>);
  await screen.findByText('Test Cinema');
  click('Phòng chiếu');
  await screen.findByText('Room A');
  click('+ Thêm phòng');
  expect(screen.getByLabelText('Tổng số ghế')).toHaveAttribute('readonly');
  click('Lưu');
  expect(await screen.findByText('Vui lòng nhập tên phòng')).toBeInTheDocument();
  input('Tên phòng','  New Room  ');
  input('Loại phòng','VIP');
  click('Lưu');
  await waitFor(()=>expect(api.createRoom).toHaveBeenCalledWith(7,{roomName:'New Room',roomType:'VIP',totalSeats:120}));
  expect(await screen.findByText('Đã thêm phòng và tự động sinh 120 ghế')).toBeInTheDocument();
  await waitFor(()=>expect(screen.queryByLabelText('Tên phòng')).toBeNull());
  await screen.findByText('Room A');
  roomButton('Sửa');
  input('Tên phòng','Updated Room');
  click('Lưu');
  await waitFor(()=>expect(api.updateRoom).toHaveBeenCalledWith(7,12,{roomName:'Updated Room',roomType:'STANDARD'}));
  expect(await screen.findByText('Đã cập nhật phòng chiếu')).toBeInTheDocument();
});

it('reports generation failure, permits retry, and handles room deletion confirmation',async()=>{
  render(<AdminCinemasPage/>);
  await screen.findByText('Test Cinema');
  click('Phòng chiếu');
  await screen.findByText('Room A');
  api.generateRoomSeats.mockRejectedValueOnce(new Error('locked')).mockResolvedValueOnce({created:0,total:120});
  roomButton('Sinh 120 ghế');
  expect(await screen.findByText('locked')).toBeInTheDocument();
  await waitFor(()=>expect(screen.getByRole('button',{name:'Sinh 120 ghế'})).not.toBeDisabled());
  roomButton('Sinh 120 ghế');
  expect(await screen.findByText('Phòng đã có đủ ghế')).toBeInTheDocument();
  await screen.findByText('Room A');
  roomButton('Xoá');
  click('Huỷ');
  expect(api.removeRoom).not.toHaveBeenCalled();
  roomButton('Xoá');
  click('Xác nhận');
  await waitFor(()=>expect(api.removeRoom).toHaveBeenCalledWith(7,12));
});

it('handles empty rooms, load errors and inactive room visibility',async()=>{
  api.getRooms.mockRejectedValueOnce(new Error('Room unavailable')).mockResolvedValueOnce([{...room,status:'INACTIVE'}]);
  render(<AdminCinemasPage/>);
  await screen.findByText('Test Cinema');
  click('Phòng chiếu');
  expect(await screen.findByText('Room unavailable')).toBeInTheDocument();
  expect(await screen.findByText('Rạp này chưa có phòng chiếu')).toBeInTheDocument();
  click('Phòng chiếu');
  await screen.findByText('Room A');
  expect(screen.queryByRole('button',{name:'Sinh 120 ghế'})).toBeNull();
  click('Đóng');
  expect(screen.queryByText('Room A')).toBeNull();
});

// CINEHUNT_WEB_MOBILE_SEAT_SYNC_V1
// CINEHUNT_COUPLE_PAIR_V1
import React from 'react';
import type { SeatItemProps } from '../../types/seat.types';
import './SeatMap.css';

const SeatItem: React.FC<SeatItemProps> = ({ seat, selected, onClick, disabled = false, pairLabel }) => {
  // CINEHUNT_SEAT120: price and type come from the seat map API.
  const typeCode=String(seat.type??'').toUpperCase();
  const kind=typeCode.includes('COUPLE')?'couple':typeCode.includes('VIP')?'vip':'standard';
  // CINEHUNT_BETA_SEAT_V4: label includes row and number.
  const visualStatus = seat.status === 'BOOKED' ? 'SOLD' : seat.status;
  const isDisabled = disabled || ['SOLD','BOOKED','HELD','BLOCKED'].includes(seat.status);

  const getTooltip = () => {
    if (selected) return 'Bỏ chọn ghế';
    const map: Record<string, string> = {
      HELD: 'Ghế đang được giữ',
      SOLD: 'Ghế đã bán',
      BOOKED: 'Ghế đã bán',
      BLOCKED: 'Ghế bị khóa',
      AVAILABLE: 'Chọn ghế',
    };
    return map[seat.status] ?? '';
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!isDisabled) onClick();
  };

  const getStatusClass = () => selected ? 'selected' : visualStatus.toLowerCase();

  return (
    <button
      type="button"
      disabled={isDisabled}
      data-seat-number={seat.seatNumber}
      className={`seat ${getStatusClass()} seat-kind-${kind} ${pairLabel?'ch-couple-pair':''} ${isDisabled ? 'disabled' : ''}`}
      onClick={handleClick}
      style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.85 : 1 }}
      title={`${getTooltip()} · ${kind==='vip'?'VIP':kind==='couple'?pairLabel?'Ghế đôi / cặp':'Ghế đôi / chỗ':'Thường'} · ${seat.price==null?'Chưa có giá':Number(seat.price).toLocaleString('vi-VN')+' đ'}`}
      aria-pressed={selected}
      aria-disabled={isDisabled}
      aria-label={`Ghế ${pairLabel??`${seat.rowName}${seat.seatNumber}`} - ${seat.status}`}
    >
      <span className="seat-number">{pairLabel??`${seat.rowName}${seat.seatNumber}`}</span>
      {isDisabled && seat.status !== 'SELECTED' && (
        <span className="seat-status-icon">
          {(seat.status === 'SOLD' || seat.status === 'BOOKED') && '✕'}
          {seat.status === 'HELD' && '⏳'}
          {seat.status === 'BLOCKED' && '⊘'}
        </span>
      )}
    </button>
  );
};

export default SeatItem;

import { isCouple, seatGroup } from '../../utils/coupleSeats'; // CINEHUNT_COUPLE_PAIR_V1
import React, { useMemo, useState } from 'react';
import type { SeatMapProps, GroupedSeats, SeatId } from '../../types/seat.types';
import { UNSELECTABLE_STATUSES } from '../../types/seat.types';
import SeatItem from './SeatItem';
import './SeatMap.css';

const SeatMap: React.FC<SeatMapProps> = ({
  seats,
  selectedIds,
  onSeatToggle,
  maxSeats = 10,
  heldIds,
  showLegend = true,
}) => {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const selected = useMemo(() => selectedIds ?? new Set<string>(), [selectedIds]);

  const groupedSeats = useMemo((): GroupedSeats => {
    const groups: GroupedSeats = {};
    seats.forEach((seat) => {
      if (!groups[seat.rowName]) groups[seat.rowName] = [];
      groups[seat.rowName].push(seat);
    });
    Object.keys(groups).forEach((row) =>
      groups[row].sort((a, b) => a.seatNumber - b.seatNumber),
    );
    return groups;
  }, [seats]);

  const rowNames = useMemo(() => Object.keys(groupedSeats).sort(), [groupedSeats]);

  const isDisabled = (seatId: SeatId, status: string): boolean =>
    UNSELECTABLE_STATUSES.includes(status as never) || (heldIds?.has(String(seatId)) ?? false);

  const isSelected = (seatId: SeatId): boolean => selected.has(String(seatId));

  const handleSeatClick = (seatId: SeatId) => {
    const seat = seats.find((s) => String(s.id) === String(seatId));
    if (!seat || isDisabled(seat.id, seat.status)) return;

    const key = String(seat.id);
    const group=seatGroup(seats,seat);
    if (isCouple(seat)&&group.length!==2)return;
    if (!group.some(s=>selected.has(String(s.id))) && selected.size+group.length > maxSeats) {
      setWarning(`Bạn chỉ có thể chọn tối đa ${maxSeats} ghế`);
      return;
    }
    setWarning(null);
    onSeatToggle?.(key);
  };

  // CINEHUNT_SEAT120: actual prices, not guessed from the row number.
  const priceFor = (kind: string) => {
    const values = seats.filter(s=>{const type=String(s.type??'').toUpperCase();return (type.includes('COUPLE')?'couple':type.includes('VIP')?'vip':'standard')===kind;}).map(s=>Number(s.price)).filter(Number.isFinite);
    if(!values.length)return '—';
    const money=(n:number)=>n.toLocaleString('vi-VN')+' đ';
    return Math.min(...values)===Math.max(...values)?money(values[0]):`${money(Math.min(...values))} – ${money(Math.max(...values))}`;
  };
  const totals=seats.filter(s=>isCouple(s)&&s.seatNumber%2===1).map(s=>seatGroup(seats,s)).filter(g=>g.length===2).map(g=>g.reduce((sum,s)=>sum+Number(s.price??0),0));
  const money=(n:number)=>n.toLocaleString('vi-VN')+' đ';
  const pairPrice=totals.length?(Math.min(...totals)===Math.max(...totals)?money(totals[0]):`${money(Math.min(...totals))} – ${money(Math.max(...totals))}`)+' / cặp':priceFor('couple')+' / chỗ (lịch cũ)';
  const stats = {
    available: seats.filter((s) => s.status === 'AVAILABLE').length,
    sold: seats.filter((s) => s.status === 'SOLD' || s.status === 'BOOKED').length,
  };

  return (
    <div className="seat-map-wrapper">
      <div className="seat-map-header">
        <h2 className="seat-map-title">Sơ đồ ghế</h2>
        <div className="seat-stats">
          <span className="stat-item available"><span className="stat-dot"></span>Trống: {stats.available}</span>
          <span className="stat-item selected"><span className="stat-dot"></span>Đã chọn: {selected.size}</span>
          <span className="stat-item sold"><span className="stat-dot"></span>Đã bán: {stats.sold}</span>
        </div>
      </div>

      {warning && (
        <p className="text-sm text-amber-500 mb-2" role="alert">{warning}</p>
      )}

      {/* CINEHUNT_BETA_SEAT_V4 */}
      {showLegend && <div className="ch-beta-legend">
        <div><strong>Trạng thái</strong><div className="legend-items">
          {[['available','Ghế trống'],['held','Đang được giữ'],['selected','Bạn đang chọn'],['sold','Đã bán'],['blocked','Bị khóa']].map(([cls,label])=><div key={cls} className="legend-item"><div className={`legend-color ${cls}`}/><span>{label}</span></div>)}
        </div></div>
        <div><strong>Giá vé</strong><div className="legend-items">
          {([['standard','Ghế thường · A–C'],['vip','Ghế VIP · D–I'],['couple','Ghế đôi · J']] as const).map(([kind,label])=><div key={kind} className="legend-item"><div className={`legend-color available ch-beta-shape-${kind}`}/><span>{label}<br/><b>{kind==='couple'?pairPrice:priceFor(kind)}</b></span></div>)}
        </div></div>
      </div>}
      <p className="ch-beta-note">Ghế đôi: chọn cả 2 chỗ liền nhau, giá theo cặp.</p>
      <div className="seat-map-container">
        <div className="screen-container">
          <div className="screen"><span>MÀN HÌNH</span></div>
        </div>
        <div className="seat-map">
          {rowNames.map((rowName) => (
            <div
              key={rowName}
              className={`seat-row ${hoveredRow === rowName ? 'hovered' : ''}`}
              onMouseEnter={() => setHoveredRow(rowName)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <div className="row-label">{rowName}</div>
              <div className="seats-container">
                {groupedSeats[rowName].map(seat=>{
                  const group=seatGroup(seats,seat);if(group.length===2&&group[0].id!==seat.id)return null;
                  const unavailable=group.find(s=>isDisabled(s.id,s.status));
                  const complete=!isCouple(seat)||group.length===2;
                  const visual={...seat,status:unavailable?.status??seat.status,price:group.reduce((sum,s)=>sum+Number(s.price??0),0)};
                  return <SeatItem key={String(seat.id)} seat={visual} pairLabel={group.length===2?group.map(s=>`${s.rowName}${s.seatNumber}`).join('–'):undefined} selected={group.every(s=>isSelected(s.id))} onClick={()=>handleSeatClick(seat.id)} disabled={!complete||!!unavailable}/>;
                })}
              </div>
            </div>
          ))}
        </div>
      </div>


    </div>
  );
};

export default SeatMap;

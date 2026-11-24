import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

type Admission = { showtimeId: number; movieId: number; movieTitle: string; rating: string; action: 'ALLOW' | 'CONFIRM' | 'BLOCK'; message: string; confirmLabel: string | null };

export default function AgeAdmissionGate({ showtimeId, movieId, children }: { showtimeId: string; movieId: string; children: ReactNode }) {
  const navigate = useNavigate();
  const [policy, setPolicy] = useState<Admission | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!/^\d+$/.test(showtimeId) || !/^\d+$/.test(movieId)) throw new Error('Chưa chọn suất chiếu hợp lệ.');
        const p = await axiosClient.get(`/showtimes/${showtimeId}/age-policy`) as unknown as Admission;
        if (p?.showtimeId !== Number(showtimeId) || p.movieId !== Number(movieId) || !['ALLOW','CONFIRM','BLOCK'].includes(p.action) || typeof p.message !== 'string' || (p.action === 'CONFIRM' && !p.confirmLabel)) throw new Error('Không xác minh được phân loại của suất chiếu.');
        if (active) setPolicy(p);
      } catch (e) { if (active) setError((e as {message?: string})?.message || 'Không tải được phân loại độ tuổi.'); }
    })();
    return () => { active = false; };
  }, [showtimeId, movieId, attempt]);
  if (policy && (policy.action === 'ALLOW' || (policy.action === 'CONFIRM' && accepted))) return <>{children}</>;
  return <section className="stitch-page grid place-items-center">
    <div className="stitch-card p-8 max-w-lg w-full text-center" aria-live="polite">
      <h1 className="text-2xl font-extrabold mb-4">Xác nhận độ tuổi</h1>
      {error ? <p className="stitch-muted mb-6" role="alert">{error}</p> : !policy ? <p className="stitch-muted mb-6">Đang kiểm tra phân loại phim...</p> : <>
        <span className="stitch-badge stitch-badge-purple mb-4">{policy.rating}</span>
        <h2 className="text-xl font-bold mb-3">{policy.movieTitle}</h2>
        <p className="stitch-muted mb-4">{policy.message}</p>
        {policy.action === 'CONFIRM' && <p className="stitch-muted text-sm mb-6">Rạp có thể kiểm tra độ tuổi khi vào phòng chiếu.</p>}
      </>}
      <div className="flex flex-col gap-3">
        {policy?.action === 'CONFIRM' && <button type="button" className="stitch-btn stitch-btn-primary" onClick={() => setAccepted(true)}>{policy.confirmLabel}</button>}
        {!!error && <button type="button" className="stitch-btn stitch-btn-primary" onClick={() => { setError(''); setAttempt(n => n+1); }}>Thử lại</button>}
        <button type="button" className="stitch-btn stitch-btn-outline" onClick={() => navigate(/^\d+$/.test(movieId) ? `/showtimes/${movieId}` : '/movies', { replace: true })}>{policy?.action === 'CONFIRM' ? 'Chưa đủ điều kiện / Quay lại' : 'Quay lại'}</button>
      </div>
    </div>
  </section>;
}

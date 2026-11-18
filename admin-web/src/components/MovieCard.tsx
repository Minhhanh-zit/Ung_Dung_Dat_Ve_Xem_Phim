import { Link } from 'react-router-dom';
import type { Movie } from '../types/movie';
import { resolveAssetUrl } from '../utils/assetUrl';
import FavoriteMovieButton from './FavoriteMovieButton';
import InteractiveMovieRating from './InteractiveMovieRating';

interface Props { movie: Movie; darkMode?: boolean; }
const FALLBACK_POSTER = 'https://picsum.photos/seed/cmc-card/600/900';

export default function MovieCard({ movie }: Props) {
  const score = movie.average_rating ?? movie.imdb_rating;
  const detailPath = `/movies/${movie.movie_id}`;
  const comingSoon = movie.status === 'COMING_SOON';

  return (
    <article className="cc-card">
      <div className="cc-poster stitch-card-hover">
        <Link to={detailPath} aria-label={movie.title} className="absolute inset-0 z-[1]">
          <img
            src={resolveAssetUrl(movie.poster_url) || FALLBACK_POSTER}
            alt={movie.title}
            onError={(event) => { event.currentTarget.src = FALLBACK_POSTER; }}
          />
          <span className="cc-hover"><span>Xem chi tiết</span></span>
        </Link>

        <div className="cc-tools">
          <InteractiveMovieRating
            movieId={movie.movie_id}
            score={score}
            fallbackScore={0}
            className="rounded-full bg-black/65 px-1.5 py-0.5 shadow-lg backdrop-blur-md"
          />
          <FavoriteMovieButton movieId={movie.movie_id} />
        </div>

        {movie.age_rating && (
          <span className={`cc-age cc-age--${movie.age_rating}`}>{movie.age_rating}</span>
        )}
        {comingSoon && <span className="cc-soon">Sắp chiếu</span>}
      </div>

      <div className="cc-info">
        <Link to={detailPath} className="cc-title">{movie.title}</Link>
        <p className="cc-meta">
          <span>
            <span className="material-symbols-outlined">theater_comedy</span>
            {movie.genres?.slice(0, 2).join(', ') || 'Đang cập nhật'}
          </span>
          <span>
            <span className="material-symbols-outlined">schedule</span>
            {movie.duration_minutes || 0} phút
          </span>
        </p>
        <Link
          to={comingSoon ? detailPath : `/showtimes/${movie.movie_id}`}
          className={`stitch-btn cc-buy ${comingSoon ? 'stitch-btn-outline' : 'stitch-btn-primary'}`}
        >
          {comingSoon ? 'Xem chi tiết' : 'Mua vé'}
        </Link>
      </div>
    </article>
  );
}

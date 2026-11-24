import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { getPublicMovies, getMovies, normalizeMovie, getGenres, createMovie, updateMovie, deleteMovie, getMovieById } from '../src/api/movieApi';
import { useMovies } from '../src/hooks/useMovies';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('../src/api/axiosClient', () => ({ default: http }));
const film = (id: number) => ({ movieId:id, title:`Film ${id}`, status:'NOW_SHOWING', durationMinutes:100, genres:[{genreId:2,genreName:'Action'}] });
const page = (ids:number[], total:number) => ({ items:ids.map(film),total });
beforeEach(() => { vi.resetAllMocks(); });

describe('movie catalogue HTTP contract', () => {
  it('normalizes legacy and current data and validates genre ids', () => {
    expect(normalizeMovie({ movie_id:2, title:'Legacy', age_rating:'T13', genres:['Drama',{id:8,name:'Comedy'}], hasEarlyShowtime:true })).toMatchObject({ movie_id:2, age_rating:'T13', genres:['Drama','Comedy'], genre_ids:[8], hasEarlyShowtime:true });
    expect(normalizeMovie({})).toMatchObject({movie_id:0, genres:[],hasEarlyShowtime:false,status:'HIDDEN'});
  });
  it('loads every public page and stops at server total', async () => {
    http.get.mockResolvedValueOnce(page([1,2],3)).mockResolvedValueOnce(page([3],3));
    const result=await getPublicMovies();
    expect(result.items.map(m=>m.movie_id)).toEqual([1,2,3]);
    expect(http.get.mock.calls).toEqual([['/movies/catalog',{params:{page:1,limit:50}}],['/movies/catalog',{params:{page:2,limit:50}}]]);
    http.get.mockResolvedValueOnce(page([],0));
    expect(await getPublicMovies()).toEqual({items:[],total:0});
  });
  it.each([undefined,-1,1.5])('rejects invalid catalogue totals %s', async total => {
    http.get.mockResolvedValue({items:[film(1)],total});
    await expect(getPublicMovies()).rejects.toThrow('Danh mục phim không hợp lệ');
  });
  it('rejects empty intermediate pages and excessive page count', async () => {
    http.get.mockResolvedValueOnce(page([1],2)).mockResolvedValueOnce(page([],2));
    await expect(getPublicMovies()).rejects.toThrow('Danh mục phim thay đổi');
    http.get.mockReset().mockResolvedValue(page([1],1000));
    await expect(getPublicMovies()).rejects.toThrow('Danh mục phim quá lớn');
    expect(http.get).toHaveBeenCalledTimes(100);
  });
  it('handles admin query, CRUD payloads, errors and genre fallback', async () => {
    http.get.mockResolvedValueOnce(page([1],1));
    await getMovies({page:2,limit:99,status:'NOW_SHOWING',search:'Film'});
    expect(http.get).toHaveBeenCalledWith('/movies',{params:{page:2,limit:50,status:'NOW_SHOWING',search:'Film'}});
    http.get.mockResolvedValueOnce({data:film(1)});
    expect((await getMovieById(1)).movie_id).toBe(1);
    http.post.mockResolvedValueOnce(film(2));
    await createMovie({title:' New ',duration_minutes:95,age_rating:'P',genre_ids:[2,0,-1]});
    expect(http.post).toHaveBeenCalledWith('/movies',{title:'New',durationMinutes:95,ageRating:'P',genreIds:[2]});
    http.patch.mockResolvedValueOnce(film(2));
    await updateMovie(2,{title:'Edited'});
    expect(http.patch).toHaveBeenCalledWith('/movies/2',{title:'Edited'});
    await deleteMovie(2);
    expect(http.delete).toHaveBeenCalledWith('/movies/2');
    http.get.mockRejectedValueOnce({raw:{response:{data:{message:['one','two']}}}});
    await expect(getMovies()).rejects.toThrow('one; two');
    http.get.mockResolvedValueOnce([{genre_id:2,genre_name:'Action'},{id:0,name:'invalid'}]);
    expect(await getGenres()).toEqual([{id:2,name:'Action'}]);
    http.get.mockResolvedValueOnce([]).mockResolvedValueOnce(page([1,2],2));
    expect(await getGenres()).toEqual([{id:2,name:'Action'}]);
    http.get.mockRejectedValue(new Error('offline'));
    expect(await getGenres()).toEqual([]);
  });
});

describe('movie hook integration with API boundary',()=>{
  it('loads public catalogue on mount and visible focus, cleans up on unmount', async()=>{
    const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(false);
    http.get.mockResolvedValue(page([1],1));
    const {result,unmount}=renderHook(()=>useMovies({publicCatalog:true}));
    await waitFor(()=>expect(result.current.total).toBe(1));
    http.get.mockResolvedValue(page([2],1));
    await act(async()=>{window.dispatchEvent(new Event('focus'));});
    await waitFor(()=>expect(result.current.movies[0]?.movie_id).toBe(2));
    unmount();
    const calls=http.get.mock.calls.length;
    window.dispatchEvent(new Event('focus'));
    expect(http.get).toHaveBeenCalledTimes(calls);
    hidden.mockRestore();
  });
  it('loads admin genres, CRUD state, and error handling',async()=>{
    http.get.mockResolvedValueOnce(page([1],1)).mockResolvedValueOnce([{id:2,name:'Action'}]);
    const {result}=renderHook(()=>useMovies({withGenres:true,params:{page:1}}));
    await waitFor(()=>expect(result.current.genres).toEqual([{id:2,name:'Action'}]));
    const {movie_id, ...input}=normalizeMovie(film(2));
    http.post.mockResolvedValue(film(movie_id));
    await act(async()=>{expect(await result.current.addMovie(input)).toBe(true);});
    expect(result.current.total).toBe(2);
    http.patch.mockResolvedValue({...film(2),title:'Edited'});
    await act(async()=>{expect(await result.current.editMovie(2,{title:'Edited'})).toBe(true);});
    expect(result.current.movies[0]?.title).toBe('Edited');
    await act(async()=>{expect(await result.current.removeMovie(2)).toBe(true);});
    expect(result.current.total).toBe(1);
    http.get.mockRejectedValue(new Error('offline'));
    await act(async()=>{await result.current.fetchMovies();});
    expect(result.current.error).toBe('offline');
    expect(result.current.loading).toBe(false);
  });
  it('supports manual fetch without automatic requests',async()=>{
    const {result}=renderHook(()=>useMovies({autoFetch:false,publicCatalog:true}));
    expect(http.get).not.toHaveBeenCalled();
    http.get.mockResolvedValue(page([],0));
    await act(async()=>{await result.current.fetchMovies();});
    expect(result.current.movies).toEqual([]);
  });
});

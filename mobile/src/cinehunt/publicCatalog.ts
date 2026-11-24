import {api} from '../services/apiClient';
import type {Movie} from '../types';

export async function loadPublicCatalog():Promise<{items:Movie[];total:number}>{
  const items:Movie[]=[];
  for(let page=1;page<=100;page+=1){
    const data=await api<{items:Movie[];total:number}>(`/movies/catalog?page=${page}&limit=50`);
    if(!Array.isArray(data.items)||!Number.isSafeInteger(data.total)||data.total<0)throw new Error('Danh mục phim không hợp lệ');
    items.push(...data.items);
    if(items.length>=data.total)return {items,total:data.total};
    if(!data.items.length)throw new Error('Danh mục phim thay đổi, hãy tải lại');
  }
  throw new Error('Danh mục phim quá lớn, hãy thử lại');
}

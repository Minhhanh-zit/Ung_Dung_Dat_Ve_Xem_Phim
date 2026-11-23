// CineHunt road-distance helper. The Google API key never goes to Expo.
// Without a Routes API key, NEVER label a straight-line distance as a road distance.
import { BadRequestException } from '@nestjs/common';

export type CinemaLocation = {
  cinemaId: number; cinemaName: string; address: string | null;
  city: string | null; latitude: number | string | null; longitude: number | string | null;
};
export type OriginInput = { latitude?: unknown; longitude?: unknown; originAddress?: unknown };
export type NearbyItem = {
  cinemaId: number; cinemaName: string; address: string | null;
  ward: string; distanceKm: number | null; durationMinutes: number | null;
  mapsUrl: string;
};

const WARDS: Readonly<Record<string, string>> = {
  'CineHunt Thanh Xuân': 'Phường Thanh Xuân',
  'CineHunt Hà Đông': 'Phường Hà Đông',
  'CineHunt Cầu Giấy': 'Phường Cầu Giấy',
};
const ROUTES_URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';

export function coreCinemas(rows: CinemaLocation[]): CinemaLocation[] {
  return rows.filter((r) => Object.prototype.hasOwnProperty.call(WARDS, r.cinemaName));
}
function validCoords(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}
function distanceKm(a: number, b: number, c: number, d: number): number {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(c-a), dLon = rad(d-b);
  const x = Math.sin(dLat/2)**2 + Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0,1-x)));
}
function navigationUrl(c: CinemaLocation, originAddress?: string): string {
  // Destination by full street address so Maps resolves the real entrance.
  const dest = c.cinemaName === 'CineHunt Thanh Xuân'
    ? ['Beta Cinemas Thanh Xuân', c.address, c.city, 'Việt Nam'].filter(Boolean).join(', ')
    : [c.address || c.cinemaName, c.city, 'Việt Nam'].filter(Boolean).join(', ');
  return 'https://www.google.com/maps/dir/?api=1&destination=' +
    encodeURIComponent(dest) + (originAddress ? '&origin=' + encodeURIComponent(originAddress) : '') +
    '&travelmode=driving';
}
function waypoint(c: CinemaLocation): Record<string, unknown> {
  const lat = Number(c.latitude), lon = Number(c.longitude);
  if (c.latitude != null && c.longitude != null && validCoords(lat, lon)) {
    return {location: {latLng: {latitude: lat, longitude: lon}}};
  }
  return {address: [c.address, c.city, 'Việt Nam'].filter(Boolean).join(', ')};
}

export async function findCinemasNearby(
  rows: CinemaLocation[], input: OriginInput, apiKey: string | undefined,
): Promise<{method:'DRIVING'|'STRAIGHT_LINE'|'UNRANKED'; note:string; cinemas:NearbyItem[]}> {
  const originAddress = typeof input.originAddress === 'string' ? input.originAddress.trim() : '';
  if (originAddress.length > 140) throw new BadRequestException('Điểm xuất phát quá dài.');
  const lat = Number(input.latitude), lon = Number(input.longitude);
  const hasCoords = input.latitude != null && input.longitude != null && validCoords(lat, lon);
  if (!hasCoords && !originAddress) throw new BadRequestException('Cần tọa độ GPS hoặc địa điểm xuất phát.');
  if ((input.latitude != null || input.longitude != null) && !hasCoords) {
    throw new BadRequestException('Tọa độ GPS không hợp lệ.');
  }
  const targets = coreCinemas(rows).slice(0, 3);
  const basic = targets.map((c) => ({
    cinemaId:c.cinemaId, cinemaName:c.cinemaName, address:c.address,
    ward:WARDS[c.cinemaName], distanceKm:null as number|null,
    durationMinutes:null as number|null, mapsUrl:navigationUrl(c, originAddress || undefined),
  }));
  if (!targets.length) return {
    method:'UNRANKED', note:'Chưa có rạp CineHunt trong phạm vi ba phường được cấu hình.', cinemas:[],
  };

  // A real routing key with the Routes API enabled is needed to rank *driving distance*.
  if (apiKey?.trim()) {
    try {
      const originWaypoint: Record<string,unknown> = hasCoords
        ? {location:{latLng:{latitude:lat,longitude:lon}}} : {address:originAddress};
      const response = await fetch(ROUTES_URL, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'X-Goog-Api-Key':apiKey.trim(),
          'X-Goog-FieldMask':'originIndex,destinationIndex,status,condition,distanceMeters,duration',
        },
        body: JSON.stringify({
          origins:[{waypoint:originWaypoint}],
          destinations:targets.map((c) => ({waypoint:waypoint(c)})),
          travelMode:'DRIVE', routingPreference:'TRAFFIC_AWARE', languageCode:'vi-VN',
        }),
        signal:AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const entries = await response.json() as Array<{
          destinationIndex?:number;distanceMeters?:number;duration?:string;
          condition?:string;status?:{code?:number};
        }>;
        const valid = Array.isArray(entries) && entries.length >= targets.length &&
          targets.every((_,i) => entries.some((e) => e.destinationIndex===i &&
            e.condition==='ROUTE_EXISTS' && Number.isFinite(e.distanceMeters) &&
            e.status?.code !== 7));
        if (valid) {
          const ranked = basic.map((b,i) => {
            const e=entries.find((x) => x.destinationIndex===i)!;
            const duration=Number(String(e.duration ?? '').replace(/s$/,''));
            return {...b,distanceKm:Math.round((e.distanceMeters!/1000)*10)/10,
              durationMinutes:Number.isFinite(duration)?Math.ceil(duration/60):null};
          }).sort((a,b) => (a.distanceKm ?? Infinity)-(b.distanceKm ?? Infinity));
          return {method:'DRIVING',note:'Xếp hạng theo quãng đường ô tô do Google Routes trả về; thời gian có thể đổi theo giao thông.',cinemas:ranked};
        }
      }
    } catch {
      // No invented road figures when Google is offline or unavailable.
    }
  }
  if (!hasCoords) {
    return {method:'UNRANKED',note:'Chưa tính được km ô tô từ địa danh này. Mở Chỉ đường để Google Maps tính từng tuyến thực tế.',cinemas:basic};
  }
  const ranked = basic.map((b,i) => {
    const c=targets[i], a=Number(c.latitude), d=Number(c.longitude);
    const km=(c.latitude!=null && c.longitude!=null && validCoords(a,d)) ? distanceKm(lat,lon,a,d) : null;
    return {...b,distanceKm:km===null?null:Math.round(km*10)/10};
  }).sort((a,b) => (a.distanceKm??Infinity)-(b.distanceKm??Infinity));
  return {method:'STRAIGHT_LINE',note:'Chỉ xếp gần theo đường thẳng (GPS), KHÔNG phải km đi xe. Mở Chỉ đường để xem tuyến thực tế.',cinemas:ranked};
}

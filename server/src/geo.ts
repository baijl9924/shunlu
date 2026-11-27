import crypto from 'node:crypto';

const TMAP_KEY = process.env.TMAP_KEY?.trim();
const TMAP_SK = process.env.TMAP_SK?.trim();

export type GeoInfo = { address: string; city: string; district: string };

const cache = new Map<string, { v: GeoInfo; exp: number }>();

// GCJ-02 -> WGS84 粗略反算（用于 OSM Nominatim 兜底，误差 < 1 米）
const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;
function tLat(x: number, y: number) {
  let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  r += ((20 * Math.sin(y * PI) + 40 * Math.sin((y / 3) * PI)) * 2) / 3;
  r += ((160 * Math.sin((y / 12) * PI) + 320 * Math.sin((y * PI) / 30)) * 2) / 3;
  return r;
}
function tLng(x: number, y: number) {
  let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  r += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  r += ((20 * Math.sin(x * PI) + 40 * Math.sin((x / 3) * PI)) * 2) / 3;
  r += ((150 * Math.sin((x / 12) * PI) + 300 * Math.sin((x / 30) * PI)) * 2) / 3;
  return r;
}
function gcj02ToWgs84(lat: number, lng: number) {
  if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return { lat, lng };
  let dLat = tLat(lng - 105, lat - 35);
  let dLng = tLng(lng - 105, lat - 35);
  const radLat = (lat / 180) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return { lat: lat - dLat, lng: lng - dLng };
}

async function tencentGeocode(lat: number, lng: number): Promise<GeoInfo | null> {
  if (!TMAP_KEY) return null;
  try {
    const path = '/ws/geocoder/v1/';
    const qs = `get_poi=0&key=${TMAP_KEY}&location=${lat},${lng}`;
    const sig = TMAP_SK ? `&sig=${crypto.createHash('md5').update(`${path}?${qs}${TMAP_SK}`).digest('hex')}` : '';
    const res = await fetch(`https://apis.map.qq.com${path}?${qs}${sig}`, { signal: AbortSignal.timeout(5000) });
    const json: any = await res.json();
    if (json.status !== 0) throw new Error(json.message);
    const r = json.result;
    const rec = r.formatted_addresses?.recommend || r.formatted_addresses?.standard_address;
    return {
      address: rec ? `${r.address_component.city}${r.address_component.district}${rec}` : r.address,
      city: r.address_component.city || '',
      district: r.address_component.district || '',
    };
  } catch (e) {
    console.warn('[geo] tencent geocode failed, using fallback:', (e as Error).message);
    return null;
  }
}

async function nominatimGeocode(lat: number, lng: number): Promise<GeoInfo | null> {
  try {
    const w = gcj02ToWgs84(lat, lng);
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${w.lat.toFixed(6)}&lon=${w.lng.toFixed(6)}&accept-language=zh-CN&zoom=18`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ShunluAccessibilityApp/1.0 (civic accessibility tool)' },
      signal: AbortSignal.timeout(6000),
    });
    const json: any = await res.json();
    const a = json.address || {};
    const city = a.city || a.municipality || a.prefecture || a.state || '';
    const district = a.city_district || a.district || a.county || a.suburb || a.borough || '';
    const detail = [a.road || a.pedestrian || a.neighbourhood, a.house_number, json.name && json.name !== a.road ? json.name : '']
      .filter(Boolean)
      .join('');
    const address = `${city}${district}${detail}`.trim() || json.display_name || '';
    if (!city && !address) return null;
    return { address, city, district };
  } catch (e) {
    console.warn('[geo] nominatim fallback failed:', (e as Error).message);
    return null;
  }
}

/** 逆地址解析：优先腾讯位置服务，配额受限时自动回退到 OpenStreetMap，并按位置缓存 1 小时 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoInfo> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.v;

  const info = (await tencentGeocode(lat, lng)) || (await nominatimGeocode(lat, lng)) || { address: '', city: '', district: '' };
  if (info.city || info.address) {
    if (cache.size > 500) cache.clear();
    cache.set(key, { v: info, exp: Date.now() + 3600_000 });
  }
  return info;
}

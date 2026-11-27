import crypto from 'node:crypto';

const TMAP_KEY = process.env.TMAP_KEY?.trim();
const TMAP_SK = process.env.TMAP_SK?.trim();

export type GeoInfo = { address: string; city: string; district: string };

/** 腾讯位置服务逆地址解析（坐标须为 GCJ-02；如配置了 TMAP_SK 则自动附加签名） */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoInfo> {
  if (!TMAP_KEY) return { address: '', city: '', district: '' };
  try {
    const path = '/ws/geocoder/v1/';
    // 参数按 key 字母序排列，便于签名校验
    const qs = `get_poi=0&key=${TMAP_KEY}&location=${lat},${lng}`;
    const sig = TMAP_SK ? `&sig=${crypto.createHash('md5').update(`${path}?${qs}${TMAP_SK}`).digest('hex')}` : '';
    const url = `https://apis.map.qq.com${path}?${qs}${sig}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
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
    console.warn('[geo] reverse geocode failed:', (e as Error).message);
    return { address: '', city: '', district: '' };
  }
}

const TMAP_KEY = process.env.TMAP_KEY?.trim();

export type GeoInfo = { address: string; city: string; district: string };

/** 腾讯位置服务逆地址解析（坐标须为 GCJ-02） */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoInfo> {
  if (!TMAP_KEY) return { address: '', city: '', district: '' };
  try {
    const url = `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}&key=${TMAP_KEY}&get_poi=0`;
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

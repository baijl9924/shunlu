import { useEffect, useRef, useState } from 'react';
import { STATUS_COLOR, type Issue } from '../lib/api';

declare global {
  interface Window {
    TMap: any;
  }
}

let loader: Promise<any> | null = null;
export function loadTMap(key: string): Promise<any> {
  if (window.TMap) return Promise.resolve(window.TMap);
  if (!loader)
    loader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(key)}`;
      s.onload = () => (window.TMap ? resolve(window.TMap) : reject(new Error('地图加载失败')));
      s.onerror = () => {
        loader = null;
        reject(new Error('地图加载失败，请检查网络'));
      };
      document.head.appendChild(s);
    });
  return loader;
}

function pinSvg(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46"><path d="M18 45s15-15.6 15-27A15 15 0 0 0 3 18c0 11.4 15 27 15 27z" fill="${color}" stroke="#fff" stroke-width="3"/><circle cx="18" cy="18" r="6" fill="#fff"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

type Props = {
  tmapKey: string;
  center: { lat: number; lng: number };
  zoom?: number;
  issues?: Issue[];
  onSelect?: (id: string) => void;
  /** 选点模式：地图中心固定一个图钉，拖动地图选择位置 */
  onCenterChange?: (c: { lat: number; lng: number }) => void;
  me?: { lat: number; lng: number } | null;
  className?: string;
};

export default function MapView({ tmapKey, center, zoom = 15, issues = [], onSelect, onCenterChange, me, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any>(null);
  const meRef = useRef<any>(null);
  const [error, setError] = useState('');
  const cbRef = useRef({ onSelect, onCenterChange });
  cbRef.current = { onSelect, onCenterChange };

  useEffect(() => {
    let destroyed = false;
    loadTMap(tmapKey)
      .then((TMap) => {
        if (destroyed || !el.current) return;
        const map = new TMap.Map(el.current, {
          center: new TMap.LatLng(center.lat, center.lng),
          zoom,
          viewMode: '2D',
          showControl: false,
        });
        mapRef.current = map;
        const styles: Record<string, any> = {};
        for (const [k, c] of Object.entries(STATUS_COLOR))
          styles[k] = new TMap.MarkerStyle({ width: 30, height: 38, src: pinSvg(c), anchor: { x: 15, y: 38 } });
        markersRef.current = new TMap.MultiMarker({ map, styles, geometries: [] });
        markersRef.current.on('click', (e: any) => cbRef.current.onSelect?.(e.geometry.id));
        meRef.current = new TMap.MultiMarker({
          map,
          styles: {
            me: new TMap.MarkerStyle({
              width: 22,
              height: 22,
              anchor: { x: 11, y: 11 },
              src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="8" fill="#2563eb" stroke="#fff" stroke-width="3"/></svg>')}`,
            }),
          },
          geometries: [],
        });
        if (cbRef.current.onCenterChange) {
          let t = 0;
          map.on('center_changed', () => {
            window.clearTimeout(t);
            t = window.setTimeout(() => {
              const c = map.getCenter();
              cbRef.current.onCenterChange?.({ lat: c.getLat(), lng: c.getLng() });
            }, 250);
          });
        }
        setMarkers();
        setMe();
      })
      .catch((e) => setError(e.message));
    return () => {
      destroyed = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmapKey]);

  function setMarkers() {
    if (!markersRef.current || !window.TMap) return;
    markersRef.current.setGeometries(
      issues.map((i) => ({ id: i.id, styleId: i.status, position: new window.TMap.LatLng(i.lat, i.lng) })),
    );
  }
  function setMe() {
    if (!meRef.current || !window.TMap) return;
    meRef.current.setGeometries(me ? [{ id: 'me', styleId: 'me', position: new window.TMap.LatLng(me.lat, me.lng) }] : []);
  }

  useEffect(setMarkers, [issues]);
  useEffect(setMe, [me]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.TMap) return;
    const c = map.getCenter();
    if (Math.abs(c.getLat() - center.lat) > 1e-6 || Math.abs(c.getLng() - center.lng) > 1e-6)
      map.setCenter(new window.TMap.LatLng(center.lat, center.lng));
  }, [center.lat, center.lng]);

  return (
    <div className={`relative isolate z-0 overflow-hidden ${className || ''}`}>
      <div ref={el} className="absolute inset-0" aria-label="问题地图" role="application" />
      {onCenterChange && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full" aria-hidden>
          <img src={pinSvg('#1677ff')} width={36} height={46} alt="" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-white/90 p-6 text-center text-[15px] text-gray-600">{error}</div>
      )}
    </div>
  );
}

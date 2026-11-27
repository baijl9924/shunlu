import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, type Config } from './api';
import { locate } from './geo';

type Profile = { name: string; phone: string };
export type UserGeo = { lat: number; lng: number; city: string; district: string; address: string };

type AppState = {
  config: Config | null;
  nickname: string;
  loggedIn: boolean;
  register: (nickname: string) => Promise<void>;
  setNickname: (n: string) => void;
  profile: Profile;
  saveProfile: (p: Profile) => void;
  userGeo: UserGeo | null;
  refreshGeo: (silent?: boolean) => Promise<UserGeo | null>;
  toast: (msg: string) => void;
};

const Ctx = createContext<AppState>(null as unknown as AppState);
export const useApp = () => useContext(Ctx);

const PROFILE_KEY = 'shunlu.profile';
const GEO_KEY = 'shunlu.geo';

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [nickname, setNickname] = useState(localStorage.getItem('shunlu.nickname') || '');
  const [loggedIn, setLoggedIn] = useState(!!getToken());
  const [profile, setProfile] = useState<Profile>(() => {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || '') as Profile;
    } catch {
      return { name: '', phone: '' };
    }
  });
  const [userGeo, setUserGeo] = useState<UserGeo | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(GEO_KEY) || '') as UserGeo;
    } catch {
      return null;
    }
  });
  const [toastMsg, setToastMsg] = useState('');

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout((toast as any)._t);
    (toast as any)._t = window.setTimeout(() => setToastMsg(''), 2600);
  }, []);

  const refreshGeo = useCallback(
    async (silent = false) => {
      try {
        const p = await locate();
        const g = await api<{ address: string; city: string; district: string }>(`/api/geocode?lat=${p.lat}&lng=${p.lng}`).catch(() => ({
          address: '',
          city: '',
          district: '',
        }));
        const next: UserGeo = { lat: p.lat, lng: p.lng, city: g.city || '', district: g.district || '', address: g.address || '' };
        setUserGeo(next);
        sessionStorage.setItem(GEO_KEY, JSON.stringify(next));
        sessionStorage.setItem('shunlu.center', JSON.stringify({ lat: p.lat, lng: p.lng }));
        return next;
      } catch (e) {
        if (!silent) toast((e as Error).message);
        return null;
      }
    },
    [toast],
  );

  useEffect(() => {
    api<Config>('/api/config').then(setConfig).catch(() => setConfig({ tmapKey: '', aiMock: true, categories: [] }));
    if (getToken())
      api('/api/me')
        .then((me) => {
          setNickname(me.nickname);
          localStorage.setItem('shunlu.nickname', me.nickname);
        })
        .catch((e: Error) => {
          if (e.message === '未登录') {
            localStorage.removeItem('shunlu.token');
            setLoggedIn(false);
          }
        });
    if (!sessionStorage.getItem(GEO_KEY)) refreshGeo(true);
  }, [refreshGeo]);

  const register = useCallback(async (name: string) => {
    const u = await api<{ token: string; nickname: string }>('/api/users', { method: 'POST', json: { nickname: name } });
    setToken(u.token);
    localStorage.setItem('shunlu.nickname', u.nickname);
    setNickname(u.nickname);
    setLoggedIn(true);
  }, []);

  const saveProfile = useCallback((p: Profile) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    setProfile(p);
  }, []);

  return (
    <Ctx.Provider
      value={{
        config,
        nickname,
        loggedIn,
        register,
        setNickname: (n) => {
          setNickname(n);
          localStorage.setItem('shunlu.nickname', n);
        },
        profile,
        saveProfile,
        userGeo,
        refreshGeo,
        toast,
      }}
    >
      {children}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed left-1/2 top-12 z-[1100] -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/90 px-4 py-2 text-[14px] font-medium text-white shadow-lg backdrop-blur-md transition-opacity ${toastMsg ? 'opacity-100' : 'opacity-0'}`}
      >
        {toastMsg}
      </div>
    </Ctx.Provider>
  );
}

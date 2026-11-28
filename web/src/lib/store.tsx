import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, getToken, setToken, type Config } from './api';
import { locate } from './geo';

type Profile = { name: string; phone: string };
export type UserGeo = { lat: number; lng: number; city: string; district: string; address: string };
export type AuthModalMode = 'login' | 'register' | 'upgrade' | null;

type AppState = {
  config: Config | null;
  nickname: string;
  role: 'user' | 'admin';
  hasPassword: boolean;
  isGuest: boolean;
  loggedIn: boolean;
  authModal: AuthModalMode;
  openAuth: (mode?: Exclude<AuthModalMode, null>) => void;
  closeAuth: () => void;
  register: (nickname: string, password: string) => Promise<void>;
  login: (nickname: string, password: string) => Promise<void>;
  enterAsGuest: () => Promise<boolean>;
  ensureSession: () => Promise<boolean>;
  upgradeGuest: (nickname: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setNickname: (n: string) => void;
  markHasPassword: () => void;
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
const GUEST_KEY = 'shunlu.isGuest';

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [nickname, setNickname] = useState(localStorage.getItem('shunlu.nickname') || '');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [hasPassword, setHasPassword] = useState(true);
  const [isGuest, setIsGuest] = useState(() => !!getToken() && localStorage.getItem(GUEST_KEY) === '1');
  const [loggedIn, setLoggedIn] = useState(!!getToken());
  const [authModal, setAuthModal] = useState<AuthModalMode>(null);
  const guestPromiseRef = useRef<Promise<boolean> | null>(null);
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
    (toast as any)._t = window.setTimeout(() => setToastMsg(''), 2800);
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
          setRole(me.role || 'user');
          setHasPassword(!!me.hasPassword);
          setIsGuest(!!me.isGuest);
          localStorage.setItem('shunlu.nickname', me.nickname);
          localStorage.setItem(GUEST_KEY, me.isGuest ? '1' : '0');
        })
        .catch((e: Error) => {
          if (e.message === '未登录' || e.message.includes('401')) {
            setToken('');
            localStorage.removeItem('shunlu.nickname');
            localStorage.removeItem(GUEST_KEY);
            setIsGuest(false);
            setLoggedIn(false);
          }
        });
    if (!sessionStorage.getItem(GEO_KEY)) refreshGeo(true);
  }, [refreshGeo]);

  const register = useCallback(async (name: string, password: string) => {
    const u = await api<{ token: string; nickname: string; role: 'user' | 'admin' }>('/api/auth/register', {
      method: 'POST',
      json: { nickname: name, password },
    });
    setToken(u.token);
    localStorage.setItem('shunlu.nickname', u.nickname);
    localStorage.setItem(GUEST_KEY, '0');
    setNickname(u.nickname);
    setRole(u.role || 'user');
    setHasPassword(true);
    setIsGuest(false);
    setLoggedIn(true);
    setAuthModal(null);
  }, []);

  const login = useCallback(async (name: string, password: string) => {
    const u = await api<{ token: string; nickname: string; role: 'user' | 'admin' }>('/api/auth/login', {
      method: 'POST',
      json: { nickname: name, password },
    });
    setToken(u.token);
    localStorage.setItem('shunlu.nickname', u.nickname);
    localStorage.setItem(GUEST_KEY, '0');
    setNickname(u.nickname);
    setRole(u.role || 'user');
    setHasPassword(true);
    setIsGuest(false);
    setLoggedIn(true);
    setAuthModal(null);
  }, []);

  const enterAsGuest = useCallback(async () => {
    if (getToken()) return true;
    if (guestPromiseRef.current) return guestPromiseRef.current;
    const p = (async () => {
      try {
        const u = await api<{ token: string; nickname: string; role: 'user' | 'admin'; isGuest: boolean }>('/api/auth/guest', {
          method: 'POST',
        });
        setToken(u.token);
        localStorage.setItem('shunlu.nickname', u.nickname);
        localStorage.setItem(GUEST_KEY, u.isGuest ? '1' : '0');
        setNickname(u.nickname);
        setRole(u.role || 'user');
        setHasPassword(!u.isGuest);
        setIsGuest(!!u.isGuest);
        setLoggedIn(true);
        setAuthModal(null);
        return true;
      } catch (e) {
        toast((e as Error).message);
        return false;
      } finally {
        guestPromiseRef.current = null;
      }
    })();
    guestPromiseRef.current = p;
    return p;
  }, [toast]);

  const ensureSession = useCallback(async () => {
    if (getToken()) return true;
    const ok = await enterAsGuest();
    if (ok) toast('已为你开启免注册游客体验');
    return ok;
  }, [enterAsGuest, toast]);

  const upgradeGuest = useCallback(async (name: string, password: string) => {
    const u = await api<{ nickname: string; role: 'user' | 'admin' }>('/api/auth/upgrade', {
      method: 'POST',
      json: { nickname: name, password },
    });
    localStorage.setItem('shunlu.nickname', u.nickname);
    localStorage.setItem(GUEST_KEY, '0');
    setNickname(u.nickname);
    setRole(u.role || 'user');
    setHasPassword(true);
    setIsGuest(false);
    setAuthModal(null);
  }, []);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setToken('');
    localStorage.removeItem('shunlu.nickname');
    localStorage.removeItem(GUEST_KEY);
    setNickname('');
    setRole('user');
    setIsGuest(false);
    setLoggedIn(false);
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
        role,
        hasPassword,
        isGuest,
        loggedIn,
        authModal,
        openAuth: (m = 'login') => setAuthModal(m),
        closeAuth: () => setAuthModal(null),
        register,
        login,
        enterAsGuest,
        ensureSession,
        upgradeGuest,
        logout,
        setNickname: (n) => {
          setNickname(n);
          localStorage.setItem('shunlu.nickname', n);
        },
        markHasPassword: () => setHasPassword(true),
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

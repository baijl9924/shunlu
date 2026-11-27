import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, type Config } from './api';

type Profile = { name: string; phone: string };
type AppState = {
  config: Config | null;
  nickname: string;
  loggedIn: boolean;
  register: (nickname: string) => Promise<void>;
  setNickname: (n: string) => void;
  profile: Profile;
  saveProfile: (p: Profile) => void;
  toast: (msg: string) => void;
};

const Ctx = createContext<AppState>(null as unknown as AppState);
export const useApp = () => useContext(Ctx);

const PROFILE_KEY = 'shunlu.profile';

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
  const [toastMsg, setToastMsg] = useState('');

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
  }, []);

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

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout((toast as any)._t);
    (toast as any)._t = window.setTimeout(() => setToastMsg(''), 2600);
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
        toast,
      }}
    >
      {children}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed left-1/2 top-6 z-[100] -translate-x-1/2 rounded-full bg-black/80 px-5 py-2.5 text-[15px] text-white shadow-lg transition-opacity ${toastMsg ? 'opacity-100' : 'opacity-0'}`}
      >
        {toastMsg}
      </div>
    </Ctx.Provider>
  );
}

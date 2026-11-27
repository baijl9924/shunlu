import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import BottomNav from './components/BottomNav';
import Onboarding from './components/Onboarding';
import Splash from './components/Splash';
import UpdateBanner from './components/UpdateBanner';
import { useApp } from './lib/store';
import Home from './pages/Home';
import Capture from './pages/Capture';
import IssuePage from './pages/Issue';
import Me from './pages/Me';
import Rank from './pages/Rank';
import Report from './pages/Report';
import Admin from './pages/Admin';
import Landing from './pages/Landing';

/** 在原生 APK 或 app.* 子域名下，根路径 / 直接进应用；主站（如 www.shunlu.cc.cd）下，/ 进入官网下载页 */
export const isAppEntryHost = () => Capacitor.isNativePlatform() || window.location.hostname.startsWith('app.');
export const appHomePath = () => (isAppEntryHost() ? '/' : '/app');

export default function App() {
  const { toast } = useApp();
  const loc = useLocation();
  const nav = useNavigate();
  const appHost = isAppEntryHost();
  const isAdmin = loc.pathname.startsWith('/admin');
  const isSite = loc.pathname.startsWith('/site') || loc.pathname.startsWith('/download') || (!appHost && loc.pathname === '/');
  const isFullPage = isAdmin || isSite;
  const showNav = !isFullPage && !loc.pathname.startsWith('/capture') && !loc.pathname.startsWith('/issue');

  const ref = useRef({ path: loc.pathname, nav, toast, lastBack: 0 });
  ref.current.path = loc.pathname;
  ref.current.nav = nav;
  ref.current.toast = toast;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | null = null;
    CapApp.addListener('backButton', () => {
      const ev = new CustomEvent('shunlu:back', { cancelable: true });
      if (!window.dispatchEvent(ev)) return;
      const { path, nav: go, toast: notify } = ref.current;
      const home = appHomePath();
      if (path !== '/' && path !== '/app') {
        if ((window.history.state?.idx ?? 0) > 0) go(-1);
        else go(home, { replace: true });
        return;
      }
      const now = Date.now();
      if (now - ref.current.lastBack < 2000) {
        CapApp.exitApp();
      } else {
        ref.current.lastBack = now;
        notify('再滑一次退出顺路');
      }
    }).then((h) => {
      handle = h;
    });
    return () => {
      handle?.remove();
    };
  }, []);

  const isCapture = loc.pathname.startsWith('/capture');
  const isAppHome = loc.pathname === appHomePath();

  return (
    <div className={isFullPage ? (isAdmin ? 'safe-top min-h-full bg-surface' : 'min-h-full bg-surface') : 'mx-auto flex h-full max-w-md flex-col bg-surface shadow-xl'}>
      <main key={loc.pathname} className={`${isFullPage ? '' : 'relative flex-1 overflow-y-auto'} ${isCapture ? 'capture-enter' : !isFullPage && !isAppHome ? 'page-enter' : ''}`}>
        <Routes>
          <Route path="/" element={appHost ? <Home /> : <Landing />} />
          <Route path="/app" element={<Home />} />
          <Route path="/site" element={<Landing />} />
          <Route path="/download" element={<Landing />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/issue/:id" element={<IssuePage />} />
          <Route path="/me" element={<Me />} />
          <Route path="/rank" element={<Rank />} />
          <Route path="/report" element={<Report />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {showNav && <BottomNav />}
      {!isFullPage && <UpdateBanner />}
      {!isFullPage && <Onboarding />}
      {!isFullPage && <Splash />}
    </div>
  );
}

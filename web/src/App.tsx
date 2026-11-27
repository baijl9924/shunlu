import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import BottomNav from './components/BottomNav';
import Onboarding from './components/Onboarding';
import { useApp } from './lib/store';
import Home from './pages/Home';
import Capture from './pages/Capture';
import IssuePage from './pages/Issue';
import Me from './pages/Me';
import Rank from './pages/Rank';
import Report from './pages/Report';
import Admin from './pages/Admin';

export default function App() {
  const { loggedIn, toast } = useApp();
  const loc = useLocation();
  const nav = useNavigate();
  const isAdmin = loc.pathname.startsWith('/admin');
  const isReport = loc.pathname.startsWith('/report');
  const showNav = !isAdmin && !loc.pathname.startsWith('/capture') && !loc.pathname.startsWith('/issue');

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
      if (path !== '/') {
        if ((window.history.state?.idx ?? 0) > 0) go(-1);
        else go('/', { replace: true });
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

  return (
    <div className={isAdmin || isReport ? 'safe-top min-h-full' : 'safe-top mx-auto flex h-full max-w-md flex-col bg-[#f3f5f4] shadow-xl'}>
      <main className={isAdmin || isReport ? '' : 'relative flex-1 overflow-y-auto'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/issue/:id" element={<IssuePage />} />
          <Route path="/me" element={<Me />} />
          <Route path="/rank" element={<Rank />} />
          <Route path="/report" element={<Report />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {showNav && !isReport && <BottomNav />}
      {!loggedIn && !isAdmin && !isReport && <Onboarding />}
    </div>
  );
}

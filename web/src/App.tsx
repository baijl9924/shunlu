import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
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
  const { loggedIn } = useApp();
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith('/admin');
  const isReport = loc.pathname.startsWith('/report');
  const showNav = !isAdmin && !loc.pathname.startsWith('/capture') && !loc.pathname.startsWith('/issue');

  return (
    <div className={isAdmin || isReport ? 'min-h-full' : 'mx-auto flex h-full max-w-md flex-col bg-[#f3f5f4] shadow-xl'}>
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

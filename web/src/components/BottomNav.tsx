import { Camera, FileBarChart2, Map, Trophy, User } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const item = 'group flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium min-h-14 transition-colors duration-200 active:scale-95';

export default function BottomNav() {
  const nav = useNavigate();
  const [lifting, setLifting] = useState(false);

  const cls = ({ isActive }: { isActive: boolean }) => `${item} ${isActive ? 'text-brand' : 'text-slate-400'}`;

  function openCapture() {
    setLifting(true);
    window.setTimeout(() => {
      setLifting(false);
      nav('/capture');
    }, 110);
  }

  return (
    <nav className="no-print safe-bottom relative z-30 flex border-t border-slate-200/80 bg-white/95 backdrop-blur-md" aria-label="主导航">
      <NavLink to="/" end className={cls}>
        {({ isActive }) => (
          <>
            <span className={`grid h-7 w-12 place-items-center rounded-full transition-all duration-200 ${isActive ? 'bg-brand-soft text-brand' : ''}`}>
              <Map className="h-[20px] w-[20px]" strokeWidth={isActive ? 2.2 : 1.8} />
            </span>
            <span>地图</span>
          </>
        )}
      </NavLink>
      <NavLink to="/rank" className={cls}>
        {({ isActive }) => (
          <>
            <span className={`grid h-7 w-12 place-items-center rounded-full transition-all duration-200 ${isActive ? 'bg-brand-soft text-brand' : ''}`}>
              <Trophy className="h-[20px] w-[20px]" strokeWidth={isActive ? 2.2 : 1.8} />
            </span>
            <span>排行</span>
          </>
        )}
      </NavLink>
      <div className="flex flex-1 justify-center">
        <button
          onClick={openCapture}
          className={`flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/35 ring-4 ring-white transition-all duration-200 ease-out active:scale-95 ${
            lifting ? '-mt-9 scale-110 shadow-xl shadow-brand/45' : '-mt-5'
          }`}
          aria-label="随手拍，记录无障碍问题"
        >
          <Camera className="h-6 w-6" strokeWidth={2.2} />
        </button>
      </div>
      <NavLink to="/report" className={cls}>
        {({ isActive }) => (
          <>
            <span className={`grid h-7 w-12 place-items-center rounded-full transition-all duration-200 ${isActive ? 'bg-brand-soft text-brand' : ''}`}>
              <FileBarChart2 className="h-[20px] w-[20px]" strokeWidth={isActive ? 2.2 : 1.8} />
            </span>
            <span>报告</span>
          </>
        )}
      </NavLink>
      <NavLink to="/me" className={cls}>
        {({ isActive }) => (
          <>
            <span className={`grid h-7 w-12 place-items-center rounded-full transition-all duration-200 ${isActive ? 'bg-brand-soft text-brand' : ''}`}>
              <User className="h-[20px] w-[20px]" strokeWidth={isActive ? 2.2 : 1.8} />
            </span>
            <span>我的</span>
          </>
        )}
      </NavLink>
    </nav>
  );
}

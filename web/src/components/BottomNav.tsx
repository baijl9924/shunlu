import { Camera, FileBarChart2, Map, Trophy, User } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';

const item = 'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium min-h-14 transition-colors';

export default function BottomNav() {
  const nav = useNavigate();
  const cls = ({ isActive }: { isActive: boolean }) => `${item} ${isActive ? 'text-brand' : 'text-slate-400'}`;
  return (
    <nav className="no-print safe-bottom relative z-30 flex border-t border-slate-200/80 bg-white/95 backdrop-blur-md" aria-label="主导航">
      <NavLink to="/" end className={cls}>
        <Map className="h-[22px] w-[22px]" strokeWidth={1.9} />
        <span>地图</span>
      </NavLink>
      <NavLink to="/rank" className={cls}>
        <Trophy className="h-[22px] w-[22px]" strokeWidth={1.9} />
        <span>排行</span>
      </NavLink>
      <div className="flex flex-1 justify-center">
        <button
          onClick={() => nav('/capture')}
          className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/35 ring-4 ring-white transition-transform active:scale-95"
          aria-label="随手拍，记录无障碍问题"
        >
          <Camera className="h-6 w-6" strokeWidth={2.2} />
        </button>
      </div>
      <NavLink to="/report" className={cls}>
        <FileBarChart2 className="h-[22px] w-[22px]" strokeWidth={1.9} />
        <span>报告</span>
      </NavLink>
      <NavLink to="/me" className={cls}>
        <User className="h-[22px] w-[22px]" strokeWidth={1.9} />
        <span>我的</span>
      </NavLink>
    </nav>
  );
}

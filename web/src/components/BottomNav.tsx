import { NavLink, useNavigate } from 'react-router-dom';

const item = 'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[13px] min-h-14';

export default function BottomNav() {
  const nav = useNavigate();
  const cls = ({ isActive }: { isActive: boolean }) => `${item} ${isActive ? 'text-brand font-semibold' : 'text-gray-500'}`;
  return (
    <nav className="safe-bottom relative flex border-t border-gray-200 bg-white" aria-label="主导航">
      <NavLink to="/" end className={cls}>
        <span aria-hidden className="text-xl">🗺️</span>地图
      </NavLink>
      <NavLink to="/rank" className={cls}>
        <span aria-hidden className="text-xl">🏆</span>排行
      </NavLink>
      <div className="flex flex-1 justify-center">
        <button
          onClick={() => nav('/capture')}
          className="-mt-7 flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/40 ring-4 ring-white active:scale-95"
          aria-label="随手拍，上报无障碍问题"
        >
          <span aria-hidden className="text-2xl leading-none">📷</span>
          <span className="mt-0.5 text-[12px] font-semibold">随手拍</span>
        </button>
      </div>
      <NavLink to="/report" className={cls}>
        <span aria-hidden className="text-xl">📋</span>报告
      </NavLink>
      <NavLink to="/me" className={cls}>
        <span aria-hidden className="text-xl">🙂</span>我的
      </NavLink>
    </nav>
  );
}

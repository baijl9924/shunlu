import { useEffect, useState } from 'react';
import IssueCard from '../components/IssueCard';
import Poster from '../components/Poster';
import { api, type Issue } from '../lib/api';
import { useApp } from '../lib/store';

type MeData = {
  nickname: string;
  stats: { points: number; issues: number; fixed: number; confirmed: number; helped: number; rechecks: number; cities: number };
  level: { name: string; index: number; next: { name: string; need: number } | null };
  badges: { id: string; name: string; desc: string; got: boolean }[];
  issues: Issue[];
};

const BADGE_ICON: Record<string, string> = { first: '🔍', ten: '👁️', echo: '📣', helper: '🤝', fixer: '🛠️', recheck: '🔄', traveler: '🧭' };

export default function Me() {
  const { loggedIn, toast, setNickname, profile, saveProfile } = useApp();
  const [me, setMe] = useState<MeData | null>(null);
  const [poster, setPoster] = useState(false);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState('');
  const [p, setP] = useState(profile);

  const load = () => api<MeData>('/api/me').then((d) => (setMe(d), setName(d.nickname))).catch((e) => toast(e.message));
  useEffect(() => {
    if (loggedIn) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  if (!me) return <div className="p-8 text-center text-gray-400">加载中…</div>;
  const { stats, level } = me;
  const progress = level.next ? Math.min(100, Math.round((stats.points / (stats.points + level.next.need)) * 100)) : 100;

  return (
    <div className="pb-14">
      <section className="bg-gradient-to-br from-brand to-brand-dark px-5 pb-16 pt-8 text-white">
        {editName ? (
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api('/api/me', { method: 'PATCH', json: { nickname: name } });
                setNickname(name.trim());
                setEditName(false);
                load();
              } catch (err) {
                toast((err as Error).message);
              }
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} className="flex-1 rounded-lg px-3 py-2 text-ink" aria-label="昵称" autoFocus />
            <button className="rounded-lg bg-white/20 px-4">保存</button>
          </form>
        ) : (
          <button onClick={() => setEditName(true)} className="text-left">
            <span className="text-[24px] font-bold">{me.nickname}</span> <span className="text-[14px] opacity-70">✏️</span>
          </button>
        )}
        <p className="mt-1 text-[16px]">🏅 {level.name} · {stats.points} 积分</p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-[13px] opacity-80">{level.next ? `再得 ${level.next.need} 积分升级为「${level.next.name}」` : '你已是最高等级，感谢一路同行！'}</p>
      </section>

      <div className="-mt-12 space-y-4 px-4">
        <section className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-4 text-center shadow-sm">
          <Stat n={stats.issues} label="标记问题" />
          <Stat n={stats.confirmed} label="获得确认" />
          <Stat n={stats.fixed} label="推动整改" />
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[15px] leading-relaxed">
            💚 你标记的问题已被 <b className="text-brand">{stats.confirmed}</b> 人确认“我也遇到”，其中 <b className="text-brand">{stats.fixed}</b> 处已经整改。每一次标记，都在帮轮椅、视障朋友提前避开路障。
          </p>
          <button onClick={() => setPoster(true)} className="mt-3 w-full rounded-xl bg-brand py-3 font-semibold text-white">
            生成我的体检官海报
          </button>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">勋章墙</h2>
          <ul className="grid grid-cols-4 gap-3">
            {me.badges.map((b) => (
              <li key={b.id} className={`text-center ${b.got ? '' : 'opacity-35 grayscale'}`} title={b.desc}>
                <div className={`mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl ${b.got ? 'bg-amber-100' : 'bg-gray-100'}`} aria-hidden>
                  {BADGE_ICON[b.id]}
                </div>
                <p className="mt-1 text-[12px] font-medium">{b.name}</p>
                <span className="sr-only">{b.got ? '已获得' : '未获得'}：{b.desc}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">举报资料卡</h2>
          <p className="mb-2 text-[13px] text-gray-500">生成反映文本时自动填入。仅保存在本机，不上传服务器。</p>
          <div className="flex gap-2">
            <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="姓名" className="w-1/3 rounded-lg border border-gray-300 px-3 py-2.5" aria-label="姓名" />
            <input value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} placeholder="联系电话" inputMode="tel" className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5" aria-label="联系电话" />
          </div>
          <button onClick={() => (saveProfile(p), toast('已保存到本机'))} className="mt-2 w-full rounded-lg border border-brand py-2.5 font-semibold text-brand">
            保存
          </button>
        </section>

        <section>
          <h2 className="mb-2 px-1 font-semibold">我的标记（{me.issues.length}）</h2>
          <div className="space-y-3">
            {me.issues.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-gray-400">还没有标记，去随手拍吧</p>}
            {me.issues.map((i) => (
              <IssueCard key={i.id} issue={i} />
            ))}
          </div>
        </section>
      </div>
      {poster && <Poster nickname={me.nickname} level={level.name} issues={stats.issues} confirmed={stats.confirmed} fixed={stats.fixed} onClose={() => setPoster(false)} />}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <p className="text-[28px] font-bold text-brand">{n}</p>
      <p className="text-[13px] text-gray-500">{label}</p>
    </div>
  );
}

import { MapPin, Navigation, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { assetUrl, SEVERITY_TEXT, STATUS_COLOR, STATUS_TEXT, timeAgo, type Issue } from '../lib/api';
import { distanceMeters, formatDistance } from '../lib/geo';
import { useApp } from '../lib/store';
import CategoryIcon from './CategoryIcon';

export function StatusBadge({ status }: { status: Issue['status'] }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
      style={{ background: STATUS_COLOR[status] }}
    >
      {STATUS_TEXT[status]}
    </span>
  );
}

export default function IssueCard({ issue: i }: { issue: Issue }) {
  const { userGeo } = useApp();
  const dist = userGeo ? formatDistance(distanceMeters(userGeo, { lat: i.lat, lng: i.lng })) : '';
  return (
    <Link to={`/issue/${i.id}`} className="flex gap-3.5 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition active:scale-[0.99] active:bg-slate-50">
      <img src={assetUrl(i.photo)} alt={`${i.title}的现场照片`} className="h-24 w-24 shrink-0 rounded-xl bg-slate-100 object-cover" loading="lazy" />
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <div className="flex items-center gap-2">
            <StatusBadge status={i.status} />
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              <CategoryIcon category={i.category} className="h-3.5 w-3.5 text-slate-400" />
              {i.category}
            </span>
            <span className="ml-auto text-[11px] text-slate-400">{timeAgo(i.createdAt)}</span>
          </div>
          <h3 className="mt-1.5 truncate text-[15px] font-semibold text-slate-900">{i.title}</h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{i.address || `${i.lat.toFixed(5)}, ${i.lng.toFixed(5)}`}</span>
          </p>
        </div>
        <div className="mt-1.5 flex items-center gap-2.5 text-[12px] text-slate-500">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{SEVERITY_TEXT[i.severity]}</span>
          {dist && (
            <span className="inline-flex items-center gap-0.5 rounded bg-brand-soft/80 px-1.5 py-0.5 text-[11px] font-medium text-brand">
              <Navigation className="h-3 w-3" />
              距你 {dist}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            {i.confirmCount} 人确认
          </span>
        </div>
      </div>
    </Link>
  );
}

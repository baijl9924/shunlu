import { Link } from 'react-router-dom';
import { assetUrl, CATEGORY_ICON, SEVERITY_TEXT, STATUS_COLOR, STATUS_TEXT, timeAgo, type Issue } from '../lib/api';

export function StatusBadge({ status }: { status: Issue['status'] }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold text-white" style={{ background: STATUS_COLOR[status] }}>
      {STATUS_TEXT[status]}
    </span>
  );
}

export default function IssueCard({ issue: i }: { issue: Issue }) {
  return (
    <Link to={`/issue/${i.id}`} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm active:bg-gray-50">
      <img src={assetUrl(i.photo)} alt={`${i.title}的现场照片`} className="h-24 w-24 shrink-0 rounded-xl object-cover" loading="lazy" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StatusBadge status={i.status} />
          <span className="text-[12px] text-gray-400">{timeAgo(i.createdAt)}</span>
        </div>
        <h3 className="mt-1 truncate text-[16px] font-semibold">
          <span aria-hidden>{CATEGORY_ICON[i.category]} </span>
          {i.title}
        </h3>
        <p className="truncate text-[13px] text-gray-500">{i.address || `${i.lat.toFixed(5)}, ${i.lng.toFixed(5)}`}</p>
        <p className="mt-1 text-[13px] text-gray-500">
          {SEVERITY_TEXT[i.severity]} · {i.confirmCount} 人也遇到
        </p>
      </div>
    </Link>
  );
}

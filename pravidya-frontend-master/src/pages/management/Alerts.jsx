import { useState, useEffect, useMemo } from 'react';
import { Bell, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { managementAPI } from '../../services/api';
import AnalyticsFilters from '../../components/management/AnalyticsFilters';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

const SEVERITY_MAP = { danger: 'Critical', warning: 'Warning', info: 'Info' };
const SEVERITY_COLORS = {
  Critical: 'bg-red-100 text-red-800 border-red-200',
  Warning: 'bg-amber-100 text-amber-800 border-amber-200',
  Info: 'bg-blue-100 text-blue-800 border-blue-200',
};
const SEVERITY_ICONS = {
  Critical: AlertCircle,
  Warning: AlertTriangle,
  Info: Info,
};
const CARD_COLORS = {
  Critical: 'border-red-300 bg-red-50/50',
  Warning: 'border-amber-300 bg-amber-50/30',
  Info: 'border-blue-300 bg-blue-50/30',
};

const PAGE_SIZE = 10;

function getAlertId(a) {
  return `${a.entityType}-${a.entityId}-${(a.message || '').slice(0, 60)}`;
}

function normalizeAlert(raw) {
  const severity = SEVERITY_MAP[raw.type] || 'Info';
  const createdAt = raw.createdAt ? new Date(raw.createdAt) : null;
  return {
    ...raw,
    alertId: getAlertId(raw),
    severity,
    createdAt,
    entityName: raw.entityName || raw.message?.replace(/^.*?(Lead|Counselor|institution)\s+/i, '')?.slice(0, 50) || `${raw.entityType} #${(raw.entityId || '').slice(0, 8)}`,
  };
}

const StatCard = ({ title, value, icon: Icon, colorClass }) => (
  <div className={`rounded-2xl border-2 p-5 shadow-sm ${colorClass}`}>
    <p className="text-sm font-medium opacity-90">{title}</p>
    <p className="text-3xl font-bold mt-1 flex items-center gap-2">
      {typeof Icon === 'function' ? <Icon className="w-8 h-8 flex-shrink-0" aria-hidden /> : <span>{Icon}</span>}
      {value}
    </p>
  </div>
);

const SeverityBadge = ({ severity }) => {
  const Icon = SEVERITY_ICONS[severity] || SEVERITY_ICONS.Info;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${SEVERITY_COLORS[severity] || SEVERITY_COLORS.Info}`}>
      {typeof Icon === 'function' ? <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden /> : Icon}
      {severity}
    </span>
  );
};

export default function Alerts() {
  const [rawAlerts, setRawAlerts] = useState([]);
  const [resolvedIds, setResolvedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [typeFilter, setTypeFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [detailAlert, setDetailAlert] = useState(null);

  const fetchAlerts = () => {
    managementAPI.getAlerts()
      .then((r) => {
        setRawAlerts(r.data?.data?.alerts || []);
        setLastUpdated(new Date());
      })
      .catch(() => toast.error('Failed to load alerts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAlerts(); }, []);

  useEffect(() => {
    const interval = setInterval(() => fetchAlerts(), 30000);
    return () => clearInterval(interval);
  }, []);

  const alerts = useMemo(() => rawAlerts.map((a) => normalizeAlert(a)), [rawAlerts]);

  const isResolved = (alertId) => resolvedIds.has(alertId);

  const filtered = useMemo(() => {
    let list = alerts.filter((a) => {
      if (statusFilter === 'Active' && isResolved(a.alertId)) return false;
      if (statusFilter === 'Resolved' && !isResolved(a.alertId)) return false;
      if (severityFilter !== 'All' && a.severity !== severityFilter) return false;
      if (typeFilter !== 'All' && a.entityType !== typeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!(a.message || '').toLowerCase().includes(q) && !(a.entityName || '').toLowerCase().includes(q)) return false;
      }
      if (a.createdAt && (dateFrom || dateTo)) {
        const t = new Date(a.createdAt).getTime();
        if (dateFrom && t < new Date(dateFrom).setHours(0, 0, 0, 0)) return false;
        if (dateTo && t > new Date(dateTo).setHours(23, 59, 59, 999)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (sortKey === 'createdAt') {
        const aT = aVal ? new Date(aVal).getTime() : 0;
        const bT = bVal ? new Date(bVal).getTime() : 0;
        return sortDir === 'asc' ? aT - bT : bT - aT;
      }
      if (sortKey === 'severity') {
        const order = { Critical: 0, Warning: 1, Info: 2 };
        return sortDir === 'asc' ? (order[aVal] - order[bVal]) : (order[bVal] - order[aVal]);
      }
      return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
    return list;
  }, [alerts, severityFilter, statusFilter, typeFilter, search, dateFrom, dateTo, sortKey, sortDir, resolvedIds]);

  const criticalAlerts = useMemo(() => filtered.filter((a) => a.severity === 'Critical' && !isResolved(a.alertId)), [filtered, resolvedIds]);
  const timelineGroups = useMemo(() => {
    const today = [];
    const yesterday = [];
    const earlier = [];
    filtered.filter((a) => !isResolved(a.alertId)).forEach((a) => {
      const d = a.createdAt;
      if (!d) today.push(a);
      else if (isToday(d)) today.push(a);
      else if (isYesterday(d)) yesterday.push(a);
      else earlier.push(a);
    });
    return { today, yesterday, earlier };
  }, [filtered, resolvedIds]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  const summary = useMemo(() => {
    const active = alerts.filter((a) => !isResolved(a.alertId));
    return {
      total: active.length,
      critical: active.filter((a) => a.severity === 'Critical').length,
      warning: active.filter((a) => a.severity === 'Warning').length,
      info: active.filter((a) => a.severity === 'Info').length,
    };
  }, [alerts, resolvedIds]);

  const handleResolve = async (alert) => {
    try {
      await managementAPI.resolveAlert(alert.entityId);
      setResolvedIds((prev) => new Set([...prev, alert.alertId]));
      toast.success('Alert marked as resolved');
    } catch {
      setResolvedIds((prev) => new Set([...prev, alert.alertId]));
      toast.success('Marked as resolved');
    }
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const entityTypes = useMemo(() => [...new Set(alerts.map((a) => a.entityType))].filter(Boolean).sort(), [alerts]);

  if (loading && rawAlerts.length === 0) {
    return (
      <div className="space-y-6">
        <AnalyticsFilters />
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-500 border-t-transparent" aria-label="Loading" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnalyticsFilters />

      {/* Live indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-100">
        <span className="text-sm font-medium text-emerald-600">Live Updates Enabled</span>
        <span className="text-xs text-slate-500">
          Last updated: {lastUpdated ? formatDistanceToNow(lastUpdated, { addSuffix: true }) : '—'}
        </span>
      </div>

      {/* Section 1: Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Active Alerts" value={summary.total} icon={Bell} colorClass="bg-white border-slate-200" />
        <StatCard title="Critical Alerts" value={summary.critical} icon={AlertCircle} colorClass="border-red-200 bg-red-50/50 text-red-900" />
        <StatCard title="Warning Alerts" value={summary.warning} icon={AlertTriangle} colorClass="border-amber-200 bg-amber-50/50 text-amber-900" />
        <StatCard title="Info Alerts" value={summary.info} icon={Info} colorClass="border-blue-200 bg-blue-50/50 text-blue-900" />
      </div>

      {/* Section 4: Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl border border-slate-100">
        <span className="text-sm font-medium text-slate-700">Filters:</span>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="input-field py-2 text-sm w-32">
          <option value="All">All Severity</option>
          <option value="Critical">Critical</option>
          <option value="Warning">Warning</option>
          <option value="Info">Info</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field py-2 text-sm w-32">
          <option value="Active">Active</option>
          <option value="Resolved">Resolved</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field py-2 text-sm w-36">
          <option value="All">All Types</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="input-field py-2 text-sm w-36" title="From date" />
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="input-field py-2 text-sm w-36" title="To date" />
        <input type="search" placeholder="Search alerts..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input-field py-2 text-sm w-48" />
      </div>

      {/* Section 2: Critical alerts priority */}
      {criticalAlerts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Critical Alerts</h3>
          <div className="space-y-3">
            {criticalAlerts.map((a) => (
              <div key={a.alertId} className={`p-4 rounded-xl border-2 ${CARD_COLORS.Critical}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SeverityBadge severity={a.severity} />
                      <span className="text-sm text-slate-500">{a.entityType} • {a.entityName}</span>
                    </div>
                    <p className="font-medium text-slate-900 mt-1">{a.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{a.createdAt ? formatDistanceToNow(a.createdAt, { addSuffix: true }) : 'Recently'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDetailAlert(a)} className="btn-secondary text-sm py-1.5 px-3">View Details</button>
                    <button type="button" onClick={() => handleResolve(a)} className="btn-primary text-sm py-1.5 px-3">Mark as Resolved</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Timeline */}
      <div className="bg-white rounded-2xl border-2 border-slate-100 p-5">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Alerts Timeline</h3>
        <div className="space-y-6">
          {['today', 'yesterday', 'earlier'].map((groupKey) => {
            const group = timelineGroups[groupKey];
            const label = groupKey === 'today' ? 'Today' : groupKey === 'yesterday' ? 'Yesterday' : 'Earlier';
            if (!group.length) return null;
            return (
              <div key={groupKey}>
                <p className="text-sm font-medium text-slate-500 mb-2">{label}</p>
                <div className="space-y-2">
                  {group.map((a) => (
                    <div key={a.alertId} className={`flex items-center gap-3 p-3 rounded-lg border ${CARD_COLORS[a.severity] || 'border-slate-100'}`}>
                      <span>{SEVERITY_ICONS[a.severity]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm">{a.message}</p>
                        <p className="text-xs text-slate-500">{a.entityType} • {a.createdAt ? format(a.createdAt, 'HH:mm') : '—'}</p>
                      </div>
                      <button type="button" onClick={() => handleResolve(a)} className="text-sm text-primary-600 hover:underline">Resolve</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {timelineGroups.today.length + timelineGroups.yesterday.length + timelineGroups.earlier.length === 0 && (
          <p className="text-slate-500 py-6 text-center text-sm">No active alerts in timeline</p>
        )}
      </div>

      {/* Section 5: Alerts table */}
      <div className="bg-white rounded-2xl border-2 border-slate-100 overflow-hidden">
        <h3 className="text-lg font-semibold text-slate-900 p-5 pb-0">Alerts Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left py-3 px-4 font-semibold cursor-pointer" onClick={() => toggleSort('severity')}>Severity {sortKey === 'severity' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                <th className="text-left py-3 px-4 font-semibold cursor-pointer" onClick={() => toggleSort('entityType')}>Type {sortKey === 'entityType' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                <th className="text-left py-3 px-4 font-semibold">Message</th>
                <th className="text-left py-3 px-4 font-semibold">Related Entity</th>
                <th className="text-left py-3 px-4 font-semibold cursor-pointer" onClick={() => toggleSort('createdAt')}>Generated {sortKey === 'createdAt' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                <th className="text-left py-3 px-4 font-semibold">Status</th>
                <th className="text-left py-3 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((a) => (
                <tr key={a.alertId} className="border-b hover:bg-slate-50">
                  <td className="py-3 px-4"><SeverityBadge severity={a.severity} /></td>
                  <td className="py-3 px-4">{a.entityType}</td>
                  <td className="py-3 px-4">{a.message}</td>
                  <td className="py-3 px-4">{a.entityName}</td>
                  <td className="py-3 px-4 text-slate-600">{a.createdAt ? formatDistanceToNow(a.createdAt, { addSuffix: true }) : '—'}</td>
                  <td className="py-3 px-4">{isResolved(a.alertId) ? <span className="text-emerald-600">Resolved</span> : <span className="text-amber-600">Active</span>}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setDetailAlert(a)} className="text-primary-600 hover:underline text-xs">View</button>
                      {!isResolved(a.alertId) && <button type="button" onClick={() => handleResolve(a)} className="text-amber-600 hover:underline text-xs">Resolve</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="text-slate-500 py-8 text-center">No alerts match your filters.</p>}
        {totalPages > 1 && (
          <div className="flex items-center justify-between py-3 px-4 border-t">
            <span className="text-sm text-slate-600">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">Previous</button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetailAlert(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Alert Details</h3>
              <button type="button" onClick={() => setDetailAlert(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">×</button>
            </div>
            <div className="space-y-3">
              <p><SeverityBadge severity={detailAlert.severity} /></p>
              <p className="text-slate-700">{detailAlert.message}</p>
              <p className="text-sm text-slate-500">Entity: {detailAlert.entityType} — {detailAlert.entityName}</p>
              <p className="text-sm text-slate-500">Time: {detailAlert.createdAt ? format(detailAlert.createdAt, 'PPpp') : '—'}</p>
            </div>
            <div className="mt-4 flex gap-2">
              {!isResolved(detailAlert.alertId) && <button type="button" onClick={() => { handleResolve(detailAlert); setDetailAlert(null); }} className="btn-primary text-sm py-2 px-4">Mark as Resolved</button>}
              <button type="button" onClick={() => setDetailAlert(null)} className="btn-secondary text-sm py-2 px-4">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

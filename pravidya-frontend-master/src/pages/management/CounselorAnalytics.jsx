import { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { managementAPI } from '../../services/api';
import { useManagementFilters } from '../../contexts/ManagementFiltersContext';
import AnalyticsFilters from '../../components/management/AnalyticsFilters';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { formatDuration } from '../../utils/format';

const CHART_COLORS = {
  primary: '#6366f1',
  teal: '#0d9488',
  emerald: '#059669',
  amber: '#d97706',
  gray: '#6b7280',
  slate: '#475569',
};
const PIE_COLORS = [CHART_COLORS.primary, CHART_COLORS.teal, CHART_COLORS.amber, CHART_COLORS.emerald, CHART_COLORS.slate, CHART_COLORS.gray];

const StatCard = ({ title, value, subtext, variant = 'default' }) => {
  const styles = {
    default: 'bg-white border-gray-200 text-gray-900',
    primary: 'bg-primary-50 border-primary-100 text-primary-800',
    green: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    blue: 'bg-blue-50 border-blue-100 text-blue-800',
    amber: 'bg-amber-50 border-amber-100 text-amber-800',
    purple: 'bg-purple-50 border-purple-100 text-purple-800',
  };
  return (
    <div className={`rounded-2xl border-2 p-5 shadow-sm ${styles[variant] || styles.default}`}>
      <p className="text-sm font-medium opacity-90">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {subtext && <p className="text-xs mt-1 opacity-80">{subtext}</p>}
    </div>
  );
};

const Card = ({ title, subtitle, children, className = '' }) => (
  <div className={`bg-white rounded-2xl border-2 border-gray-100 p-5 shadow-sm ${className}`}>
    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
    {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    {children}
  </div>
);

const EmptyState = ({ message = 'No data available' }) => (
  <div className="flex items-center justify-center py-12 text-gray-500 text-sm">{message}</div>
);

const PAGE_SIZE = 10;

export default function CounselorAnalytics() {
  const { params } = useManagementFilters();
  const [counselors, setCounselors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('leadsAssigned');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    managementAPI.getCounselors(params)
      .then((r) => { if (!cancelled) setCounselors(r.data?.data?.counselors || []); })
      .catch(() => { if (!cancelled) toast.error('Failed to load counselors'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [JSON.stringify(params)]);

  const list = useMemo(() => counselors.filter((c) => c.name && c.id), [counselors]);

  const summary = useMemo(() => {
    const total = list.length;
    const active = list.filter((c) => (c.leadsAssigned ?? 0) > 0).length;
    const totalAssigned = list.reduce((s, c) => s + (c.leadsAssigned ?? 0), 0);
    const totalCompleted = list.reduce((s, c) => s + (c.admissions ?? 0), 0);
    const withConversion = list.filter((c) => (c.leadsAssigned ?? 0) > 0);
    const avgConversion = withConversion.length
      ? (withConversion.reduce((s, c) => s + (parseFloat(c.conversionPct) || 0), 0) / withConversion.length).toFixed(1)
      : '0';
    return { total, active, totalAssigned, totalCompleted, avgConversion };
  }, [list]);

  const formatLastActivity = (date) => {
    if (!date) return '—';
    try {
      const d = new Date(date);
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 1440) return `${formatDuration(diffMins)} ago`; // < 24h
      return format(d, 'dd MMM yyyy, HH:mm');
    } catch (_) { return '—'; }
  };

  const tableRows = useMemo(() => {
    let rows = list.map((c) => ({
      ...c,
      pendingLeads: (c.leadsAssigned ?? 0) - (c.admissions ?? 0),
      counselingCompleted: c.admissions ?? 0,
      conversionRate: c.conversionPct ?? '0',
      lastActivity: formatLastActivity(c.lastActivity),
    }));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => (r.name || '').toLowerCase().includes(q));
    }
    const mult = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (sortKey === 'conversionRate') return mult * (parseFloat(aVal) - parseFloat(bVal));
      if (typeof aVal === 'number' && typeof bVal === 'number') return mult * (aVal - bVal);
      return mult * String(aVal ?? '').localeCompare(String(bVal ?? ''));
    });
    return rows;
  }, [list, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => tableRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [tableRows, page]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const openDetail = (id) => {
    setDetailId(id);
    setDetailData(null);
    setDetailLoading(true);
    managementAPI.getCounselorDetail(id)
      .then((r) => setDetailData(r.data?.data))
      .catch(() => toast.error('Failed to load counselor detail'))
      .finally(() => setDetailLoading(false));
  };

  const closeDetail = () => { setDetailId(null); setDetailData(null); };

  if (loading) {
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

      {/* Row 1: Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard title="Total Counselors" value={summary.total} subtext="All counselors" variant="default" />
        <StatCard title="Active Counselors" value={summary.active} subtext="With assigned leads" variant="primary" />
        <StatCard title="Total Leads Assigned" value={summary.totalAssigned} subtext="Across all counselors" variant="blue" />
        <StatCard title="Total Counseling Completed" value={summary.totalCompleted} subtext="Admissions" variant="green" />
        <StatCard title="Average Conversion Rate" value={`${summary.avgConversion}%`} subtext="Across counselors" variant="purple" />
      </div>

      {/* Row 2: Leads Assigned | Counseling Completed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Leads Assigned per Counselor" subtitle="Workload distribution">
          {list.length === 0 ? <EmptyState /> : (
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={list.map((c) => ({ name: c.name, value: c.leadsAssigned ?? 0 }))} margin={{ top: 8, right: 8, left: 8, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill={CHART_COLORS.primary} name="Leads Assigned" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Counseling Completed per Counselor" subtitle="Actual performance">
          {list.length === 0 ? <EmptyState /> : (
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={list.map((c) => ({ name: c.name, value: c.admissions ?? 0 }))} margin={{ top: 8, right: 8, left: 8, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill={CHART_COLORS.emerald} name="Completed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Row 3: Conversion Rate | Response Time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Conversion Rate per Counselor" subtitle="(Completed / Assigned) × 100">
          {list.length === 0 ? <EmptyState /> : (
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={list.map((c) => ({ name: c.name, value: parseFloat(c.conversionPct) || 0 }))} margin={{ top: 8, right: 8, left: 8, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v) => [v + '%', 'Conversion']} />
                  <Bar dataKey="value" fill={CHART_COLORS.teal} name="Conversion %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Response Time per Counselor" subtitle="Average (h / m) where available">
          {list.length === 0 ? <EmptyState /> : (
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={list.map((c) => ({ name: c.name, value: Number(c.avgResponseTime) || 0 }))} margin={{ top: 8, right: 8, left: 8, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatDuration(v)} />
                  <Tooltip formatter={(v) => [v ? formatDuration(v) : '—', 'Response']} />
                  <Bar dataKey="value" fill={CHART_COLORS.amber} name="Response time" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Row 4: Leaderboard | Workload Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Top Performers (by Counseling Completed)" subtitle="Leaderboard">
          {list.length === 0 ? <EmptyState /> : (
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...list].sort((a, b) => (b.admissions ?? 0) - (a.admissions ?? 0)).slice(0, 8).map((c) => ({ name: c.name, value: c.admissions ?? 0 }))}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 100, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill={CHART_COLORS.emerald} name="Completed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Workload Distribution" subtitle="% of total leads per counselor">
          {list.length === 0 ? <EmptyState /> : (() => {
            const workloadData = list.map((c, i) => ({ name: c.name, value: c.leadsAssigned ?? 0, color: PIE_COLORS[i % PIE_COLORS.length] })).filter((d) => d.value > 0);
            const totalLeads = list.reduce((s, x) => s + (x.leadsAssigned ?? 0), 0);
            return (
              <div className="h-72 mt-4 flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={workloadData}
                      cx="50%"
                      cy="50%"
                      innerRadius="50%"
                      outerRadius="75%"
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => {
                        const pct = totalLeads > 0 ? ((value / totalLeads) * 100).toFixed(0) : 0;
                        return `${name}: ${pct}%`;
                      }}
                    >
                      {workloadData.map((entry, i) => <Cell key={entry.name + i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value, name) => {
                      const pct = totalLeads > 0 ? ((value / totalLeads) * 100).toFixed(1) : 0;
                      return [value + ' (' + pct + '%)', name];
                    }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </Card>
      </div>

      {/* Row 5: Counselor Performance Table */}
      <Card title="Counselor Performance" subtitle="Sort, search, and view details">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="search"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field py-2 w-64"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 font-semibold cursor-pointer" onClick={() => toggleSort('name')}>Counselor Name {sortKey === 'name' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                <th className="text-right py-3 px-4 font-semibold cursor-pointer" onClick={() => toggleSort('leadsAssigned')}>Leads Assigned {sortKey === 'leadsAssigned' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                <th className="text-right py-3 px-4 font-semibold cursor-pointer" onClick={() => toggleSort('counselingCompleted')}>Completed {sortKey === 'counselingCompleted' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                <th className="text-right py-3 px-4 font-semibold cursor-pointer" onClick={() => toggleSort('pendingLeads')}>Pending {sortKey === 'pendingLeads' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                <th className="text-right py-3 px-4 font-semibold cursor-pointer" onClick={() => toggleSort('conversionRate')}>Conversion % {sortKey === 'conversionRate' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                <th className="text-right py-3 px-4 font-semibold">Avg Response</th>
                <th className="text-left py-3 px-4 font-semibold">Last Activity</th>
                <th className="text-left py-3 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{c.name}</td>
                  <td className="py-3 px-4 text-right">{c.leadsAssigned ?? 0}</td>
                  <td className="py-3 px-4 text-right text-emerald-600">{c.counselingCompleted ?? 0}</td>
                  <td className="py-3 px-4 text-right">{c.pendingLeads ?? 0}</td>
                  <td className="py-3 px-4 text-right">{c.conversionRate}%</td>
                  <td className="py-3 px-4 text-right">{c.avgResponseTime != null ? formatDuration(c.avgResponseTime) : '—'}</td>
                  <td className="py-3 px-4 text-gray-600">{c.lastActivity}</td>
                  <td className="py-3 px-4">
                    <button type="button" onClick={() => openDetail(c.id)} className="text-primary-600 hover:text-primary-700 font-medium">View Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tableRows.length === 0 && <p className="text-gray-500 py-8 text-center">No counselors match your search.</p>}
        {totalPages > 1 && (
          <div className="flex items-center justify-between py-3 px-4 border-t">
            <span className="text-sm text-gray-600">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, tableRows.length)} of {tableRows.length}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">Previous</button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail modal */}
      {detailId && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true">
          <div className="fixed inset-0 bg-black/50" onClick={closeDetail} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-bold text-gray-900">Counselor Details</h2>
                <button type="button" onClick={closeDetail} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" aria-label="Close">×</button>
              </div>
              <div className="p-6 space-y-6">
                {detailLoading && (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
                  </div>
                )}
                {!detailLoading && detailData && (
                  <>
                    {detailData.counselor && (
                      <>
                        <div className="p-4 bg-gray-50 rounded-xl">
                          <p className="font-semibold text-gray-900">{detailData.counselor.fullName}</p>
                          <p className="text-sm text-gray-600 mt-1">Status: Active</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <StatCard title="Leads Assigned" value={detailData.counselor.assignedLeads?.length ?? 0} variant="blue" />
                          <StatCard title="Counseling Completed" value={(detailData.counselor.assignedLeads || []).filter((l) => l.status === 'ENROLLED').length} variant="green" />
                          <StatCard title="Pending" value={detailData.detail?.pendingLeads ?? 0} variant="amber" />
                          <StatCard title="Conversion %" value={detailData.counselor.assignedLeads?.length > 0 ? (((detailData.counselor.assignedLeads.filter((l) => l.status === 'ENROLLED').length / detailData.counselor.assignedLeads.length) * 100).toFixed(1) + '%') : '0%'} variant="purple" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <StatCard title="Avg Response Time" value={detailData.detail?.avgResponseTime != null ? formatDuration(detailData.detail.avgResponseTime) : '—'} variant="default" />
                          <StatCard title="Today's Response Time" value={detailData.detail?.todayResponseTime != null ? formatDuration(detailData.detail.todayResponseTime) : '—'} variant="default" />
                          <StatCard title="Last Activity" value={detailData.detail?.lastActivity ? formatLastActivity(detailData.detail.lastActivity) : '—'} variant="default" />
                        </div>
                      </>
                    )}
                    {detailData.detail?.performanceTrend && Object.keys(detailData.detail.performanceTrend).length > 0 && (
                      <Card title="Lead Handling Trend" subtitle="Leads by month">
                        <div className="h-56 mt-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={Object.entries(detailData.detail.performanceTrend).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }))}
                              margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip />
                              <Line type="monotone" dataKey="count" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} name="Leads" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                    )}
                    {detailData.counselor?.assignedLeads?.length > 0 && (
                      <>
                        <Card title="Lead Status Distribution" subtitle="Pending, In Progress, Completed, Other">
                          <div className="h-48 mt-4 flex items-center">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={(() => {
                                    const leads = detailData.counselor.assignedLeads || [];
                                    const pending = leads.filter((l) => l.status === 'NEW').length;
                                    const inProgress = leads.filter((l) => ['CONTACTED', 'FOLLOW_UP'].includes(l.status)).length;
                                    const completed = leads.filter((l) => l.status === 'ENROLLED').length;
                                    const other = leads.filter((l) => !['NEW', 'CONTACTED', 'FOLLOW_UP', 'ENROLLED'].includes(l.status)).length;
                                    return [
                                      { name: 'Pending', value: pending, color: CHART_COLORS.gray },
                                      { name: 'In Progress', value: inProgress, color: CHART_COLORS.amber },
                                      { name: 'Completed', value: completed, color: CHART_COLORS.emerald },
                                      { name: 'Other', value: other, color: CHART_COLORS.slate },
                                    ].filter((d) => d.value > 0);
                                  })()}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius="50%"
                                  outerRadius="70%"
                                  dataKey="value"
                                  nameKey="name"
                                  label={({ name, value }) => `${name}: ${value}`}
                                >
                                  {(() => {
                                    const leads = detailData.counselor.assignedLeads || [];
                                    const pending = leads.filter((l) => l.status === 'NEW').length;
                                    const inProgress = leads.filter((l) => ['CONTACTED', 'FOLLOW_UP'].includes(l.status)).length;
                                    const completed = leads.filter((l) => l.status === 'ENROLLED').length;
                                    const other = leads.filter((l) => !['NEW', 'CONTACTED', 'FOLLOW_UP', 'ENROLLED'].includes(l.status)).length;
                                    return [
                                      { name: 'Pending', value: pending, color: CHART_COLORS.gray },
                                      { name: 'In Progress', value: inProgress, color: CHART_COLORS.amber },
                                      { name: 'Completed', value: completed, color: CHART_COLORS.emerald },
                                      { name: 'Other', value: other, color: CHART_COLORS.slate },
                                    ].filter((d) => d.value > 0).map((entry) => <Cell key={entry.name} fill={entry.color} />);
                                  })()}
                                </Pie>
                                <Tooltip />
                                <Legend />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </Card>
                        <Card title="Recent Leads" subtitle="Assigned to this counselor">
                          <div className="overflow-x-auto mt-4">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2 px-3 font-semibold">Lead ID</th>
                                  <th className="text-left py-2 px-3 font-semibold">Status</th>
                                  <th className="text-left py-2 px-3 font-semibold">Lead Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(detailData.counselor.assignedLeads || []).slice(0, 15).map((l) => (
                                  <tr key={l.id} className="border-b hover:bg-gray-50">
                                    <td className="py-2 px-3">{l.id?.slice(0, 8) || '—'}</td>
                                    <td className="py-2 px-3">{l.status || '—'}</td>
                                    <td className="py-2 px-3">{l.submittedAt ? format(new Date(l.submittedAt), 'dd MMM yyyy') : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </Card>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { managementAPI } from '../../services/api';
import { useManagementFilters } from '../../contexts/ManagementFiltersContext';
import AnalyticsFilters from '../../components/management/AnalyticsFilters';
import toast from 'react-hot-toast';
import { format, subDays } from 'date-fns';

// Reusable StatCard (consistent with Overview)
const StatCard = ({ title, value, subtext, variant = 'default' }) => {
  const styles = {
    default: 'bg-white border-slate-200 text-slate-900',
    primary: 'bg-primary-50 border-primary-100 text-primary-800',
    green: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    blue: 'bg-blue-50 border-blue-100 text-blue-800',
    purple: 'bg-purple-50 border-purple-100 text-purple-800',
    amber: 'bg-amber-50 border-amber-100 text-amber-800',
  };
  return (
    <div className={`rounded-2xl border-2 p-5 shadow-sm ${styles[variant] || styles.default}`}>
      <p className="text-sm font-medium opacity-90">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {subtext && <p className="text-xs mt-1 opacity-80">{subtext}</p>}
    </div>
  );
};

// Bar chart: vertical bars, data = [{ label, value }]
const BAR_CHART_HEIGHT = 140;
const BarChart = ({ data, title, subtitle, color = 'bg-primary-500', maxBars = 12 }) => {
  const sliced = (data || []).slice(0, maxBars);
  const maxVal = Math.max(1, ...sliced.map((d) => Number(d.value) || 0));
  return (
    <div className="bg-white rounded-2xl border-2 border-slate-100 p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      {sliced.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 italic">No data</p>
      ) : (
        <div className="flex items-end gap-2 mt-4 overflow-x-auto" style={{ minHeight: BAR_CHART_HEIGHT + 32 }}>
          {sliced.map((d, i) => {
            const val = Number(d.value) || 0;
            const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
            const barHeightPx = Math.max(heightPct * (BAR_CHART_HEIGHT / 100), val > 0 ? 8 : 0);
            return (
              <div key={d.label + i} className="flex flex-col items-center min-w-[48px] flex-1 shrink-0">
                <div
                  className="w-full flex flex-col justify-end"
                  style={{ height: BAR_CHART_HEIGHT }}
                  title={`${d.label}: ${d.value}`}
                >
                  <div
                    className={`w-full ${color} rounded-t transition-all min-h-0`}
                    style={{ height: `${barHeightPx}px` }}
                  />
                </div>
                <span className="text-xs text-slate-600 mt-2 truncate w-full text-center" title={d.label}>
                  {d.label.length > 10 ? d.label.slice(0, 8) + '…' : d.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Horizontal bar for top performers: data = [{ label, value }]
const HorizontalBarChart = ({ data, title, subtitle, color = 'bg-primary-500' }) => {
  const maxVal = Math.max(1, ...(data || []).map((d) => Number(d.value) || 0));
  return (
    <div className="bg-white rounded-2xl border-2 border-slate-100 p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      {(!data || data.length === 0) ? (
        <p className="mt-4 text-sm text-slate-500 italic">No data</p>
      ) : (
        <div className="mt-4 space-y-3">
          {data.map((d, i) => (
            <div key={d.label + i} className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700 w-32 truncate" title={d.label}>{d.label}</span>
              <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                <div
                  className={`h-full ${color} rounded transition-all`}
                  style={{ width: maxVal > 0 ? `${((Number(d.value) || 0) / maxVal) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-800 w-12 text-right">{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Line chart: data = [{ date, count }]. compact=true makes it smaller.
const LineChart = ({ data, title, subtitle, compact }) => {
  const points = data || [];
  const maxVal = Math.max(1, ...points.map((d) => Number(d.count) || 0));
  const width = compact ? 320 : 400;
  const height = compact ? 140 : 180;
  const padding = { top: 10, right: 24, bottom: 36, left: 44 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const getX = (i) => padding.left + (points.length <= 1 ? 0 : (i / (points.length - 1)) * innerW);
  const getY = (c) => padding.top + innerH - (maxVal > 0 ? (Number(c) / maxVal) * innerH : 0);
  const pathD = points.length
    ? points
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.count)}`)
        .join(' ')
    : '';

  // Y-axis tick values: 0, maxVal, and optionally one in between
  const yTicks = maxVal <= 5
    ? Array.from({ length: maxVal + 1 }, (_, i) => i)
    : [0, Math.round(maxVal / 2), maxVal];

  return (
    <div className={`bg-white rounded-2xl border-2 border-slate-100 p-5 shadow-sm ${compact ? 'max-w-md' : ''}`}>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      {points.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 italic">No data in this period</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
            {/* Y-axis label: Leads */}
            <text x={12} y={padding.top + innerH / 2} textAnchor="middle" className="text-[10px] fill-gray-600 font-medium" transform={`rotate(-90, 12, ${padding.top + innerH / 2})`}>
              Leads
            </text>
            {/* Y-axis ticks and values */}
            {yTicks.map((tick) => (
              <g key={tick}>
                <line x1={padding.left} y1={getY(tick)} x2={padding.left - 4} y2={getY(tick)} stroke="#d1d5db" strokeWidth="1" />
                <text x={padding.left - 6} y={getY(tick) + 4} textAnchor="end" className="text-[9px] fill-gray-500">{tick}</text>
              </g>
            ))}
            {/* X-axis label: Date */}
            <text x={padding.left + innerW / 2} y={height - 8} textAnchor="middle" className="text-[10px] fill-gray-600 font-medium">
              Date
            </text>
            {/* Data line and points */}
            <path d={pathD} fill="none" stroke="var(--tw-primary-500, #6366f1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((d, i) => (
              <circle key={d.date} cx={getX(i)} cy={getY(d.count)} r="3" fill="var(--tw-primary-500, #6366f1)" />
            ))}
            {/* X-axis date labels */}
            {points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 6)) === 0).map((d, i) => {
              const idx = i * Math.max(1, Math.floor(points.length / 6));
              const pt = points[idx];
              if (!pt) return null;
              return (
                <text key={pt.date} x={getX(idx)} y={height - 18} textAnchor="middle" className="text-[9px] fill-gray-500">
                  {pt.date}
                </text>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};

// Donut / Pie: data = [{ label, value, color }]
const DonutChart = ({ data, title, subtitle }) => {
  const total = (data || []).reduce((s, d) => s + (Number(d.value) || 0), 0) || 1;
  let acc = 0;
  const gradientParts = (data || [])
    .filter((d) => (Number(d.value) || 0) > 0)
    .map((d) => {
      const pct = (Number(d.value) / total) * 100;
      const start = acc;
      acc += pct;
      return `${d.color || '#6366f1'} ${start}% ${acc}%`;
    })
    .join(', ');
  return (
    <div className="bg-white rounded-2xl border-2 border-slate-100 p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      <div className="flex items-center gap-6 flex-wrap mt-4">
        <div className="relative w-36 h-36 shrink-0">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: gradientParts ? `conic-gradient(${gradientParts})` : 'conic-gradient(#e5e7eb 100%)',
            }}
          />
          <div className="absolute inset-[22%] rounded-full bg-white" />
        </div>
        <div className="space-y-2 min-w-[140px]">
          {(data || []).map((d) => {
            const pct = total > 0 ? Math.round((Number(d.value) / total) * 100) : 0;
            return (
              <div key={d.label} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color || '#6366f1' }} />
                <span className="text-sm text-slate-700">{d.label}: {pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const TREND_FILTERS = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 3 months', days: 90 },
];

const PAGE_SIZE = 10;

export default function SchoolAnalytics() {
  const { params } = useManagementFilters();
  const [institutions, setInstitutions] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trendRange, setTrendRange] = useState('30');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('leadsReceived');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      managementAPI.getInstitutions(params),
      managementAPI.getAnalyticsDashboard(params),
    ])
      .then(([instRes, dashRes]) => {
        if (cancelled) return;
        setInstitutions(instRes.data?.data?.institutions || []);
        setDashboardData(dashRes.data?.data || null);
      })
      .catch(() => { if (!cancelled) toast.error('Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [JSON.stringify(params)]);

  // Derived metrics (no revenue)
  const summary = useMemo(() => {
    const totalInstitutions = institutions.length;
    const totalLeads = institutions.reduce((s, i) => s + (i.leadsReceived ?? 0), 0);
    const totalCounselingDone = institutions.reduce((s, i) => s + (i.admissions ?? 0), 0);
    const activeInstitutions = institutions.filter((i) => (i.leadsReceived ?? 0) >= 1).length;
    const conversionOverall = totalLeads > 0 ? ((totalCounselingDone / totalLeads) * 100).toFixed(1) : '0';
    return {
      totalInstitutions,
      activeInstitutions,
      totalLeads,
      totalCounselingDone,
      conversionOverall,
    };
  }, [institutions]);

  // Lead trend filtered by range
  const leadsOverTimeFiltered = useMemo(() => {
    const raw = dashboardData?.leadsOverTime || [];
    const days = TREND_FILTERS.find((f) => f.key === trendRange)?.days ?? 30;
    const cutoff = format(subDays(new Date(), days), 'yyyy-MM-dd');
    return raw.filter((d) => d.date >= cutoff);
  }, [dashboardData, trendRange]);

  // Top 5 by leads or conversion
  const topFive = useMemo(() => {
    const withConversion = institutions.map((i) => ({
      ...i,
      conversion: (i.leadsReceived ?? 0) > 0 ? ((i.admissions ?? 0) / (i.leadsReceived ?? 1)) * 100 : 0,
    }));
    return [...withConversion]
      .sort((a, b) => (b.leadsReceived ?? 0) - (a.leadsReceived ?? 0))
      .slice(0, 5)
      .map((i) => ({ label: i.name, value: i.leadsReceived ?? 0, conversion: i.conversion }));
  }, [institutions]);

  // Table: search, sort, paginate
  const tableRows = useMemo(() => {
    let list = institutions.map((i) => ({
      id: i.id,
      name: i.name,
      totalLeads: i.leadsReceived ?? 0,
      counselingDone: i.admissions ?? 0,
      pendingCounseling: (i.leadsReceived ?? 0) - (i.admissions ?? 0),
      conversionRate: (i.leadsReceived ?? 0) > 0 ? (((i.admissions ?? 0) / (i.leadsReceived ?? 1)) * 100).toFixed(1) : '0',
      lastLeadDate: '—',
    }));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }
    const mult = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const aVal = sortKey === 'conversionRate' ? parseFloat(a.conversionRate) : a[sortKey];
      const bVal = sortKey === 'conversionRate' ? parseFloat(b.conversionRate) : b[sortKey];
      if (typeof aVal === 'string' || typeof bVal === 'string') return mult * String(aVal).localeCompare(String(bVal));
      return mult * (aVal - bVal);
    });
    return list;
  }, [institutions, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(
    () => tableRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [tableRows, page]
  );

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else setSortKey(key) || setSortDir('desc');
  };

  const openDetail = (id) => {
    setDetailId(id);
    setDetailData(null);
    setDetailLoading(true);
    const detailParams = { ...params, institutionId: id };
    Promise.all([
      managementAPI.getInstitutions(detailParams),
      managementAPI.getAnalyticsDashboard(detailParams),
      managementAPI.getCounselors(detailParams),
    ])
      .then(([instRes, dashRes, counselRes]) => {
        const instList = instRes.data?.data?.institutions || [];
        const institution = instList[0] || null;
        const dashboard = dashRes.data?.data || null;
        const counselors = counselRes.data?.data?.counselors || [];
        const counselorPerformance = (counselors || []).map((c) => ({
          name: c.name || c.fullName || '—',
          leadsAssigned: c.leadsAssigned ?? 0,
          counselingCompleted: (c.contactedLeads ?? 0) + (c.admissions ?? 0),
        }));
        setDetailData({
          institution,
          dashboard,
          counselorPerformance,
          recentLeads: [],
        });
      })
      .catch(() => toast.error('Failed to load institution details'))
      .finally(() => setDetailLoading(false));
  };

  const closeDetail = () => {
    setDetailId(null);
    setDetailData(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <AnalyticsFilters />
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnalyticsFilters />

      {/* SECTION 1: Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Institutions" value={summary.totalInstitutions} subtext="All institutions" variant="default" />
        <StatCard title="Active Institutions" value={summary.activeInstitutions} subtext="With at least 1 lead" variant="primary" />
        <StatCard title="Total Leads" value={summary.totalLeads} subtext="From all institutions" variant="blue" />
        <StatCard title="Total Counseling Done" value={summary.totalCounselingDone} subtext="Enrolled / completed" variant="green" />
        <StatCard title="Overall Conversion Rate" value={`${summary.conversionOverall}%`} subtext="Counseling done ÷ Total leads" variant="purple" />
      </div>

      {/* SECTION 2: Leads per institution */}
      <BarChart
        data={institutions.map((i) => ({ label: i.name, value: i.leadsReceived ?? 0 }))}
        title="Leads per Institution"
        subtitle="Which institutions generate the most leads"
        color="bg-teal-600"
      />

      {/* SECTION 3: Counseling per institution */}
      <BarChart
        data={institutions.map((i) => ({ label: i.name, value: i.admissions ?? 0 }))}
        title="Counseling per Institution"
        subtitle="Engagement level per institution"
        color="bg-emerald-600"
      />

      {/* SECTION 4: Lead trend over time */}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <span className="text-sm font-medium text-slate-700">Trend range:</span>
        {TREND_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setTrendRange(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${trendRange === f.key ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-gray-200'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <LineChart
        data={leadsOverTimeFiltered}
        title="Lead Trend Over Time"
        subtitle="Growth trend"
        compact
      />

      {/* SECTION 5: Top 5 institutions */}
      <HorizontalBarChart
        data={topFive.map((t) => ({ label: t.label, value: t.value }))}
        title="Top 5 Institutions by Leads"
        subtitle="Highest lead count"
        color="bg-primary-500"
      />

      {/* SECTION 6: Institution performance table */}
      <div className="card overflow-hidden">
        <h2 className="text-xl font-semibold mb-4">Institution Performance</h2>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="search"
            placeholder="Search institution..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field py-2 w-64"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left py-3 px-4 font-semibold cursor-pointer" onClick={() => toggleSort('name')}>Institution Name {sortKey === 'name' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                <th className="text-right py-3 px-4 font-semibold cursor-pointer" onClick={() => toggleSort('totalLeads')}>Total Leads {sortKey === 'totalLeads' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                <th className="text-right py-3 px-4 font-semibold cursor-pointer" onClick={() => toggleSort('counselingDone')}>Counseling Done {sortKey === 'counselingDone' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                <th className="text-right py-3 px-4 font-semibold cursor-pointer" onClick={() => toggleSort('pendingCounseling')}>Pending {sortKey === 'pendingCounseling' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                <th className="text-right py-3 px-4 font-semibold cursor-pointer" onClick={() => toggleSort('conversionRate')}>Conversion % {sortKey === 'conversionRate' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                <th className="text-left py-3 px-4 font-semibold">Last Lead Date</th>
                <th className="text-left py-3 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium">{row.name}</td>
                  <td className="py-3 px-4 text-right">{row.totalLeads}</td>
                  <td className="py-3 px-4 text-right text-emerald-600">{row.counselingDone}</td>
                  <td className="py-3 px-4 text-right">{row.pendingCounseling}</td>
                  <td className="py-3 px-4 text-right">{row.conversionRate}%</td>
                  <td className="py-3 px-4 text-sm text-slate-600">{row.lastLeadDate}</td>
                  <td className="py-3 px-4">
                    <button type="button" onClick={() => openDetail(row.id)} className="text-primary-600 hover:text-primary-700 font-medium text-sm">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tableRows.length === 0 && (
          <p className="text-slate-500 py-8 text-center">No institutions match your search.</p>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between py-3 px-4 border-t">
            <span className="text-sm text-slate-600">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, tableRows.length)} of {tableRows.length}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">
                Previous
              </button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 7: View Details modal */}
      {detailId && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true">
          <div className="fixed inset-0 bg-black/50" onClick={closeDetail} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-bold text-slate-900">Institution Details</h2>
                <button type="button" onClick={closeDetail} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" aria-label="Close">×</button>
              </div>
              <div className="p-6 space-y-6">
                {detailLoading && (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
                  </div>
                )}
                {!detailLoading && detailData && (
                  <>
                    {detailData.institution && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <StatCard title="Total Leads" value={detailData.institution.leadsReceived ?? 0} variant="blue" />
                          <StatCard title="Counseling Done" value={detailData.institution.admissions ?? 0} variant="green" />
                          <StatCard title="Pending" value={(detailData.institution.leadsReceived ?? 0) - (detailData.institution.admissions ?? 0)} variant="amber" />
                          <StatCard title="Conversion %" value={`${detailData.institution.conversionPct ?? 0}%`} variant="purple" />
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl">
                          <p className="font-semibold text-slate-900">{detailData.institution.name}</p>
                          <p className="text-sm text-slate-600 mt-1">Status: {(detailData.institution.leadsReceived ?? 0) >= 1 ? 'Active' : 'Inactive'}</p>
                        </div>
                      </>
                    )}
                    {detailData.dashboard?.leadsOverTime?.length > 0 && (
                      <LineChart data={detailData.dashboard.leadsOverTime} title="Lead Trend (this institution)" subtitle="Leads over time" />
                    )}
                    {detailData.institution && (
                      <DonutChart
                        data={[
                          { label: 'Counseling Done', value: detailData.institution.admissions ?? 0, color: '#10b981' },
                          { label: 'Pending', value: (detailData.institution.leadsReceived ?? 0) - (detailData.institution.admissions ?? 0), color: '#f59e0b' },
                        ]}
                        title="Counseling Status"
                      />
                    )}
                    {detailData.counselorPerformance?.length > 0 && (
                      <HorizontalBarChart
                        data={detailData.counselorPerformance.map((c) => ({ label: c.name, value: c.counselingCompleted }))}
                        title="Counselor Performance (counseling completed)"
                        color="bg-emerald-600"
                      />
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-3">Recent Leads</h3>
                      {detailData.recentLeads?.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-3 font-semibold">Student Name</th>
                                <th className="text-left py-2 px-3 font-semibold">Phone</th>
                                <th className="text-left py-2 px-3 font-semibold">Course Interested</th>
                                <th className="text-left py-2 px-3 font-semibold">Assigned Counselor</th>
                                <th className="text-left py-2 px-3 font-semibold">Counseling Status</th>
                                <th className="text-left py-2 px-3 font-semibold">Lead Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailData.recentLeads.map((l) => (
                                <tr key={l.id} className="border-b hover:bg-slate-50">
                                  <td className="py-2 px-3">{l.studentName || '—'}</td>
                                  <td className="py-2 px-3">{l.parentPhone || l.phone || '—'}</td>
                                  <td className="py-2 px-3">{l.course?.name || l.importedCourseName || '—'}</td>
                                  <td className="py-2 px-3">{l.counselorName}</td>
                                  <td className="py-2 px-3">{l.status || '—'}</td>
                                  <td className="py-2 px-3">{l.submittedAt ? format(new Date(l.submittedAt), 'dd MMM yyyy') : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 py-4">Recent leads list is not available for this view.</p>
                      )}
                    </div>
                    {!detailData.institution && <p className="text-slate-500">Institution not found.</p>}
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

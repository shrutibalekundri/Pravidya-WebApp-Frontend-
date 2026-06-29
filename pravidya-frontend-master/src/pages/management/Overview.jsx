import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { managementAPI } from '../../services/api';
import { useManagementFilters } from '../../contexts/ManagementFiltersContext';
import AnalyticsFilters from '../../components/management/AnalyticsFilters';
import toast from 'react-hot-toast';
import { format, subDays, addDays, parseISO, isAfter } from 'date-fns';

const TREND_FILTERS = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '21', label: 'Last 3 weeks', days: 21 },
];

const CHART_COLORS = {
  primary: '#6366f1',
  teal: '#0d9488',
  emerald: '#059669',
  amber: '#d97706',
  blue: '#2563eb',
  gray: '#6b7280',
};

const SOURCE_COLORS = {
  instagram: '#E4405F',
  linkedin: '#0A66C2',
  whatsapp: '#25D366',
  facebook: '#1877F2',
  website: '#6366f1',
  referral: '#8b5cf6',
  'google ads': '#ea4335',
  direct: '#6b7280',
};

// Simple icon components (inline SVG)
const Icons = {
  Users: () => (
    <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  TrendingUp: () => (
    <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Percent: () => (
    <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4v16" />
    </svg>
  ),
  Building: () => (
    <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  Clock: () => (
    <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Alert: () => (
    <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

const Card = ({ title, subtitle, children, className = '' }) => (
  <div className={`bg-white rounded-2xl border-2 border-slate-100 p-5 shadow-sm ${className}`}>
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
    {children}
  </div>
);

const EmptyState = ({ message = 'No data available' }) => (
  <div className="flex items-center justify-center py-12 text-slate-500 text-sm">{message}</div>
);

// KPI card with icon
const KPICard = ({ title, value, icon: Icon, variant = 'default' }) => {
  const styles = {
    default: 'bg-white border-slate-200 text-slate-900',
    primary: 'bg-primary-50 border-primary-100 text-primary-800',
    green: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    blue: 'bg-blue-50 border-blue-100 text-blue-800',
    purple: 'bg-purple-50 border-purple-100 text-purple-800',
    amber: 'bg-amber-50 border-amber-100 text-amber-800',
    red: 'bg-red-50 border-red-100 text-red-800',
  };
  return (
    <div className={`rounded-2xl border-2 p-5 shadow-sm flex flex-col gap-2 ${styles[variant] || styles.default}`}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium opacity-90">{title}</p>
        {Icon && <Icon />}
      </div>
      <p className="text-2xl sm:text-3xl font-bold mt-0">{value}</p>
    </div>
  );
};

export default function Overview() {
  const { params } = useManagementFilters();
  const [overview, setOverview] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [counselors, setCounselors] = useState([]);
  const [leadsData, setLeadsData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trendRange, setTrendRange] = useState('30');
  const [conversionTrendRange, setConversionTrendRange] = useState('30');
  const [recentLeadsPage, setRecentLeadsPage] = useState(1);
  const [recentLeadsSort, setRecentLeadsSort] = useState({ key: 'createdAt', dir: 'desc' });
  const PAGE_SIZE = 10;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      managementAPI.getOverview(params),
      managementAPI.getAnalyticsDashboard(params),
      managementAPI.getInstitutions(params),
      managementAPI.getCounselors(params),
      managementAPI.getLeads(params),
      managementAPI.getAlerts(),
    ])
      .then(([oRes, dRes, iRes, cRes, lRes, aRes]) => {
        if (cancelled) return;
        setOverview(oRes.data?.data || null);
        setDashboard(dRes.data?.data || null);
        setInstitutions(iRes.data?.data?.institutions || []);
        setCounselors(cRes.data?.data?.counselors || []);
        setLeadsData(lRes.data?.data || null);
        setAlerts(aRes.data?.data?.alerts || []);
      })
      .catch(() => { if (!cancelled) toast.error('Failed to load dashboard'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [JSON.stringify(params)]);

  const kpis = dashboard?.kpis || {};
  const totalLeads = kpis.totalLeads ?? 0;
  const counselingCompleted = kpis.admissionConfirmed ?? 0;
  const conversionRate = totalLeads > 0 ? ((counselingCompleted / totalLeads) * 100).toFixed(1) : 0;
  const pendingLeads = Math.max(0, totalLeads - counselingCompleted);
  const ov = overview || {};
  const newLeadsToday = ov.newLeadsToday ?? 0;
  const activeCounselors = ov.activeCounselors ?? 0;
  const activeInstitutions = ov.partnerInstitutions ?? 0;
  const criticalAlertsCount = useMemo(() => alerts.filter((a) => a.type === 'danger').length, [alerts]);

  // Lead creation trend (7/30/90 days) with conversions overlay
  const creationTrendData = useMemo(() => {
    const rawLeads = overview?.leadsOverTime || [];
    const rawConversions = dashboard?.conversionsOverTime || [];
    const countByDate = {};
    const convertedByDate = {};

    rawLeads.forEach((d) => {
      const dateStr = typeof d.date === 'string' ? d.date.slice(0, 10) : format(new Date(d.date), 'yyyy-MM-dd');
      countByDate[dateStr] = (countByDate[dateStr] ?? 0) + (d.count ?? d.value ?? 0);
    });

    rawConversions.forEach((d) => {
      const dateStr = typeof d.date === 'string' ? d.date.slice(0, 10) : format(new Date(d.date), 'yyyy-MM-dd');
      convertedByDate[dateStr] = (convertedByDate[dateStr] ?? 0) + Math.max(0, Number(d.converted) || 0);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = TREND_FILTERS.find((f) => f.key === trendRange)?.days ?? 30;
    const startDay = subDays(today, days - 1);
    const result = [];
    for (let d = new Date(startDay); !isAfter(d, today); d = addDays(d, 1)) {
      const dateStr = format(d, 'yyyy-MM-dd');
      result.push({
        date: dateStr,
        leads: countByDate[dateStr] ?? 0,
        converted: convertedByDate[dateStr] ?? 0,
      });
    }
    return result;
  }, [overview, dashboard, trendRange]);

  const creationYMax = useMemo(
    () => Math.max(1, ...creationTrendData.map((d) => Math.max(d.leads ?? 0, d.converted ?? 0))),
    [creationTrendData],
  );

  // Conversion trend – same pattern as Lead Creation Trend (day-by-day iteration)
  const conversionTrendData = useMemo(() => {
    const raw = dashboard?.conversionsOverTime || [];
    const convertedByDate = {};
    raw.forEach((d) => {
      const dateStr = typeof d.date === 'string' ? d.date.slice(0, 10) : format(new Date(d.date), 'yyyy-MM-dd');
      convertedByDate[dateStr] = (convertedByDate[dateStr] ?? 0) + Math.max(0, Number(d.converted) || 0);
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = TREND_FILTERS.find((f) => f.key === conversionTrendRange)?.days ?? 30;
    const startDay = subDays(today, days - 1);
    const result = [];
    for (let d = new Date(startDay); !isAfter(d, today); d = addDays(d, 1)) {
      const dateStr = format(d, 'yyyy-MM-dd');
      result.push({ date: dateStr, converted: convertedByDate[dateStr] ?? 0 });
    }
    return result;
  }, [dashboard, conversionTrendRange]);
  const conversionYMax = useMemo(() => Math.max(1, ...conversionTrendData.map((d) => d.converted)), [conversionTrendData]);

  // Lead status chart: New, Assigned, In Progress, Counseling Completed
  // New = all not yet contacted. Assigned = all leads with a counselor. (A lead may appear in more than one)
  const statusCounts = dashboard?.statusCountsForChart || {};
  const newTotal = (statusCounts.newUnassigned ?? 0) + (statusCounts.newAssigned ?? 0) || (statusCounts.new ?? 0);
  const statusChartData = useMemo(() => [
    { name: 'New', value: newTotal, color: CHART_COLORS.gray },
    { name: 'Assigned', value: statusCounts.assigned ?? 0, color: CHART_COLORS.blue },
    { name: 'In Progress', value: statusCounts.inProgress ?? 0, color: CHART_COLORS.amber },
    { name: 'Counseling Completed', value: statusCounts.completed ?? 0, color: CHART_COLORS.emerald },
  ], [newTotal, statusCounts.assigned, statusCounts.inProgress, statusCounts.completed]);

  // Marketing attribution – leads by source (doughnut)
  const sourceDoughnutData = useMemo(() => {
    const raw = overview?.sourceDistribution || [];
    const palette = [CHART_COLORS.primary, CHART_COLORS.teal, CHART_COLORS.amber, CHART_COLORS.emerald, CHART_COLORS.blue, CHART_COLORS.gray];
    return raw.map((s, i) => {
      const label = (s.label || s.name || 'Other').trim() || 'Direct';
      const key = label.toLowerCase();
      let color = palette[i % palette.length];
      Object.entries(SOURCE_COLORS).forEach(([k, v]) => { if (key.includes(k)) color = v; });
      return { name: label, value: s.value ?? s.count ?? 0, color };
    }).filter((d) => d.value > 0);
  }, [overview]);
  const sourceDoughnutWithDefault = sourceDoughnutData.length > 0 ? sourceDoughnutData : [{ name: 'No data', value: 1, color: '#e5e7eb' }];

  // Conversion rate by source (bar)
  const conversionBySource = useMemo(() => {
    const raw = overview?.conversionBySource || [];
    return raw.map((s) => ({ name: s.source, conversionPct: s.conversionPct, fullName: s.source }));
  }, [overview]);

  // Institution contribution (bar)
  const institutionBarData = useMemo(() => {
    return institutions.slice(0, 12).map((i) => ({ name: i.name?.slice(0, 15) || '—', value: i.leadsReceived ?? 0, fullName: i.name }));
  }, [institutions]);

  // Counselor activity (bar) – leads handled
  const counselorBarData = useMemo(() => {
    return (counselors || [])
      .slice(0, 12)
      .map((c) => ({ name: (c.name || '—').slice(0, 12), value: c.leadsAssigned ?? 0, fullName: c.name }));
  }, [counselors]);

  // Recent leads (from getLeads response)
  const recentLeadsRaw = leadsData?.recentLeads || [];
  const recentLeadsSorted = useMemo(() => {
    const arr = [...recentLeadsRaw];
    const key = recentLeadsSort.key;
    const dir = recentLeadsSort.dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let va = a[key];
      let vb = b[key];
      if (key === 'createdAt') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      }
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return 0;
    });
    return arr;
  }, [recentLeadsRaw, recentLeadsSort]);
  const recentLeadsPaginated = useMemo(() => {
    const start = (recentLeadsPage - 1) * PAGE_SIZE;
    return recentLeadsSorted.slice(start, start + PAGE_SIZE);
  }, [recentLeadsSorted, recentLeadsPage]);
  const recentLeadsTotalPages = Math.max(1, Math.ceil(recentLeadsSorted.length / PAGE_SIZE));

  const handleSort = (key) => {
    setRecentLeadsSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
    setRecentLeadsPage(1);
  };

  // Recent alerts (latest 5)
  const recentAlertsList = useMemo(() => alerts.slice(0, 5), [alerts]);
  const severityBadge = (type) => {
    const t = type === 'danger' ? 'Critical' : type === 'warning' ? 'Warning' : 'Info';
    const c = type === 'danger' ? 'bg-red-100 text-red-800' : type === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800';
    return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${c}`}>{t}</span>;
  };

  // Top source summary card
  const topSource = useMemo(() => {
    const list = overview?.conversionBySource || [];
    if (list.length === 0) return null;
    const best = list.reduce((acc, s) => (s.conversionPct > (acc?.conversionPct ?? 0) ? s : acc), null);
    return best;
  }, [overview]);

  if (loading) {
    return (
      <div className="space-y-6">
        <AnalyticsFilters />
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-500 border-t-transparent" aria-label="Loading" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnalyticsFilters />

      {/* Row 1: KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <KPICard title="Total Leads" value={totalLeads} icon={Icons.Users} variant="primary" />
        <KPICard title="New Leads Today" value={newLeadsToday} icon={Icons.TrendingUp} variant="blue" />
        <KPICard title="Counseling Completed" value={counselingCompleted} icon={Icons.CheckCircle} variant="green" />
        <KPICard title="Conversion Rate (%)" value={`${conversionRate}%`} icon={Icons.Percent} variant="primary" />
        <KPICard title="Active Counselors" value={activeCounselors} icon={Icons.Users} variant="purple" />
        <KPICard title="Active Institutions" value={activeInstitutions} icon={Icons.Building} variant="blue" />
        <KPICard title="Pending Leads" value={pendingLeads} icon={Icons.Clock} variant="amber" />
        <KPICard title="Critical Alerts" value={criticalAlertsCount} icon={Icons.Alert} variant={criticalAlertsCount > 0 ? 'red' : 'default'} />
      </div>

      {/* Row 2: Lead Creation Trend | Conversion Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Lead Creation Trend" subtitle="System growth over time">
          <div className="flex flex-wrap gap-2 mt-2 mb-2">
            {TREND_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setTrendRange(f.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${trendRange === f.key ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-gray-200'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {creationTrendData.length === 0 ? (
            <EmptyState message="No lead creation data in this period" />
          ) : (
            <div className="h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={creationTrendData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, creationYMax]} tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="leads" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} name="Leads Created" />
                  <Line type="monotone" dataKey="converted" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={{ r: 3 }} name="Converted" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Conversion Trend" subtitle="Leads converted (counseling completed) by period">
          <div className="flex flex-wrap gap-2 mt-2 mb-2">
            {TREND_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setConversionTrendRange(f.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${conversionTrendRange === f.key ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-gray-200'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {conversionTrendData.length === 0 ? (
            <EmptyState message="No conversion data" />
          ) : (
            <div className="h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={conversionTrendData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, conversionYMax]} tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Converted']} />
                  <Line type="monotone" dataKey="converted" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={{ r: 4 }} name="Converted" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Row 3: Lead Status (single chart) | Marketing Attribution Doughnut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Lead Status Distribution" subtitle="Counts by pipeline stage (a lead may appear in more than one). Assigned = leads with a counselor.">
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statusChartData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 120, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={115} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, 'Count']} />
                <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]}>
                  {statusChartData.map((entry, i) => (
                    <Cell key={entry.name + i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Leads by Source" subtitle="Marketing attribution – which channels bring most leads">
          <div className="h-64 mt-4 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceDoughnutWithDefault}
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {sourceDoughnutWithDefault.map((entry, i) => (
                    <Cell key={entry.name + i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 4: Conversion Rate by Source | Institution Contribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Conversion Rate by Source" subtitle="Best-performing marketing channels (%)">
          {conversionBySource.length === 0 ? (
            <EmptyState message="No source conversion data" />
          ) : (
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionBySource} layout="vertical" margin={{ top: 8, right: 24, left: 80, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={76} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Conversion']} />
                  <Bar dataKey="conversionPct" name="Conversion %" fill={CHART_COLORS.teal} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Institution Contribution" subtitle="Leads contributed by each institution">
          {institutionBarData.length === 0 ? (
            <EmptyState message="No institution data" />
          ) : (
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={institutionBarData} margin={{ top: 8, right: 8, left: 8, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Leads']} />
                  <Bar dataKey="value" name="Leads" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Row 5: Counselor Activity | Top Source Summary Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Counselor Activity Overview" subtitle="Leads handled per counselor">
          {counselorBarData.length === 0 ? (
            <EmptyState message="No counselor data" />
          ) : (
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={counselorBarData} margin={{ top: 8, right: 8, left: 8, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Leads Handled']} />
                  <Bar dataKey="value" name="Leads Handled" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Top Marketing Source" subtitle="Best-performing source summary">
          {topSource ? (
            <div className="mt-4 p-4 rounded-xl bg-primary-50 border-2 border-primary-100">
              <p className="text-sm font-medium text-primary-800">Source</p>
              <p className="text-xl font-bold text-primary-900 mt-0.5">{topSource.source}</p>
              <p className="text-sm text-slate-600 mt-3">Total Leads: {topSource.total}</p>
              <p className="text-sm font-semibold text-emerald-700">Conversion Rate: {topSource.conversionPct}%</p>
            </div>
          ) : (
            <EmptyState message="No source data available" />
          )}
        </Card>
      </div>

      {/* Row 6: Recent Leads Table */}
      <Card title="Recent Leads" subtitle="Latest system activity">
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('studentName')}>Student Name</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('institutionName')}>Institution</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('counselorName')}>Counselor</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('source')}>Source</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>Lead Status</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('createdAt')}>Created</th>
              </tr>
            </thead>
            <tbody>
              {recentLeadsPaginated.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-500">No recent leads</td></tr>
              ) : (
                recentLeadsPaginated.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-slate-50">
                    <td className="py-3 px-4">{row.studentName || '—'}</td>
                    <td className="py-3 px-4">{row.institutionName || '—'}</td>
                    <td className="py-3 px-4">{row.counselorName || '—'}</td>
                    <td className="py-3 px-4">{row.source || '—'}</td>
                    <td className="py-3 px-4">{row.status || '—'}</td>
                    <td className="py-3 px-4">{row.createdAt ? format(new Date(row.createdAt), 'dd MMM yyyy') : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {recentLeadsSorted.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setRecentLeadsPage((p) => Math.max(1, p - 1))}
              disabled={recentLeadsPage <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">Page {recentLeadsPage} of {recentLeadsTotalPages}</span>
            <button
              type="button"
              onClick={() => setRecentLeadsPage((p) => Math.min(recentLeadsTotalPages, p + 1))}
              disabled={recentLeadsPage >= recentLeadsTotalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </Card>

      {/* Row 7: Recent Alerts */}
      <Card title="Recent Alerts" subtitle="Latest system issues">
        <div className="mt-4 space-y-3">
          {recentAlertsList.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No recent alerts</p>
          ) : (
            recentAlertsList.map((a, i) => (
              <div key={a.entityId + i} className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                {severityBadge(a.type)}
                <span className="text-sm text-slate-800 flex-1">{a.message}</span>
                <span className="text-xs text-slate-500">{a.entityType}</span>
                <span className="text-xs text-slate-500">{a.createdAt ? format(new Date(a.createdAt), 'dd MMM HH:mm') : ''}</span>
              </div>
            ))
          )}
        </div>
        <div className="mt-4">
          <Link to="/management/alerts" className="inline-flex items-center px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700">
            View All Alerts
          </Link>
        </div>
      </Card>
    </div>
  );
}

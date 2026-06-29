import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart,
  Area,
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
import { format, subDays, addDays, parseISO, isAfter } from 'date-fns';

const TREND_FILTERS = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 3 months', days: 90 },
];

const CHART_COLORS = {
  primary: '#6366f1',
  teal: '#0d9488',
  emerald: '#059669',
  amber: '#d97706',
  gray: '#6b7280',
  slate: '#475569',
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

export default function LeadBehavior() {
  const { params } = useManagementFilters();
  const [overview, setOverview] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trendRange, setTrendRange] = useState('30');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      managementAPI.getOverview(params),
      managementAPI.getAnalyticsDashboard(params),
    ])
      .then(([overviewRes, dashboardRes]) => {
        if (cancelled) return;
        setOverview(overviewRes.data?.data || null);
        setDashboard(dashboardRes.data?.data || null);
      })
      .catch(() => { if (!cancelled) toast.error('Failed to load lead behavior data'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [JSON.stringify(params)]);

  const kpis = dashboard?.kpis || {};
  const performanceTable = dashboard?.performanceTable || [];
  const totalLeads = kpis.totalLeads ?? 0;
  const pendingContact = kpis.pendingContact ?? 0;
  const counselingInProgress = kpis.counselingInProgress ?? 0;
  const priority = kpis.priority ?? 0;
  const admissionConfirmed = kpis.admissionConfirmed ?? 0;

  // Unassigned count = leads with no counselor (from performance table)
  const unassignedCount = performanceTable.find((r) => r.counselorId === 'unassigned')?.leadsAssigned ?? 0;
  const counselorAssignedCount = Math.max(0, totalLeads - unassignedCount);

  // SECTION 1: Lead lifecycle funnel (Lead Created → Counselor Assigned → Counseling Started → Counseling Completed)
  const funnelData = useMemo(() => {
    const started = counselingInProgress + priority + admissionConfirmed;
    const completed = admissionConfirmed;
    return [
      { name: 'Lead Created', value: totalLeads, fill: CHART_COLORS.primary },
      { name: 'Counselor Assigned', value: counselorAssignedCount, fill: CHART_COLORS.teal },
      { name: 'Counseling Started', value: started, fill: CHART_COLORS.amber },
      { name: 'Counseling Completed', value: completed, fill: CHART_COLORS.emerald },
    ].filter((d) => d.value >= 0);
  }, [totalLeads, counselorAssignedCount, counselingInProgress, priority, admissionConfirmed]);

  // SECTION 2: Lead creation trend – align date range with filter or last 7/30/90 days
  const creationTrendData = useMemo(() => {
    const raw = overview?.leadsOverTime || [];
    const countByDate = {};
    raw.forEach((d) => {
      const dateStr = typeof d.date === 'string' ? d.date.slice(0, 10) : format(new Date(d.date), 'yyyy-MM-dd');
      const count = d.count ?? d.value ?? 0;
      countByDate[dateStr] = (countByDate[dateStr] ?? 0) + count;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let startDay;
    let endDay = today;

    if (params.startDate && params.endDate) {
      startDay = parseISO(params.startDate);
      const endParsed = parseISO(params.endDate);
      endDay = isAfter(endParsed, today) ? today : endParsed;
      if (isAfter(startDay, endDay)) startDay = endDay;
    } else {
      const days = TREND_FILTERS.find((f) => f.key === trendRange)?.days ?? 30;
      startDay = subDays(today, days - 1);
    }

    const result = [];
    for (let d = new Date(startDay); !isAfter(d, endDay); d = addDays(d, 1)) {
      const dateStr = format(d, 'yyyy-MM-dd');
      result.push({ date: dateStr, leads: countByDate[dateStr] ?? 0 });
    }
    return result;
  }, [overview, trendRange, params.startDate, params.endDate]);

  // SECTION 3: Conversion trend (from dashboard leadsByMonth – ensure correct keys and numeric values)
  const conversionTrendData = useMemo(() => {
    const byMonth = dashboard?.leadsByMonth || [];
    if (!Array.isArray(byMonth) || byMonth.length === 0) return [];
    return byMonth.map((m) => ({
      date: m.monthKey || m.month || '',
      converted: Math.max(0, Number(m.conversions) || 0),
      label: m.month || m.monthKey || '',
    }));
  }, [dashboard]);

  const conversionYMax = useMemo(() => Math.max(1, ...(conversionTrendData.map((d) => d.converted) || [0])), [conversionTrendData]);

  // SECTION 4: Lead source doughnut – where leads came from (Instagram, LinkedIn, WhatsApp, Facebook, etc.)
  const SOURCE_COLORS = {
    instagram: '#E4405F',
    linkedin: '#0A66C2',
    whatsapp: '#25D366',
    facebook: '#1877F2',
    other: '#6b7280',
  };
  const sourceDoughnutData = useMemo(() => {
    const raw = overview?.sourceDistribution || [];
    const palette = [CHART_COLORS.primary, CHART_COLORS.teal, CHART_COLORS.amber, CHART_COLORS.emerald, CHART_COLORS.slate, CHART_COLORS.gray];
    return raw.map((s, i) => {
      const label = (s.label || s.name || 'Other').trim() || 'Other';
      const key = label.toLowerCase();
      let color = palette[i % palette.length];
      if (key.includes('instagram')) color = SOURCE_COLORS.instagram;
      else if (key.includes('linkedin')) color = SOURCE_COLORS.linkedin;
      else if (key.includes('whatsapp')) color = SOURCE_COLORS.whatsapp;
      else if (key.includes('facebook')) color = SOURCE_COLORS.facebook;
      else if (key.includes('other') || key.includes('direct')) color = SOURCE_COLORS.other;
      return { name: label, value: s.value ?? s.count ?? 0, color };
    }).filter((d) => d.value > 0);
  }, [overview]);

  // SECTION 6: Response time trend (no backend data - show empty)
  const responseTimeData = useMemo(() => [], []);

  // SECTION 7: Lead activity per day (no backend data - show empty)
  const activityData = useMemo(() => [], []);

  // SECTION 8: Recent lead movement (no API returns lead list for management - show empty)
  const recentLeads = useMemo(() => [], []);
  const [tablePage, setTablePage] = useState(1);
  const [tableSort, setTableSort] = useState({ key: 'createdAt', dir: 'desc' });
  const PAGE_SIZE = 10;

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

      {/* Row 1: Funnel */}
      <Card title="Lead Lifecycle Funnel" subtitle="Identify where leads drop off">
        {funnelData.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 100, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [v, 'Count']} />
                <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]} isAnimationActive={true}>
                  {funnelData.map((entry, i) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Row 2: Lead Creation Trend | Conversion Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Lead Creation Trend" subtitle="Lead inflow over time">
          <div className="flex flex-wrap gap-2 mt-2 mb-2">
            {TREND_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setTrendRange(f.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${trendRange === f.key ? 'bg-primary-600 text-white' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}
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
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="leads" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} name="Leads Created" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Lead Conversion Trend" subtitle="Leads converted (counseling completed) by month">
          {conversionTrendData.length === 0 ? (
            <EmptyState message="No conversion data" />
          ) : (
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={conversionTrendData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, conversionYMax]} allowDecimals={false} />
                  <Tooltip formatter={(value) => [value, 'Converted']} labelFormatter={(label) => `Month: ${label || ''}`} />
                  <Line type="monotone" dataKey="converted" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={{ r: 4 }} name="Converted" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Row 3: Lead Source Distribution */}
      <Card title="Lead Source Distribution" subtitle="Where leads came from (e.g. Instagram, LinkedIn, WhatsApp, Facebook)">
          {sourceDoughnutData.length === 0 ? (
            <EmptyState message="No lead source data available" />
          ) : (
            <div className="h-64 mt-4 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceDoughnutData}
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {sourceDoughnutData.map((entry, i) => (
                      <Cell key={entry.name + i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

      {/* Row 4: Response Time Trend | Lead Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Response Time Trend" subtitle="Average time from lead created to first action">
          {responseTimeData.length === 0 ? (
            <EmptyState message="Response time data is not available from the current API" />
          ) : (
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={responseTimeData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgHours" stroke={CHART_COLORS.teal} strokeWidth={2} name="Avg hours" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Lead Activity Chart" subtitle="Lead updates or movements per day">
          {activityData.length === 0 ? (
            <EmptyState message="Activity data is not available from the current API" />
          ) : (
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill={CHART_COLORS.primary} name="Updates" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Row 5: Recent Lead Movement Table */}
      <Card title="Recent Lead Movement" subtitle="Track live lead progress">
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 font-semibold cursor-pointer" onClick={() => setTableSort({ key: 'studentName', dir: tableSort.key === 'studentName' && tableSort.dir === 'asc' ? 'desc' : 'asc' })}>
                  Lead ID / Student Name {tableSort.key === 'studentName' && (tableSort.dir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left py-3 px-4 font-semibold cursor-pointer" onClick={() => setTableSort({ key: 'status', dir: tableSort.key === 'status' && tableSort.dir === 'asc' ? 'desc' : 'asc' })}>
                  Current Status {tableSort.key === 'status' && (tableSort.dir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left py-3 px-4 font-semibold cursor-pointer" onClick={() => setTableSort({ key: 'createdAt', dir: tableSort.key === 'createdAt' && tableSort.dir === 'asc' ? 'desc' : 'asc' })}>
                  Created Date {tableSort.key === 'createdAt' && (tableSort.dir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left py-3 px-4 font-semibold">Last Updated</th>
                <th className="text-left py-3 px-4 font-semibold">Time in Current Stage</th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Recent lead movement data is not available from the current API.
                  </td>
                </tr>
              ) : (
                recentLeads
                  .slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE)
                  .map((row) => (
                    <tr key={row.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{row.leadId || row.studentName || '—'}</td>
                      <td className="py-3 px-4">{row.status || '—'}</td>
                      <td className="py-3 px-4">{row.createdAt ? format(new Date(row.createdAt), 'dd MMM yyyy') : '—'}</td>
                      <td className="py-3 px-4">{row.updatedAt ? format(new Date(row.updatedAt), 'dd MMM yyyy') : '—'}</td>
                      <td className="py-3 px-4">{row.timeInStage ?? '—'}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
        {recentLeads.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <span className="text-sm text-slate-600">
              Page {tablePage} of {Math.ceil(recentLeads.length / PAGE_SIZE)}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setTablePage((p) => Math.max(1, p - 1))} disabled={tablePage <= 1} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">
                Previous
              </button>
              <button type="button" onClick={() => setTablePage((p) => Math.min(Math.ceil(recentLeads.length / PAGE_SIZE), p + 1))} disabled={tablePage >= Math.ceil(recentLeads.length / PAGE_SIZE)} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

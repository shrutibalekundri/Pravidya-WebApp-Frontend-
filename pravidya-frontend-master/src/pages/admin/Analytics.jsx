import { useState, useEffect, useMemo } from 'react';
import { adminAPI, leadAPI, counselorAPI, institutionAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { format, startOfDay, startOfMonth, isToday, differenceInDays } from 'date-fns';

// --- Stat Card Component ---
const StatCard = ({ title, value, subtext, variant = 'default' }) => {
  const variantStyles = {
    default: 'bg-white border-gray-200 text-gray-900',
    primary: 'bg-primary-50 border-primary-100 text-primary-800',
    green: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    blue: 'bg-blue-50 border-blue-100 text-blue-800',
    purple: 'bg-purple-50 border-purple-100 text-purple-800',
    amber: 'bg-amber-50 border-amber-100 text-amber-800',
  };
  const s = variantStyles[variant] || variantStyles.default;
  return (
    <div className={`rounded-2xl border-2 p-5 shadow-sm transition-shadow hover:shadow-md ${s}`}>
      <p className="text-sm font-medium opacity-90">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {subtext && <p className="text-xs mt-1 opacity-80">{subtext}</p>}
    </div>
  );
};

// --- Simple Pie Chart (CSS conic-gradient) ---
const PieChart = ({ data }) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const gradientParts = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const pct = (d.value / total) * 100;
      const start = acc;
      acc += pct;
      return `${d.color} ${start}% ${acc}%`;
    })
    .join(', ');
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <div
        className="w-40 h-40 rounded-full shrink-0"
        style={{
          background: gradientParts ? `conic-gradient(${gradientParts})` : 'conic-gradient(#e5e7eb 100%)',
        }}
      />
      <div className="space-y-2 min-w-[140px]">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-sm text-gray-700">{d.label}: {d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Funnel Step ---
const FunnelStep = ({ label, count, total, color }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-sm font-medium text-gray-700 shrink-0">{label}</div>
      <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
        <div
          className="h-full rounded-lg transition-all"
          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color || '#4F46E5' }}
        />
      </div>
      <span className="w-16 text-right font-semibold text-gray-900">{count}</span>
    </div>
  );
};

// --- Simple Bar Chart (vertical bars) ---
const BarChart = ({ data, labelKey = 'label', valueKey = 'value', maxBars = 10 }) => {
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  return (
    <div className="flex items-end gap-2 h-32">
      {data.slice(0, maxBars).map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-primary-500 rounded-t min-h-[4px] transition-all"
            style={{ height: `${(d[valueKey] / max) * 100}%` }}
          />
          <span className="text-xs text-gray-600 truncate w-full text-center">{d[labelKey]}</span>
        </div>
      ))}
    </div>
  );
};

const AdminAnalytics = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [leadStats, setLeadStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [counselors, setCounselors] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [statsRes, dashboardRes, leadsRes, counselorsRes, instRes] = await Promise.all([
        leadAPI.getStats(),
        adminAPI.getDashboard(),
        leadAPI.getAll({ limit: 100, page: 1 }),
        counselorAPI.getAll({ limit: 100 }),
        institutionAPI.getAll({ limit: 200 }),
      ]);
      setLeadStats(statsRes.data?.data || null);
      setDashboardData(dashboardRes.data?.data || null);
      setLeads(leadsRes.data?.data?.leads || []);
      setCounselors(counselorsRes.data?.data?.counselors || []);
      setInstitutions(instRes.data?.data?.institutions || []);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  // --- Derived metrics from leadStats & leads ---
  const metrics = useMemo(() => {
    const total = leadStats?.total ?? 0;
    const auto = leadStats?.assignment?.auto ?? 0;
    const manual = leadStats?.assignment?.manual ?? 0;
    const enrolled = leadStats?.status?.enrolled ?? 0;
    const assigned = auto + manual;
    const conversionRate = total > 0 ? ((enrolled / total) * 100).toFixed(1) : '0';
    const assignmentRate = total > 0 ? ((assigned / total) * 100).toFixed(1) : '0';

    const dropped = leads.filter((l) => l.status === 'REJECTED').length;
    const priorityCount = leads.filter((l) => l.classification === 'PRIORITY').length;
    const admissionConfirmedCount = leads.filter((l) => l.classification === 'ADMISSION_CONFIRMED').length;
    const pendingFollowUps = leads.filter((l) => l.status === 'FOLLOW_UP').length;
    const contactedToday = leads.filter((l) => {
      const updated = l.updatedAt ? new Date(l.updatedAt) : null;
      return l.status === 'CONTACTED' && updated && isToday(updated);
    }).length;

    return {
      total,
      auto,
      manual,
      enrolled,
      conversionRate,
      assignmentRate,
      dropped,
      priorityLeads: leadStats?.classification?.priority ?? priorityCount,
      admissionConfirmed: leadStats?.classification?.admissionConfirmed ?? admissionConfirmedCount,
      pendingFollowUps,
      contactedToday,
    };
  }, [leadStats, leads]);

  // --- Status distribution (from leads + stats) ---
  const statusDistribution = useMemo(() => {
    const statuses = ['NEW', 'COUNSELING_IN_PROGRESS', 'PRIORITY', 'ADMISSION_CONFIRMED', 'ENROLLED', 'REJECTED', 'CONTACTED', 'FOLLOW_UP', 'ON_HOLD'];
    const byStatus = {};
    statuses.forEach((s) => (byStatus[s] = 0));
    leads.forEach((l) => {
      if (l.classification && ['NEW', 'COUNSELING_IN_PROGRESS', 'PRIORITY', 'ADMISSION_CONFIRMED'].includes(l.classification)) {
        byStatus[l.classification] = (byStatus[l.classification] || 0) + 1;
      }
      if (l.status) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    });
    if (leadStats) {
      byStatus.NEW = leadStats.classification?.new ?? byStatus.NEW;
      byStatus.COURSELING_IN_PROGRESS = leadStats.classification?.counselingInProgress ?? byStatus.COURSELING_IN_PROGRESS;
      byStatus.PRIORITY = leadStats.classification?.priority ?? byStatus.PRIORITY;
      byStatus.ADMISSION_CONFIRMED = leadStats.classification?.admissionConfirmed ?? byStatus.ADMISSION_CONFIRMED;
      byStatus.ENROLLED = leadStats.status?.enrolled ?? byStatus.ENROLLED;
    }
    const classificationLabels = { NEW: 'New', COUNSELING_IN_PROGRESS: 'Counseling In Progress', PRIORITY: 'Priority', ADMISSION_CONFIRMED: 'Admission Confirmed' };
    const colors = { NEW: '#93C5FD', COUNSELING_IN_PROGRESS: '#FCD34D', PRIORITY: '#F87171', ADMISSION_CONFIRMED: '#34D399', ENROLLED: '#10B981', REJECTED: '#9CA3AF', CONTACTED: '#A78BFA', FOLLOW_UP: '#FBBF24', ON_HOLD: '#D1D5DB' };
    return ['NEW', 'COUNSELING_IN_PROGRESS', 'PRIORITY', 'ADMISSION_CONFIRMED', 'ENROLLED', 'REJECTED'].map((key) => ({
      label: classificationLabels[key] || key,
      value: byStatus[key] ?? 0,
      color: colors[key] || '#94A3B8',
    })).filter((d) => d.value > 0);
  }, [leads, leadStats]);

  // --- Funnel (derived) ---
  const funnelData = useMemo(() => {
    const total = leadStats?.total ?? leads.length;
    const newCount = leadStats?.classification?.new ?? leads.filter((l) => l.classification === 'NEW').length;
    const counselingInProgress = leadStats?.classification?.counselingInProgress ?? leads.filter((l) => l.classification === 'COUNSELING_IN_PROGRESS').length;
    const priorityCount = leadStats?.classification?.priority ?? leads.filter((l) => l.classification === 'PRIORITY').length;
    const admissionConfirmed = leadStats?.classification?.admissionConfirmed ?? leads.filter((l) => l.classification === 'ADMISSION_CONFIRMED').length;
    return [
      { label: 'New', count: newCount, color: '#6366F1' },
      { label: 'Counseling In Progress', count: counselingInProgress, color: '#818CF8' },
      { label: 'Priority', count: priorityCount, color: '#A5B4FC' },
      { label: 'Admission Confirmed', count: admissionConfirmed, color: '#34D399' },
    ];
  }, [leadStats, leads]);

  // --- Counselor performance (from leads) ---
  const counselorPerformance = useMemo(() => {
    const map = {};
    counselors.forEach((c) => {
      const id = c.id || c._id;
      map[id] = {
        name: c.fullName || c.username || 'Unknown',
        assigned: 0,
        contacted: 0,
        followUps: 0,
        enrolled: 0,
      };
    });
    leads.forEach((l) => {
      const cid = l.assignedCounselorId || l.assignedCounselor?.id;
      if (!cid) return;
      if (!map[cid]) map[cid] = { name: l.assignedCounselor?.fullName || 'Unknown', assigned: 0, contacted: 0, followUps: 0, enrolled: 0 };
      map[cid].assigned += 1;
      if (l.status === 'CONTACTED' || l.status === 'FOLLOW_UP') map[cid].contacted += 1;
      if (l.status === 'FOLLOW_UP') map[cid].followUps += 1;
      if (l.status === 'ENROLLED') map[cid].enrolled += 1;
    });
    return Object.entries(map)
      .filter(([, v]) => v.assigned > 0)
      .map(([id, v]) => ({
        id,
        ...v,
        conversionPct: v.assigned > 0 ? ((v.enrolled / v.assigned) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => b.enrolled - a.enrolled)
      .slice(0, 10);
  }, [leads, counselors]);

  // --- Institution-wise (from leads) ---
  const institutionAnalytics = useMemo(() => {
    const map = {};
    leads.forEach((l) => {
      const iid = l.institutionId || l.institution?.id;
      const iname = l.institution?.name || 'Unknown';
      if (!map[iid]) map[iid] = { name: iname, count: 0, enrolled: 0 };
      map[iid].count += 1;
      if (l.status === 'ENROLLED') map[iid].enrolled += 1;
    });
    return Object.entries(map).map(([id, v]) => ({
      id,
      ...v,
      conversionPct: v.count > 0 ? ((v.enrolled / v.count) * 100).toFixed(1) : '0',
    })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [leads]);

  // --- Time-based: leads per day ---
  const leadsPerDay = useMemo(() => {
    const byDay = {};
    leads.forEach((l) => {
      const d = l.submittedAt ? format(startOfDay(new Date(l.submittedAt)), 'MMM d') : null;
      if (d) { byDay[d] = (byDay[d] || 0) + 1; }
    });
    return Object.entries(byDay)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => new Date(a.label) - new Date(b.label))
      .slice(-14);
  }, [leads]);

  // --- Enrollments per month ---
  const enrollmentsPerMonth = useMemo(() => {
    const byMonth = {};
    leads.filter((l) => l.status === 'ENROLLED').forEach((l) => {
      const d = l.updatedAt ? format(startOfMonth(new Date(l.updatedAt)), 'MMM yyyy') : null;
      if (d) { byMonth[d] = (byMonth[d] || 0) + 1; }
    });
    return Object.entries(byMonth)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => new Date(a.label) - new Date(b.label))
      .slice(-6);
  }, [leads]);

  // --- Alerts (rule-based) ---
  const alerts = useMemo(() => {
    const list = [];
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    leads.forEach((l) => {
      const updated = l.updatedAt ? new Date(l.updatedAt) : null;
      if (l.status === 'NEW' && updated && differenceInDays(new Date(), updated) >= 3) {
        list.push({ type: 'warning', msg: `Lead ${l.leadId || l.studentName} not contacted for 3+ days` });
      }
      if (l.classification === 'PRIORITY' && l.status !== 'CONTACTED' && l.status !== 'ENROLLED') {
        list.push({ type: 'danger', msg: `Priority lead ${l.leadId || l.studentName} needs follow-up` });
      }
    });
    counselorPerformance.forEach((c) => {
      if (c.assigned > 0 && c.enrolled === 0) {
        list.push({ type: 'info', msg: `Counselor ${c.name} has 0 enrollments` });
      }
    });
    return list.slice(0, 8);
  }, [leads, counselorPerformance]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-500 border-t-transparent" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-gray-600 mt-1">Comprehensive insights and statistics</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-sm">Export Leads Report</button>
          <button type="button" className="btn-secondary text-sm">Export Counselor Report</button>
        </div>
      </div>

      {/* 1. Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatCard title="Total Leads" value={metrics.total} variant="primary" />
        <StatCard title="Auto Assigned" value={metrics.auto} variant="green" />
        <StatCard title="Manual Assigned" value={metrics.manual} variant="blue" />
        <StatCard title="Enrolled" value={metrics.enrolled} variant="purple" />
        <StatCard title="Conversion Rate" value={`${metrics.conversionRate}%`} subtext="Enrolled / Total" variant="green" />
        <StatCard title="Assignment Rate" value={`${metrics.assignmentRate}%`} subtext="(Auto+Manual) / Total" variant="blue" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Dropped Leads" value={metrics.dropped} subtext="status = REJECTED" variant="default" />
        <StatCard title="Pending Follow-ups" value={metrics.pendingFollowUps} subtext="status = FOLLOW_UP" variant="amber" />
        <StatCard title="Priority Leads" value={metrics.priorityLeads} subtext="classification = PRIORITY" variant="amber" />
        <StatCard title="Contacted Today" value={metrics.contactedToday} subtext="status CONTACTED, updated today" variant="green" />
      </div>

      {/* 2. Lead Status Distribution */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Lead Status Distribution</h2>
        <PieChart data={statusDistribution.length > 0 ? statusDistribution : [{ label: 'No data', value: 1, color: '#E5E7EB' }]} />
      </div>

      {/* 3. Lead Conversion Funnel */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Lead Conversion Funnel</h2>
        <div className="space-y-3 max-w-xl">
          {funnelData.map((step) => (
            <FunnelStep key={step.label} label={step.label} count={step.count} total={funnelData[0]?.count || 1} color={step.color} />
          ))}
        </div>
      </div>

      {/* 4. Counselor Performance Table */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Performing Counselors</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-gray-700 font-semibold">Counselor Name</th>
                <th className="text-right py-3 px-4 text-gray-700 font-semibold">Leads Assigned</th>
                <th className="text-right py-3 px-4 text-gray-700 font-semibold">Contacted</th>
                <th className="text-right py-3 px-4 text-gray-700 font-semibold">Follow-ups</th>
                <th className="text-right py-3 px-4 text-gray-700 font-semibold">Enrolled</th>
                <th className="text-right py-3 px-4 text-gray-700 font-semibold">Conversion %</th>
              </tr>
            </thead>
            <tbody>
              {(counselorPerformance.length > 0 ? counselorPerformance : dashboardData?.topCounselors?.map((c) => ({ name: c.counselorName, assigned: 0, contacted: 0, followUps: 0, enrolled: c.enrolledCount, conversionPct: '0' })) || []).map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{row.name}</td>
                  <td className="py-3 px-4 text-right">{row.assigned ?? '—'}</td>
                  <td className="py-3 px-4 text-right">{row.contacted ?? '—'}</td>
                  <td className="py-3 px-4 text-right">{row.followUps ?? '—'}</td>
                  <td className="py-3 px-4 text-right font-semibold text-emerald-600">{row.enrolled ?? row.enrolledCount ?? '—'}</td>
                  <td className="py-3 px-4 text-right">{row.conversionPct != null ? `${row.conversionPct}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {counselorPerformance.length === 0 && (!dashboardData?.topCounselors || dashboardData.topCounselors.length === 0) && (
            <p className="text-gray-500 py-6 text-center">No counselor data available</p>
          )}
        </div>
      </div>

      {/* 5. Institution-wise Analytics */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Institution-wise Analytics</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-gray-700 font-semibold">Institution Name</th>
                <th className="text-right py-3 px-4 text-gray-700 font-semibold">Leads Count</th>
                <th className="text-right py-3 px-4 text-gray-700 font-semibold">Enrolled</th>
                <th className="text-right py-3 px-4 text-gray-700 font-semibold">Conversion %</th>
              </tr>
            </thead>
            <tbody>
              {institutionAnalytics.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{row.name}</td>
                  <td className="py-3 px-4 text-right">{row.count}</td>
                  <td className="py-3 px-4 text-right text-emerald-600">{row.enrolled}</td>
                  <td className="py-3 px-4 text-right">{row.conversionPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {institutionAnalytics.length === 0 && <p className="text-gray-500 py-6 text-center">No institution data available</p>}
        </div>
      </div>

      {/* 6. Time-Based Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Leads per Day</h2>
          {leadsPerDay.length > 0 ? (
            <BarChart data={leadsPerDay} labelKey="label" valueKey="value" maxBars={14} />
          ) : (
            <p className="text-gray-500 py-8 text-center">No date data available</p>
          )}
        </div>
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Enrollments per Month</h2>
          {enrollmentsPerMonth.length > 0 ? (
            <BarChart data={enrollmentsPerMonth} labelKey="label" valueKey="value" maxBars={6} />
          ) : (
            <p className="text-gray-500 py-8 text-center">No enrollment date data available</p>
          )}
        </div>
      </div>

      {/* 7. Alerts Panel */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Alerts</h2>
        {alerts.length > 0 ? (
          <ul className="space-y-2">
            {alerts.map((a, i) => (
              <li
                key={i}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  a.type === 'danger' ? 'bg-red-50 text-red-800' : a.type === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'
                }`}
              >
                <span>{a.type === 'danger' ? '🔴' : a.type === 'warning' ? '🟡' : 'ℹ️'}</span>
                {a.msg}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 py-4">No alerts at this time</p>
        )}
      </div>

      {/* Lead Classification (funnel: New → Counseling In Progress → Priority → Admission Confirmed) */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Lead Classification</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{leadStats?.classification?.new ?? 0}</p>
            <p className="text-sm text-gray-600 mt-1">New</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{leadStats?.classification?.counselingInProgress ?? 0}</p>
            <p className="text-sm text-gray-600 mt-1">Counseling In Progress</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{leadStats?.classification?.priority ?? 0}</p>
            <p className="text-sm text-gray-600 mt-1">Priority</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{leadStats?.classification?.admissionConfirmed ?? 0}</p>
            <p className="text-sm text-gray-600 mt-1">Admission Confirmed</p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AdminAnalytics;

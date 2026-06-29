import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
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
import { feedbackAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const PIE_COLORS = ['#6366f1', '#0d9488', '#059669', '#d97706', '#475569', '#6b7280'];

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

const EmptyState = () => <div className="flex items-center justify-center py-12 text-gray-500 text-sm">No data available</div>;

export default function FeedbackAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    feedbackAPI
      .getAnalytics()
      .then((r) => { if (!cancelled) setAnalytics(r.data?.data || null); })
      .catch(() => { if (!cancelled) toast.error('Failed to load analytics'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    feedbackAPI
      .getAll({ page, limit })
      .then((r) => {
        if (!cancelled) {
          setList(r.data?.data?.feedback || []);
          setTotal(r.data?.data?.total ?? 0);
        }
      })
      .catch(() => { if (!cancelled) toast.error('Failed to load feedback list'); })
      .finally(() => { if (!cancelled) setListLoading(false); });
    return () => { cancelled = true; };
  }, [page]);

  const openDetail = (id) => {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    feedbackAPI
      .getById(id)
      .then((r) => setDetail(r.data?.data))
      .catch(() => toast.error('Failed to load feedback'))
      .finally(() => setDetailLoading(false));
  };

  const closeDetail = () => { setDetailId(null); setDetail(null); };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-500 border-t-transparent" aria-label="Loading" />
      </div>
    );
  }

  const d = analytics || {};
  const avgRating = d.averageRating ?? 0;
  const interestedPct = d.interestedPct ?? 0;
  const notInterestedPct = d.notInterestedPct ?? 0;
  const readyPct = d.readyForAdmissionPct ?? 0;
  const recommendPct = d.recommendationPct ?? 0;
  const interestDist = d.interestDistribution || [];
  const admissionDist = d.admissionDistribution || [];
  const counselorPerf = d.counselorPerformance || [];
  const institutionInterest = d.institutionInterest || [];
  const recommendationRate = d.recommendationRate || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Feedback Analytics</h1>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard title="Total Feedback Collected" value={d.totalFeedback ?? 0} variant="default" />
        <StatCard title="Average Counseling Rating" value={avgRating} subtext="Out of 5" variant="primary" />
        <StatCard title="Interested Parents %" value={`${interestedPct}%`} variant="green" />
        <StatCard title="Not Interested Parents %" value={`${notInterestedPct}%`} variant="amber" />
        <StatCard title="Ready for Admission %" value={`${readyPct}%`} variant="blue" />
        <StatCard title="Recommendation %" value={`${recommendPct}%`} variant="purple" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Interest Level Distribution" subtitle="Parent interest in institution">
          {interestDist.length === 0 ? <EmptyState /> : (
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={interestDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}: ${e.value}`}>
                    {interestDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Admission Decision Distribution" subtitle="Parent admission intent">
          {admissionDist.length === 0 ? <EmptyState /> : (
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={admissionDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}: ${e.value}`}>
                    {admissionDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Counselor Performance" subtitle="Average rating (1–5) from feedback">
          {counselorPerf.length === 0 ? <EmptyState /> : (
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={counselorPerf.map((c) => ({ ...c, avgRating: parseFloat(c.avgRating) || 0 }))}
                  margin={{ top: 8, right: 8, left: 8, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="avgRating" fill="#6366f1" name="Avg Rating" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Institution-wise Interest" subtitle="Feedback count per institution">
          {institutionInterest.length === 0 ? <EmptyState /> : (
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={institutionInterest} margin={{ top: 8, right: 8, left: 8, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0d9488" name="Feedback count" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Recommendation Rate" subtitle="Would recommend Pravidya counseling?">
          {recommendationRate.length === 0 ? <EmptyState /> : (
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={recommendationRate} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}: ${e.value}`}>
                    {recommendationRate.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Feedback Table */}
      <Card title="Feedback List" subtitle="All submitted parent feedback">
        {listLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-5 -mb-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-5 py-3 font-medium text-gray-700">Student</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-700">Parent</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-700">Institution</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-700">Counselor</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-700">Interest</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-700">Admission Decision</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-700">Rating</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-700">Recommend</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-700">Submitted</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-8 text-center text-gray-500">No feedback yet</td>
                    </tr>
                  ) : (
                    list.map((row) => {
                      const avg = (row.experienceRating + row.explanationRating + row.helpfulnessRating + row.professionalismRating) / 4;
                      return (
                        <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                          <td className="px-5 py-3 font-medium text-gray-900">{row.studentName || '—'}</td>
                          <td className="px-5 py-3 text-gray-700">{row.parentName || '—'}</td>
                          <td className="px-5 py-3 text-gray-600">{row.institution?.name || '—'}</td>
                          <td className="px-5 py-3 text-gray-600">{row.counselor?.fullName || '—'}</td>
                          <td className="px-5 py-3 text-gray-600">{row.interestLevel || '—'}</td>
                          <td className="px-5 py-3 text-gray-600">{row.admissionDecision || '—'}</td>
                          <td className="px-5 py-3 text-gray-600">{avg.toFixed(1)}</td>
                          <td className="px-5 py-3 text-gray-600">{row.recommend ? 'Yes' : 'No'}</td>
                          <td className="px-5 py-3 text-gray-600">{row.createdAt ? format(new Date(row.createdAt), 'MMM d, yyyy') : '—'}</td>
                          <td className="px-5 py-3">
                            <button type="button" onClick={() => openDetail(row.id)} className="text-primary-600 hover:text-primary-800 font-medium text-sm">
                              View Full Feedback
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-600">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary text-sm py-2 px-3 disabled:opacity-50">
                    Previous
                  </button>
                  <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary text-sm py-2 px-3 disabled:opacity-50">
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* View Full Feedback Modal */}
      {detailId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeDetail}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Full Feedback</h3>
              <button type="button" onClick={closeDetail} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">×</button>
            </div>
            {detailLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
              </div>
            ) : detail ? (
              <div className="space-y-4 text-sm">
                <dl className="grid grid-cols-2 gap-2">
                  <dt className="text-gray-500">Student</dt><dd className="font-medium">{detail.studentName}</dd>
                  <dt className="text-gray-500">Parent</dt><dd className="font-medium">{detail.parentName}</dd>
                  <dt className="text-gray-500">Email</dt><dd>{detail.email}</dd>
                  <dt className="text-gray-500">Phone</dt><dd>{detail.phone}</dd>
                  <dt className="text-gray-500">Institution</dt><dd>{detail.institution?.name}</dd>
                  <dt className="text-gray-500">Counselor</dt><dd>{detail.counselor?.fullName}</dd>
                </dl>
                <hr />
                <p><strong>Experience rating:</strong> {detail.experienceRating}/5</p>
                <p><strong>Explanation clarity:</strong> {detail.explanationRating}/5</p>
                <p><strong>Helpfulness:</strong> {detail.helpfulnessRating}/5</p>
                <p><strong>Professionalism:</strong> {detail.professionalismRating}/5</p>
                <p><strong>Questions answered:</strong> {detail.questionsAnswered ? 'Yes' : 'No'}</p>
                <p><strong>Interest level:</strong> {detail.interestLevel}</p>
                <p><strong>Admission decision:</strong> {detail.admissionDecision}</p>
                {detail.concern && <p><strong>Biggest concern:</strong> {detail.concern}</p>}
                <p><strong>Recommend Pravidya:</strong> {detail.recommend ? 'Yes' : 'No'}</p>
                {detail.likedFeedback && <p><strong>What they liked:</strong> {detail.likedFeedback}</p>}
                {detail.improvementFeedback && <p><strong>What can improve:</strong> {detail.improvementFeedback}</p>}
                <p className="text-gray-500">Submitted: {detail.createdAt ? format(new Date(detail.createdAt), 'PPpp') : '—'}</p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

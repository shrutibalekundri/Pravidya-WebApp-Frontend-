import { useState, useEffect } from 'react';
import { historicalFilesAPI } from '../../../services/api';
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
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const CARD_COLORS = ['#6366f1', '#0d9488', '#059669', '#d97706', '#dc2626'];

export default function HistoricalDashboard() {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([historicalFilesAPI.getStats(), historicalFilesAPI.getAnalytics()])
      .then(([statsRes, analyticsRes]) => {
        setStats(statsRes.data?.data || null);
        setAnalytics(analyticsRes.data?.data || null);
      })
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const s = stats || {};
  const cards = [
    { title: 'Total Files Uploaded', value: s.totalFiles ?? 0 },
    { title: 'Total Institutions Covered', value: s.totalInstitutions ?? 0 },
    { title: 'Total Historical Records', value: s.totalRecords ?? 0 },
    { title: 'Pending Verification', value: s.pendingVerification ?? 0 },
    { title: 'Verified Records', value: s.verifiedRecords ?? 0 },
  ];

  const yearData = (analytics?.yearWiseAdmissions || []).length
    ? analytics.yearWiseAdmissions
    : (s.recentUploads || []).length
      ? [{ year: String(new Date().getFullYear()), admissions: s.totalRecords || 0 }]
      : [];
  const instData = ((analytics?.institutionWise || []).length ? analytics.institutionWise : (s.institutionWise || [])).slice(0, 10);
  const categoryData = (s.categoryDistribution || []).map((c, i) => ({
    name: c.category,
    value: c.count,
    fill: CARD_COLORS[i % CARD_COLORS.length],
  }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card, i) => (
          <div
            key={card.title}
            className="bg-white rounded-2xl border-2 border-gray-100 p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-gray-600">{card.title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Year-wise admissions trend</h3>
          {yearData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yearData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="admissions" stroke="#6366f1" strokeWidth={2} name="Admissions" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-500 py-8 text-center text-sm">No year-wise data yet. Upload Excel files to see trends.</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Institution-wise admissions comparison</h3>
          {instData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={instData} margin={{ top: 8, right: 8, left: 8, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Files" fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-500 py-8 text-center text-sm">No institution data yet.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Category distribution (Marketing vs Publicity)</h3>
        {categoryData.length > 0 ? (
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {categoryData.map((entry, i) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500 py-8 text-center text-sm">No category data yet.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 p-5 pb-0">Recent uploads</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Institution Name</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">File Name</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">File Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Uploaded By</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Upload Date</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {(s.recentUploads || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No uploads yet. <Link to="/admin/historical-admissions/upload" className="text-primary-600 hover:underline">Upload data</Link>.
                  </td>
                </tr>
              ) : (
                s.recentUploads.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{row.institution?.name || '—'}</td>
                    <td className="py-3 px-4">{row.fileName || '—'}</td>
                    <td className="py-3 px-4 uppercase">{row.fileType || '—'}</td>
                    <td className="py-3 px-4">{row.uploadedBy?.username || '—'}</td>
                    <td className="py-3 px-4">{row.uploadedAt ? format(new Date(row.uploadedAt), 'dd MMM yyyy HH:mm') : '—'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          row.status === 'VERIFIED'
                            ? 'bg-green-100 text-green-800'
                            : row.status === 'LOCKED'
                              ? 'bg-gray-200 text-gray-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

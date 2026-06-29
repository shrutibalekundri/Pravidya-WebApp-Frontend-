import { useState, useEffect } from 'react';
import { historicalFilesAPI, institutionAPI } from '../../../services/api';
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

const COLORS = ['#6366f1', '#0d9488', '#059669', '#d97706', '#dc2626', '#8b5cf6'];

export default function HistoricalAnalytics() {
  const [data, setData] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [institutionId, setInstitutionId] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    institutionAPI.getAll({ limit: 200 }).then((r) => {
      const list = r.data?.data?.institutions ?? r.data?.institutions ?? [];
      setInstitutions(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (institutionId) params.institutionId = institutionId;
    if (year) params.year = year;
    historicalFilesAPI.getAnalytics(params)
      .then((r) => setData(r.data?.data || null))
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [institutionId, year]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const yearData = data?.yearWiseAdmissions || [];
  const instData = (data?.institutionWise || []).slice(0, 12);
  const courseData = (data?.coursePopularity || []).slice(0, 10);
  const categoryData = (data?.categoryDistribution || []).map((c, i) => ({ ...c, fill: COLORS[i % COLORS.length] }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-4">
        <select
          value={institutionId}
          onChange={(e) => setInstitutionId(e.target.value)}
          className="input-field py-2 text-sm w-56"
        >
          <option value="">All institutions</option>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
        <input
          type="text"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="Filter by year (e.g. 2023)"
          className="input-field py-2 text-sm w-48"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Admissions per year</h3>
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
            <p className="text-gray-500 py-12 text-center text-sm">No year-wise data. Upload and verify Excel files with Year/Admissions columns.</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Institution comparison</h3>
          {instData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={instData} margin={{ top: 8, right: 8, left: 8, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Count" fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-500 py-12 text-center text-sm">No institution data.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Course popularity</h3>
          {courseData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courseData} layout="vertical" margin={{ top: 8, right: 24, left: 80, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={76} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Admissions" fill="#059669" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-500 py-12 text-center text-sm">No course data. Parse Excel with Course/Admissions columns.</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Marketing vs Publicity effectiveness</h3>
          {categoryData.length > 0 ? (
            <div className="h-72 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="name"
                    label={({ name, count }) => `${name}: ${count}`}
                  >
                    {categoryData.map((entry, i) => (
                      <Cell key={entry.name} fill={entry.fill || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-500 py-12 text-center text-sm">No category data.</p>
          )}
        </div>
      </div>
    </div>
  );
}

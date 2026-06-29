import { useState, useEffect } from 'react';
import { Building2, Search } from 'lucide-react';
import { superAdminAPI } from '../../services/api';
import toast from 'react-hot-toast';

const SuperAdminInstitutions = () => {
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchInstitutions = () => {
    setLoading(true);
    superAdminAPI
      .getInstitutions({ page, limit: 20, search: search || undefined })
      .then((res) => {
        setInstitutions(res.data?.data?.institutions || []);
        setTotal(res.data?.data?.total || 0);
      })
      .catch(() => toast.error('Failed to load institutions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInstitutions();
  }, [page, search]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Institution Management</h1>
          <p className="text-slate-600 mt-0.5">View and manage institutions</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search institutions..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input-field pl-10 w-full"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent mx-auto" />
          </div>
        ) : institutions.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No institutions found. Use Onboarding to add new institutions.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Institution ID</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Location</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Leads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {institutions.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {inst.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{inst.type}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-sm">
                      {inst.jitofyInstitutionId || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {[inst.city, inst.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">{inst._count?.leads ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages} ({total} total)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary text-sm py-1.5 px-3"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-secondary text-sm py-1.5 px-3"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminInstitutions;

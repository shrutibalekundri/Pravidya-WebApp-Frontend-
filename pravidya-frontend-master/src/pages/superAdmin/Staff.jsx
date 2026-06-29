import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { superAdminAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Users, Plus, Search } from 'lucide-react';
import CreateStaffModal from '../../components/superAdmin/CreateStaffModal';

const SuperAdminStaff = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [institutions, setInstitutions] = useState([]);
  const isPlatform = user?.jitofyInstitutionId === 'PLATFORM';

  const fetchStaff = () => {
    setLoading(true);
    const params = { page: 1, limit: 100 };
    if (search) params.search = search;
    if (roleFilter) params.role = roleFilter;
    if (isPlatform && institutionId) params.institutionId = institutionId;
    superAdminAPI
      .getStaff(params)
      .then((res) => setStaff(res.data?.data?.staff || []))
      .catch(() => toast.error('Failed to load staff'))
      .finally(() => setLoading(false));
  };

  const fetchInstitutions = () => {
    if (isPlatform) {
      superAdminAPI.getInstitutions({ limit: 200 }).then((res) => {
        setInstitutions(res.data?.data?.institutions || []);
      });
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [search, roleFilter, institutionId]);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const handleCreated = () => {
    setShowModal(false);
    fetchStaff();
  };

  const handleToggleActive = async (id, isActive) => {
    try {
      await superAdminAPI.updateStaff(id, { isActive: !isActive });
      toast.success(isActive ? 'Staff deactivated' : 'Staff activated');
      fetchStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff Management</h1>
          <p className="text-slate-600 mt-0.5">Create and manage Admin, Counselor, Management</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Staff
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-3">
          {isPlatform && institutions.length > 0 && (
            <select
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
              className="input-field min-w-[180px]"
            >
              <option value="">All Institutions</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input-field min-w-[140px]"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="COUNSELOR">Counselor</option>
            <option value="MANAGEMENT">Management</option>
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent mx-auto" />
          </div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No staff found. Create your first staff member.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Email</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Role</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {staff.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      {s.fullName || s.username || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700">
                        {s.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={s.isActive ? 'text-green-600' : 'text-slate-400'}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(s.id, s.isActive)}
                        className="text-sm text-primary-600 hover:underline"
                      >
                        {s.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <CreateStaffModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
          institutionId={institutionId}
          institutions={institutions}
          isPlatform={isPlatform}
        />
      )}
    </div>
  );
};

export default SuperAdminStaff;

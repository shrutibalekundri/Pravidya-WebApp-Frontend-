import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  ClipboardList,
  UserCheck,
  TrendingUp,
  UserPlus,
  UserCog,
} from 'lucide-react';
import { superAdminAPI } from '../../services/api';
import toast from 'react-hot-toast';

const StatCard = ({ title, value, icon: Icon, to, sub }) => (
  <Link
    to={to || '#'}
    className={`bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow ${to ? 'cursor-pointer' : 'cursor-default'}`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      {Icon && (
        <div className="p-2 rounded-lg bg-primary-50 text-primary-600">
          <Icon className="w-6 h-6" strokeWidth={2} />
        </div>
      )}
    </div>
  </Link>
);

const SuperAdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superAdminAPI
      .getDashboard()
      .then((res) => setData(res.data?.data))
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load dashboard');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const overview = data?.overview || {};

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">System Overview</h1>
        <p className="text-slate-600 mt-0.5">
          {data?.isPlatform ? 'Platform-level control' : 'Institution-level dashboard'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          title="Institutions"
          value={overview.institutions ?? 0}
          icon={Building2}
          to="/super-admin/institutions"
        />
        <StatCard
          title="Staff"
          value={overview.staff ?? 0}
          icon={Users}
          to="/super-admin/staff"
          sub={`${overview.admins ?? 0} Admin · ${overview.counselors ?? 0} Counselor · ${overview.management ?? 0} Management`}
        />
        <StatCard
          title="Total Leads"
          value={overview.leads ?? 0}
          icon={ClipboardList}
        />
        <StatCard
          title="Enrolled"
          value={overview.enrolled ?? 0}
          icon={UserCheck}
        />
        <StatCard
          title="New Leads Today"
          value={overview.newLeadsToday ?? 0}
          icon={TrendingUp}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {data?.isPlatform && (
              <Link
                to="/super-admin/onboarding"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <UserPlus className="w-5 h-5 text-primary-600" />
                <span className="font-medium">Onboard New Institution</span>
              </Link>
            )}
            <Link
              to="/super-admin/staff"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <UserCog className="w-5 h-5 text-primary-600" />
              <span className="font-medium">Create Staff</span>
            </Link>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Role Structure</h2>
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="font-medium text-slate-800">Super Admin</span>
              — Institution level control, onboarding, staff management
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium text-slate-800">Admin</span>
              — Operational control, leads, counselors, institutions
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium text-slate-800">Counselor</span>
              — Lead counseling, call handling, enrollment
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium text-slate-800">Management</span>
              — Monitoring, reporting, analytics
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;

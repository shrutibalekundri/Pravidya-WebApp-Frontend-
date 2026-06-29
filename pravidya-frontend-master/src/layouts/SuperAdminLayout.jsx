import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Users, UserPlus, X, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { superAdminOnboardingPath } from '../constants/institutionIds';

const SuperAdminLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/super-admin/login');
  };

  const onboardingPath = superAdminOnboardingPath(user?.jitofyInstitutionId);
  const navItems = [
    { path: onboardingPath, label: 'Onboarding', Icon: UserPlus },
    { path: '/super-admin/staff', label: 'Staff Management', Icon: Users },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-white z-40 transform transition-transform duration-200 ease-out lg:translate-x-0 border-r border-slate-200 shadow-soft-lg flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-primary-600">Pravidya</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Super Admin Portal</p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
        <nav className="p-3 flex-1 overflow-y-auto min-h-0">
          {navItems.map((item) => {
            const isActive =
              item.label === 'Onboarding'
                ? location.pathname.startsWith('/super-admin/onboarding')
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-all duration-200 border-l-2 ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-medium border-primary-500'
                    : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.Icon className="w-5 h-5 shrink-0" strokeWidth={2} aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 pt-0 border-t border-slate-200 shrink-0 bg-white">
          <div className="px-4 py-2 mb-2">
            <p className="text-sm font-medium text-slate-800 truncate">{user?.email}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              Super Admin
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              handleLogout();
            }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200 border-l-2 border-transparent"
          >
            <LogOut className="w-5 h-5 shrink-0" strokeWidth={2} aria-hidden />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="lg:ml-64 min-h-screen flex flex-col">
        <header className="bg-white sticky top-0 z-20 border-b border-slate-200 shadow-soft">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                aria-label="Open menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h2 className="text-base sm:text-xl font-semibold text-slate-800 truncate">
                {navItems.find((item) => location.pathname.startsWith(item.path))?.label || 'Super Admin'}
              </h2>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SuperAdminLayout;

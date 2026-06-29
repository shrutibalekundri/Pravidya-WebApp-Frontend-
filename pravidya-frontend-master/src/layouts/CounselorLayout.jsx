import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Calendar,
  Building2,
  BarChart2,
  GraduationCap,
  CheckCircle,
  X,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { counselorAPI } from '../services/api';

const CounselorLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [alertDropdownOpen, setAlertDropdownOpen] = useState(false);

  const counselorId = user?.counselorProfile?.id || user?.counselorProfile?._id;

  useEffect(() => {
    if (!counselorId) return;
    const id = setTimeout(() => {
      counselorAPI.getNewLeadsCount(counselorId)
        .then(({ data }) => setNewLeadsCount(data?.data?.newLeads ?? 0))
        .catch(() => setNewLeadsCount(0));
    }, 0);
    return () => clearTimeout(id);
  }, [counselorId]);

  useEffect(() => {
    if (!alertDropdownOpen) return;
    const close = () => setAlertDropdownOpen(false);
    const onDocClick = () => {
      setTimeout(close, 0);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [alertDropdownOpen]);

  const handleAlertClick = (e) => {
    e.stopPropagation();
    setAlertDropdownOpen((prev) => !prev);
  };

  const handleLogout = () => {
    logout();
    navigate('/pravidya/acme/veeman/login?role=COUNSELOR');
  };

  const navItems = [
    { path: '/counselor/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { path: '/counselor/leads', label: 'My Leads', Icon: ClipboardList },
    { path: '/counselor/sessions', label: 'Sessions', Icon: Calendar },
    { path: '/counselor/emotional-hook-analytics', label: 'Emotional Hook Analytics', Icon: BarChart2 },
    { path: '/counselor/schools', label: 'Admissions Available', Icon: Building2 },
    { path: '/counselor/historical-insights', label: 'Historical Insights', Icon: BarChart2 },
    { path: '/counselor/training', label: 'Training', Icon: GraduationCap },
    { path: '/counselor/intelligence-chat', label: 'Intelligence Chat', Icon: GraduationCap },
    { path: '/counselor/todos', label: 'To-Dos', Icon: CheckCircle },
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
            <h1 className="text-lg sm:text-xl font-bold text-primary-600">Counselor Portal</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Welcome back!</p>
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
              (item.path === '/counselor/leads' && location.pathname.startsWith('/counselor/leads')) ||
              (item.path === '/counselor/sessions' && location.pathname.startsWith('/counselor/sessions')) ||
              (item.path === '/counselor/historical-insights' && location.pathname.includes('historical-insights')) ||
              location.pathname === item.path;
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
            <p className="text-sm font-medium text-slate-800 truncate">{user?.fullName || user?.counselorProfile?.fullName || user?.username || 'Counselor'}</p>
            <p className="text-xs text-slate-500">Counselor</p>
          </div>
          <button
            type="button"
            onClick={() => { setSidebarOpen(false); handleLogout(); }}
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
                {navItems.find(item => item.path === location.pathname)?.label || 'Counselor'}
              </h2>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              {newLeadsCount > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={handleAlertClick}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 shadow-sm hover:bg-amber-100 hover:border-amber-300 transition-colors"
                    title="View alerts"
                    aria-expanded={alertDropdownOpen}
                    aria-haspopup="true"
                  >
                    <span className="relative inline-flex">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-red-500 text-[10px] sm:text-xs font-bold text-white">
                        {newLeadsCount > 99 ? '99+' : newLeadsCount}
                      </span>
                    </span>
                    <span className="hidden sm:inline font-medium text-sm">New lead{newLeadsCount !== 1 ? 's' : ''} assigned</span>
                  </button>
                  {alertDropdownOpen && (
                    <div
                      className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-amber-200 bg-white shadow-lg py-3 z-50"
                      role="menu"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-4 py-2 border-b border-amber-100">
                        <p className="font-semibold text-amber-800">New leads assigned</p>
                        <p className="text-sm text-slate-600 mt-0.5">
                          You have {newLeadsCount} new lead{newLeadsCount !== 1 ? 's' : ''} assigned to you.
                        </p>
                      </div>
                      <div className="px-3 pt-2">
                        <Link
                          to="/counselor/leads"
                          onClick={() => setAlertDropdownOpen(false)}
                          className="block w-full text-center px-4 py-2 rounded-lg bg-amber-100 text-amber-800 font-medium text-sm hover:bg-amber-200 transition-colors"
                        >
                          Go to Leads →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
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

export default CounselorLayout;

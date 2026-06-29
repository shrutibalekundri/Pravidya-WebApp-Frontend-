import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';

const tabs = [
  { path: '/admin/historical-admissions/upload', label: 'Upload Data' },
  { path: '/admin/historical-admissions/records', label: 'Records' },
  { path: '/admin/historical-admissions/entries', label: 'Entries' },
];

export default function HistoricalAdmissionsLayout() {
  const location = useLocation();

  if (location.pathname === '/admin/historical-admissions' || location.pathname === '/admin/historical-admissions/') {
    return <Navigate to="/admin/historical-admissions/upload" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        {tabs.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              (tab.path === '/admin/historical-admissions/entries' ? location.pathname.startsWith('/admin/historical-admissions/entries') : location.pathname === tab.path)
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  );
}

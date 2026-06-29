import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { saasAPI } from '../../services/api';

export default function SaasDashboard() {
  const { academyId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await saasAPI.getDashboard();
        if (!mounted) return;
        setData(res.data.data);
      } catch (err) {
        const status = err?.response?.status;
        const code = err?.response?.data?.code;
        if (status === 401) {
          navigate(`/venam/${academyId}`);
        } else if (code === 'LICENSE_EXPIRED') {
          // Redirect back to academy page so license banner can show renewal link
          navigate(`/venam/${academyId}`);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [academyId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-xl shadow px-6 py-4">
          <p className="text-sm text-slate-700">Unable to load dashboard.</p>
        </div>
      </div>
    );
  }

  const { academy } = data;
  const expiry = academy.licenseExpiry ? new Date(academy.licenseExpiry) : null;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-4 py-4 flex items-center gap-3 border-b border-slate-700">
          {academy.logoUrl && (
            <img
              src={academy.logoUrl}
              alt={academy.schoolName}
              className="h-8 w-8 rounded bg-white object-contain"
            />
          )}
          <div>
            <p className="text-sm font-semibold truncate">{academy.schoolName}</p>
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">
              Pravidya Academy
            </p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
          <button className="w-full text-left px-3 py-2 rounded bg-slate-800">
            Dashboard
          </button>
          <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-800">
            Students
          </button>
          <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-800">
            Teachers
          </button>
          <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-800">
            Attendance
          </button>
          <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-800">
            Fees
          </button>
          <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-800">
            Settings
          </button>
        </nav>
        <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-300">
          {expiry ? (
            <>
              License expires on{' '}
              <span className="font-medium">
                {expiry.toLocaleDateString()}
              </span>
            </>
          ) : (
            'License status unknown'
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 px-8 py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-600 mt-1">
              Welcome to {academy.schoolName} on Pravidya.
            </p>
          </div>
          <Link
            to={`/venam/${academy.academyId}`}
            className="text-sm text-sky-600 hover:text-sky-800"
          >
            Back to onboarding
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500 mb-1">Students</p>
            <p className="text-2xl font-semibold text-slate-900">0</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500 mb-1">Teachers</p>
            <p className="text-2xl font-semibold text-slate-900">0</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500 mb-1">Pending Fees</p>
            <p className="text-2xl font-semibold text-slate-900">₹0</p>
          </div>
        </div>
      </main>
    </div>
  );
}


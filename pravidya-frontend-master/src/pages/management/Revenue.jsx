import { useState, useEffect } from 'react';
import { managementAPI } from '../../services/api';
import { useManagementFilters } from '../../contexts/ManagementFiltersContext';
import AnalyticsFilters from '../../components/management/AnalyticsFilters';
import toast from 'react-hot-toast';

export default function Revenue() {
  const { params } = useManagementFilters();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    managementAPI.getRevenue(params)
      .then((r) => { if (!cancelled) setData(r.data?.data); })
      .catch(() => { if (!cancelled) toast.error('Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [JSON.stringify(params)]);

  if (loading) {
    return (
      <div className="space-y-6">
        <AnalyticsFilters />
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  const d = data || {};
  const maxInst = Math.max(...(d.revenuePerInstitution || []).map((x) => x.value), 1);
  const maxCouns = Math.max(...(d.revenuePerCounselor || []).map((x) => x.value), 1);

  return (
    <div className="space-y-6">
      <AnalyticsFilters />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-slate-600">Total Revenue</p>
          <p className="text-2xl font-bold text-emerald-600">₹{(d.totalRevenue || 0).toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Cost per Lead</p>
          <p className="text-2xl font-bold">₹{(d.costPerLead || 0).toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">ROI</p>
          <p className="text-2xl font-bold">{d.roi ?? 0}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Revenue per Institution</h2>
          {(d.revenuePerInstitution || []).length > 0 ? (
            <div className="space-y-3">
              {d.revenuePerInstitution.map((x, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-32 text-sm truncate">{x.name}</div>
                  <div className="flex-1 h-8 bg-slate-100 rounded overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded" style={{ width: `${(x.value / maxInst) * 100}%` }} />
                  </div>
                  <span className="w-20 text-right font-medium">₹{x.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 py-8 text-center">No data</p>
          )}
        </div>
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Revenue per Counselor</h2>
          {(d.revenuePerCounselor || []).length > 0 ? (
            <div className="space-y-3">
              {d.revenuePerCounselor.map((x, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-32 text-sm truncate">{x.name}</div>
                  <div className="flex-1 h-8 bg-slate-100 rounded overflow-hidden">
                    <div className="h-full bg-primary-500 rounded" style={{ width: `${(x.value / maxCouns) * 100}%` }} />
                  </div>
                  <span className="w-20 text-right font-medium">₹{x.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 py-8 text-center">No data</p>
          )}
        </div>
      </div>
    </div>
  );
}

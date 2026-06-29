import { useState, useEffect } from 'react';
import { historicalVerificationAPI } from '../../services/api';
import toast from 'react-hot-toast';

function ViewButton({ uploadId }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleView = () => {
    setOpen(true);
    setLoading(true);
    historicalVerificationAPI
      .getCounselorView(uploadId)
      .then((res) => setDetail(res.data?.data || res.data))
      .catch((e) => {
        toast.error(e.response?.data?.message || 'Failed to load records');
        setOpen(false);
      })
      .finally(() => setLoading(false));
  };

  return (
    <>
      <button
        type="button"
        onClick={handleView}
        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
      >
        View
      </button>
      {open && (
        <RecordsModal
          detail={detail}
          loading={loading}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function RecordsModal({ detail, loading, onClose }) {
  const records = detail?.records || [];
  const institution = detail?.institution?.name || '—';
  const year = detail?.academicYear || '—';
  const dataType = detail?.dataType || '—';
  const fileUrl = detail?.fileUrl;
  const fileName = detail?.fileName;

  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '');
  const fullFileUrl = fileUrl ? `${apiBase}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}` : null;

  const keys = [
    ...new Set(
      records.flatMap((r) =>
        typeof r?.recordData === 'object' && r.recordData ? Object.keys(r.recordData) : []
      )
    ),
  ];

  const isDocumentView = keys.length === 1 && keys[0] === 'content';

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
        </div>
      );
    }
    if (records.length === 0) {
      return (
        <div className="space-y-3">
          <p className="text-gray-500">No extracted data to display.</p>
          {fullFileUrl && (
            <a
              href={fullFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 font-medium"
            >
              View / Download original file {fileName ? `(${fileName})` : ''}
            </a>
          )}
        </div>
      );
    }
    if (isDocumentView) {
      const content = records.map((r) => r.recordData?.content).filter(Boolean).join('\n\n');
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            {fullFileUrl && (
              <a
                href={fullFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 font-medium text-sm"
              >
                View / Download original file
              </a>
            )}
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-[60vh] overflow-auto">
            {content || '(Empty content)'}
          </pre>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
              {keys.map((k) => (
                <th key={k} className="px-3 py-2 text-left font-medium text-gray-700 capitalize">
                  {k.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r, idx) => (
              <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                {keys.map((k) => (
                  <td key={k} className="px-3 py-2 text-gray-800">
                    {r.recordData?.[k] != null ? String(r.recordData[k]) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {institution} — {year} — {String(dataType).toUpperCase()}
            </h3>
            <p className="text-sm text-gray-500">{records.length} record(s)</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            aria-label="Close"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">{renderContent()}</div>
      </div>
    </div>
  );
}

export default function HistoricalInsights() {
  const [data, setData] = useState({ uploads: [], yearCounts: {}, growth: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    historicalVerificationAPI
      .getCounselorData()
      .then((res) => setData(res.data?.data || res.data || { uploads: [], yearCounts: {}, growth: [] }))
      .catch((e) => {
        toast.error(e.response?.data?.message || 'Failed to load historical insights');
        setData({ uploads: [], yearCounts: {}, growth: [] });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const { yearCounts, growth, uploads } = data;
  const years = Object.keys(yearCounts || {}).sort();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Historical Insights</h1>
      <p className="text-gray-600">
        Verified institutional data from admin uploads. Only approved data is shown.
      </p>

      {years.length === 0 && (!uploads || uploads.length === 0) ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800">
          <p className="font-medium">No historical data available</p>
          <p className="text-sm mt-1">
            Admins need to upload and verify historical data in the Admin Panel (Historical Data &amp; Verification). Once verified, it will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Year comparison & growth */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Year Comparison</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {years.map((yr) => (
                <div key={yr} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <p className="text-sm text-gray-500">{yr}</p>
                  <p className="text-2xl font-bold text-primary-600">{yearCounts[yr] ?? 0}</p>
                  <p className="text-xs text-gray-400">records</p>
                </div>
              ))}
            </div>
          </section>

          {/* Growth percentage */}
          {growth && growth.length > 0 && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Growth Trends</h2>
              <div className="space-y-3">
                {growth.map((g) => (
                  <div key={g.year} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-gray-700">
                      {g.prevYear} → {g.year}
                    </span>
                    <span
                      className={`font-medium ${g.growthPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {g.growthPercent >= 0 ? '+' : ''}{g.growthPercent}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Uploads summary */}
          {uploads && uploads.length > 0 && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Verified Data Sources</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Institution</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Year</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Type</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Records</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploads.map((u) => (
                      <tr key={u.id} className="border-t border-gray-100">
                        <td className="px-4 py-2 text-sm">{u.institution?.name || '—'}</td>
                        <td className="px-4 py-2 text-sm">{u.academicYear}</td>
                        <td className="px-4 py-2 text-sm capitalize">{u.dataType}</td>
                        <td className="px-4 py-2 text-sm">{u._count?.records ?? 0}</td>
                        <td className="px-4 py-2">
                          <ViewButton uploadId={u.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

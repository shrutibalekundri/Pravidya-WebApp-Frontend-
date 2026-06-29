import { useState, useEffect, useRef } from 'react';
import { historicalMarketingAPI } from '../../../services/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import toast from 'react-hot-toast';

function StatusBadge({ status }) {
  const styles = {
    DRAFT: 'bg-amber-100 text-amber-800',
    VERIFIED: 'bg-emerald-100 text-emerald-800',
    LOCKED: 'bg-slate-200 text-slate-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default function HistoricalMarketingIntelligence() {
  const [viewMode, setViewMode] = useState('data');
  const [institutions, setInstitutions] = useState([]);
  const [institutionId, setInstitutionId] = useState('');
  const [records, setRecords] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [dashboard, setDashboard] = useState(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [previewRows, setPreviewRows] = useState([]);
  const [importInstitutionId, setImportInstitutionId] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [photoPreviewRows, setPhotoPreviewRows] = useState([]);
  const [photoInstitutionId, setPhotoInstitutionId] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);

  useEffect(() => {
    historicalMarketingAPI.getOptions().then((r) => {
      const list = r.data?.data?.institutions || [];
      setInstitutions(list);
      if (list.length && !institutionId) setInstitutionId(list[0].id);
    }).catch(() => {});
  }, []);

  const fetchRecords = () => {
    setLoading(true);
    const params = { page, limit: 20 };
    if (institutionId) params.institutionId = institutionId;
    historicalMarketingAPI.getList(params)
      .then((r) => {
        setRecords(r.data?.data?.list || []);
        setTotalPages(r.data?.data?.totalPages || 1);
      })
      .catch(() => toast.error('Failed to load records'))
      .finally(() => setLoading(false));
  };

  const fetchAnalytics = () => {
    const params = {};
    if (institutionId) params.institutionId = institutionId;
    Promise.all([
      historicalMarketingAPI.getTrends(params),
      historicalMarketingAPI.getRecommendations(params),
      historicalMarketingAPI.getDashboard(params),
    ])
      .then(([tr, rec, dash]) => {
        setTrends(tr.data?.data || null);
        setRecommendations(rec.data?.data?.recommendations || []);
        setDashboard(dash.data?.data || null);
      })
      .catch(() => toast.error('Failed to load analytics'));
  };

  useEffect(() => {
    fetchRecords();
  }, [institutionId, page]);

  useEffect(() => {
    if (viewMode === 'analytics') fetchAnalytics();
  }, [viewMode, institutionId]);

  const handleDownloadTemplate = () => {
    historicalMarketingAPI.getTemplate().then((r) => {
      const blob = new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'historical_marketing_template.xlsx';
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Template downloaded');
    }).catch(() => toast.error('Failed to download template'));
  };

  const handleImportFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setImportFile(f);
  };

  const handleImportPreview = () => {
    if (!importInstitutionId || !importFile) {
      toast.error('Select institution and file');
      return;
    }
    setImporting(true);
    const fd = new FormData();
    fd.append('file', importFile);
    fd.append('institutionId', importInstitutionId);
    historicalMarketingAPI.importPreview(fd)
      .then((r) => {
        setPreviewRows(r.data?.data?.rows || []);
        setImportStep(2);
        if (r.data?.data?.errors?.length) {
          toast.error(r.data.data.errors.map((e) => e.message || e).join('; '));
        }
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Import preview failed'))
      .finally(() => setImporting(false));
  };

  const handleImportExecute = () => {
    const valid = previewRows.filter((r) => r.academicYear && r.courseName && (!r._errors || !r._errors.length));
    if (!valid.length) {
      toast.error('No valid rows to import');
      return;
    }
    setImporting(true);
    historicalMarketingAPI.importExecute({
      institutionId: importInstitutionId,
      rows: valid.map((r) => ({
        academicYear: r.academicYear,
        courseName: r.courseName,
        totalInquiries: r.totalInquiries,
        totalApplications: r.totalApplications,
        confirmedAdmissions: r.confirmedAdmissions,
        maleCount: r.maleCount,
        femaleCount: r.femaleCount,
        zipCode: r.zipCode,
        marketingChannel: r.marketingChannel,
        marketingSpend: r.marketingSpend,
        leadsGenerated: r.leadsGenerated,
        admissionsFromCampaign: r.admissionsFromCampaign,
      })),
    })
      .then(() => {
        toast.success(`Imported ${valid.length} records`);
        setShowImportModal(false);
        setImportStep(1);
        setPreviewRows([]);
        setImportFile(null);
        fetchRecords();
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Import failed'))
      .finally(() => setImporting(false));
  };

  const handlePhotoFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setPhotoFile(f);
  };

  const handlePhotoOcr = () => {
    if (!photoInstitutionId || !photoFile) {
      toast.error('Select institution and image');
      return;
    }
    setPhotoLoading(true);
    const fd = new FormData();
    fd.append('file', photoFile);
    fd.append('institutionId', photoInstitutionId);
    historicalMarketingAPI.photoOcrPreview(fd)
      .then((r) => {
        const rows = r.data?.data?.rows || [];
        setPhotoPreviewRows(rows.map((row) => ({
          ...row,
          academicYear: row.academicYear || '',
          courseName: row.courseName || (row.parts?.[0] || '').trim(),
          totalInquiries: row.totalInquiries ?? (row.numbers?.[0] || 0),
          totalApplications: row.totalApplications ?? (row.numbers?.[1] || 0),
          confirmedAdmissions: row.confirmedAdmissions ?? (row.numbers?.[2] || 0),
          maleCount: row.maleCount ?? (row.numbers?.[3] || 0),
          femaleCount: row.femaleCount ?? (row.numbers?.[4] || 0),
          zipCode: row.zipCode || '',
        })));
      })
      .catch((err) => {
        if (err.response?.data?.fallback) {
          toast.error('OCR not available. Install tesseract.js on backend, or use Excel import.');
        } else {
          toast.error(err.response?.data?.message || 'OCR failed');
        }
      })
      .finally(() => setPhotoLoading(false));
  };

  const handlePhotoSave = () => {
    const valid = photoPreviewRows.filter(
      (r) => (r.academicYear || r.courseName) && (r.totalInquiries != null || r.confirmedAdmissions != null)
    );
    if (!valid.length) {
      toast.error('Add at least one valid row');
      return;
    }
    setPhotoLoading(true);
    historicalMarketingAPI.photoOcrSave({
      institutionId: photoInstitutionId,
      rows: valid.map((r) => ({
        academicYear: r.academicYear || new Date().getFullYear() + '-' + String((new Date().getFullYear() + 1) % 100).padStart(2, '0'),
        courseName: r.courseName || 'Unknown',
        totalInquiries: r.totalInquiries || 0,
        totalApplications: r.totalApplications || 0,
        confirmedAdmissions: r.confirmedAdmissions || 0,
        maleCount: r.maleCount || 0,
        femaleCount: r.femaleCount || 0,
        zipCode: r.zipCode || null,
      })),
    })
      .then(() => {
        toast.success(`Saved ${valid.length} records`);
        setShowPhotoModal(false);
        setPhotoPreviewRows([]);
        setPhotoFile(null);
        fetchRecords();
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Save failed'))
      .finally(() => setPhotoLoading(false));
  };

  const handleExportExcel = () => {
    const params = {};
    if (institutionId) params.institutionId = institutionId;
    historicalMarketingAPI.exportExcel(params).then((r) => {
      const blob = new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `historical_marketing_${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Excel exported');
    }).catch(() => toast.error('Export failed'));
  };

  const handleExportPdf = () => {
    const params = {};
    if (institutionId) params.institutionId = institutionId;
    historicalMarketingAPI.exportPdf(params).then((r) => {
      const blob = new Blob([r.data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success('Report opened. Use Print → Save as PDF to download.');
    }).catch(() => toast.error('Export failed'));
  };

  const handleStatusChange = (id, status) => {
    historicalMarketingAPI.updateStatus(id, status)
      .then(() => {
        toast.success('Status updated');
        fetchRecords();
      })
      .catch(() => toast.error('Update failed'));
  };

  const toggleRow = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900">Historical Marketing Intelligence</h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={institutionId}
            onChange={(e) => setInstitutionId(e.target.value)}
            className="input-field py-2 text-sm w-48"
          >
            <option value="">All institutions</option>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setViewMode('data')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${viewMode === 'data' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Data
            </button>
            <button
              type="button"
              onClick={() => setViewMode('analytics')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${viewMode === 'analytics' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Analytics
            </button>
          </div>
          <button onClick={() => setShowImportModal(true)} className="btn-primary text-sm py-2">
            Import Excel
          </button>
          <button onClick={() => setShowPhotoModal(true)} className="btn-secondary text-sm py-2">
            Upload Register Photo
          </button>
          <button onClick={handleDownloadTemplate} className="btn-secondary text-sm py-2">
            Download Template
          </button>
          <button onClick={handleExportExcel} className="btn-secondary text-sm py-2">
            Export Excel
          </button>
          <button onClick={handleExportPdf} className="btn-secondary text-sm py-2">
            PDF Report
          </button>
        </div>
      </div>

      {viewMode === 'data' && (
        <div className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
            </div>
          ) : records.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="mb-4">No historical marketing records yet.</p>
              <p className="text-sm">Import Excel data or upload a register photo to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Year</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Course</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Inquiries</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Admissions</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Zip</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((r) => (
                    <>
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{r.academicYear}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{r.courseName}</td>
                        <td className="px-4 py-3 text-sm text-right">{r.totalInquiries}</td>
                        <td className="px-4 py-3 text-sm text-right">{r.confirmedAdmissions}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{r.zipCode || '—'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3">
                          {r.status !== 'LOCKED' && (
                            <select
                              value={r.status}
                              onChange={(e) => handleStatusChange(r.id, e.target.value)}
                              className="text-xs border border-gray-200 rounded px-2 py-1"
                            >
                              <option value="DRAFT">Draft</option>
                              <option value="VERIFIED">Verified</option>
                              <option value="LOCKED">Lock</option>
                            </select>
                          )}
                        </td>
                      </tr>
                      {expandedRows.has(r.id) && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-4 py-2 text-xs text-gray-600">
                            Male: {r.maleCount} | Female: {r.femaleCount} | Channel: {r.marketingChannel || '—'} | Spend: {r.marketingSpend ?? '—'} | Leads: {r.leadsGenerated ?? '—'}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 py-4 border-t border-gray-100">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
              >
                Prev
              </button>
              <span className="py-1 text-sm text-gray-600">Page {page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {viewMode === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {dashboard?.topGrowingCourse && (
              <div className="card p-4">
                <p className="text-xs font-medium text-gray-500 uppercase">Top Course (Inquiries)</p>
                <p className="text-lg font-bold text-primary-600">{dashboard.topGrowingCourse.name}</p>
                <p className="text-sm text-gray-600">{dashboard.topGrowingCourse.inquiries} inquiries</p>
              </div>
            )}
            {dashboard?.highestInquiryZip && (
              <div className="card p-4">
                <p className="text-xs font-medium text-gray-500 uppercase">Top Zip Code</p>
                <p className="text-lg font-bold text-primary-600">{dashboard.highestInquiryZip.zip}</p>
                <p className="text-sm text-gray-600">{dashboard.highestInquiryZip.inquiries} inquiries</p>
              </div>
            )}
            {trends?.cagrInquiry != null && (
              <div className="card p-4">
                <p className="text-xs font-medium text-gray-500 uppercase">Inquiry CAGR (%)</p>
                <p className="text-lg font-bold text-emerald-600">{trends.cagrInquiry}%</p>
              </div>
            )}
            {trends?.cagrAdmission != null && (
              <div className="card p-4">
                <p className="text-xs font-medium text-gray-500 uppercase">Admission CAGR (%)</p>
                <p className="text-lg font-bold text-emerald-600">{trends.cagrAdmission}%</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">5-Year Admission Trend</h3>
              {(trends?.yearTrends?.length || dashboard?.yearTrend?.length) ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends?.yearTrends || dashboard?.yearTrend} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="admissions" stroke="#6366f1" strokeWidth={2} name="Admissions" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-500 py-12 text-center text-sm">No trend data. Add verified records.</p>
              )}
            </div>
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Comparison</h3>
              {trends?.courseTrends?.length ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trends.courseTrends.slice(0, 8)} layout="vertical" margin={{ top: 8, right: 24, left: 100, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="inquiries" name="Inquiries" fill="#0d9488" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-500 py-12 text-center text-sm">No course data.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Marketing Recommendations</h3>
            {recommendations.length > 0 ? (
              <ul className="space-y-2">
                {recommendations.map((rec, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="text-primary-500 mt-0.5">•</span>
                    <span className="text-gray-700">{rec.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 py-8 text-center text-sm">No recommendations yet. Add more verified data.</p>
            )}
          </div>

          {trends?.zipTrends?.length > 0 && (
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Zip Code Performance</h3>
              <div className="flex flex-wrap gap-2">
                {trends.zipTrends.slice(0, 15).map((z) => (
                  <span
                    key={z.zip}
                    className="px-3 py-1.5 rounded-lg bg-primary-50 text-primary-800 text-sm font-medium"
                    title={`${z.inquiries} inquiries, ${z.admissions} admissions`}
                  >
                    {z.zip}: {z.inquiries}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Excel Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Import Excel / CSV</h3>
              <button onClick={() => { setShowImportModal(false); setImportStep(1); setPreviewRows([]); }} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {importStep === 1 ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
                    <select
                      value={importInstitutionId}
                      onChange={(e) => setImportInstitutionId(e.target.value)}
                      className="input-field"
                    >
                      <option value="">Select...</option>
                      {institutions.map((i) => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">File (.xlsx, .csv)</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleImportFileChange}
                      className="block w-full text-sm"
                    />
                    {importFile && <p className="mt-1 text-sm text-gray-500">{importFile.name}</p>}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Preview ({previewRows.length} rows). Rows with errors are highlighted.</p>
                  <div className="overflow-x-auto max-h-64 border border-gray-200 rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left">Year</th>
                          <th className="px-2 py-1 text-left">Course</th>
                          <th className="px-2 py-1 text-right">Inq</th>
                          <th className="px-2 py-1 text-right">Adm</th>
                          <th className="px-2 py-1 text-left">Errors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 50).map((r, i) => (
                          <tr key={i} className={r._errors?.length ? 'bg-red-50' : ''}>
                            <td className="px-2 py-1">{r.academicYear}</td>
                            <td className="px-2 py-1">{r.courseName}</td>
                            <td className="px-2 py-1 text-right">{r.totalInquiries}</td>
                            <td className="px-2 py-1 text-right">{r.confirmedAdmissions}</td>
                            <td className="px-2 py-1 text-red-600 text-xs">{r._errors?.join(', ') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewRows.length > 50 && <p className="text-xs text-gray-500">Showing first 50 of {previewRows.length}</p>}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              {importStep === 1 ? (
                <>
                  <button onClick={() => setShowImportModal(false)} className="btn-secondary">Cancel</button>
                  <button onClick={handleImportPreview} disabled={importing} className="btn-primary">
                    {importing ? 'Loading...' : 'Preview'}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setImportStep(1)} className="btn-secondary">Back</button>
                  <button onClick={handleImportExecute} disabled={importing} className="btn-primary">
                    {importing ? 'Importing...' : `Import ${previewRows.filter((r) => !r._errors?.length).length} Valid Rows`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photo OCR Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Upload Register Photo (OCR)</h3>
              <button onClick={() => { setShowPhotoModal(false); setPhotoPreviewRows([]); }} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <div className="p-4 overflow-auto flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
                <select
                  value={photoInstitutionId}
                  onChange={(e) => setPhotoInstitutionId(e.target.value)}
                  className="input-field"
                >
                  <option value="">Select...</option>
                  {institutions.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image (JPG/PNG)</label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={handlePhotoFileChange}
                  className="block w-full text-sm"
                />
                {photoFile && <p className="mt-1 text-sm text-gray-500">{photoFile.name}</p>}
              </div>
              {photoPreviewRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Review and edit extracted data before saving.</p>
                  <div className="overflow-x-auto max-h-48 border border-gray-200 rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-2 py-1 text-left">Year</th>
                          <th className="px-2 py-1 text-left">Course</th>
                          <th className="px-2 py-1 text-right">Inq</th>
                          <th className="px-2 py-1 text-right">Adm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {photoPreviewRows.map((r, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1">
                              <input
                                value={r.academicYear || ''}
                                onChange={(e) => {
                                  const next = [...photoPreviewRows];
                                  next[i] = { ...next[i], academicYear: e.target.value };
                                  setPhotoPreviewRows(next);
                                }}
                                className="w-24 border rounded px-1 py-0.5 text-xs"
                                placeholder="2023-24"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                value={r.courseName || ''}
                                onChange={(e) => {
                                  const next = [...photoPreviewRows];
                                  next[i] = { ...next[i], courseName: e.target.value };
                                  setPhotoPreviewRows(next);
                                }}
                                className="w-32 border rounded px-1 py-0.5 text-xs"
                                placeholder="Course"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                value={r.totalInquiries ?? ''}
                                onChange={(e) => {
                                  const next = [...photoPreviewRows];
                                  next[i] = { ...next[i], totalInquiries: parseInt(e.target.value, 10) || 0 };
                                  setPhotoPreviewRows(next);
                                }}
                                className="w-16 border rounded px-1 py-0.5 text-xs text-right"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                value={r.confirmedAdmissions ?? ''}
                                onChange={(e) => {
                                  const next = [...photoPreviewRows];
                                  next[i] = { ...next[i], confirmedAdmissions: parseInt(e.target.value, 10) || 0 };
                                  setPhotoPreviewRows(next);
                                }}
                                className="w-16 border rounded px-1 py-0.5 text-xs text-right"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowPhotoModal(false)} className="btn-secondary">Cancel</button>
              {photoPreviewRows.length === 0 ? (
                <button onClick={handlePhotoOcr} disabled={photoLoading} className="btn-primary">
                  {photoLoading ? 'Extracting...' : 'Extract from Image'}
                </button>
              ) : (
                <button onClick={handlePhotoSave} disabled={photoLoading} className="btn-primary">
                  {photoLoading ? 'Saving...' : 'Save to Database'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

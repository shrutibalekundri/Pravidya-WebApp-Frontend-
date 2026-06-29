import { useState, useEffect } from 'react';
import { institutionAPI, historicalVerificationAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const DATA_TYPES = [
  { value: 'admissions', label: 'Admissions' },
  { value: 'leads', label: 'Leads' },
  { value: 'fees', label: 'Fees' },
  { value: 'feedback', label: 'Feedback' },
];

function generateAcademicYears() {
  const years = [];
  const current = new Date().getFullYear();
  for (let y = current; y >= current - 10; y--) {
    years.push(`${y}-${String(y + 1).slice(-2)}`);
  }
  return years;
}

const ACADEMIC_YEARS = generateAcademicYears();

export default function HistoricalDataVerification() {
  const [institutions, setInstitutions] = useState([]);
  const [uploads, setUploads] = useState({ pending: [], verified: [], rejected: [] });
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewModal, setViewModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);

  // Form state
  const [form, setForm] = useState({
    institutionId: '',
    academicYear: '',
    dataType: 'admissions',
    description: '',
    file: null,
  });
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    Promise.all([
      institutionAPI.getAll({ limit: 500 }),
      historicalVerificationAPI.getPending(),
      historicalVerificationAPI.getAll({ status: 'VERIFIED' }),
      historicalVerificationAPI.getAll({ status: 'REJECTED' }),
    ])
      .then(([instRes, pendRes, verRes, rejRes]) => {
        setInstitutions(instRes.data?.data?.institutions || instRes.data?.institutions || []);
        setUploads({
          pending: pendRes.data?.data || [],
          verified: verRes.data?.data || [],
          rejected: rejRes.data?.data || [],
        });
      })
      .catch((e) => toast.error(e.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const refreshUploads = () => {
    Promise.all([
      historicalVerificationAPI.getPending(),
      historicalVerificationAPI.getAll({ status: 'VERIFIED' }),
      historicalVerificationAPI.getAll({ status: 'REJECTED' }),
    ]).then(([pendRes, verRes, rejRes]) => {
      setUploads({
        pending: pendRes.data?.data || [],
        verified: verRes.data?.data || [],
        rejected: rejRes.data?.data || [],
      });
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.institutionId || !form.academicYear || !form.file) {
      toast.error('Institution, Academic Year, and File are required');
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append('institutionId', form.institutionId);
    fd.append('academicYear', form.academicYear);
    fd.append('dataType', form.dataType);
    if (form.description) fd.append('description', form.description);
    fd.append('file', form.file);

    try {
      const res = await historicalVerificationAPI.upload(fd);
      toast.success('Upload successful. Status: Pending verification.');
      setForm({ institutionId: '', academicYear: '', dataType: 'admissions', description: '', file: null });
      setPreview(null);
      refreshUploads();
      if (res.data?.data?.parseError) toast(res.data.data.parseError, { icon: '⚠️' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await historicalVerificationAPI.approve(id);
      toast.success('Upload approved');
      setViewModal(null);
      refreshUploads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approve failed');
    }
  };

  const handleReject = async (id, reason) => {
    try {
      await historicalVerificationAPI.reject(id, reason);
      toast.success('Upload rejected');
      setRejectModal(null);
      refreshUploads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reject failed');
    }
  };

  const openView = (id) => {
    historicalVerificationAPI.getById(id).then((res) => setViewModal(res.data?.data)).catch(() => toast.error('Failed to load'));
  };

  const list = uploads[activeTab] || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Historical Data & Verification</h1>

      {/* Upload Form */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Upload Historical Data</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
            <select
              value={form.institutionId}
              onChange={(e) => setForm((f) => ({ ...f, institutionId: e.target.value }))}
              className="w-full rounded-lg border-gray-200"
              required
            >
              <option value="">Select institution</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
            <select
              value={form.academicYear}
              onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))}
              className="w-full rounded-lg border-gray-200"
              required
            >
              <option value="">Select year</option>
              {ACADEMIC_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Type</label>
            <select
              value={form.dataType}
              onChange={(e) => setForm((f) => ({ ...f, dataType: e.target.value }))}
              className="w-full rounded-lg border-gray-200"
            >
              {DATA_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File (.xlsx, .csv, .pdf, .docx)</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,.docx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setForm((prev) => ({ ...prev, file: f || null }));
                setPreview(null);
              }}
              className="w-full rounded-lg border-gray-200 text-sm"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border-gray-200"
              placeholder="Brief description of the data"
            />
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={uploading} className="btn-primary">
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </section>

      {/* Verification Section */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Verification</h2>
        <div className="flex gap-2 border-b border-gray-200 mb-4">
          {['pending', 'verified', 'rejected'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium capitalize ${
                activeTab === tab ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : list.length === 0 ? (
          <p className="text-gray-500">No {activeTab} uploads</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Institution</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Year</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Type</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Records</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Uploaded</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-sm">{u.institution?.name || '—'}</td>
                    <td className="px-4 py-2 text-sm">{u.academicYear}</td>
                    <td className="px-4 py-2 text-sm capitalize">{u.dataType}</td>
                    <td className="px-4 py-2 text-sm">{u._count?.records ?? 0}</td>
                    <td className="px-4 py-2 text-sm">{u.uploadedAt ? format(new Date(u.uploadedAt), 'PP') : '—'}</td>
                    <td className="px-4 py-2">
                      <button onClick={() => openView(u.id)} className="text-primary-600 hover:underline text-sm mr-2">
                        View
                      </button>
                      {activeTab === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(u.id)} className="text-green-600 hover:underline text-sm mr-2">
                            Approve
                          </button>
                          <button onClick={() => setRejectModal({ id: u.id, name: u.institution?.name })} className="text-red-600 hover:underline text-sm">
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* View Modal */}
      {viewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewModal(null)}>
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Upload Details</h3>
            <p className="text-sm text-gray-600">
              {viewModal.institution?.name} · {viewModal.academicYear} · {viewModal.dataType}
            </p>
            {viewModal.description && <p className="text-sm text-gray-700 mt-1">{viewModal.description}</p>}
            <p className="text-sm text-gray-500 mt-1">Records: {viewModal.records?.length ?? 0} (showing first 100)</p>
            <div className="mt-4 overflow-x-auto max-h-64 border rounded-lg">
              <table className="min-w-full text-sm">
                <thead>
                  {viewModal.records?.[0] && (
                    <tr className="bg-gray-50">
                      {Object.keys(viewModal.records[0].recordData || {}).map((k) => (
                        <th key={k} className="px-3 py-2 text-left font-medium">
                          {k}
                        </th>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {(viewModal.records || []).slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t">
                      {Object.values(r.recordData || {}).map((v, j) => (
                        <td key={j} className="px-3 py-2">
                          {String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {viewModal.status === 'PENDING' && (
              <div className="mt-4 flex gap-2">
                <button onClick={() => handleApprove(viewModal.id)} className="btn-primary">
                  Approve
                </button>
                <button onClick={() => setRejectModal({ id: viewModal.id })} className="btn-secondary">
                  Reject
                </button>
              </div>
            )}
            <button onClick={() => setViewModal(null)} className="mt-4 text-gray-600 hover:text-gray-900">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Reject Upload</h3>
            <p className="text-sm text-gray-600 mb-3">Provide a reason for rejection (optional)</p>
            <textarea
              id="reject-reason"
              rows={3}
              className="w-full rounded-lg border-gray-200 mb-4"
              placeholder="e.g. Invalid data format, duplicate upload"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const reason = document.getElementById('reject-reason')?.value || '';
                  handleReject(rejectModal.id, reason);
                }}
                className="btn-secondary bg-red-50 text-red-700 hover:bg-red-100"
              >
                Reject
              </button>
              <button onClick={() => setRejectModal(null)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

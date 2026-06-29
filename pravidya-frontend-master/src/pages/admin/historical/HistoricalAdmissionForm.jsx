import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { historicalAdmissionAPI } from '../../../services/api';
import toast from 'react-hot-toast';

export default function HistoricalAdmissionForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [options, setOptions] = useState({ institutions: [], courses: [], academicYears: [] });
  const [loading, setLoading] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(isEdit);
  const [form, setForm] = useState({
    institutionId: '',
    courseId: '',
    academicYear: '',
    category: 'Admissions',
    status: 'DRAFT',
    title: '',
    description: '',
    applicationData: null,
    marketingData: null,
  });

  useEffect(() => {
    historicalAdmissionAPI.getOptions().then((r) => {
      const data = r.data?.data || {};
      setOptions({
        institutions: data.institutions || [],
        courses: data.courses || [],
        academicYears: data.academicYears || [],
      });
    }).catch(() => toast.error('Failed to load options'));
  }, []);

  useEffect(() => {
    if (isEdit && id) {
      historicalAdmissionAPI.getById(id).then((r) => {
        const d = r.data?.data;
        if (d) {
          setForm({
            institutionId: d.institutionId || '',
            courseId: d.courseId || '',
            academicYear: d.academicYear || '',
            category: d.category || 'Admissions',
            status: d.status || 'DRAFT',
            title: d.title || '',
            description: d.description || '',
            applicationData: d.applicationData,
            marketingData: d.marketingData,
          });
        }
      }).catch(() => toast.error('Failed to load entry')).finally(() => setLoadingRecord(false));
    }
  }, [isEdit, id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.institutionId || !form.academicYear || !form.category) {
      toast.error('Institution, Academic Year, and Category are required.');
      return;
    }
    setLoading(true);
    const payload = {
      institutionId: form.institutionId,
      courseId: form.courseId || null,
      academicYear: form.academicYear,
      category: form.category,
      status: form.status,
      title: form.title || null,
      description: form.description || null,
      applicationData: form.applicationData && typeof form.applicationData === 'object' ? form.applicationData : null,
      marketingData: form.marketingData && typeof form.marketingData === 'object' ? form.marketingData : null,
    };
    if (isEdit) {
      historicalAdmissionAPI.update(id, payload).then(() => {
        toast.success('Entry updated');
        navigate('/admin/historical-admissions/entries');
      }).catch((e) => toast.error(e.response?.data?.message || 'Update failed')).finally(() => setLoading(false));
    } else {
      historicalAdmissionAPI.create(payload).then(() => {
        toast.success('Entry created (Draft)');
        navigate('/admin/historical-admissions/entries');
      }).catch((e) => toast.error(e.response?.data?.message || 'Create failed')).finally(() => setLoading(false));
    }
  };

  const coursesForInstitution = options.courses.filter((c) => c.institutionId === form.institutionId);

  if (loadingRecord && isEdit) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">{isEdit ? 'Edit Entry' : 'Add Entry'}</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Institution *</label>
            <select
              value={form.institutionId}
              onChange={(e) => setForm((f) => ({ ...f, institutionId: e.target.value, courseId: '' }))}
              className="input-field w-full"
              required
            >
              <option value="">Select institution</option>
              {options.institutions.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select
              value={form.courseId}
              onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}
              className="input-field w-full"
            >
              <option value="">Select course (optional)</option>
              {coursesForInstitution.map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.code ? `(${c.code})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year *</label>
            <input
              type="text"
              value={form.academicYear}
              onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))}
              className="input-field w-full"
              placeholder="e.g. 2024-25"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="Admissions">Admissions</option>
              <option value="Marketing">Marketing</option>
              <option value="Publicity">Publicity</option>
            </select>
          </div>
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="input-field w-full"
              >
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="VERIFIED">Verified</option>
                <option value="LOCKED">Locked</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="input-field w-full"
              placeholder="Optional title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="input-field w-full min-h-[80px]"
              placeholder="Optional description"
              rows={3}
            />
          </div>
        </div>

        {form.category === 'Admissions' && (
          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-800 mb-2">Admission data (optional)</h3>
            <p className="text-xs text-gray-500 mb-2">Stored as JSON for seats, cutoffs, etc.</p>
            <textarea
              value={typeof form.applicationData === 'object' ? JSON.stringify(form.applicationData, null, 2) : (form.applicationData || '{}')}
              onChange={(e) => {
                try {
                  const v = JSON.parse(e.target.value || '{}');
                  setForm((f) => ({ ...f, applicationData: v }));
                } catch {
                  setForm((f) => ({ ...f, applicationData: null }));
                }
              }}
              className="input-field w-full font-mono text-sm min-h-[120px]"
              placeholder='{"seats": 60, "cutoff": "..."}'
              rows={5}
            />
          </div>
        )}

        {(form.category === 'Marketing' || form.category === 'Publicity') && (
          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-800 mb-2">Marketing / Publicity data (optional)</h3>
            <p className="text-xs text-gray-500 mb-2">Stored as JSON for campaign, channels, etc.</p>
            <textarea
              value={typeof form.marketingData === 'object' ? JSON.stringify(form.marketingData, null, 2) : (form.marketingData || '{}')}
              onChange={(e) => {
                try {
                  const v = JSON.parse(e.target.value || '{}');
                  setForm((f) => ({ ...f, marketingData: v }));
                } catch {
                  setForm((f) => ({ ...f, marketingData: null }));
                }
              }}
              className="input-field w-full font-mono text-sm min-h-[120px]"
              placeholder='{"campaign": "...", "channels": []}'
              rows={5}
            />
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={loading} className="btn-primary py-2 px-6">
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Save as Draft'}
          </button>
          <button type="button" onClick={() => navigate('/admin/historical-admissions/entries')} className="btn-secondary py-2 px-6">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { superAdminAPI } from '../../services/api';
import toast from 'react-hot-toast';

const EXPERTISE_OPTIONS = [
  'Academic Counseling',
  'Career Guidance',
  'Admissions Support',
  'Parent Counseling',
  'International Admissions',
  'Financial Aid Guidance',
  'Other',
];

const LANGUAGE_OPTIONS = [
  'English',
  'Hindi',
  'Kannada',
  'Marathi',
  'Tamil',
  'Telugu',
  'Other',
];

const CreateStaffModal = ({ onClose, onCreated, institutionId, institutions, isPlatform }) => {
  const [role, setRole] = useState('COUNSELOR');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    mobile: '',
    expertise: [],
    languages: [],
    availability: 'ACTIVE',
    maxCapacity: 50,
    schoolId: '',
    institutionId: institutionId || '',
  });
  const [settings, setSettings] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    superAdminAPI.getStaffSettings().then((res) => {
      setSettings(res.data?.data);
    }).catch(() => {});
  }, []);

  const isFieldVisible = (key) => {
    const cfg = settings?.counselorFields || {};
    return cfg[key] !== false;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const toggleMulti = (field, option) => {
    setFormData((prev) => {
      const arr = prev[field] || [];
      const set = new Set(arr);
      if (set.has(option)) set.delete(option);
      else set.add(option);
      return { ...prev, [field]: Array.from(set) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username?.trim() || !formData.email?.trim() || !formData.password) {
      toast.error('Username, email and password are required');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (isPlatform && !formData.institutionId) {
      toast.error('Please select an institution');
      return;
    }
    if (!isPlatform && institutionId) {
      formData.institutionId = institutionId;
    }
    setSubmitting(true);
    try {
      const payload = {
        role,
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
      };
      if (isPlatform) payload.institutionId = formData.institutionId;
      if (role === 'COUNSELOR') {
        if (isFieldVisible('fullName')) payload.fullName = formData.fullName?.trim();
        if (isFieldVisible('mobile')) payload.mobile = formData.mobile?.trim();
        if (isFieldVisible('expertise')) payload.expertise = formData.expertise || [];
        if (isFieldVisible('languages')) payload.languages = formData.languages || [];
        payload.availability = formData.availability || 'ACTIVE';
        payload.maxCapacity = parseInt(formData.maxCapacity, 10) || 50;
        if (formData.schoolId) payload.schoolId = formData.schoolId;
      }
      await superAdminAPI.createStaff(payload);
      toast.success(`${role} created successfully`);
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create staff');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Create Staff</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isPlatform && institutions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Institution *</label>
              <select
                name="institutionId"
                value={formData.institutionId}
                onChange={handleChange}
                className="input-field w-full"
                required
              >
                <option value="">Select institution</option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="input-field w-full"
            >
              <option value="ADMIN">Admin</option>
              <option value="COUNSELOR">Counselor</option>
              <option value="MANAGEMENT">Management</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username *</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="input-field w-full"
              minLength={6}
              required
            />
          </div>
          {role === 'COUNSELOR' && (
            <>
              {isFieldVisible('fullName') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
              )}
              {isFieldVisible('mobile') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
                  <input
                    type="text"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
              )}
              {isFieldVisible('expertise') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expertise</label>
                  <div className="flex flex-wrap gap-2">
                    {EXPERTISE_OPTIONS.map((opt) => (
                      <label key={opt} className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={formData.expertise?.includes(opt)}
                          onChange={() => toggleMulti('expertise', opt)}
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {isFieldVisible('languages') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Languages</label>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGE_OPTIONS.map((opt) => (
                      <label key={opt} className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={formData.languages?.includes(opt)}
                          onChange={() => toggleMulti('languages', opt)}
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateStaffModal;

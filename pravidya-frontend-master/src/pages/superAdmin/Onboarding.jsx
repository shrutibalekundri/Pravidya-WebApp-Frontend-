import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { isPlatformScopeJitofyId, superAdminOnboardingPath } from '../../constants/institutionIds';
import { superAdminAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Building2,
  Palette,
  MapPin,
  Settings,
  UserPlus,
  FileCheck,
} from 'lucide-react';

const MAX_LOGO_SIZE = 256;
const MAX_LOGO_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_LOGO_FILE_SIZE_LABEL = '2 MB';

const STEPS = [
  { id: 1, title: 'School basic information', short: 'Basic info', Icon: Building2 },
  { id: 2, title: 'School branding', short: 'Branding', Icon: Palette },
  { id: 3, title: 'Location & contact', short: 'Location', Icon: MapPin },
  { id: 4, title: 'Platform configuration', short: 'Configuration', Icon: Settings },
  { id: 5, title: 'School admin account', short: 'Admin account', Icon: UserPlus },
  { id: 6, title: 'Review & confirm', short: 'Review', Icon: FileCheck },
];

const INITIAL_DATA = {
  jitofyInstitutionId: '',
  name: '',
  type: 'School',
  logoUrl: '',
  address: '',
  city: '',
  state: '',
  contactEmail: '',
  contactPhone: '',
  isActive: true,
  adminUsername: '',
  adminEmail: '',
  adminPassword: '',
};

const SuperAdminOnboarding = () => {
  const { institutionId: institutionIdParam } = useParams();
  const { user } = useAuth();
  const userJitofyId = user?.jitofyInstitutionId;
  const isPlatform = isPlatformScopeJitofyId(userJitofyId);

  // If platform user opens /super-admin/onboarding without ID, redirect to scoped URL
  if (isPlatform && userJitofyId && !institutionIdParam) {
    return <Navigate to={superAdminOnboardingPath(userJitofyId)} replace />;
  }
  const [step, setStep] = useState(1);
  const [data, setData] = useState(INITIAL_DATA);
  const [submitting, setSubmitting] = useState(false);

  const update = (key, value) => setData((prev) => ({ ...prev, [key]: value }));

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    update(name, type === 'checkbox' ? checked : value);
  };

  const handleLogoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, etc.)');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_LOGO_FILE_SIZE_BYTES) {
      toast.error(`Logo is too large. Max ${MAX_LOGO_FILE_SIZE_LABEL}.`);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > MAX_LOGO_SIZE || h > MAX_LOGO_SIZE) {
          if (w > h) {
            h = (h / w) * MAX_LOGO_SIZE;
            w = MAX_LOGO_SIZE;
          } else {
            w = (w / h) * MAX_LOGO_SIZE;
            h = MAX_LOGO_SIZE;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        update('logoUrl', canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => update('logoUrl', dataUrl);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const validateStep = (s) => {
    if (s === 1) {
      if (!data.jitofyInstitutionId?.trim()) return 'Institution ID (Jitofy) is required';
      if (!data.name?.trim()) return 'School name is required';
      return null;
    }
    if (s === 5) {
      if (!data.adminUsername?.trim()) return 'Admin username is required';
      if (!data.adminEmail?.trim()) return 'Admin email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.adminEmail?.trim())) return 'Enter a valid email address';
      if (!data.adminPassword || data.adminPassword.length < 6) return 'Password must be at least 6 characters';
      return null;
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    if (step < 6) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    const err1 = validateStep(1);
    if (err1) {
      toast.error(err1);
      return;
    }
    const err5 = validateStep(5);
    if (err5) {
      toast.error(err5);
      return;
    }
    setSubmitting(true);
    try {
      const institutionPayload = {
        jitofyInstitutionId: data.jitofyInstitutionId.trim(),
        name: data.name.trim(),
        type: 'School',
        address: data.address?.trim() || undefined,
        city: data.city?.trim() || undefined,
        state: data.state?.trim() || undefined,
        isActive: data.isActive,
      };
      if (data.logoUrl?.trim()) institutionPayload.logoUrl = data.logoUrl.trim();
      const customData = {};
      if (data.contactEmail?.trim()) customData.contactEmail = data.contactEmail.trim();
      if (data.contactPhone?.trim()) customData.contactPhone = data.contactPhone.trim();
      if (Object.keys(customData).length > 0) institutionPayload.customData = customData;

      const instRes = await superAdminAPI.createInstitution(institutionPayload);
      const institution = instRes.data?.data?.institution;
      if (!institution?.id) throw new Error('Institution created but no ID returned');

      await superAdminAPI.createStaff({
        role: 'ADMIN',
        username: data.adminUsername.trim(),
        email: data.adminEmail.trim(),
        password: data.adminPassword,
        institutionId: institution.id,
      });

      toast.success(`${data.name} has been onboarded. The admin account is ready to log in.`);
      setData(INITIAL_DATA);
      setStep(1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Onboarding failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isPlatform) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 max-w-xl">
        <h2 className="text-lg font-semibold text-amber-800">Access restricted</h2>
        <p className="text-amber-700 mt-2">
          Only Platform Super Admin can onboard new schools. Contact your administrator.
        </p>
      </div>
    );
  }

  // Context from URL: venam login lands on /super-admin/onboarding/PRV-F-000018
  const routeContextId = institutionIdParam ? decodeURIComponent(institutionIdParam) : null;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Set up a new school</h1>
        <p className="text-slate-600 mt-0.5">
          Complete each step to register the school in Pravidya and create the first admin user.
        </p>
        {routeContextId && (
          <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">Veman onboarding context</span>
              {' — '}Institution ID in route:{' '}
              <span className="font-mono font-medium text-sky-800">{routeContextId}</span>
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Use a <em>new</em> Jitofy Institution ID in Step 1 for each additional school; this URL
              keeps your session tied to Veman Academy (PRV-F-000018).
            </p>
          </div>
        )}
      </div>

      {/* Progress step indicator */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Progress</p>
        <div className="flex flex-wrap items-center gap-2">
          {STEPS.map((s, idx) => {
            const isActive = step === s.id;
            const isPast = step > s.id;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : isPast
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isPast ? <Check className="w-4 h-4" /> : <s.Icon className="w-4 h-4" />}
                  <span className="hidden sm:inline">{s.short}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" aria-hidden />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <h2 className="text-lg font-semibold text-slate-800">
            Step {step}: {STEPS.find((s) => s.id === step)?.title}
          </h2>
        </div>
        <div className="p-6">
          {/* Step 1 — School basic information */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Institution ID (Jitofy) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="jitofyInstitutionId"
                  value={data.jitofyInstitutionId}
                  onChange={handleChange}
                  placeholder="e.g. JITOFY-SCH-001"
                  className="input-field w-full"
                />
                <p className="text-xs text-slate-500 mt-0.5">
                  The single unique ID given for this school. Use it here to onboard the school; the same ID is used when the school logs in (Institution ID + email + password).
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  School name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={data.name}
                  onChange={handleChange}
                  placeholder="e.g. ABC International School"
                  className="input-field w-full"
                />
              </div>
              <p className="text-xs text-slate-500">Type is set to <strong>School</strong> for this flow.</p>
            </div>
          )}

          {/* Step 2 — School branding */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Logo</label>
                <p className="text-xs text-slate-500 mb-2">Upload an image or paste a link. Optional.</p>
                <div className="flex flex-wrap gap-3 items-start">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFile}
                      className="sr-only"
                    />
                    Upload image
                  </label>
                  <span className="text-slate-400 text-sm">or</span>
                  <input
                    type="url"
                    name="logoUrl"
                    value={data.logoUrl?.startsWith('data:') ? '' : (data.logoUrl || '')}
                    onChange={handleChange}
                    placeholder="Paste logo URL"
                    className="input-field flex-1 min-w-[200px]"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Max {MAX_LOGO_FILE_SIZE_LABEL}. Large images are resized.</p>
              </div>
              {data.logoUrl?.trim() && (
                <div className="flex items-center gap-3 mt-2">
                  <img
                    src={data.logoUrl}
                    alt="Logo preview"
                    className="h-16 w-16 object-contain border border-slate-200 rounded-lg bg-slate-50"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <button
                    type="button"
                    onClick={() => update('logoUrl', '')}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remove logo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Location & contact */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  name="address"
                  value={data.address}
                  onChange={handleChange}
                  placeholder="Street, building, block"
                  className="input-field w-full"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    name="city"
                    value={data.city}
                    onChange={handleChange}
                    placeholder="City"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    name="state"
                    value={data.state}
                    onChange={handleChange}
                    placeholder="State"
                    className="input-field w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact email</label>
                  <input
                    type="email"
                    name="contactEmail"
                    value={data.contactEmail}
                    onChange={handleChange}
                    placeholder="school@example.com"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact phone</label>
                  <input
                    type="tel"
                    name="contactPhone"
                    value={data.contactPhone}
                    onChange={handleChange}
                    placeholder="+91 98765 43210"
                    className="input-field w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Platform configuration */}
          {step === 4 && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={data.isActive}
                  onChange={handleChange}
                  className="rounded border-slate-300 text-primary-600"
                />
                <span className="text-sm font-medium text-slate-700">School is active on the platform</span>
              </label>
              <p className="text-xs text-slate-500">
                You can configure boards, standards, and admissions later from the admin panel for this school.
              </p>
            </div>
          )}

          {/* Step 5 — School admin account */}
          {step === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 mb-4">
                Create the first Admin user for this school. They will be able to log in and manage the school.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="adminUsername"
                  value={data.adminUsername}
                  onChange={handleChange}
                  placeholder="e.g. admin@school"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  name="adminEmail"
                  value={data.adminEmail}
                  onChange={handleChange}
                  placeholder="admin@school.example.com"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  name="adminPassword"
                  value={data.adminPassword}
                  onChange={handleChange}
                  placeholder="Min. 6 characters"
                  className="input-field w-full"
                />
              </div>
            </div>
          )}

          {/* Step 6 — Review & confirm */}
          {step === 6 && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="font-medium text-slate-800 mb-2">School</h3>
                  <p><span className="text-slate-500">Name:</span> {data.name || '—'}</p>
                  <p><span className="text-slate-500">Jitofy ID:</span> {data.jitofyInstitutionId || '—'}</p>
                  <p><span className="text-slate-500">Type:</span> School</p>
                  {(data.address || data.city || data.state) && (
                    <p><span className="text-slate-500">Location:</span> {[data.address, data.city, data.state].filter(Boolean).join(', ') || '—'}</p>
                  )}
                  {data.logoUrl && <p><span className="text-slate-500">Logo:</span> Yes</p>}
                  {(data.contactEmail || data.contactPhone) && (
                    <p><span className="text-slate-500">Contact:</span> {[data.contactEmail, data.contactPhone].filter(Boolean).join(' • ') || '—'}</p>
                  )}
                  <p><span className="text-slate-500">Active:</span> {data.isActive ? 'Yes' : 'No'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="font-medium text-slate-800 mb-2">School admin</h3>
                  <p><span className="text-slate-500">Username:</span> {data.adminUsername || '—'}</p>
                  <p><span className="text-slate-500">Email:</span> {data.adminEmail || '—'}</p>
                </div>
              </div>
              <p className="text-slate-600">
                Click &quot;Complete onboarding&quot; to register the school and create the admin account. The admin can log in immediately.
              </p>
            </div>
          )}
        </div>

        {/* Next / Back and submit */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          {step < 6 ? (
            <button
              type="button"
              onClick={goNext}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
            >
              {submitting ? 'Completing…' : 'Complete onboarding'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminOnboarding;

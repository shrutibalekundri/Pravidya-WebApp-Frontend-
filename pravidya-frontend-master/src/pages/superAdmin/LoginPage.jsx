import { useState, useRef } from 'react';
import { superAdminAPI } from '../../services/api';
import { superAdminOnboardingPath } from '../../constants/institutionIds';
import toast from 'react-hot-toast';

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500';

const SuperAdminLoginPage = () => {
  const [formData, setFormData] = useState({
    institutionId: '',
    email: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const submitInProgress = useRef(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitInProgress.current) return;
    if (!formData.institutionId?.trim() || !formData.email?.trim() || !formData.password) {
      toast.error('Please fill all required fields');
      return;
    }
    submitInProgress.current = true;
    setSubmitting(true);
    try {
      const res = await superAdminAPI.login(
        formData.institutionId.trim(),
        formData.email.trim(),
        formData.password
      );
      const data = res.data?.data ?? res.data;
      if (data?.token && data?.user) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        toast.success('Login successful');
        setSubmitting(false);
        submitInProgress.current = false;
        window.location.href = superAdminOnboardingPath(data.user?.jitofyInstitutionId);
        return;
      }
      toast.error('Login failed. Invalid response from server.');
    } catch (err) {
      const msg =
        err.response?.status === 401
          ? err.response?.data?.message ||
            'Invalid Institution ID or credentials. Use the ID and email provided for your school.'
          : err.response?.data?.message ||
            err.message ||
            'Login failed. Check Institution ID, email, and password.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
      submitInProgress.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900 text-center">
          Welcome to <span className="text-sky-600">Pravidya</span>
        </h1>
        <p className="text-center text-sm text-slate-600 -mt-2">Super Admin sign in</p>

        {/* Same visual language as venam license banner */}
        <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 space-y-1">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Portal:</span> Super Admin
          </p>
          <p className="text-sm text-slate-700">
            Use your <span className="font-semibold">Institution ID</span> and the email/password
            provided during onboarding.
          </p>
          <p className="text-sm text-slate-700">
            After sign in you&apos;ll continue to{' '}
            <span className="font-semibold">onboarding</span> and staff management.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700">Institution ID</label>
            <input
              type="text"
              name="institutionId"
              value={formData.institutionId}
              onChange={handleChange}
              placeholder="e.g. JITOFY-SCH-001 or PRV-F-000018"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="superadmin@example.com"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className={inputClass}
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-sky-600 text-white text-sm font-semibold py-2.5 hover:bg-sky-700 disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SuperAdminLoginPage;

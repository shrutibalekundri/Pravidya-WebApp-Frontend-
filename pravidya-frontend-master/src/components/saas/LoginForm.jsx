import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { saasAPI, superAdminAPI } from '../../services/api';
import { superAdminOnboardingPath } from '../../constants/institutionIds';
import toast from 'react-hot-toast';

export default function LoginForm() {
  const { academyId } = useParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Prefer Super Admin session so user lands on onboarding dashboard
      // (Institution ID from URL path, e.g. /venam/PRV-F-000018)
      try {
        const res = await superAdminAPI.login(academyId, email, password);
        const data = res.data?.data ?? res.data;
        if (data?.token && data?.user) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          toast.success('Login successful');
          // Scoped onboarding URL so Veman flow keeps PRV-F-000018 (academyId) in route
          window.location.href = superAdminOnboardingPath(academyId);
          return;
        }
      } catch {
        // Not a super admin for this institution — fall through to SaaS login
      }

      await saasAPI.login({ academyId, email, password });
      toast.success('Login successful');
      // After Jeetofy login, always continue to Pravidya onboarding (first-time setup)
      window.location.href = `/venam/${encodeURIComponent(String(academyId || '').trim())}/onboarding`;
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Login failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
  );
}


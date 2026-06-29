import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { saasAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function OnboardingForm({ license }) {
  const { academyId } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await saasAPI.onboard({
        academyId,
        password,
        address,
        logoUrl: null,
      });
      toast.success('Account created');
      // SaaS dashboard lives under /venam/:academyId/dashboard
      navigate(`/venam/${academyId}/dashboard`);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Onboarding failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="block text-xs font-medium text-slate-600">School Name</label>
        <input
          className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          value={license.schoolName}
          readOnly
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Admin Email</label>
        <input
          className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          value={license.adminEmail}
          readOnly
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600">Create Password</label>
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Confirm Password</label>
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">School Address</label>
        <textarea
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          rows={3}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-sky-600 text-white text-sm font-semibold py-2.5 hover:bg-sky-700 disabled:opacity-60"
      >
        {submitting ? 'Creating account…' : 'Create Account'}
      </button>
    </form>
  );
}


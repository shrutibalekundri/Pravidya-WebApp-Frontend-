import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { saasAPI } from '../../services/api';
import { VEMAN_JITOFY_INSTITUTION_ID } from '../../constants/institutionIds';

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500';

const STEPS = [
  { id: 1, title: 'School details' },
  { id: 2, title: 'Location & contact' },
  { id: 3, title: 'Create admin account' },
  { id: 4, title: 'Review' },
];

export default function VemanOnboarding() {
  const { academyId } = useParams();
  const routeId = useMemo(() => String(academyId || '').trim(), [academyId]);
  const isVeman = routeId.toUpperCase() === VEMAN_JITOFY_INSTITUTION_ID.toUpperCase();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState({
    name: '',
    type: 'School',
    logoUrl: '',
    address: '',
    city: '',
    state: '',
    contactEmail: '',
    contactPhone: '',
    adminUsername: '',
    adminEmail: '',
    adminPassword: '',
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await saasAPI.getPravidyaStatus();
        if (!mounted) return;
        const st = res.data?.data || null;
        setStatus(st);
        // Prefill Jeetofy admin email if backend provides it
        if (st?.jeetofyAdminEmail) {
          setData((p) => ({ ...p, adminEmail: st.jeetofyAdminEmail }));
        }
        // If already onboarded, send them to Pravidya staff portal login
        if (st?.onboarded) {
          // Let UI show a small message then redirect
          toast.success('School already onboarded. Redirecting to login…');
        }
      } catch (e) {
        // Most likely not logged in (saas_token missing) -> go back to venam login
        console.error('Failed to load onboarding status', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (!isVeman) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-xl shadow px-6 py-4 max-w-md text-center space-y-2">
          <p className="text-sm text-slate-700 font-medium">Onboarding not available</p>
          <p className="text-xs text-slate-500">
            This onboarding flow is configured for Veman Academy only. Institution ID in URL:{' '}
            <span className="font-mono">{routeId}</span>
          </p>
        </div>
      </div>
    );
  }

  if (!loading && status?.onboarded) {
    return <Navigate to="/pravidya/acme/veeman/login?role=ADMIN" replace />;
  }

  const set = (key, value) => setData((p) => ({ ...p, [key]: value }));

  const validateStep = (s) => {
    if (s === 1) {
      if (!data.name.trim()) return 'School name is required';
    }
    if (s === 3) {
      if (!data.adminUsername.trim()) return 'Admin username is required';
      if (!data.adminEmail.trim()) return 'Admin email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.adminEmail.trim())) return 'Enter a valid admin email';
      if (!data.adminPassword || data.adminPassword.length < 6) return 'Admin password must be at least 6 characters';
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) return toast.error(err);
    setStep((s) => Math.min(4, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const submit = async () => {
    const err1 = validateStep(1);
    const err3 = validateStep(3);
    if (err1) return toast.error(err1);
    if (err3) return toast.error(err3);

    setSubmitting(true);
    try {
      await saasAPI.onboardPravidya({
        name: data.name.trim(),
        type: 'School',
        logoUrl: data.logoUrl?.trim() || undefined,
        address: data.address?.trim() || undefined,
        city: data.city?.trim() || undefined,
        state: data.state?.trim() || undefined,
        contactEmail: data.contactEmail?.trim() || undefined,
        contactPhone: data.contactPhone?.trim() || undefined,
        adminUsername: data.adminUsername.trim(),
        adminEmail: data.adminEmail.trim(),
        adminPassword: data.adminPassword,
      });
      toast.success('Onboarding complete. Redirecting to login…');
      window.location.href = '/pravidya/acme/veeman/login?role=ADMIN';
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Onboarding failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">
            Onboard <span className="text-sky-600">Veman Academy</span>
          </h1>
          <p className="text-sm text-slate-600">
            Institution ID (Jeetofy): <span className="font-mono">{VEMAN_JITOFY_INSTITUTION_ID}</span>
          </p>
        </div>

        <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3">
          <p className="text-sm text-slate-700">
            Fill the school details once. After completion, your admin can sign in to Pravidya.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STEPS.map((s) => {
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div
                key={s.id}
                className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                  active ? 'bg-sky-600 text-white' : done ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {s.title}
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">School name</label>
              <input className={inputClass} value={data.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Veman Academy" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Logo URL (optional)</label>
              <input className={inputClass} value={data.logoUrl} onChange={(e) => set('logoUrl', e.target.value)} placeholder="https://..." />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Address</label>
              <input className={inputClass} value={data.address} onChange={(e) => set('address', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">City</label>
                <input className={inputClass} value={data.city} onChange={(e) => set('city', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">State</label>
                <input className={inputClass} value={data.state} onChange={(e) => set('state', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Contact email (optional)</label>
                <input type="email" className={inputClass} value={data.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Contact phone (optional)</label>
                <input className={inputClass} value={data.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Admin username</label>
              <input className={inputClass} value={data.adminUsername} onChange={(e) => set('adminUsername', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Admin email</label>
              <input type="email" className={inputClass} value={data.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} />
              {status?.jeetofyAdminEmail && (
                <p className="text-xs text-slate-500 mt-1">
                  Jeetofy provided admin email: <span className="font-mono">{status.jeetofyAdminEmail}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Admin password</label>
              <input type="password" className={inputClass} value={data.adminPassword} onChange={(e) => set('adminPassword', e.target.value)} />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="flex justify-between gap-4"><span className="font-medium">School name</span><span>{data.name || '—'}</span></div>
              <div className="flex justify-between gap-4"><span className="font-medium">City / State</span><span>{(data.city || '—') + ' / ' + (data.state || '—')}</span></div>
              <div className="flex justify-between gap-4"><span className="font-medium">Admin email</span><span>{data.adminEmail || '—'}</span></div>
            </div>
            <p className="text-xs text-slate-500">
              Clicking “Complete onboarding” will create the school in Pravidya using Institution ID <span className="font-mono">{VEMAN_JITOFY_INSTITUTION_ID}</span>.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={back}
            disabled={step === 1 || submitting}
            className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm disabled:opacity-50"
          >
            Back
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={next}
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-60"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-60"
            >
              {submitting ? 'Completing…' : 'Complete onboarding'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


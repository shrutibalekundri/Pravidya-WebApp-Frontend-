import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500';

export default function JeetofyOnboarding() {
  const { academyId } = useParams();
  const id = useMemo(() => decodeURIComponent(String(academyId || '')).trim(), [academyId]);
  const [loading, setLoading] = useState(true);
  const [license, setLicense] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: School, 2: Admin, 3: Counselor, 4: Management, 5: Review

  // STEP 2 — School onboarding (first)
  const [school, setSchool] = useState({
    schoolName: '',
    adminEmail: '',
    logoUrl: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    contactNumber: '',
    website: '',
  });

  // STEP 3 — Admin account creation
  const [admin, setAdmin] = useState({ password: '', confirm: '' });

  // STEP 4 — Primary counselor (match required subset; rest defaults server-side)
  const [counselor, setCounselor] = useState({
    name: '',
    email: '',
    username: '',
    phone: '',
    password: '',
  });

  // STEP 5 — Management
  const [management, setManagement] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/license/${encodeURIComponent(id)}`);
        const json = await res.json();
        const data = json?.data;
        if (!mounted) return;
        if (!res.ok || !data?.academyId) {
          throw new Error(json?.message || 'License not found');
        }
        setLicense(data);
        setSchool((p) => ({
          ...p,
          schoolName: data.schoolName || '',
          adminEmail: data.adminEmail || '',
        }));
      } catch (e) {
        toast.error(e?.message || 'Could not load license');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const validateStep = (s) => {
    if (s === 1) {
      if (!school.address.trim()) return 'School Address is required';
      if (!school.city.trim()) return 'City is required';
      if (!school.state.trim()) return 'State is required';
      if (!school.pincode.trim()) return 'Pincode is required';
      if (!school.contactNumber.trim()) return 'School Contact Number is required';
    } else if (s === 2) {
      if (!admin.password || admin.password.length < 6) return 'Admin password must be at least 6 characters';
      if (admin.password !== admin.confirm) return 'Passwords do not match';
    } else if (s === 3) {
      if (!counselor.name.trim()) return 'Counselor Name is required';
      if (!counselor.email.trim()) return 'Counselor Email is required';
      if (!counselor.username.trim()) return 'Counselor Username is required';
      if (!counselor.password || counselor.password.length < 6) return 'Counselor password must be at least 6 characters';
    } else if (s === 4) {
      if (!management.name.trim()) return 'Management Name is required';
      if (!management.email.trim()) return 'Management Email is required';
      if (!management.username.trim()) return 'Management Username is required';
      if (!management.password || management.password.length < 6) return 'Management password must be at least 6 characters';
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(5, s + 1));
  };

  const goBack = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  const submit = async () => {
    // Validate all steps before final submit
    for (let s = 1; s <= 4; s += 1) {
      const err = validateStep(s);
      if (err) {
        setStep(s);
        toast.error(err);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/onboarding/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // School
          logoUrl: school.logoUrl || undefined,
          schoolAddress: school.address,
          city: school.city,
          state: school.state,
          pincode: school.pincode,
          contactNumber: school.contactNumber,
          website: school.website || undefined,

          // Admin
          adminPassword: admin.password,

          // Counselor
          counselorName: counselor.name,
          counselorEmail: counselor.email,
          counselorUsername: counselor.username,
          counselorPhone: counselor.phone || undefined,
          counselorPassword: counselor.password,

          // Management
          managementName: management.name,
          managementEmail: management.email,
          managementUsername: management.username,
          managementPassword: management.password,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          toast.error('License expired. Please renew your plan.');
          const link = json?.data?.renewalLink;
          if (link) window.open(link, '_blank', 'noopener,noreferrer');
          return;
        }
        // Surface first validation error from backend so user knows what is missing
        const firstErr = Array.isArray(json?.errors) && json.errors.length > 0 ? json.errors[0]?.msg : null;
        throw new Error(firstErr || json?.message || 'Onboarding failed');
      }
      toast.success('Onboarding Completed Successfully.');
      // After onboarding, send admin to the Pravidya staff login/landing page for this academy
      window.location.href = '/pravidya/acme/veeman';
    } catch (e) {
      toast.error(e?.message || 'Onboarding failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  if (!license) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-xl shadow px-6 py-4 text-sm text-slate-700">
          License not found for academy ID: <span className="font-mono">{id}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-8 space-y-8">
        {/* Welcome Banner */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome to <span className="text-sky-600">Pravidya</span>
          </h1>
          <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-left space-y-1">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">School Name:</span> {license.schoolName}
            </p>
            <p className="text-sm text-slate-700">
              <span className="font-semibold">⚠</span> Your plan expires in{' '}
              <span className="font-semibold">{license.daysRemaining}</span> days.
            </p>
            <a
              href={`https://pravidya.jeetofy.com/academy/${encodeURIComponent(id)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex mt-1 text-xs font-medium text-sky-700 hover:text-sky-900"
            >
              Renew Plan →
            </a>
          </div>
        </div>

        {/* Simple step indicator */}
        <div className="flex flex-wrap items-center gap-2 justify-center">
          {['School', 'Admin', 'Counselor', 'Management', 'Review'].map((label, idx) => {
            const current = idx + 1;
            const isActive = step === current;
            const isDone = step > current;
            return (
              <span
                key={label}
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium ${
                  isActive ? 'bg-sky-600 text-white' : isDone ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {label}
              </span>
            );
          })}
        </div>

        {/* Step 1 — School Onboarding */}
        {step === 1 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">School Onboarding</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">School Name</label>
              <input className={inputClass} value={school.schoolName} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Admin Email</label>
              <input className={inputClass} value={school.adminEmail} readOnly />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Upload School Logo (URL)</label>
              <input className={inputClass} value={school.logoUrl} onChange={(e) => setSchool((p) => ({ ...p, logoUrl: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">School Address</label>
              <input className={inputClass} value={school.address} onChange={(e) => setSchool((p) => ({ ...p, address: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">City</label>
              <input className={inputClass} value={school.city} onChange={(e) => setSchool((p) => ({ ...p, city: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">State</label>
              <input className={inputClass} value={school.state} onChange={(e) => setSchool((p) => ({ ...p, state: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Pincode</label>
              <input className={inputClass} value={school.pincode} onChange={(e) => setSchool((p) => ({ ...p, pincode: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">School Contact Number</label>
              <input className={inputClass} value={school.contactNumber} onChange={(e) => setSchool((p) => ({ ...p, contactNumber: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">School Website (optional)</label>
              <input className={inputClass} value={school.website} onChange={(e) => setSchool((p) => ({ ...p, website: e.target.value }))} />
            </div>
          </div>
        </section>
        )}

        {/* Step 2 — Admin Account Creation */}
        {step === 2 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Admin Account Creation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">School Name</label>
              <input className={inputClass} value={school.schoolName} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Admin Email</label>
              <input className={inputClass} value={school.adminEmail} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Create Password</label>
              <input type="password" className={inputClass} value={admin.password} onChange={(e) => setAdmin((p) => ({ ...p, password: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Confirm Password</label>
              <input type="password" className={inputClass} value={admin.confirm} onChange={(e) => setAdmin((p) => ({ ...p, confirm: e.target.value }))} />
            </div>
          </div>
        </section>
        )}

        {/* Step 3 — Counselor Creation */}
        {step === 3 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Create Primary Counselor</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Counselor Name</label>
              <input className={inputClass} value={counselor.name} onChange={(e) => setCounselor((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input type="email" className={inputClass} value={counselor.email} onChange={(e) => setCounselor((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Username</label>
              <input className={inputClass} value={counselor.username} onChange={(e) => setCounselor((p) => ({ ...p, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Phone Number</label>
              <input className={inputClass} value={counselor.phone} onChange={(e) => setCounselor((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input type="password" className={inputClass} value={counselor.password} onChange={(e) => setCounselor((p) => ({ ...p, password: e.target.value }))} />
            </div>
          </div>
        </section>
        )}

        {/* Step 4 — Management Creation */}
        {step === 4 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Create Management User</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Name</label>
              <input className={inputClass} value={management.name} onChange={(e) => setManagement((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input type="email" className={inputClass} value={management.email} onChange={(e) => setManagement((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Username</label>
              <input className={inputClass} value={management.username} onChange={(e) => setManagement((p) => ({ ...p, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input type="password" className={inputClass} value={management.password} onChange={(e) => setManagement((p) => ({ ...p, password: e.target.value }))} />
            </div>
          </div>
        </section>
        )}

        {/* Step 5 — Review & Submit */}
        {step === 5 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Review</h2>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-1">
              <div>
                <span className="font-semibold">School:</span> {school.schoolName} ({school.city || 'City'}, {school.state || 'State'})
              </div>
              <div>
                <span className="font-semibold">Admin:</span> {school.adminEmail}
              </div>
              <div>
                <span className="font-semibold">Counselor:</span> {counselor.name} ({counselor.username})
              </div>
              <div>
                <span className="font-semibold">Management:</span> {management.name} ({management.username})
              </div>
            </div>
          </section>
        )}

        {/* Wizard controls */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={step === 1 || submitting}
            onClick={goBack}
            className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm disabled:opacity-50"
          >
            Back
          </button>
          {step < 5 ? (
            <button
              type="button"
              disabled={submitting}
              onClick={goNext}
              className="px-5 py-2.5 rounded-md bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-60"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="px-5 py-2.5 rounded-md bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit Onboarding'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


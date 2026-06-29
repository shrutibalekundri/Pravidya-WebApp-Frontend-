import React, { useState } from 'react';
import toast from 'react-hot-toast';

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500';

export default function JeetofyLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const json = await res.json();
      const data = json?.data;
      if (!res.ok) {
        if (res.status === 402) {
          toast.error('License expired. Please renew your plan.');
          const link = json?.data?.renewalLink;
          if (link) window.open(link, '_blank', 'noopener,noreferrer');
          return;
        }
        throw new Error(json?.message || 'Login failed');
      }
      if (data?.token && data?.user) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        const role = data.user.role;
        if (role === 'ADMIN') window.location.href = '/admin/dashboard';
        else if (role === 'COUNSELOR') window.location.href = '/counselor/dashboard';
        else if (role === 'MANAGEMENT') window.location.href = '/management/overview';
        else window.location.href = '/';
        return;
      }
      toast.error('Login failed');
    } catch (err) {
      toast.error(err?.message || 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900 text-center">
          Login to <span className="text-sky-600">Pravidya</span>
        </h1>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="block text-sm font-medium text-slate-700">Username or Email</label>
            <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
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
}


import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { saasAPI } from '../../services/api';
import LicenseBanner from '../../components/saas/LicenseBanner';
import LoginForm from '../../components/saas/LoginForm';
import OnboardingForm from '../../components/saas/OnboardingForm';
import { VEMAN_JITOFY_INSTITUTION_ID } from '../../constants/institutionIds';

/** Fallback when license API fails (backend down, CORS, etc.) — keeps venam login usable */
function fallbackLicense(academyId) {
  const id = String(academyId || '').trim();
  return {
    academyId: id,
    schoolName: 'Veman Academy',
    adminEmail: 'admin@example.com',
    daysRemaining: 30,
    renewalLink: `https://pravidya.jeetofy.com/${encodeURIComponent(id)}/renew`,
  };
}

export default function SaasAcademyEntry() {
  const { academyId } = useParams();
  const [license, setLicense] = useState(null);
  const [adminExists, setAdminExists] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [licRes, adminRes] = await Promise.all([
          saasAPI.getLicense(academyId),
          saasAPI.checkAdmin(academyId),
        ]);
        if (!mounted) return;
        const licData = licRes?.data?.data;
        if (licData && licData.schoolName) {
          setLicense(licData);
        } else {
          throw new Error('Invalid license response');
        }
        setAdminExists(!!adminRes?.data?.data?.adminExists);
      } catch (err) {
        console.error('Failed to load SAAS academy info', err);
        if (!mounted) return;
        // Always allow Veman canonical ID to show login/onboarding UI even if API fails
        const id = String(academyId || '').trim();
        const isVemanRoute =
          id.toUpperCase() === VEMAN_JITOFY_INSTITUTION_ID.toUpperCase();
        if (isVemanRoute) {
          setLicense(fallbackLicense(id));
          try {
            const adminRes = await saasAPI.checkAdmin(id);
            if (mounted) setAdminExists(!!adminRes?.data?.data?.adminExists);
          } catch {
            if (mounted) setAdminExists(false);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [academyId]);

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
        <div className="bg-white rounded-xl shadow px-6 py-4 max-w-md text-center space-y-2">
          <p className="text-sm text-slate-700">
            License not found for academy ID: <span className="font-mono">{academyId}</span>
          </p>
          <p className="text-xs text-slate-500">
            Check that the backend is running (e.g. port 8000) and{' '}
            <code className="bg-slate-100 px-1 rounded">VITE_API_URL</code> points to{' '}
            <code className="bg-slate-100 px-1 rounded">http://localhost:8000/api</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900 text-center">
          Welcome to <span className="text-sky-600">Pravidya</span>
        </h1>

        <LicenseBanner license={license} />

        {adminExists ? <LoginForm /> : <OnboardingForm license={license} />}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { pravidyaAuthAPI } from '../../services/pravidyaApi';
import toast from 'react-hot-toast';

const OTP_EXPIRY_SECONDS = 5 * 60; // 5 minutes, must match backend

const roleRedirects = {
  ADMIN: '/admin/dashboard',
  COUNSELOR: '/counselor/dashboard',
  MANAGEMENT: '/management/dashboard',
};

function getSecondsLeft(otpSentAt) {
  if (!otpSentAt) return 0;
  const elapsed = (Date.now() - otpSentAt) / 1000;
  return Math.max(0, Math.ceil(OTP_EXPIRY_SECONDS - elapsed));
}

const OTPPage = () => {
  const { domain, academySlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const loginData = location.state?.loginData;
  const initialOtpsentAt = location.state?.otpSentAt;
  const [otpSentAt, setOtpsentAt] = useState(initialOtpsentAt ?? Date.now());
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsLeft(otpSentAt));
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const expired = secondsLeft <= 0;

  useEffect(() => {
    if (!loginData) {
      navigate(`/pravidya/${domain || 'acme'}/${academySlug}/login`, { replace: true });
    }
  }, [loginData, domain, academySlug, navigate]);

  useEffect(() => {
    if (expired) return;
    const t = setInterval(() => {
      const left = getSecondsLeft(otpSentAt);
      setSecondsLeft(left);
      if (left <= 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [otpSentAt, expired]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!loginData || otp.length !== 6) return;
    setSubmitting(true);
    try {
      const res = await pravidyaAuthAPI.verifyOtp({
        ...loginData,
        otp,
      });
      const data = res.data.data;
      if (res.data.requiresPasswordReset) {
        toast.success('Check your email for password reset link');
        navigate(`/pravidya/${domain || 'acme'}/${academySlug}/reset-password?email=${loginData.email}`);
        return;
      }
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      if (data.token) {
        localStorage.setItem('token', data.token);
        toast.success('Login successful!');
        const redirect = roleRedirects[data.user?.role] || '/admin/dashboard';
        window.location.href = redirect;
      } else {
        toast.error('Login succeeded but session could not be started. Please try again.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (!loginData || !expired || resending) return;
    setResending(true);
    try {
      await pravidyaAuthAPI.resendOtp({
        email: loginData.email,
        academySlug: loginData.academySlug,
        role: loginData.role,
      });
      const now = Date.now();
      setOtpsentAt(now);
      setSecondsLeft(OTP_EXPIRY_SECONDS);
      setOtp('');
      toast.success('New code sent to your email');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend code');
    } finally {
      setResending(false);
    }
  };

  if (!loginData) return null;

  const base = `/pravidya/${domain || 'acme'}/${academySlug}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Enter OTP</h1>
        <p className="text-gray-600 mb-6">
          We sent a 6-digit code to <strong>{loginData.email}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="000000"
            autoFocus
          />
          <button
            type="submit"
            disabled={otp.length !== 6 || submitting}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        {expired && (
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resending}
            className="w-full mt-3 py-2.5 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 text-sm font-medium"
          >
            {resending ? 'Sending...' : 'Resend OTP'}
          </button>
        )}

        <Link to={`${base}/login`} className="block text-center mt-4 text-blue-600 hover:underline text-sm">
          Back to Login
        </Link>
      </div>
    </div>
  );
};

export default OTPPage;

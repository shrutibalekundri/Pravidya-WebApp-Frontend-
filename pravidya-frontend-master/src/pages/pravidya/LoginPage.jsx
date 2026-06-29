import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Users, BookOpen, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { pravidyaAuthAPI, pravidyaAcademyAPI } from '../../services/pravidyaApi';
import toast from 'react-hot-toast';
import CaptchaInput from '../../components/CaptchaInput';

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
  captchaText: z.string().min(1, 'Captcha is required'),
});

const LoginPage = () => {
  const { domain, academySlug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role');
  const role = roleParam || '';
  const [academy, setAcademy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loginData, setLoginData] = useState(null);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaText, setCaptchaText] = useState('');
  const [captchaImage, setCaptchaImage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Use the same API base as pravidyaApi so that captcha
    // and login always hit the same backend instance.
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    const getMock = (s) => ({
      name: (s || 'academy').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
      logoUrl: '/logo-veman-academy.png',
      description: 'Quality education for your child.',
    });
    const academyPromise = pravidyaAcademyAPI
      .getBySlug(academySlug)
      .then((r) => setAcademy(r?.data?.data?.academy || null))
      .catch(() => setAcademy(getMock(academySlug)));
    const captchaPromise = fetch(`${apiBase}/auth/captcha`)
      .then((res) => res.json())
      .then((json) => {
        const data = json?.data || json;
        if (data?.captchaId && data?.image) {
          setCaptchaId(data.captchaId);
          setCaptchaImage(data.image);
        }
      })
      .catch(() => {});
    Promise.all([academyPromise, captchaPromise]).finally(() => setLoading(false));
  }, [academySlug]);

  const { register, handleSubmit, formState: { errors }, setValue } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { captchaText: '' },
  });

  const onSubmit = async (data) => {
    if (!role) return;
    setSubmitting(true);
    try {
      const res = await pravidyaAuthAPI.login({
        email: data.email,
        password: data.password,
        role,
        academySlug,
        captchaId,
        captchaText: data.captchaText || captchaText,
      });
      setOtpSent(true);
      setLoginData({ email: data.email, role, academySlug });
      toast.success(res?.data?.message || 'OTP sent to your email');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      const hint = err.response?.data?.hint;
      toast.error(hint ? `${msg} — ${hint}` : msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (otpSent && loginData) {
    navigate(`/pravidya/${domain}/${academySlug}/otp`, {
      state: { loginData, otpSentAt: Date.now() },
      replace: true,
    });
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const base = `/pravidya/${domain || 'acme'}/${academySlug}`;
  const logoUrl = academy?.logoUrl || '/logo-veman-academy.png';
  const rawName = (academy?.name || '').trim();
  const isVemanSlug = (academySlug || '').toLowerCase() === 'veeman' || (academySlug || '').toLowerCase() === 'veman';
  const displayName = rawName.replace(/Veeman/g, 'Veman');
  const nameParts = displayName.split(/\s+/).filter(Boolean);
  const hasAcademyWord = nameParts.length > 1 || nameParts[0]?.toLowerCase() === 'academy';
  const brandName = hasAcademyWord && nameParts.length > 1
    ? nameParts.slice(0, -1).join(' ')
    : isVemanSlug
      ? 'Veman'
      : nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase() : displayName;
  const nameLast = hasAcademyWord && nameParts.length > 1
    ? nameParts[nameParts.length - 1]
    : isVemanSlug
      ? 'Academy'
      : '';

  if (!roleParam) {
    const roles = [
      { id: 'ADMIN', title: 'Administrator', desc: 'Complete academy management, user control, and system configuration', Icon: Shield, color: '#387FFF' },
      { id: 'COUNSELOR', title: 'Counselor', desc: 'Student lead management, follow-ups, and enrollment tracking', Icon: Users, color: '#28A745' },
      { id: 'MANAGEMENT', title: 'Management', desc: 'Analytics dashboard, reports, and operational oversight', Icon: BookOpen, color: '#FF8A00' },
    ];
    return (
      <div className="min-h-screen py-12 px-4" style={{ backgroundColor: '#F7F9FC' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-center mb-8">
            <Link to={base} className="text-gray-500 hover:underline text-sm">← Back to Home</Link>
          </p>
          <img src={logoUrl} alt={displayName} className="h-14 w-auto mx-auto mb-8" />
          <p className="text-center text-sm uppercase tracking-widest mb-1" style={{ color: '#EA6D20' }}>Staff Portal</p>
          <h1 className="text-3xl font-bold text-center mb-2" style={{ color: '#333E4F' }}>Secure <span style={{ color: '#387FFF' }}>Portal</span> Access</h1>
          <p className="text-center mb-10" style={{ color: '#6B7C8C' }}>Sign in to your role-specific dashboard with OTP-verified secure authentication</p>
          <div className="grid md:grid-cols-3 gap-6">
            {roles.map(({ id, title, desc, Icon, color }) => (
              <Link
                key={id}
                to={`${base}/login?role=${id}`}
                className="block bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-all border-t-4"
                style={{ borderTopColor: color }}
              >
                <div className="w-14 h-14 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: color }}>
                  <Icon className="w-7 h-7 text-white" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#333E4F' }}>{title}</h3>
                <p className="text-sm mb-4" style={{ color: '#6B7C8C' }}>{desc}</p>
                <span className="font-medium text-sm" style={{ color: '#387FFF' }}>Sign In →</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const roleLabel = role === 'ADMIN' ? 'Administrator' : role === 'COUNSELOR' ? 'Counselor' : 'Management';
  const rolePortalDesc = role === 'ADMIN' ? 'Full academy management access' : role === 'COUNSELOR' ? 'Student lead management & enrollment' : 'Analytics and operational oversight';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-[#1A233D] border-b border-white/5">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-md overflow-hidden">
              <img src={logoUrl} alt="" className="h-9 w-auto object-contain" />
            </div>
            <div>
              <p className="font-bold text-xl">
                <span className="text-white">{brandName}</span>
                {nameLast && <span style={{ color: '#FF8C00' }}> {nameLast}</span>}
              </p>
              <p className="text-white/70 text-xs uppercase tracking-widest">POWERED BY PRAVIDYA</p>
            </div>
          </div>
          <Link to={base} className="text-gray-300 hover:text-white text-sm font-medium transition-colors">Staff Login</Link>
        </div>
      </header>

      <div className="flex flex-1 pt-[72px]">
        {/* Left panel - branding (match image 1) */}
        <div className="hidden md:flex md:w-[45%] relative overflow-hidden" style={{ background: '#1A233D' }}>
          <div className="relative flex flex-col justify-center items-center text-center w-full px-8 py-12">
            <div className="w-28 h-28 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-xl overflow-hidden">
              <img src={logoUrl} alt="" className="h-20 w-auto object-contain" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              <span>{brandName}</span>
              {nameLast && <span style={{ color: '#FF8C00' }}> {nameLast}</span>}
            </h2>
            <p className="text-gray-400 text-sm mb-8 max-w-sm leading-relaxed">
              {academy?.description || 'Quality education for your child. Expert faculty, modern curriculum, and a nurturing environment for academic excellence.'}
            </p>
            <div className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold shadow-lg mb-8" style={{ backgroundColor: '#387FFF' }}>
              <Shield className="w-5 h-5 flex-shrink-0" />
              <div className="text-left">
                <span className="block text-base leading-tight">{roleLabel} Portal</span>
                <span className="block text-xs font-normal text-white/90 mt-0.5">{rolePortalDesc}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-gray-400 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-500/50 bg-white/5">
                <Lock className="w-3.5 h-3.5" /> OTP Verified
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-500/50 bg-white/5">
                <Lock className="w-3.5 h-3.5" /> Encrypted
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-500/50 bg-white/5 font-bold">G</span>
            </div>
          </div>
        </div>

        {/* Right panel - login form */}
        <div className="w-full md:w-[55%] min-h-[calc(100vh-72px)] py-10 px-6 sm:px-10 flex items-center justify-center" style={{ backgroundColor: '#F7F9FC' }}>
          <div className="max-w-md w-full">
            <div className="flex items-center justify-between gap-4 mb-6">
              <Link to={base} className="text-gray-500 hover:underline text-sm">← Back to Home</Link>
              <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: '#387FFF' }}>
                <Shield className="w-4 h-4" /> {roleLabel}
              </div>
            </div>
            <img src={logoUrl} alt="" className="h-12 w-auto mb-6 md:hidden" />
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Welcome back</h1>
            <p className="text-gray-600 mb-6">Sign in to access your {role === 'ADMIN' ? 'administrator' : role === 'COUNSELOR' ? 'counselor' : 'management'} dashboard.</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Your Gmail / Email</label>
                <p className="text-xs text-gray-500 mb-1.5">OTP will be sent to this address. Use the password set by your administrator.</p>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('email')}
                    type="email"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                    placeholder="your.email@gmail.com"
                  />
                </div>
                {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    className="w-full pl-10 pr-11 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                    placeholder="Password set by administrator"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
              </div>
              <div className="flex justify-end">
                <Link to={`${base}/forgot-password`} className="text-sm font-medium hover:underline" style={{ color: '#387FFF' }}>Forgot Password?</Link>
              </div>

              <CaptchaInput
                captchaId={captchaId}
                setCaptchaId={setCaptchaId}
                captchaText={captchaText}
                setCaptchaText={(v) => { setCaptchaText(v); setValue('captchaText', v, { shouldValidate: true }); }}
                initialImage={captchaImage}
                onRefresh={async () => {
                  const apiBase = import.meta.env.VITE_API_URL || '/api';
                  const res = await fetch(`${apiBase}/auth/captcha`);
                  if (!res.ok) throw new Error('Captcha unavailable');
                  const j = await res.json();
                  const d = j?.data || j;
                  if (d?.captchaId && d?.image) {
                    setCaptchaId(d.captchaId);
                    setCaptchaImage(d.image);
                    setCaptchaText('');
                  } else {
                    throw new Error('Invalid captcha response');
                  }
                }}
                disabled={submitting}
                error={errors.captchaText?.message}
              />

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-lg text-white font-semibold disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#387FFF' }}
              >
                {submitting ? 'Sending OTP...' : 'Sign In & Get OTP'}
              </button>
              <p className="text-xs text-gray-500 mt-2">By signing in, you agree to {displayName}'s security policies. A one-time password (OTP) will be sent to the email you enter above.</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

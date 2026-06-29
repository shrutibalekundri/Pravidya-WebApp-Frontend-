import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { pravidyaAuthAPI, pravidyaAcademyAPI } from '../../services/pravidyaApi';
import toast from 'react-hot-toast';

const schema = z.object({
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'At least 1 uppercase')
    .regex(/[0-9]/, 'At least 1 number'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
});

const ResetPasswordPage = () => {
  const { domain, academySlug } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [academy, setAcademy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const getMock = (s) => ({
      name: (s || 'academy').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
    });
    pravidyaAcademyAPI.getBySlug(academySlug).then((r) => setAcademy(r?.data?.data?.academy || null)).catch(() => setAcademy(getMock(academySlug))).finally(() => setLoading(false));
  }, [academySlug]);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    if (!token) {
      toast.error('Invalid reset link');
      return;
    }
    try {
      await pravidyaAuthAPI.resetPassword({
        token,
        password: data.password,
        academySlug,
      });
      setDone(true);
      toast.success('Password updated. You can now login.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const base = `/pravidya/${domain || 'acme'}/${academySlug}`;

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8 text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-4">This password reset link is invalid or expired.</p>
          <Link to={`${base}/forgot-password`} className="text-blue-600 hover:underline">Request new link</Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-12 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8 text-center">
          <span className="text-5xl mb-4 block">✅</span>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Password Updated</h1>
          <p className="text-gray-600 mb-6">You can now login with your new password.</p>
          <Link to={`${base}/login`} className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Reset Password</h1>
          <p className="text-gray-600 mb-6">{academy?.name || academySlug}</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
              <input
                {...register('password')}
                type="password"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Min 8 chars, 1 uppercase, 1 number"
              />
              {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
              <input
                {...register('confirmPassword')}
                type="password"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm password"
              />
              {errors.confirmPassword && <p className="text-red-600 text-sm mt-1">{errors.confirmPassword.message}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
            >
              Reset Password
            </button>
          </form>

          <Link to={`${base}/login`} className="block text-center mt-4 text-blue-600 hover:underline text-sm">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

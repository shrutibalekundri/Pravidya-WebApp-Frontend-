import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { pravidyaAuthAPI, pravidyaAcademyAPI } from '../../services/pravidyaApi';
import toast from 'react-hot-toast';

const schema = z.object({
  email: z.string().email('Valid email required'),
});

const ForgotPasswordPage = () => {
  const { domain, academySlug } = useParams();
  const [academy, setAcademy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

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
    try {
      await pravidyaAuthAPI.forgotPassword({
        email: data.email,
        academySlug,
      });
      setSubmitted(true);
      toast.success('If an account exists, you will receive a reset link.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed');
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

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8 text-center">
          <span className="text-5xl mb-4 block">📧</span>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Check your email</h1>
          <p className="text-gray-600 mb-6">If an account exists, you will receive a password reset link shortly.</p>
          <Link to={`${base}/login`} className="text-blue-600 hover:underline">Back to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Forgot Password</h1>
          <p className="text-gray-600 mb-6">{academy?.name || academySlug}</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                {...register('email')}
                type="email"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
              {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
            >
              Send Reset Link
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

export default ForgotPasswordPage;

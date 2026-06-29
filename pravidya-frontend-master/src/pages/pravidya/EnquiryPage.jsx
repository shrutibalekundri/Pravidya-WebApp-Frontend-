import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { pravidyaLeadsAPI, pravidyaAcademyAPI } from '../../services/pravidyaApi';
import toast from 'react-hot-toast';

const schema = z.object({
  studentName: z.string().min(1, 'Student name is required'),
  parentName: z.string().min(1, 'Parent name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Valid email required'),
  course: z.string().min(1, 'Course is required'),
});

const EnquiryPage = () => {
  const { domain, academySlug } = useParams();
  const navigate = useNavigate();
  const [academy, setAcademy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      await pravidyaLeadsAPI.create({
        ...data,
        academySlug,
        source: 'DIRECT',
      });
      toast.success('Thank you! We will contact you soon.');
      navigate(`/pravidya/${domain || 'acme'}/${academySlug}/thank-you`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Enquiry Form</h1>
          <p className="text-gray-600 mb-6">{academy?.name || 'Academy'}</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student Name *</label>
              <input
                {...register('studentName')}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Student name"
              />
              {errors.studentName && <p className="text-red-600 text-sm mt-1">{errors.studentName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent Name *</label>
              <input
                {...register('parentName')}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Parent name"
              />
              {errors.parentName && <p className="text-red-600 text-sm mt-1">{errors.parentName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input
                {...register('phone')}
                type="tel"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Phone"
              />
              {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                {...register('email')}
                type="email"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Email"
              />
              {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course Interested *</label>
              <input
                {...register('course')}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Course"
              />
              {errors.course && <p className="text-red-600 text-sm mt-1">{errors.course.message}</p>}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Enquiry'}
            </button>
          </form>

          <Link to={base} className="block text-center mt-4 text-blue-600 hover:underline">Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default EnquiryPage;

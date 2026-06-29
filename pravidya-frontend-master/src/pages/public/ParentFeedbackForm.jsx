import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { feedbackAPI } from '../../services/api';
import toast from 'react-hot-toast';

const INTEREST_OPTIONS = ['Very Interested', 'Interested', 'Not Sure', 'Not Interested'];
const ADMISSION_OPTIONS = ['Ready to take admission', 'Need more time', 'Exploring other institutions', 'Not interested'];
const CONCERN_OPTIONS = ['Fees', 'Location', 'Course Details', 'Placement', 'Reputation', 'Other'];

const initialForm = {
  experienceRating: 0,
  explanationRating: 0,
  helpfulnessRating: 0,
  questionsAnswered: null,
  professionalismRating: 0,
  interestLevel: '',
  admissionDecision: '',
  concern: '',
  concernOther: '',
  likedFeedback: '',
  improvementFeedback: '',
  recommend: null,
};

export default function ParentFeedbackForm() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [readOnly, setReadOnly] = useState(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (!token) {
      setError('Invalid link');
      setLoading(false);
      return;
    }
    feedbackAPI
      .getForm(token)
      .then((res) => {
        const d = res.data?.data;
        if (d) setReadOnly(d);
        else setError('Invalid or expired link');
      })
      .catch((err) => {
        const msg = err.response?.data?.message || 'Invalid or expired link';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const concernValue = form.interestLevel === 'Not Interested'
      ? (form.concern === 'Other' ? form.concernOther : form.concern) || null
      : null;
    const payload = {
      token,
      experienceRating: Number(form.experienceRating),
      explanationRating: Number(form.explanationRating),
      helpfulnessRating: Number(form.helpfulnessRating),
      questionsAnswered: form.questionsAnswered === true,
      professionalismRating: Number(form.professionalismRating),
      interestLevel: form.interestLevel,
      admissionDecision: form.admissionDecision,
      concern: concernValue,
      likedFeedback: form.likedFeedback || null,
      improvementFeedback: form.improvementFeedback || null,
      recommend: form.recommend === true,
    };
    if (payload.experienceRating < 1 || payload.experienceRating > 5 ||
        payload.explanationRating < 1 || payload.explanationRating > 5 ||
        payload.helpfulnessRating < 1 || payload.helpfulnessRating > 5 ||
        payload.professionalismRating < 1 || payload.professionalismRating > 5) {
      toast.error('Please rate all experience questions from 1 to 5.');
      return;
    }
    if (form.questionsAnswered === null) {
      toast.error('Please answer whether the counselor answered all questions.');
      return;
    }
    if (!form.interestLevel || !form.admissionDecision) {
      toast.error('Please select interest level and admission decision.');
      return;
    }
    if (form.recommend === null) {
      toast.error('Please indicate if you would recommend Pravidya counseling.');
      return;
    }
    setSubmitting(true);
    try {
      await feedbackAPI.submit(payload);
      setSubmitted(true);
      toast.success('Thank you for your feedback');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }
  if (error || !readOnly) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <p className="text-red-600 font-medium">{error || 'Invalid or expired link'}</p>
        </div>
      </div>
    );
  }
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold text-gray-900">Thank you for your feedback</h1>
        </div>
      </div>
    );
  }

  const showConcern = form.interestLevel === 'Not Interested';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Pravidya Counseling Feedback</h1>

        {/* Section 1: Read-only */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Student & Parent Details</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><dt className="text-gray-500">Student Name</dt><dd className="font-medium text-gray-900">{readOnly.studentName || '—'}</dd></div>
            <div><dt className="text-gray-500">Parent Name</dt><dd className="font-medium text-gray-900">{readOnly.parentName || '—'}</dd></div>
            <div><dt className="text-gray-500">Email</dt><dd className="font-medium text-gray-900">{readOnly.email || '—'}</dd></div>
            <div><dt className="text-gray-500">Phone</dt><dd className="font-medium text-gray-900">{readOnly.phone || '—'}</dd></div>
            <div><dt className="text-gray-500">Institution</dt><dd className="font-medium text-gray-900">{readOnly.institutionName || '—'}</dd></div>
            <div><dt className="text-gray-500">Counselor</dt><dd className="font-medium text-gray-900">{readOnly.counselorName || '—'}</dd></div>
          </dl>
        </section>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 2: Counseling experience */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Counseling Experience</h2>
            {[
              { key: 'experienceRating', label: 'Overall counseling experience' },
              { key: 'explanationRating', label: 'Counselor explanation clarity' },
              { key: 'helpfulnessRating', label: 'Counselor helpfulness' },
              { key: 'professionalismRating', label: 'Counselor professionalism' },
            ].map(({ key, label }) => (
              <div key={key} className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">{label} (1–5)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => update(key, n)}
                      className={`w-10 h-10 rounded-lg border-2 text-sm font-medium ${form[key] === n ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Did the counselor answer all your questions?</label>
              <div className="flex gap-4">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="questionsAnswered" checked={form.questionsAnswered === true} onChange={() => update('questionsAnswered', true)} className="rounded-full border-gray-300 text-primary-600" />
                  Yes
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="questionsAnswered" checked={form.questionsAnswered === false} onChange={() => update('questionsAnswered', false)} className="rounded-full border-gray-300 text-primary-600" />
                  No
                </label>
              </div>
            </div>
          </section>

          {/* Section 3: Interest */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Interest Level</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Are you interested in this institution?</label>
              <select value={form.interestLevel} onChange={(e) => update('interestLevel', e.target.value)} className="input-field w-full" required>
                <option value="">Select</option>
                {INTEREST_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Admission decision status</label>
              <select value={form.admissionDecision} onChange={(e) => update('admissionDecision', e.target.value)} className="input-field w-full" required>
                <option value="">Select</option>
                {ADMISSION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </section>

          {/* Section 4: Concern (conditional) */}
          {showConcern && (
            <section className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Question</h2>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">What is your biggest concern?</label>
                <select value={form.concern} onChange={(e) => update('concern', e.target.value)} className="input-field w-full">
                  <option value="">Select</option>
                  {CONCERN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {form.concern === 'Other' && (
                <input type="text" value={form.concernOther} onChange={(e) => update('concernOther', e.target.value)} placeholder="Please specify" className="input-field w-full mt-2" />
              )}
            </section>
          )}

          {/* Section 5: Additional feedback */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Feedback</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">What did you like about counseling?</label>
              <textarea value={form.likedFeedback} onChange={(e) => update('likedFeedback', e.target.value)} rows={3} className="input-field w-full" placeholder="Optional" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">What can be improved?</label>
              <textarea value={form.improvementFeedback} onChange={(e) => update('improvementFeedback', e.target.value)} rows={3} className="input-field w-full" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Would you recommend Pravidya counseling?</label>
              <div className="flex gap-4">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="recommend" checked={form.recommend === true} onChange={() => update('recommend', true)} className="rounded-full border-gray-300 text-primary-600" />
                  Yes
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="recommend" checked={form.recommend === false} onChange={() => update('recommend', false)} className="rounded-full border-gray-300 text-primary-600" />
                  No
                </label>
              </div>
            </div>
          </section>

          <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
}

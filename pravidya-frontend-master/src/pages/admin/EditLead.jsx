import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { leadAPI, institutionAPI, courseAPI } from '../../services/api';
import CustomFieldInput from '../../components/CustomFieldInput';
import toast from 'react-hot-toast';

const DEFAULT_FORM_FIELDS = {
  parentName: true, parentMobile: true, parentEmail: true, parentCity: true,
  preferredLanguage: true, studentName: true, dateOfBirth: true, gender: true,
  currentClass: true, boardUniversity: true, marksPercentage: true,
  institution: true, course: true, academicYear: true, preferredCounselingMode: true, notes: true,
  customFields: [],
  requiredFields: {},
};

const LANGUAGES = ['English', 'Hindi', 'Kannada', 'Telugu', 'Marathi', 'Tamil', 'Other'];

const RequiredStar = () => <span className="text-red-500">*</span>;

const formatDateForInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

const EditLead = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isCounselorContext = location.pathname.startsWith('/counselor/');
  const leadsPath = isCounselorContext ? '/counselor/leads' : '/admin/leads';
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm();
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const languageDropdownRef = useRef(null);

  const [institutions, setInstitutions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingLead, setLoadingLead] = useState(true);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [formFields, setFormFields] = useState(DEFAULT_FORM_FIELDS);
  const [customData, setCustomData] = useState({});
  const selectedInstitution = watch('institution');

  // Call modal (counselor only)
  const [showCallModal, setShowCallModal] = useState(false);
  const [callStartTime, setCallStartTime] = useState(null);
  const [dispositions, setDispositions] = useState([]);
  const [callDispositionId, setCallDispositionId] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [callSubmitting, setCallSubmitting] = useState(false);
  const [callErrors, setCallErrors] = useState({});

  const handleCustomFieldChange = (key, value) => {
    setCustomData((prev) => ({ ...prev, [key]: value }));
  };

  const openCallModal = () => {
    setCallStartTime(new Date());
    setCallDispositionId('');
    setCallNotes('');
    setCallErrors({});
    setShowCallModal(true);
    leadAPI.getCallDispositions()
      .then((res) => setDispositions(res.data?.data || []))
      .catch(() => toast.error('Failed to load call dispositions'));
  };

  const handleLogCall = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!callDispositionId?.trim()) errs.dispositionId = 'Call disposition is required';
    if (!callNotes?.trim()) errs.notes = 'Call notes are required';
    setCallErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setCallSubmitting(true);
    try {
      const callEndTime = new Date();
      await leadAPI.logCall(id, {
        callStartTime: callStartTime?.toISOString(),
        callEndTime: callEndTime.toISOString(),
        dispositionId: callDispositionId,
        notes: callNotes.trim(),
      });
      toast.success('Call logged successfully');
      setShowCallModal(false);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to log call';
      toast.error(msg);
      const apiErrors = err.response?.data?.errors;
      if (apiErrors && Array.isArray(apiErrors)) {
        const map = {};
        apiErrors.forEach((e) => { map[e.field] = e.message; });
        setCallErrors(map);
      }
    } finally {
      setCallSubmitting(false);
    }
  };

  const isFieldRequired = (fieldKey) => {
    const rf = formFields.requiredFields || {};
    return rf[fieldKey] === true;
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(e.target)) {
        setLanguageDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  useEffect(() => {
    const fetchFormFields = () => {
      leadAPI.getCreateLeadFormFields().then((res) => {
        const data = res.data?.data?.createLeadFormFields;
        if (data && typeof data === 'object') {
          setFormFields((prev) => ({ ...prev, ...data }));
        }
      }).catch(() => {});
    };
    fetchFormFields();
    window.addEventListener('settings-updated', fetchFormFields);
    return () => window.removeEventListener('settings-updated', fetchFormFields);
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoadingLead(true);
    leadAPI.getById(id)
      .then((res) => {
        const lead = res.data?.data?.lead;
        if (!lead) {
          toast.error('Lead not found');
          navigate(leadsPath);
          return;
        }
        const langStr = lead.preferredLanguage || '';
        const langs = langStr ? langStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
        setSelectedLanguages(langs);
        setCustomData(lead.customData && typeof lead.customData === 'object' ? { ...lead.customData } : {});
        reset({
          parentName: lead.parentName || '',
          parentMobile: lead.parentMobile || '',
          parentEmail: lead.parentEmail || '',
          parentCity: lead.parentCity || '',
          studentName: lead.studentName || '',
          dateOfBirth: formatDateForInput(lead.dateOfBirth),
          gender: lead.gender || '',
          currentClass: lead.currentClass || '',
          boardUniversity: lead.boardUniversity || '',
          marksPercentage: lead.marksPercentage ?? '',
          institution: lead.institutionId || '',
          course: lead.courseId || '',
          academicYear: lead.academicYear || '',
          preferredCounselingMode: lead.preferredCounselingMode || '',
          notes: lead.notes || '',
          classification: lead.classification || 'NEW',
          priority: lead.priority || 'NORMAL',
          status: lead.status || 'NEW',
        });
        if (lead.institutionId) {
          fetchCourses(lead.institutionId);
        }
      })
      .catch((err) => {
        const msg = err.response?.data?.message || err.message || 'Failed to load lead';
        toast.error(msg);
        navigate(leadsPath);
      })
      .finally(() => setLoadingLead(false));
  }, [id, navigate, reset, leadsPath]);

  useEffect(() => {
    if (loadingLead) return;
    if (selectedInstitution) {
      fetchCourses(selectedInstitution);
    } else {
      setCourses([]);
      setValue('course', '');
    }
  }, [selectedInstitution, loadingLead]);

  const fetchInstitutions = async () => {
    try {
      const response = await institutionAPI.getAll({ isActive: 'true' });
      const instList = response.data?.data?.institutions ?? [];
      setInstitutions(Array.isArray(instList) ? instList : []);
    } catch (error) {
      console.error('Error fetching institutions:', error);
      toast.error('Failed to load institutions. Please refresh the page.');
    } finally {
      setInstitutionsLoading(false);
    }
  };

  const fetchCourses = async (institutionId) => {
    if (!institutionId) {
      setCourses([]);
      return;
    }
    setCoursesLoading(true);
    try {
      const response = await courseAPI.getAll({ institution: institutionId, isActive: 'true' });
      const courseList = response.data?.data?.courses ?? [];
      setCourses(Array.isArray(courseList) ? courseList : []);
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast.error(error.response?.data?.message || 'Failed to load courses');
      setCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  };

  const handleInstitutionChange = (e) => {
    const instId = e.target.value;
    setValue('institution', instId);
    setValue('course', '');
    if (instId) {
      fetchCourses(instId);
    } else {
      setCourses([]);
    }
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      if (!data.institution || data.institution === '') {
        toast.error('Please select an institution');
        setLoading(false);
        return;
      }
      if (!data.course || data.course === '') {
        toast.error('Please select a course');
        setLoading(false);
        return;
      }
      if (!data.dateOfBirth) {
        toast.error('Please select date of birth');
        setLoading(false);
        return;
      }
      const f = formFields;
      const formData = {
        parentName: (data.parentName || '').trim(),
        parentMobile: (data.parentMobile || '').trim(),
        parentEmail: (data.parentEmail || '').trim().toLowerCase(),
        parentCity: (data.parentCity || '').trim(),
        preferredLanguage: selectedLanguages.length > 0 ? selectedLanguages.join(', ') : (data.preferredLanguage || 'English').trim(),
        studentName: (data.studentName || '').trim(),
        dateOfBirth: new Date(data.dateOfBirth || new Date()).toISOString(),
        gender: data.gender || 'Other',
        currentClass: (data.currentClass || '').trim(),
        boardUniversity: f.boardUniversity !== false ? (data.boardUniversity?.trim() || '') : '',
        marksPercentage: f.marksPercentage !== false && data.marksPercentage ? parseFloat(data.marksPercentage) : undefined,
        institution: data.institution,
        course: data.course,
        academicYear: (data.academicYear || '').trim(),
        preferredCounselingMode: data.preferredCounselingMode,
        notes: f.notes !== false ? (data.notes?.trim() || '') : '',
        customData: Object.keys(customData).length > 0 ? customData : undefined,
        classification: ['NEW', 'COUNSELING_IN_PROGRESS', 'PRIORITY', 'ADMISSION_CONFIRMED'].includes(data.classification) ? data.classification : 'NEW',
        priority: ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(data.priority) ? data.priority : 'NORMAL',
      };
      if (isCounselorContext) {
        formData.status = ['NEW', 'CONTACTED', 'FOLLOW_UP', 'ENROLLED', 'REJECTED', 'ON_HOLD', 'CALL_NOT_CONNECTED'].includes(data.status) ? data.status : undefined;
      }

      await leadAPI.update(id, formData);
      toast.success('Lead updated successfully');
      navigate(leadsPath);
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to update lead. Please try again.';
      toast.error(message);
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        error.response.data.errors.forEach((err) => {
          const fieldName = err.param || err.path || 'Field';
          const errorMsg = err.msg || err.message || 'Invalid value';
          toast.error(`${fieldName}: ${errorMsg}`, { duration: 4000 });
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (loadingLead) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" aria-label="Loading" />
      </div>
    );
  }

  if (!id) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(leadsPath)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Back to Leads"
          >
            ←
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Lead</h1>
            <p className="text-gray-600 mt-1">Update lead details</p>
          </div>
        </div>
        {isCounselorContext && (
          <button
            type="button"
            onClick={openCallModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
          >
            <span aria-hidden>📞</span> Call
          </button>
        )}
      </div>

      {/* Call Modal */}
      {showCallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCallModal(false)} aria-hidden="true" />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Log Call</h3>
            <p className="text-sm text-gray-500 mb-4">
              Call started: {callStartTime ? new Date(callStartTime).toLocaleString() : '—'}
            </p>
            <form onSubmit={handleLogCall} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Call Disposition <span className="text-red-500">*</span></label>
                <select
                  value={callDispositionId}
                  onChange={(e) => { setCallDispositionId(e.target.value); setCallErrors((prev) => ({ ...prev, dispositionId: null })); }}
                  className="input-field w-full"
                  required
                >
                  <option value="">Select disposition</option>
                  {dispositions.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {callErrors.dispositionId && <p className="text-red-500 text-xs mt-1">{callErrors.dispositionId}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Call Notes <span className="text-red-500">*</span></label>
                <textarea
                  value={callNotes}
                  onChange={(e) => { setCallNotes(e.target.value); setCallErrors((prev) => ({ ...prev, notes: null })); }}
                  rows={3}
                  className="input-field w-full"
                  placeholder="Enter call summary and notes..."
                  required
                />
                {callErrors.notes && <p className="text-red-500 text-xs mt-1">{callErrors.notes}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={callSubmitting}
                  className="btn-primary py-2 px-4 disabled:opacity-50"
                >
                  {callSubmitting ? 'Saving...' : 'End Call & Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCallModal(false)}
                  className="btn-secondary py-2 px-4"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 sm:space-y-6 p-4 sm:p-6 max-w-4xl">
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Parent Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent Name {isFieldRequired('parentName') ? <RequiredStar /> : null}</label>
              <input
                type="text"
                {...register('parentName', { required: isFieldRequired('parentName') ? 'Parent name is required' : false })}
                className="input-field"
              />
              {errors.parentName && <p className="text-red-500 text-xs mt-1">{errors.parentName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number {isFieldRequired('parentMobile') ? <RequiredStar /> : null}</label>
              <input
                type="tel"
                {...register('parentMobile', { required: isFieldRequired('parentMobile') ? 'Mobile number is required' : false })}
                className="input-field"
              />
              {errors.parentMobile && <p className="text-red-500 text-xs mt-1">{errors.parentMobile.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email {isFieldRequired('parentEmail') ? <RequiredStar /> : null}</label>
              <input
                type="email"
                {...register('parentEmail', {
                  required: isFieldRequired('parentEmail') ? 'Email is required' : false,
                  pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email address' },
                })}
                className="input-field"
              />
              {errors.parentEmail && <p className="text-red-500 text-xs mt-1">{errors.parentEmail.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City {isFieldRequired('parentCity') ? <RequiredStar /> : null}</label>
              <input
                type="text"
                {...register('parentCity', { required: isFieldRequired('parentCity') ? 'City is required' : false })}
                className="input-field"
              />
              {errors.parentCity && <p className="text-red-500 text-xs mt-1">{errors.parentCity.message}</p>}
            </div>
            <div className="relative" ref={languageDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Language</label>
              <button
                type="button"
                onClick={() => setLanguageDropdownOpen((prev) => !prev)}
                className="input-field w-full text-left flex items-center justify-between"
              >
                <span className={selectedLanguages.length === 0 ? 'text-gray-500' : ''}>
                  {selectedLanguages.length === 0 ? 'Select language(s)' : selectedLanguages.join(', ')}
                </span>
                <span className="text-gray-400">{languageDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {languageDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg py-1 max-h-48 overflow-auto">
                  {LANGUAGES.map((lang) => (
                    <label key={lang} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLanguages.includes(lang)}
                        onChange={() => {
                          setSelectedLanguages((prev) =>
                            prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
                          );
                        }}
                        className="rounded text-primary-600"
                      />
                      <span className="text-sm text-gray-700">{lang}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Student Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student Name {isFieldRequired('studentName') ? <RequiredStar /> : null}</label>
              <input
                type="text"
                {...register('studentName', { required: isFieldRequired('studentName') ? 'Student name is required' : false })}
                className="input-field"
              />
              {errors.studentName && <p className="text-red-500 text-xs mt-1">{errors.studentName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth {isFieldRequired('dateOfBirth') ? <RequiredStar /> : null}</label>
              <input
                type="date"
                {...register('dateOfBirth', { required: isFieldRequired('dateOfBirth') ? 'Date of birth is required' : false })}
                className="input-field"
              />
              {errors.dateOfBirth && <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender {isFieldRequired('gender') ? <RequiredStar /> : null}</label>
              <select
                {...register('gender', { required: isFieldRequired('gender') ? 'Gender is required' : false })}
                className="input-field"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Class / Qualification {isFieldRequired('currentClass') ? <RequiredStar /> : null}</label>
              <input
                type="text"
                {...register('currentClass', { required: isFieldRequired('currentClass') ? 'Current class is required' : false })}
                className="input-field"
                placeholder="e.g., 12th, B.Tech, etc."
              />
              {errors.currentClass && <p className="text-red-500 text-xs mt-1">{errors.currentClass.message}</p>}
            </div>
            {formFields.boardUniversity !== false && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Board / University {isFieldRequired('boardUniversity') ? <RequiredStar /> : null}</label>
                <input
                  type="text"
                  {...register('boardUniversity', { required: isFieldRequired('boardUniversity') ? 'Board / University is required' : false })}
                  className="input-field"
                  placeholder="e.g., CBSE, State Board, etc."
                />
              </div>
            )}
            {formFields.marksPercentage !== false && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Marks / Percentage {isFieldRequired('marksPercentage') ? <RequiredStar /> : null}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  {...register('marksPercentage', {
                    required: isFieldRequired('marksPercentage') ? 'Marks / Percentage is required' : false,
                    min: { value: 0, message: 'Marks must be between 0 and 100' },
                    max: { value: 100, message: 'Marks must be between 0 and 100' },
                  })}
                  className="input-field"
                />
                {errors.marksPercentage && <p className="text-red-500 text-xs mt-1">{errors.marksPercentage.message}</p>}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Lead Classification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classification</label>
              <select
                {...register('classification')}
                className="input-field"
              >
                <option value="NEW">New</option>
                <option value="COUNSELING_IN_PROGRESS">Counseling In Progress</option>
                <option value="PRIORITY">Priority</option>
                <option value="ADMISSION_CONFIRMED">Admission Confirmed</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">PRIORITY = Hot Lead (dashboard count)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                {...register('priority')}
                className="input-field"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">HIGH or URGENT = Hot Lead (dashboard count)</p>
            </div>
            {isCounselorContext && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stage / Status</label>
                <select
                  {...register('status')}
                  className="input-field"
                >
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="FOLLOW_UP">Follow-up</option>
                  <option value="ENROLLED">Enrolled</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="CALL_NOT_CONNECTED">Call not connected</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Moving to Contacted/Follow-up requires logging a call first</p>
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Admission Preferences</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Institution {isFieldRequired('institution') ? <RequiredStar /> : null}</label>
              <select
                {...register('institution', { required: isFieldRequired('institution') ? 'Institution is required' : false })}
                className="input-field"
                onChange={handleInstitutionChange}
                value={selectedInstitution || ''}
              >
                <option value="">Select Institution</option>
                {institutionsLoading ? (
                  <option value="" disabled>Loading institutions...</option>
                ) : institutions.length === 0 ? (
                  <option value="" disabled>No institutions available</option>
                ) : (
                  institutions.map((inst) => (
                    <option key={inst.id || inst._id} value={inst.id || inst._id}>
                      {inst.name} ({inst.type})
                    </option>
                  ))
                )}
              </select>
              {errors.institution && <p className="text-red-500 text-xs mt-1">{errors.institution.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course / Program {isFieldRequired('course') ? <RequiredStar /> : null}</label>
              <select
                {...register('course', {
                  required: isFieldRequired('course') && selectedInstitution ? 'Course is required' : false,
                  validate: (value) => {
                    if (!selectedInstitution) return 'Please select an institution first';
                    if (!value || value === '') return 'Course is required';
                    return true;
                  },
                })}
                className="input-field"
                disabled={!selectedInstitution || coursesLoading}
              >
                <option value="">
                  {!selectedInstitution ? 'Select Institution First' : coursesLoading ? 'Loading courses...' : courses.length === 0 ? 'No courses available' : 'Select Course'}
                </option>
                {courses.map((c) => (
                  <option key={c.id || c._id} value={c.id || c._id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
              {errors.course && <p className="text-red-500 text-xs mt-1">{errors.course.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year {isFieldRequired('academicYear') ? <RequiredStar /> : null}</label>
              <input
                type="text"
                {...register('academicYear', { required: isFieldRequired('academicYear') ? 'Academic year is required' : false })}
                className="input-field"
                placeholder="e.g., 2024-2025"
              />
              {errors.academicYear && <p className="text-red-500 text-xs mt-1">{errors.academicYear.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Counseling Mode {isFieldRequired('preferredCounselingMode') ? <RequiredStar /> : null}</label>
              <select
                {...register('preferredCounselingMode', { required: isFieldRequired('preferredCounselingMode') ? 'Counseling mode is required' : false })}
                className="input-field"
              >
                <option value="">Select Mode</option>
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
              </select>
              {errors.preferredCounselingMode && <p className="text-red-500 text-xs mt-1">{errors.preferredCounselingMode.message}</p>}
            </div>
          </div>
        </section>

        {formFields.notes !== false && (
          <section>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Queries {isFieldRequired('notes') ? <RequiredStar /> : null}</label>
            <textarea
              {...register('notes', { required: isFieldRequired('notes') ? 'Notes is required' : false })}
              rows="3"
              className="input-field w-full"
              placeholder="Any additional information or queries..."
            />
          </section>
        )}

        {(formFields.customFields || []).length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Additional Fields</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(formFields.customFields || []).map((f) => (
                <div key={f.key}>
                  <CustomFieldInput
                    field={f}
                    value={customData[f.key]}
                    onChange={handleCustomFieldChange}
                    required={f.required}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={loading} className="btn-primary py-2.5 px-4 disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => navigate(leadsPath)} className="btn-secondary py-2.5 px-4">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditLead;

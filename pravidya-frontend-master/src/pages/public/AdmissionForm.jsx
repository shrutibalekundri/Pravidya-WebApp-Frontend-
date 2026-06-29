import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { leadAPI, institutionAPI, courseAPI } from '../../services/api';
import toast from 'react-hot-toast';

// Capture UTM and fbclid from URL query params (no hardcoding)
function getUtmAndFbclid() {
  if (typeof window === 'undefined' || !window.location?.search) return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    fbclid: params.get('fbclid') || undefined,
  };
}

const DEFAULT_FORM_FIELDS = {
  parentName: true, parentMobile: true, parentEmail: true, parentCity: true,
  preferredLanguage: true, studentName: true, dateOfBirth: true, gender: true,
  currentClass: true, boardUniversity: true, marksPercentage: true,
  institution: true, course: true, academicYear: true, preferredCounselingMode: true, notes: true,
  customFields: [],
  requiredFields: {},
};

const AdmissionForm = () => {
  const navigate = useNavigate();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm();
  const [institutions, setInstitutions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [formFields, setFormFields] = useState(DEFAULT_FORM_FIELDS);
  const selectedInstitution = watch('institution');
  const DEFAULT_REQUIRED = ['parentName', 'parentMobile', 'parentEmail', 'parentCity', 'preferredLanguage', 'studentName', 'dateOfBirth', 'gender', 'currentClass', 'institution', 'course', 'academicYear', 'preferredCounselingMode'];
  const isFieldRequired = (fieldKey) => {
    const rf = formFields.requiredFields || {};
    if (rf[fieldKey] === true) return true;
    if (Object.keys(rf).length === 0) return DEFAULT_REQUIRED.includes(fieldKey);
    return false;
  };

  useEffect(() => {
    fetchInstitutions();
  }, []);

  useEffect(() => {
    leadAPI.getFormFields().then((res) => {
      const data = res.data?.data?.admissionFormFields;
      if (data && typeof data === 'object') {
        setFormFields((prev) => ({ ...prev, ...data }));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedInstitution) {
      fetchCourses(selectedInstitution);
      // Reset course selection when institution changes
      setValue('course', '');
    } else {
      setCourses([]);
      setValue('course', '');
    }
  }, [selectedInstitution, setValue]);

  // Auto-select KLE Tech University when institutions load
  useEffect(() => {
    if (institutions.length > 0 && !selectedInstitution) {
      const kleInstitution = institutions.find(
        inst => inst.name.toLowerCase().includes('kle tech') || 
                inst.name.toLowerCase().includes('kle') && inst.type === 'College'
      );
      if (kleInstitution) {
        setValue('institution', kleInstitution._id);
        fetchCourses(kleInstitution._id);
      }
    }
  }, [institutions, selectedInstitution, setValue]);

  const fetchInstitutions = async () => {
    try {
      const response = await institutionAPI.getAll({ isActive: 'true' });
      if (response.data?.data?.institutions) {
        setInstitutions(response.data.data.institutions);
      } else {
        toast.error('Failed to load institutions');
      }
    } catch (error) {
      toast.error('Failed to load institutions. Please refresh the page.');
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
      if (response.data?.data?.courses) {
        setCourses(response.data.data.courses);
        if (response.data.data.courses.length === 0) {
          toast.error('No active courses available for this institution');
        }
      } else {
        setCourses([]);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to load courses';
      toast.error(errorMsg);
      setCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  };

  const handleInstitutionChange = (e) => {
    const instId = e.target.value;
    setValue('institution', instId);
    setValue('course', ''); // Reset course when institution changes
    if (instId) {
      fetchCourses(instId);
    } else {
      setCourses([]);
    }
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      // Validate institution and course are selected
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

      // Validate date of birth
      if (!data.dateOfBirth) {
        toast.error('Please select date of birth');
        setLoading(false);
        return;
      }

      const f = formFields;
      const utmAndFbclid = getUtmAndFbclid();
      const formData = {
        parentName: (data.parentName || '').trim(),
        parentMobile: (data.parentMobile || '').trim(),
        parentEmail: (data.parentEmail || '').trim().toLowerCase(),
        parentCity: (data.parentCity || '').trim(),
        preferredLanguage: (data.preferredLanguage || '').trim(),
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
        consent: true,
        ...utmAndFbclid,
      };

      const response = await leadAPI.create(formData);
      
      if (response.data?.success && response.data?.data?.leadId) {
        toast.success('Admission form submitted successfully!');
        navigate('/thank-you', { state: { leadId: response.data.data.leadId } });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to submit form. Please try again.';
      toast.error(message);
      
      // Show validation errors if any
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        error.response.data.errors.forEach(err => {
          const fieldName = err.param || err.path || 'Field';
          const errorMsg = err.msg || err.message || 'Invalid value';
          toast.error(`${fieldName}: ${errorMsg}`, { duration: 4000 });
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-6 sm:py-8 lg:py-12 px-3 sm:px-4">
      <div className="max-w-4xl mx-auto w-full">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Admission Enquiry Form</h1>
          <p className="text-sm sm:text-base text-gray-600 px-1">Fill in the details below to submit your admission enquiry</p>
        </div>

        {/* Debug Info - Remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-4 bg-gray-100 rounded text-xs">
            <p>Institutions: {institutions.length} loaded</p>
            <p>Selected Institution: {selectedInstitution || 'None'}</p>
            <p>Courses: {courses.length} loaded</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 sm:space-y-6 p-4 sm:p-6">
          {/* Parent Details Section */}
          <section>
            <h2 className="text-lg sm:text-2xl font-semibold text-gray-800 mb-3 sm:mb-4 border-b pb-2">
              Parent Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Name *
                </label>
                <input
                  type="text"
                  {...register('parentName', { required: isFieldRequired('parentName') ? 'Parent name is required' : false })}
                  className="input-field"
                />
                {errors.parentName && (
                  <p className="text-red-500 text-xs mt-1">{errors.parentName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  {...register('parentMobile', { required: isFieldRequired('parentMobile') ? 'Mobile number is required' : false })}
                  className="input-field"
                />
                {errors.parentMobile && (
                  <p className="text-red-500 text-xs mt-1">{errors.parentMobile.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  {...register('parentEmail', { 
                    required: isFieldRequired('parentEmail') ? 'Email is required' : false,
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  className="input-field"
                />
                {errors.parentEmail && (
                  <p className="text-red-500 text-xs mt-1">{errors.parentEmail.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  {...register('parentCity', { required: isFieldRequired('parentCity') ? 'City is required' : false })}
                  className="input-field"
                />
                {errors.parentCity && (
                  <p className="text-red-500 text-xs mt-1">{errors.parentCity.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Language *
                </label>
                <select
                  {...register('preferredLanguage', { required: isFieldRequired('preferredLanguage') ? 'Preferred language is required' : false })}
                  className="input-field"
                >
                  <option value="">Select Language</option>
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Kannada">Kannada</option>
                  <option value="Telugu">Telugu</option>
                  <option value="Marathi">Marathi</option>
                  <option value="Tamil">Tamil</option>
                </select>
                {errors.preferredLanguage && (
                  <p className="text-red-500 text-xs mt-1">{errors.preferredLanguage.message}</p>
                )}
              </div>
            </div>
          </section>

          {/* Student Details Section */}
          <section>
            <h2 className="text-lg sm:text-2xl font-semibold text-gray-800 mb-3 sm:mb-4 border-b pb-2">
              Student Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student Name *
                </label>
                <input
                  type="text"
                  {...register('studentName', { required: isFieldRequired('studentName') ? 'Student name is required' : false })}
                  className="input-field"
                />
                {errors.studentName && (
                  <p className="text-red-500 text-xs mt-1">{errors.studentName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  {...register('dateOfBirth', { required: isFieldRequired('dateOfBirth') ? 'Date of birth is required' : false })}
                  className="input-field"
                />
                {errors.dateOfBirth && (
                  <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender *
                </label>
                <select
                  {...register('gender', { required: isFieldRequired('gender') ? 'Gender is required' : false })}
                  className="input-field"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {errors.gender && (
                  <p className="text-red-500 text-xs mt-1">{errors.gender.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Class / Qualification *
                </label>
                <input
                  type="text"
                  {...register('currentClass', { required: isFieldRequired('currentClass') ? 'Current class is required' : false })}
                  className="input-field"
                  placeholder="e.g., 12th, B.Tech, etc."
                />
                {errors.currentClass && (
                  <p className="text-red-500 text-xs mt-1">{errors.currentClass.message}</p>
                )}
              </div>

              {formFields.boardUniversity !== false && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Board / University {isFieldRequired('boardUniversity') && '*'}
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Marks / Percentage {isFieldRequired('marksPercentage') && '*'}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  {...register('marksPercentage', {
                    required: isFieldRequired('marksPercentage') ? 'Marks / Percentage is required' : false,
                    min: { value: 0, message: 'Marks must be between 0 and 100' },
                    max: { value: 100, message: 'Marks must be between 0 and 100' }
                  })}
                  className="input-field"
                />
                {errors.marksPercentage && (
                  <p className="text-red-500 text-xs mt-1">{errors.marksPercentage.message}</p>
                )}
              </div>
              )}
            </div>
          </section>

          {/* Admission Preferences Section */}
          <section>
            <h2 className="text-lg sm:text-2xl font-semibold text-gray-800 mb-3 sm:mb-4 border-b pb-2">
              Admission Preferences
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Institution *
                </label>
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
                      <option key={inst._id} value={inst._id}>
                        {inst.name} ({inst.type})
                      </option>
                    ))
                  )}
                </select>
                {errors.institution && (
                  <p className="text-red-500 text-xs mt-1">{errors.institution.message}</p>
                )}
                {selectedInstitution && (
                  <p className="text-green-600 text-xs mt-1">
                    ✓ {institutions.find(i => i._id === selectedInstitution)?.name || 'Institution'} selected
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Course / Program *
                </label>
                <select
                  {...register('course', { 
                    required: isFieldRequired('course') && selectedInstitution ? 'Course is required' : false,
                    validate: (value) => {
                      if (!selectedInstitution) {
                        return 'Please select an institution first';
                      }
                      if (!value || value === '') {
                        return 'Course is required';
                      }
                      return true;
                    }
                  })}
                  className="input-field"
                  disabled={!selectedInstitution || coursesLoading}
                >
                  <option value="">
                    {!selectedInstitution 
                      ? 'Select Institution First' 
                      : coursesLoading
                      ? 'Loading courses...' 
                      : courses.length === 0
                      ? 'No courses available'
                      : 'Select Course (CS/EC available)'}
                  </option>
                  {courses.map((course) => {
                    // Highlight CS and EC courses
                    const isCSE = course.name.toLowerCase().includes('computer science') || 
                                 course.code?.toUpperCase() === 'CSE';
                    const isECE = course.name.toLowerCase().includes('electronics') || 
                                 course.code?.toUpperCase() === 'ECE';
                    return (
                      <option key={course._id} value={course._id}>
                        {course.name} {isCSE ? '(CS)' : isECE ? '(EC)' : ''}
                      </option>
                    );
                  })}
                </select>
                {errors.course && (
                  <p className="text-red-500 text-xs mt-1">{errors.course.message}</p>
                )}
                {selectedInstitution && !coursesLoading && courses.length > 0 && (
                  <p className="text-blue-600 text-xs mt-1">
                    Available courses: {courses.map(c => c.name).join(', ')}
                  </p>
                )}
                {selectedInstitution && !coursesLoading && courses.length === 0 && (
                  <p className="text-yellow-600 text-xs mt-1">
                    No active courses available for this institution
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Academic Year *
                </label>
                <input
                  type="text"
                  {...register('academicYear', { required: isFieldRequired('academicYear') ? 'Academic year is required' : false })}
                  className="input-field"
                  placeholder="e.g., 2024-2025"
                />
                {errors.academicYear && (
                  <p className="text-red-500 text-xs mt-1">{errors.academicYear.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Counseling Mode *
                </label>
                <select
                  {...register('preferredCounselingMode', { required: isFieldRequired('preferredCounselingMode') ? 'Counseling mode is required' : false })}
                  className="input-field"
                >
                  <option value="">Select Mode</option>
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                </select>
                {errors.preferredCounselingMode && (
                  <p className="text-red-500 text-xs mt-1">{errors.preferredCounselingMode.message}</p>
                )}
              </div>
            </div>
          </section>

          {/* Additional Information & Consent */}
          <section>
            <h2 className="text-lg sm:text-2xl font-semibold text-gray-800 mb-3 sm:mb-4 border-b pb-2">
              Additional Information
            </h2>
            {formFields.notes !== false && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes / Queries {isFieldRequired('notes') && '*'}
              </label>
              <textarea
                {...register('notes', { required: isFieldRequired('notes') ? 'Notes is required' : false })}
                rows="4"
                className="input-field"
                placeholder="Any additional information or queries..."
              />
            </div>
            )}

            <div className="mt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register('consent', { required: 'Consent is required' })}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-sm text-gray-700">
                  I consent to the processing of my personal data for admission purposes *
                </span>
              </label>
              {errors.consent && (
                <p className="text-red-500 text-xs mt-1">{errors.consent.message}</p>
              )}
            </div>
          </section>

          <div className="flex gap-3 sm:gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 py-3 text-base sm:text-lg disabled:opacity-50 w-full"
            >
              {loading ? 'Submitting...' : 'Submit Admission Form'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdmissionForm;

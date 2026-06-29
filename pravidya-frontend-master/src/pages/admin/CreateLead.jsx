import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { leadAPI, institutionAPI, courseAPI } from '../../services/api';
import CustomFieldInput from '../../components/CustomFieldInput';
import toast from 'react-hot-toast';

const DEFAULT_DROPDOWN_OPTIONS = {
  preferredLanguage: ['English', 'Hindi', 'Kannada', 'Telugu', 'Marathi', 'Tamil', 'Other'],
  preferredCounselingMode: ['Online', 'Offline'],
};

const DEFAULT_FORM_FIELDS = {
  parentName: true,
  parentMobile: true,
  parentEmail: true,
  parentCity: true,
  preferredLanguage: true,
  studentName: true,
  dateOfBirth: true,
  gender: true,
  currentClass: true,
  boardUniversity: true,
  marksPercentage: true,
  institution: true,
  course: true,
  academicYear: true,
  preferredCounselingMode: true,
  notes: true,
  // UI-only switches controlled from Settings → Add New Lead Form
  previousSchooling: true,
  academicSection: true,
  customFields: [],
  requiredFields: {},
  dropdownOptions: DEFAULT_DROPDOWN_OPTIONS,
};

const LANGUAGES = DEFAULT_DROPDOWN_OPTIONS.preferredLanguage;

const RequiredStar = () => <span className="text-red-500">*</span>;

const CreateLead = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isCounselor = location.pathname.startsWith('/counselor');
  const leadsPath = isCounselor ? '/counselor/leads' : '/admin/leads';
  const { register, handleSubmit, watch, setValue, unregister, clearErrors, formState: { errors } } = useForm();
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const languageDropdownRef = useRef(null);
  const [previousSchooling, setPreviousSchooling] = useState(false); // OFF by default

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(e.target)) {
        setLanguageDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [institutions, setInstitutions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [formFields, setFormFields] = useState(DEFAULT_FORM_FIELDS);
  const [customData, setCustomData] = useState({});
  const selectedInstitution = watch('institution');

  const handleCustomFieldChange = (key, value) => {
    setCustomData((prev) => ({ ...prev, [key]: value }));
  };

  const isFieldRequired = (fieldKey) => {
    const rf = formFields.requiredFields || {};
    return rf[fieldKey] === true; // Only required if explicitly set in settings
  };

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

  // If Previous Schooling is OFF, hide academic fields and ensure they are not validated
  useEffect(() => {
    if (previousSchooling) return;
    unregister('currentClass');
    unregister('boardUniversity');
    unregister('marksPercentage');
    clearErrors(['currentClass', 'boardUniversity', 'marksPercentage']);
    setValue('currentClass', '');
    setValue('boardUniversity', '');
    setValue('marksPercentage', '');
  }, [previousSchooling, unregister, clearErrors, setValue]);

  // Load all active courses once for the Course / Program dropdown (not scoped by institution).
  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchInstitutions = async () => {
    try {
      const response = await institutionAPI.getAll({ isActive: 'true' });
      const instList = response.data?.data?.institutions ?? [];
      const normalizedList = Array.isArray(instList) ? instList : [];
      setInstitutions(normalizedList);
    } catch (error) {
      console.error('Error fetching institutions:', error);
      toast.error('Failed to load institutions. Please refresh the page.');
    } finally {
      setInstitutionsLoading(false);
    }
  };

  const fetchCourses = async () => {
    setCoursesLoading(true);
    try {
      const response = await courseAPI.getAll({ isActive: 'true', limit: 1000 });
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

  const handleInstitutionChange = () => {
    // Institution field is currently hidden in UI; handler kept for backward compatibility.
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      // Validation should be driven by Settings (Admin → Settings → Add New Lead Form)
      if (formFields.institution !== false && isFieldRequired('institution') && (!data.institution || data.institution === '')) {
        toast.error('Institution is required');
        setLoading(false);
        return;
      }
      if (formFields.course !== false && isFieldRequired('course') && (!data.course || data.course === '')) {
        toast.error('Course / Program is required');
        setLoading(false);
        return;
      }
      if (formFields.dateOfBirth !== false && isFieldRequired('dateOfBirth') && !data.dateOfBirth) {
        toast.error('Date of birth is required');
        setLoading(false);
        return;
      }
      const f = formFields;
      // Backend (/api/leads) still enforces some required fields and DB has non-null columns.
      // If a field is hidden or marked not-required in Settings, send safe defaults so schools
      // can manage the *form* without needing code changes.
      const safeText = (v, fallback) => {
        const s = (v ?? '').toString().trim();
        return s || fallback;
      };
      const safeEmail = (v) => {
        const s = (v ?? '').toString().trim().toLowerCase();
        return s || 'noreply@onboarding.local';
      };

      const parentNameVal =
        f.parentName === false || !isFieldRequired('parentName')
          ? safeText(data.parentName, 'N/A')
          : safeText(data.parentName, '');
      const parentMobileVal =
        f.parentMobile === false || !isFieldRequired('parentMobile')
          ? safeText(data.parentMobile, '0000000000')
          : safeText(data.parentMobile, '');
      const parentEmailVal =
        f.parentEmail === false || !isFieldRequired('parentEmail')
          ? safeEmail(data.parentEmail)
          : safeEmail(data.parentEmail);
      const parentCityVal =
        f.parentCity === false || !isFieldRequired('parentCity')
          ? safeText(data.parentCity, 'N/A')
          : safeText(data.parentCity, '');

      const studentNameVal =
        f.studentName === false || !isFieldRequired('studentName')
          ? safeText(data.studentName, 'N/A')
          : safeText(data.studentName, '');
      // Backend requires currentClass; when Previous Schooling is OFF we always send a safe value
      // since the UI intentionally hides academic fields.
      const currentClassVal = !previousSchooling
        ? 'N/A'
        : (f.currentClass === false || !isFieldRequired('currentClass')
            ? safeText(data.currentClass, 'N/A')
            : safeText(data.currentClass, ''));
      const academicYearVal =
        f.academicYear === false || !isFieldRequired('academicYear')
          ? safeText(data.academicYear, new Date().getFullYear() + '-' + (new Date().getFullYear() + 1))
          : safeText(data.academicYear, '');
      const preferredLanguageVal =
        selectedLanguages.length > 0
          ? selectedLanguages.join(', ')
          : f.preferredLanguage === false || !isFieldRequired('preferredLanguage')
            ? safeText(data.preferredLanguage, 'English')
            : safeText(data.preferredLanguage, 'English');

      // Find selected course to derive the correct institutionId for the lead.
      const selectedCourse = courses.find((c) => (c.id || c._id) === data.course);
      const institutionIdForLead =
        selectedCourse?.institutionId || data.institution || institutions[0]?.id || institutions[0]?._id;

      const formData = {
        parentName: parentNameVal,
        parentMobile: parentMobileVal,
        parentEmail: parentEmailVal,
        parentCity: parentCityVal,
        preferredLanguage: preferredLanguageVal,
        studentName: studentNameVal,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString() : undefined,
        gender: data.gender || 'Other',
        currentClass: currentClassVal,
        boardUniversity: f.boardUniversity !== false ? (data.boardUniversity?.trim() || '') : '',
        marksPercentage: f.marksPercentage !== false && data.marksPercentage ? parseFloat(data.marksPercentage) : undefined,
        institution: institutionIdForLead || undefined,
        course: data.course || undefined,
        academicYear: academicYearVal,
        preferredCounselingMode: data.preferredCounselingMode,
        notes: f.notes !== false ? (data.notes?.trim() || '') : '',
        consent: true,
        customData: Object.keys(customData).length > 0 ? customData : undefined,
        classification: ['NEW', 'COUNSELING_IN_PROGRESS', 'PRIORITY', 'ADMISSION_CONFIRMED'].includes(data.classification) ? data.classification : 'NEW',
        source: 'manual_entry',
      };

      const response = await leadAPI.create(formData);
      if (response.data?.success && response.data?.data?.leadId) {
        const { needsManualAssignment, assignmentWarning } = response.data.data;
        toast.success('Lead created successfully');
        if (needsManualAssignment && assignmentWarning) {
          toast(assignmentWarning, {
            icon: '⚠️',
            duration: 6000,
            style: { background: '#fef3c7', color: '#92400e' },
          });
        }
        navigate(leadsPath);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to create lead. Please try again.';
      toast.error(message);
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
    <div className="space-y-6">
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
          <h1 className="text-2xl font-bold text-gray-900">Create New Lead</h1>
          <p className="text-gray-600 mt-1">Add a new admission lead manually</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 sm:space-y-6 p-4 sm:p-6 max-w-4xl">
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Parent Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formFields.parentName !== false && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Name {isFieldRequired('parentName') ? <RequiredStar /> : null}
                </label>
                <input
                  type="text"
                  {...register('parentName', {
                    required: isFieldRequired('parentName') ? 'Parent name is required' : false,
                  })}
                  className="input-field"
                />
                {errors.parentName && (
                  <p className="text-red-500 text-xs mt-1">{errors.parentName.message}</p>
                )}
              </div>
            )}

            {formFields.parentMobile !== false && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Number {isFieldRequired('parentMobile') ? <RequiredStar /> : null}
                </label>
                <input
                  type="tel"
                  {...register('parentMobile', {
                    required: isFieldRequired('parentMobile') ? 'Mobile number is required' : false,
                  })}
                  className="input-field"
                />
                {errors.parentMobile && (
                  <p className="text-red-500 text-xs mt-1">{errors.parentMobile.message}</p>
                )}
              </div>
            )}

            {formFields.parentEmail !== false && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email {isFieldRequired('parentEmail') ? <RequiredStar /> : null}
                </label>
                <input
                  type="email"
                  {...register('parentEmail', {
                    required: isFieldRequired('parentEmail') ? 'Email is required' : false,
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                  className="input-field"
                />
                {errors.parentEmail && (
                  <p className="text-red-500 text-xs mt-1">{errors.parentEmail.message}</p>
                )}
              </div>
            )}

            {formFields.parentCity !== false && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City {isFieldRequired('parentCity') ? <RequiredStar /> : null}
                </label>
                <input
                  type="text"
                  {...register('parentCity', {
                    required: isFieldRequired('parentCity') ? 'City is required' : false,
                  })}
                  className="input-field"
                />
                {errors.parentCity && (
                  <p className="text-red-500 text-xs mt-1">{errors.parentCity.message}</p>
                )}
              </div>
            )}

            {formFields.preferredLanguage !== false && (
              <div className="relative" ref={languageDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Language
                </label>
                <button
                  type="button"
                  onClick={() => setLanguageDropdownOpen((prev) => !prev)}
                  className="input-field w-full text-left flex items-center justify-between"
                >
                  <span className={selectedLanguages.length === 0 ? 'text-gray-500' : ''}>
                    {selectedLanguages.length === 0
                      ? 'Select language(s)'
                      : selectedLanguages.join(', ')}
                  </span>
                  <span className="text-gray-400">{languageDropdownOpen ? '▲' : '▼'}</span>
                </button>
                {languageDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg py-1 max-h-48 overflow-auto">
                    {(formFields.dropdownOptions?.preferredLanguage || LANGUAGES).map((lang) => (
                      <label
                        key={lang}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedLanguages.includes(lang)}
                          onChange={() => {
                            setSelectedLanguages((prev) =>
                              prev.includes(lang)
                                ? prev.filter((l) => l !== lang)
                                : [...prev, lang]
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
            )}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender {isFieldRequired('gender') ? <RequiredStar /> : null}
              </label>
              <select
                {...register('gender', {
                  required: isFieldRequired('gender') ? 'Gender is required' : false,
                })}
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

            {/* Previous Schooling toggle (below Gender, above Current Class) */}
            {formFields.previousSchooling !== false && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Previous Schooling</label>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <span className="text-sm text-gray-600">
                    {previousSchooling ? 'Transfer admission' : 'First-time admission'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviousSchooling((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      previousSchooling ? 'bg-primary-600' : 'bg-gray-300'
                    }`}
                    aria-pressed={previousSchooling}
                    aria-label="Toggle previous schooling"
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        previousSchooling ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {formFields.academicSection !== false && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Academic Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Academic fields only when Previous Schooling is ON */}
              {previousSchooling && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Previously Completed Class {isFieldRequired('currentClass') ? <RequiredStar /> : null}
                  </label>
                  <input
                    type="text"
                    {...register('currentClass', {
                      required: isFieldRequired('currentClass') ? 'Current class is required' : false,
                    })}
                    className="input-field"
                    placeholder="e.g., 12th, B.Tech, etc."
                  />
                  {errors.currentClass && (
                    <p className="text-red-500 text-xs mt-1">{errors.currentClass.message}</p>
                  )}
                </div>
              )}
              {previousSchooling && formFields.boardUniversity !== false && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Previous Board / University {isFieldRequired('boardUniversity') ? <RequiredStar /> : null}
                  </label>
                  <input
                    type="text"
                    {...register('boardUniversity', {
                      required: isFieldRequired('boardUniversity')
                        ? 'Board / University is required'
                        : false,
                    })}
                    className="input-field"
                    placeholder="e.g., CBSE, State Board, etc."
                  />
                </div>
              )}
              {previousSchooling && formFields.marksPercentage !== false && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Previous Marks / Percentage {isFieldRequired('marksPercentage') ? <RequiredStar /> : null}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    {...register('marksPercentage', {
                      required: isFieldRequired('marksPercentage')
                        ? 'Marks / Percentage is required'
                        : false,
                      min: { value: 0, message: 'Marks must be between 0 and 100' },
                      max: { value: 100, message: 'Marks must be between 0 and 100' },
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
        )}

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Admission Preferences</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course / Program {isFieldRequired('course') ? <RequiredStar /> : null}
              </label>
              <select
                {...register('course', {
                  required: isFieldRequired('course') ? 'Course is required' : 'Course is required',
                })}
                className="input-field"
                disabled={coursesLoading}
              >
                <option value="">
                  {coursesLoading
                    ? 'Loading courses...'
                    : courses.length === 0
                      ? 'No courses available'
                      : 'Select Course'}
                </option>
                {courses.map((c) => (
                  <option key={c.id || c._id} value={c.id || c._id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
              {errors.course && (
                <p className="text-red-500 text-xs mt-1">{errors.course.message}</p>
              )}
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
                {(formFields.dropdownOptions?.preferredCounselingMode || DEFAULT_DROPDOWN_OPTIONS.preferredCounselingMode).map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
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
          <button
            type="submit"
            disabled={loading}
            className="btn-primary py-2.5 px-4 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Lead'}
          </button>
          <button
            type="button"
            onClick={() => navigate(leadsPath)}
            className="btn-secondary py-2.5 px-4"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateLead;

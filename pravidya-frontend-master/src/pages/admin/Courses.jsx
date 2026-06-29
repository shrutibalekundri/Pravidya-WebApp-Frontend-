import { useState, useEffect, useCallback } from 'react';
import { Building2 } from 'lucide-react';
import { courseAPI, institutionAPI, adminAPI } from '../../services/api';
import toast from 'react-hot-toast';
import CustomFieldInput from '../../components/CustomFieldInput';
import SearchableSelect from '../../components/SearchableSelect';
import SearchableMultiSelect from '../../components/SearchableMultiSelect';
import { DEGREE_TO_COURSES, DURATION_OPTIONS, ELIGIBILITY_OPTIONS } from '../../constants/degreeCourses';

const DEGREE_OPTIONS = [
  'B.E', 'B.Tech', 'B.Sc', 'B.Com', 'B.A', 'BBA', 'BCA', 'B.Pharm', 'B.Arch', 'BDS', 'MBBS',
  'M.E', 'M.Tech', 'M.Sc', 'M.Com', 'M.A', 'MBA', 'MCA', 'M.Pharm', 'M.Arch', 'MDS', 'MD', 'MS',
  'Ph.D', 'Diploma', 'PG Diploma', 'Integrated B.Tech-M.Tech', 'Integrated B.Sc-M.Sc'
];

// Normalize institution display name so variants show consistently
function normalizeInstitutionDisplayName(name) {
  if (!name || typeof name !== 'string') return name;
  const n = name.trim();
  if (/KLE\s*TE?chnological?\s*University/i.test(n)) return 'KLE Technological University';
  if (/KLE\s*Tech\s*University/i.test(n)) return 'KLE Technological University';
  return n;
}

const AdminCourses = () => {
  const [groups, setGroups] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [deletingCourse, setDeletingCourse] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    degree: '',
    description: '',
    institution: '',
    duration: '',
    eligibility: '',
    isActive: true,
    board: '',
    standardRange: '',
    stream: '',
    seats: '',
    admissionsOpen: true,
    customData: {},
  });
  const [courseFields, setCourseFields] = useState({ customFields: [] });
  const [schoolCourseFields, setSchoolCourseFields] = useState({ customFields: [] });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    adminAPI.getSettings().then((res) => {
      const d = res.data?.data?.courseFields;
      if (d) {
        setCourseFields((prev) => ({
          ...prev,
          ...d,
          customFields: d.customFields || prev.customFields,
        }));
      }
    }).catch(() => {});
  }, []);
  const [institutionFilter, setInstitutionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [expandedInstitutions, setExpandedInstitutions] = useState(new Set());

  const selectedInstitutionForForm = formData.institution
    ? institutions.find((i) => i.id === formData.institution) || groups.find((g) => g.institutionId === formData.institution)
    : null;
  const selectedInstType = selectedInstitutionForForm?.type ?? selectedInstitutionForForm?.institutionType;
  const isSchoolCourseForm = selectedInstType === 'School';
  const boardsForSelect = selectedInstitutionForForm?.boardsOffered ?? [];
  const standardsForSelect = selectedInstitutionForForm?.standardsAvailable ?? [];
  const streamsForSelect = selectedInstitutionForForm?.streamsOffered ?? [];
  const hasSeniorSecondary = (standardsForSelect || []).includes('11–12');

  const COURSE_FIELDS_REQUIRED_ALWAYS = ['name', 'institution'];
  const isCourseFieldVisible = (key) => courseFields[key] !== false;
  const isCourseFieldRequired = (key) =>
    COURSE_FIELDS_REQUIRED_ALWAYS.includes(key) || courseFields.requiredFields?.[key] === true;

  const SCHOOL_COURSE_FIELDS_REQUIRED_ALWAYS = ['board', 'standardRange'];
  const isSchoolCourseFieldVisible = (key) => schoolCourseFields[key] !== false;
  const isSchoolCourseFieldRequired = (key) =>
    SCHOOL_COURSE_FIELDS_REQUIRED_ALWAYS.includes(key) || schoolCourseFields.requiredFields?.[key] === true;

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        ...(searchInput.trim() && { search: searchInput.trim() }),
        ...(institutionFilter && { institution: institutionFilter }),
        ...(statusFilter !== '' && { isActive: statusFilter }),
      };
      const response = await courseAPI.getAllGrouped(params);
      const data = response.data?.data;
      const groupList = data?.groups ?? [];
      setGroups(groupList);
      setExpandedInstitutions(new Set(groupList.map((g) => g.institutionId)));
    } catch (error) {
      toast.error('Failed to load courses');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [searchInput, institutionFilter, statusFilter]);

  const fetchInstitutions = useCallback(async () => {
    try {
      const response = await institutionAPI.getAll({ limit: 200 });
      setInstitutions(response.data?.data?.institutions ?? []);
    } catch (error) {
      toast.error('Failed to load institutions');
    }
  }, []);

  useEffect(() => {
    fetchInstitutions();
  }, [fetchInstitutions]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    fetchCourses();
  };

  const toggleInstitution = (institutionId) => {
    setExpandedInstitutions((prev) => {
      const next = new Set(prev);
      if (next.has(institutionId)) next.delete(institutionId);
      else next.add(institutionId);
      return next;
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCustomFieldChange = (key, value) => {
    setFormData((prev) => ({ ...prev, customData: { ...(prev.customData || {}), [key]: value } }));
  };

  const handleMultiCheckboxChange = (key, option, checked) => {
    setFormData(prev => {
      const current = Array.isArray(prev.customData?.[key]) ? prev.customData[key] : [];
      const next = checked ? [...current, option] : current.filter((o) => o !== option);
      return { ...prev, customData: { ...prev.customData, [key]: next } };
    });
  };

  const handleAddNew = () => {
    setEditingCourse(null);
    setFormData({
      name: '', code: '', degree: '', description: '', institution: '', duration: '', eligibility: '', isActive: true,
      board: '', standardRange: '', stream: '', seats: '', admissionsOpen: true, customData: {},
    });
    setShowModal(true);
  };

  const handleEdit = (course, institutionId, institutionType, institutionAdmissionsOpen) => {
    setEditingCourse(course.id);
    const isSchool = institutionType === 'School';
    const effectiveAdmissionsOpen = course.admissionsOpen !== undefined && course.admissionsOpen !== null
      ? course.admissionsOpen
      : (institutionAdmissionsOpen ?? true);
    setFormData({
      name: course.name || '',
      code: course.code || '',
      degree: course.degree || '',
      description: course.description || '',
      institution: institutionId || course.institutionId || '',
      duration: course.duration || '',
      eligibility: course.eligibility || '',
      isActive: course.isActive !== undefined ? course.isActive : true,
      board: course.board || '',
      standardRange: course.standardRange || '',
      stream: course.stream || '',
      seats: course.seats != null ? String(course.seats) : '',
      admissionsOpen: effectiveAdmissionsOpen,
      customData: course.customData && typeof course.customData === 'object' ? { ...course.customData } : {},
    });
    setShowModal(true);
  };

  const handleDelete = (course) => {
    setDeletingCourse(course);
  };

  const confirmDelete = async () => {
    if (!deletingCourse) return;
    setSubmitting(true);
    try {
      await courseAPI.delete(deletingCourse.id);
      toast.success('Course deleted successfully');
      setDeletingCourse(null);
      fetchCourses();
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to delete course';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const inst = selectedInstitutionForForm;
    const isSchool = inst?.type === 'School' || inst?.institutionType === 'School';
    if (!formData.institution) {
      toast.error('Please select an institution');
      return;
    }
    if (isSchool) {
      if (isSchoolCourseFieldVisible('board') && isSchoolCourseFieldRequired('board') && !(formData.board && formData.board.trim())) {
        toast.error('Board is required');
        return;
      }
      if (isSchoolCourseFieldVisible('standardRange') && isSchoolCourseFieldRequired('standardRange') && !(formData.standardRange && formData.standardRange.trim())) {
        toast.error('Standard Range is required');
        return;
      }
      if (isSchoolCourseFieldVisible('stream') && isSchoolCourseFieldRequired('stream') && formData.standardRange === '11–12' && !(formData.stream && formData.stream.trim())) {
        toast.error('Stream is required when Standard range is 11–12');
        return;
      }
      if (isSchoolCourseFieldVisible('seats') && isSchoolCourseFieldRequired('seats') && (formData.seats == null || formData.seats === '')) {
        toast.error('Seats is required');
        return;
      }
    } else {
      if (isCourseFieldVisible('name') && isCourseFieldRequired('name') && !(formData.name && formData.name.trim())) {
        toast.error('Course name is required');
        return;
      }
      if (!(formData.degree && formData.degree.trim())) {
        toast.error('Degree is required');
        return;
      }
      if (isCourseFieldVisible('description') && isCourseFieldRequired('description') && !(formData.description && formData.description.trim())) {
        toast.error('Description is required');
        return;
      }
      if (isCourseFieldVisible('code') && isCourseFieldRequired('code') && !(formData.code && formData.code.trim())) {
        toast.error('Course code is required');
        return;
      }
      if (isCourseFieldVisible('duration') && isCourseFieldRequired('duration') && !(formData.duration && formData.duration.trim())) {
        toast.error('Duration is required');
        return;
      }
      if (isCourseFieldVisible('eligibility') && isCourseFieldRequired('eligibility') && !(formData.eligibility && formData.eligibility.trim())) {
        toast.error('Eligibility is required');
        return;
      }
      if (isCourseFieldVisible('stream') && isCourseFieldRequired('stream') && !(formData.stream && formData.stream.trim())) {
        toast.error('Stream is required');
        return;
      }
      if (isCourseFieldVisible('seats') && isCourseFieldRequired('seats') && (formData.seats == null || formData.seats === '')) {
        toast.error('Seats is required');
        return;
      }
    }
    setSubmitting(true);
    try {
      const submitData = {
        ...formData,
        institution: formData.institution,
        seats: formData.seats ? parseInt(formData.seats, 10) : null,
        admissionsOpen: formData.admissionsOpen === true || formData.admissionsOpen === 'true',
      };
      if (Object.keys(formData.customData || {}).length > 0) {
        submitData.customData = formData.customData;
      }
      if (editingCourse) {
        await courseAPI.update(editingCourse, submitData);
        toast.success('Updated successfully');
      } else {
        await courseAPI.create(submitData);
        toast.success('Created successfully');
      }
      setShowModal(false);
      setEditingCourse(null);
      setFormData({
        name: '', code: '', degree: '', description: '', institution: '', duration: '', eligibility: '', isActive: true, customData: {},
        board: '', standardRange: '', stream: '', seats: '', admissionsOpen: true,
      });
      fetchCourses();
    } catch (error) {
      const errMsg = error.response?.data?.message || (editingCourse ? 'Failed to update' : 'Failed to create');
      const errList = error.response?.data?.errors;
      if (Array.isArray(errList) && errList.length) {
        toast.error(errList.map((e) => e.msg || e.message).join('; '));
      } else {
        toast.error(errMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCourse(null);
    setFormData({
      name: '', code: '', degree: '', description: '', institution: '', duration: '', eligibility: '', isActive: true,
      board: '', standardRange: '', stream: '', seats: '', admissionsOpen: true, customData: {},
    });
  };

  const handleFilterChange = (key, value) => {
    if (key === 'institution') setInstitutionFilter(value);
    if (key === 'status') setStatusFilter(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Courses Management</h1>
          <p className="text-gray-600 mt-1">Manage courses and programs by institution</p>
        </div>
        <button onClick={handleAddNew} className="btn-primary shrink-0">
          Add New Course
        </button>
      </div>

      <div className="rounded-xl shadow-sm border border-gray-200 bg-white overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50/50">
          <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder="Search by course name or code..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="input-field flex-1 min-w-0"
              />
              <button type="submit" className="btn-primary px-4 shrink-0">
                Search
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                value={institutionFilter}
                onChange={(e) => handleFilterChange('institution', e.target.value)}
                className="input-field w-full sm:w-auto min-w-[180px]"
              >
                <option value="">All Institutions</option>
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="input-field w-full sm:w-auto min-w-[140px]"
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </form>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
                  <div className="space-y-2">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="h-10 bg-gray-200 rounded" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <span className="text-4xl">📚</span>
                <p className="font-medium">No courses found</p>
                <p className="text-sm">Try adjusting filters or add a new course.</p>
                <button onClick={handleAddNew} className="btn-primary mt-2">
                  Add New Course
                </button>
              </div>
            </div>
          ) : (
            groups.map((group) => {
              const isExpanded = expandedInstitutions.has(group.institutionId);
              const displayName = normalizeInstitutionDisplayName(group.institutionName);
              const courseCount = group.courses?.length ?? 0;
              return (
                <div
                  key={group.institutionId}
                  className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleInstitution(group.institutionId)}
                    className="w-full flex items-center justify-between gap-4 p-4 sm:p-5 text-left bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-7 h-7 text-gray-600 shrink-0" strokeWidth={1.8} />
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">{displayName}</h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {courseCount} course{courseCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-gray-400 shrink-0">
                      {isExpanded ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </span>
                  </button>

                  {isExpanded && courseCount > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr className="border-b border-gray-200">
                            {group.institutionType === 'School' ? (
                              <>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Board</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Standard Range</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Stream</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Seats</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Admissions Open</th>
                              </>
                            ) : (
                              <>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Course Name</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Degree</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Duration</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Seats</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Admissions Open</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                              </>
                            )}
                            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {group.courses.map((course) => (
                            <tr key={course.id} className="hover:bg-blue-50/50 transition-colors">
                              {group.institutionType === 'School' ? (
                                <>
                                  <td className="py-3 px-4 font-medium text-gray-900">{course.board || '—'}</td>
                                  <td className="py-3 px-4 text-sm text-gray-700">{course.standardRange || '—'}</td>
                                  <td className="py-3 px-4 text-sm text-gray-700">{course.stream || '—'}</td>
                                  <td className="py-3 px-4 text-sm text-gray-700">{course.seats != null ? course.seats : '—'}</td>
                                  <td className="py-3 px-4">
                                    {(() => {
                                      const effectiveOpen = course.admissionsOpen ?? group.institutionAdmissionsOpen ?? false;
                                      return (
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${effectiveOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                                          {effectiveOpen ? 'Open' : 'Closed'}
                                        </span>
                                      );
                                    })()}
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="py-3 px-4">
                                    <div className="font-medium text-gray-900">{course.name}</div>
                                    {course.description && <div className="text-sm text-gray-500 mt-0.5 line-clamp-1">{course.description}</div>}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-gray-600">{course.degree || '—'}</td>
                                  <td className="py-3 px-4 text-sm text-gray-600">{course.duration || '—'}</td>
                                  <td className="py-3 px-4 text-sm text-gray-700">{course.seats != null ? course.seats : '—'}</td>
                                  <td className="py-3 px-4">
                                    {(() => {
                                      const effectiveOpen = course.admissionsOpen ?? group.institutionAdmissionsOpen ?? false;
                                      return (
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${effectiveOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                                          {effectiveOpen ? 'Open' : 'Closed'}
                                        </span>
                                      );
                                    })()}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${course.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                                      {course.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                </>
                              )}
                              <td className="py-3 px-4 text-right">
                                <div className="flex justify-end gap-1">
                                  <button onClick={() => handleEdit(course, group.institutionId, group.institutionType, group.institutionAdmissionsOpen)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors" title="Edit">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  </button>
                                  <button onClick={() => handleDelete(course)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {isExpanded && courseCount === 0 && (
                    <div className="py-8 px-4 text-center text-gray-500 text-sm">
                      No courses in this institution. Add a course using the button above.
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add/Edit Course Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingCourse ? (isSchoolCourseForm ? 'Edit Admission Entry' : 'Edit Course') : (isSchoolCourseForm ? 'Add Admission Entry' : 'Add New Course')}
                </h2>
                <button onClick={handleCloseModal} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <span className="text-2xl leading-none">×</span>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Institution <span className="text-red-500">*</span></label>
                  <select name="institution" value={formData.institution} onChange={handleInputChange} className="input-field" required disabled={!!editingCourse}>
                    <option value="">Select Institution</option>
                    {institutions.map((inst) => (
                      <option key={inst.id} value={inst.id}>{inst.name} ({inst.type})</option>
                    ))}
                  </select>
                  {editingCourse && <p className="text-xs text-gray-500 mt-1">Institution cannot be changed when editing.</p>}
                </div>

                {isSchoolCourseForm ? (
                  <>
                    {isSchoolCourseFieldVisible('board') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Board {isSchoolCourseFieldRequired('board') && <span className="text-red-500">*</span>}</label>
                        <select name="board" value={formData.board} onChange={handleInputChange} className="input-field" required={isSchoolCourseFieldRequired('board')}>
                          <option value="">Select Board</option>
                          {(boardsForSelect || []).map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                        {boardsForSelect.length === 0 && formData.institution && <p className="text-xs text-amber-600 mt-1">Add boards in the institution (School) profile first.</p>}
                      </div>
                    )}
                    {isSchoolCourseFieldVisible('standardRange') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Standard Range {isSchoolCourseFieldRequired('standardRange') && <span className="text-red-500">*</span>}</label>
                        <select name="standardRange" value={formData.standardRange} onChange={handleInputChange} className="input-field" required={isSchoolCourseFieldRequired('standardRange')}>
                          <option value="">Select Standard Range</option>
                          {(standardsForSelect || []).map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {isSchoolCourseFieldVisible('stream') && hasSeniorSecondary && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Stream (for 11–12) {isSchoolCourseFieldRequired('stream') && <span className="text-red-500">*</span>}</label>
                        <select name="stream" value={formData.stream} onChange={handleInputChange} className="input-field" required={isSchoolCourseFieldRequired('stream') && formData.standardRange === '11–12'}>
                          <option value="">Select Stream</option>
                          {(streamsForSelect || []).map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {isSchoolCourseFieldVisible('seats') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Seats {isSchoolCourseFieldRequired('seats') && <span className="text-red-500">*</span>}</label>
                        <input type="number" name="seats" value={formData.seats} onChange={handleInputChange} className="input-field" min={0} placeholder="Optional" required={isSchoolCourseFieldRequired('seats')} />
                      </div>
                    )}
                    {isSchoolCourseFieldVisible('admissionsOpen') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Admissions Open {isSchoolCourseFieldRequired('admissionsOpen') && <span className="text-red-500">*</span>}</label>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-sm font-medium ${!formData.admissionsOpen ? 'text-gray-500' : 'text-gray-700'}`}>Closed</span>
                          <button type="button" role="switch" onClick={() => setFormData((prev) => ({ ...prev, admissionsOpen: !prev.admissionsOpen }))} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${formData.admissionsOpen ? 'bg-primary-600' : 'bg-gray-200'}`}>
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${formData.admissionsOpen ? 'translate-x-5' : 'translate-x-1'}`} />
                          </button>
                          <span className={`text-sm font-medium ${formData.admissionsOpen ? 'text-primary-700' : 'text-gray-500'}`}>Open</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Degree <span className="text-red-500">*</span></label>
                        <SearchableSelect
                          value={formData.degree}
                          onChange={(v) => setFormData((prev) => {
                            const baseCourses = DEGREE_TO_COURSES[v] || [];
                            const keepName = v && prev.name && baseCourses.includes(prev.name);
                            return { ...prev, degree: v, name: keepName ? prev.name : '' };
                          })}
                          options={[...new Set([...(formData.degree && !DEGREE_OPTIONS.includes(formData.degree) ? [formData.degree] : []), ...DEGREE_OPTIONS])]}
                          placeholder="Search or select degree..."
                          className="input-field"
                          required
                        />
                      </div>
                      {isCourseFieldVisible('name') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Course Name {isCourseFieldRequired('name') && <span className="text-red-500">*</span>}</label>
                          <SearchableSelect
                            value={formData.name}
                            onChange={(v) => setFormData((prev) => ({ ...prev, name: v }))}
                            options={(() => {
                              const base = DEGREE_TO_COURSES[formData.degree] || [];
                              if (formData.name && !base.includes(formData.name)) return [formData.name, ...base];
                              return base;
                            })()}
                            placeholder={formData.degree ? 'Search or select course...' : 'Select degree first'}
                            className={`input-field ${!formData.degree ? 'cursor-not-allowed bg-gray-50 opacity-75' : ''}`}
                            required={isCourseFieldRequired('name')}
                            disabled={!formData.degree}
                            allowCustom
                          />
                          {!formData.degree && <p className="text-xs text-amber-600 mt-0.5">Select a degree to see course options</p>}
                        </div>
                      )}
                    </div>
                    {isCourseFieldVisible('code') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Course Code {isCourseFieldRequired('code') && <span className="text-red-500">*</span>}</label>
                        <input type="text" name="code" value={formData.code} onChange={handleInputChange} className="input-field" required={isCourseFieldRequired('code')} />
                      </div>
                    )}
                    {isCourseFieldVisible('description') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description {isCourseFieldRequired('description') && <span className="text-red-500">*</span>}</label>
                        <textarea name="description" value={formData.description} onChange={handleInputChange} className="input-field" rows={3} required={isCourseFieldRequired('description')} />
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {isCourseFieldVisible('duration') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Duration {isCourseFieldRequired('duration') && <span className="text-red-500">*</span>}</label>
                          <SearchableSelect
                            value={formData.duration}
                            onChange={(v) => setFormData((prev) => ({ ...prev, duration: v }))}
                            options={formData.duration && !DURATION_OPTIONS.includes(formData.duration) ? [formData.duration, ...DURATION_OPTIONS] : DURATION_OPTIONS}
                            placeholder="Select or type duration..."
                            className="input-field"
                            required={isCourseFieldRequired('duration')}
                            allowCustom
                          />
                        </div>
                      )}
                      {isCourseFieldVisible('eligibility') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Eligibility {isCourseFieldRequired('eligibility') && <span className="text-red-500">*</span>}</label>
                          <SearchableMultiSelect
                            value={formData.eligibility}
                            onChange={(v) => setFormData((prev) => ({ ...prev, eligibility: v }))}
                            options={(() => {
                              const base = ELIGIBILITY_OPTIONS;
                              const current = (formData.eligibility || '').split(',').map((s) => s.trim()).filter(Boolean);
                              const extra = current.filter((c) => !base.includes(c));
                              return [...new Set([...extra, ...base])];
                            })()}
                            placeholder="Select or type eligibility (multiple)..."
                            required={isCourseFieldRequired('eligibility')}
                            allowCustom
                          />
                        </div>
                      )}
                    </div>
                    {isCourseFieldVisible('stream') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Stream {isCourseFieldRequired('stream') && <span className="text-red-500">*</span>}</label>
                        <select name="stream" value={formData.stream} onChange={handleInputChange} className="input-field" required={isCourseFieldRequired('stream')}>
                          <option value="">Select Stream</option>
                          {(streamsForSelect || []).map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {isCourseFieldVisible('seats') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Seats {isCourseFieldRequired('seats') && <span className="text-red-500">*</span>}</label>
                        <input type="number" name="seats" value={formData.seats} onChange={handleInputChange} className="input-field" min={0} placeholder="Optional" required={isCourseFieldRequired('seats')} />
                      </div>
                    )}
                    {(isCourseFieldVisible('admissionsOpen') || isCourseFieldVisible('isActive')) && (
                      <div className="flex flex-wrap gap-6">
                        {isCourseFieldVisible('admissionsOpen') && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Admissions Open {isCourseFieldRequired('admissionsOpen') && <span className="text-red-500">*</span>}</label>
                            <div className="flex items-center gap-2 mt-1">
                              <button type="button" role="switch" onClick={() => setFormData((prev) => ({ ...prev, admissionsOpen: !prev.admissionsOpen }))} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${formData.admissionsOpen ? 'bg-primary-600' : 'bg-gray-200'}`}>
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${formData.admissionsOpen ? 'translate-x-5' : 'translate-x-1'}`} />
                              </button>
                              <span className="text-sm">{formData.admissionsOpen ? 'Open' : 'Closed'}</span>
                            </div>
                          </div>
                        )}
                        {isCourseFieldVisible('isActive') && (
                          <div>
                            <label className="flex items-center gap-2 mt-6">
                              <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleInputChange} className="rounded" />
                              <span className="text-sm font-medium text-gray-700">Active</span>
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {((isSchoolCourseForm ? schoolCourseFields.customFields : courseFields.customFields) || []).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(isSchoolCourseForm ? schoolCourseFields.customFields : courseFields.customFields || []).map((f) => (
                    <div key={f.key}>
                      <CustomFieldInput
                        field={f}
                        value={formData.customData?.[f.key]}
                        onChange={handleCustomFieldChange}
                        required={f.required}
                      />
                    </div>
                  ))}
                </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={handleCloseModal} className="btn-secondary" disabled={submitting}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? (editingCourse ? 'Updating...' : 'Creating...') : (editingCourse ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Delete Course</h2>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete <strong>{deletingCourse.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeletingCourse(null)} className="btn-secondary" disabled={submitting}>Cancel</button>
                <button onClick={confirmDelete} className="btn-primary bg-red-600 hover:bg-red-700" disabled={submitting}>
                  {submitting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCourses;

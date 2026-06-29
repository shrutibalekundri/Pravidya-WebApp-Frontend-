import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { institutionAPI, courseAPI, adminAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { fetchLocationByPincode } from '../../utils/pincodeLookup';
import { BoardGradeSelector, defaultBoardGradeMapValue, hasAnyGrade } from '../../components/BoardGradeSelector';
import CustomFieldInput from '../../components/CustomFieldInput';
import SearchableSelect from '../../components/SearchableSelect';
import SearchableMultiSelect from '../../components/SearchableMultiSelect';
import { DEGREE_TO_COURSES, DURATION_OPTIONS, ELIGIBILITY_OPTIONS } from '../../constants/degreeCourses';

const BOARD_OPTIONS = ['CBSE', 'ICSE', 'State Board', 'IB', 'IGCSE'];
const STANDARD_RANGES = ['1-5', '6-10', '11-12'];
const STREAM_OPTIONS = ['Science', 'Commerce', 'Arts'];

const DEGREE_OPTIONS = [
  'B.E', 'B.Tech', 'B.Sc', 'B.Com', 'B.A', 'BBA', 'BCA', 'B.Pharm', 'B.Arch', 'BDS', 'MBBS',
  'M.E', 'M.Tech', 'M.Sc', 'M.Com', 'M.A', 'MBA', 'MCA', 'M.Pharm', 'M.Arch', 'MDS', 'MD', 'MS',
  'Ph.D', 'Diploma', 'PG Diploma', 'Integrated B.Tech-M.Tech', 'Integrated B.Sc-M.Sc'
];

const defaultBoardsByStandard = () => ({ '1-5': [], '6-10': [], '11-12': [] });
const defaultAdmissionsOpenByStandard = () => ({ '1-5': true, '6-10': true, '11-12': true });
const defaultBoardGradeMap = () => ({});

const MAX_LOGO_SIZE = 256;
const MAX_LOGO_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_LOGO_FILE_SIZE_LABEL = '2 MB';

const EditInstitution = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({ boards: '', grades: '' });
  const [courses, setCourses] = useState([]);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [courseForm, setCourseForm] = useState({ name: '', code: '', description: '', duration: '', eligibility: '', isActive: true });
  const [courseSubmitting, setCourseSubmitting] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState(null);
  const [viewingCourse, setViewingCourse] = useState(null);
  const [institutionFields, setInstitutionFields] = useState({ customFields: [], requiredFields: {} });

  const isInstitutionFieldVisible = (key) => institutionFields[key] !== false;
  const isInstitutionFieldRequired = (key) =>
    ['name', 'type'].includes(key) || institutionFields.requiredFields?.[key] === true;
  const [courseFields, setCourseFields] = useState({ customFields: [], requiredFields: {} });
  const [locationOptions, setLocationOptions] = useState({ cities: [], states: [], loading: false });

  const isCourseFieldVisible = (key) => courseFields[key] !== false;
  const isCourseFieldRequired = (key) =>
    ['name', 'degree'].includes(key) || courseFields.requiredFields?.[key] === true;

  const isSchool = formData?.type === 'School';
  const boardGradeMap = formData?.boardGradeMap && typeof formData.boardGradeMap === 'object' ? formData.boardGradeMap : defaultBoardGradeMap();
  const selectedBoards = Object.keys(boardGradeMap).filter((b) => b);
  const hasSeniorSecondary = selectedBoards.some((b) => (boardGradeMap[b]?.high || []).length > 0);

  useEffect(() => {
    if (id) fetchInstitution();
  }, [id]);

  const filterOutColorField = (arr) => (arr || []).filter((f) => f.key !== 'color');

  const fetchSettings = () => {
    adminAPI.getSettings().then((res) => {
      const data = res.data?.data || {};
      const inst = data.institutionFields;
      if (inst) {
        const rf = inst && typeof inst.requiredFields === 'object' ? inst.requiredFields : {};
        setInstitutionFields((prev) => ({
          ...prev,
          ...inst,
          customFields: filterOutColorField(inst.customFields),
          schoolCustomFields: filterOutColorField(inst.schoolCustomFields),
          collegeCustomFields: filterOutColorField(inst.collegeCustomFields),
          requiredFields: { ...(prev.requiredFields || {}), ...rf },
        }));
      }
      const course = data.courseFields;
      if (course) setCourseFields((prev) => ({ ...prev, ...course, customFields: course.customFields || prev.customFields }));
    }).catch(() => {});
  };

  useEffect(() => {
    fetchSettings();
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') fetchSettings(); };
    const onSettingsUpdated = () => fetchSettings();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('settings-updated', onSettingsUpdated);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('settings-updated', onSettingsUpdated);
    };
  }, []);

  const fetchInstitution = async () => {
    setLoading(true);
    try {
      const res = await institutionAPI.getById(id);
      const inst = res.data?.data?.institution;
      if (!inst) throw new Error('Institution not found');
      setFormData(buildFormData(inst));
      setCourses(inst.courses || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load institution');
      navigate('/admin/institutions');
    } finally {
      setLoading(false);
    }
  };

  const buildFormData = (institution) => {
    let boardsByStandard = defaultBoardsByStandard();
    if (institution.boardsByStandard && typeof institution.boardsByStandard === 'object') {
      boardsByStandard = {
        '1-5': Array.isArray(institution.boardsByStandard['1-5']) ? institution.boardsByStandard['1-5'] : [],
        '6-10': Array.isArray(institution.boardsByStandard['6-10']) ? institution.boardsByStandard['6-10'] : [],
        '11-12': Array.isArray(institution.boardsByStandard['11-12']) ? institution.boardsByStandard['11-12'] : [],
      };
    }
    let boardGradeMap = defaultBoardGradeMap();
    if (institution.boardGradeMap && typeof institution.boardGradeMap === 'object' && Object.keys(institution.boardGradeMap).length > 0) {
      boardGradeMap = { ...institution.boardGradeMap };
    } else if (boardsByStandard && (boardsByStandard['1-5']?.length || boardsByStandard['6-10']?.length || boardsByStandard['11-12']?.length)) {
      const allBoards = new Set([...(boardsByStandard['1-5'] || []), ...(boardsByStandard['6-10'] || []), ...(boardsByStandard['11-12'] || [])]);
      allBoards.forEach((board) => {
        boardGradeMap[board] = {
          primary: (boardsByStandard['1-5'] || []).includes(board) ? [1, 2, 3, 4, 5] : [],
          middle: (boardsByStandard['6-10'] || []).includes(board) ? [6, 7, 8, 9, 10] : [],
          high: (boardsByStandard['11-12'] || []).includes(board) ? [11, 12] : [],
        };
      });
    }
    let admissionsOpenByStandard = defaultAdmissionsOpenByStandard();
    if (institution.admissionsOpenByStandard && typeof institution.admissionsOpenByStandard === 'object') {
      admissionsOpenByStandard = {
        '1-5': institution.admissionsOpenByStandard['1-5'] !== false,
        '6-10': institution.admissionsOpenByStandard['6-10'] !== false,
        '11-12': institution.admissionsOpenByStandard['11-12'] !== false,
      };
    }
    return {
      name: institution.name || '',
      type: institution.type || 'College',
      address: institution.address || '',
      pincode: institution.pincode || '',
      city: institution.city || '',
      state: institution.state || '',
      isActive: institution.isActive !== undefined ? institution.isActive : true,
      logoUrl: institution.logoUrl || '',
      boardsOffered: Array.isArray(institution.boardsOffered) ? institution.boardsOffered : [],
      standardsAvailable: Array.isArray(institution.standardsAvailable) ? institution.standardsAvailable : [],
      streamsOffered: Array.isArray(institution.streamsOffered) ? institution.streamsOffered : [],
      admissionsOpen: institution.admissionsOpen !== undefined ? institution.admissionsOpen : true,
      admissionsOpenByStandard,
      boardsByStandard,
      boardGradeMap,
      customData: institution.customData && typeof institution.customData === 'object' ? { ...institution.customData } : {},
    };
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

  const handlePincodeChange = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
    setFormData((prev) => ({ ...prev, pincode: v }));
  };

  const handlePincodeLookup = async () => {
    const pin = (formData?.pincode ?? '').toString().trim();
    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      toast.error('Enter a valid 6-digit pincode');
      return;
    }
    setLocationOptions((prev) => ({ ...prev, loading: true }));
    const { cities, states, error } = await fetchLocationByPincode(pin);
    setLocationOptions({ cities, states, loading: false });
    if (error) {
      toast.error(error);
      return;
    }
    setFormData((prev) => {
      const next = { ...prev };
      if (states.length === 1) next.state = states[0];
      if (cities.length === 1) next.city = cities[0];
      return next;
    });
    if (cities.length > 0 || states.length > 0) {
      toast.success('Location loaded from pincode');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'type') {
        if (value === 'College') {
          next.boardsOffered = []; next.standardsAvailable = []; next.streamsOffered = [];
          next.admissionsOpen = true; next.admissionsOpenByStandard = defaultAdmissionsOpenByStandard();
          next.boardsByStandard = defaultBoardsByStandard(); next.boardGradeMap = defaultBoardGradeMap();
        }
      }
      return next;
    });
  };

  const toggleMulti = (field, option) => {
    setFormData(prev => {
      const arr = prev[field] || [];
      const set = new Set(arr);
      if (set.has(option)) set.delete(option); else set.add(option);
      return { ...prev, [field]: Array.from(set) };
    });
  };

  const toggleBoard = (board) => {
    setFormData(prev => {
      const map = { ...(prev.boardGradeMap && typeof prev.boardGradeMap === 'object' ? prev.boardGradeMap : {}) };
      if (map[board]) delete map[board]; else map[board] = defaultBoardGradeMapValue();
      return { ...prev, boardGradeMap: map };
    });
    setValidationErrors(prev => ({ ...prev, boards: '', grades: '' }));
  };

  const updateBoardGrades = (board, value) => {
    setFormData(prev => {
      const map = { ...(prev.boardGradeMap && typeof prev.boardGradeMap === 'object' ? prev.boardGradeMap : {}) };
      map[board] = value && typeof value === 'object' ? value : defaultBoardGradeMapValue();
      return { ...prev, boardGradeMap: map };
    });
    setValidationErrors(prev => ({ ...prev, grades: '' }));
  };

  const handleLogoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); e.target.value = ''; return; }
    if (file.size > MAX_LOGO_FILE_SIZE_BYTES) { toast.error(`Logo too large. Max ${MAX_LOGO_FILE_SIZE_LABEL}`); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > MAX_LOGO_SIZE || h > MAX_LOGO_SIZE) {
          if (w > h) { h = (h / w) * MAX_LOGO_SIZE; w = MAX_LOGO_SIZE; } else { w = (w / h) * MAX_LOGO_SIZE; h = MAX_LOGO_SIZE; }
        }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        setFormData(prev => ({ ...prev, logoUrl: canvas.toDataURL('image/jpeg', 0.85) }));
      };
      img.onerror = () => setFormData(prev => ({ ...prev, logoUrl: dataUrl }));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isInstitutionFieldVisible('name') && isInstitutionFieldRequired('name') && !formData.name?.trim()) {
      toast.error('Institution name is required'); return;
    }
    if (isInstitutionFieldVisible('type') && isInstitutionFieldRequired('type') && !formData.type) {
      toast.error('Type is required'); return;
    }
    if (isInstitutionFieldVisible('logoUrl') && isInstitutionFieldRequired('logoUrl') && !formData.logoUrl?.trim()) {
      toast.error('Logo is required'); return;
    }
    if (isInstitutionFieldVisible('address') && isInstitutionFieldRequired('address') && !formData.address?.trim()) {
      toast.error('Address is required'); return;
    }
    if (isInstitutionFieldVisible('city') && isInstitutionFieldRequired('city') && !formData.city?.trim()) {
      toast.error('City is required'); return;
    }
    if (isInstitutionFieldVisible('state') && isInstitutionFieldRequired('state') && !formData.state?.trim()) {
      toast.error('State is required'); return;
    }
    const payload = { ...formData };
    if (formData.type === 'School') {
      const map = formData.boardGradeMap && typeof formData.boardGradeMap === 'object' ? formData.boardGradeMap : {};
      const boards = Object.keys(map).filter((b) => b);
      if (isInstitutionFieldRequired('boardsOffered') && boards.length === 0) {
        setValidationErrors(prev => ({ ...prev, boards: 'Select at least one board.' })); return;
      }
      const boardWithoutGrades = boards.find((b) => !hasAnyGrade(map[b]));
      if (boardWithoutGrades) { setValidationErrors(prev => ({ ...prev, grades: `Select at least one grade for ${boardWithoutGrades}.` })); return; }
      setValidationErrors({ boards: '', grades: '' });
      const hasSeniorSecondary = boards.some((b) => (map[b]?.high || []).length > 0);
      if (hasSeniorSecondary && isInstitutionFieldVisible('streamsOffered') && isInstitutionFieldRequired('streamsOffered') && (!formData.streamsOffered || formData.streamsOffered.length === 0)) {
        toast.error('Select at least one stream for 11–12'); return;
      }
      payload.boardGradeMap = map;
      payload.boardsOffered = boards;
      const standardsSet = new Set();
      boards.forEach((board) => {
        const g = map[board];
        if (Array.isArray(g?.primary) && g.primary.length > 0) standardsSet.add('Primary');
        if (Array.isArray(g?.middle) && g.middle.length > 0) standardsSet.add('Middle');
        if (Array.isArray(g?.high) && g.high.length > 0) standardsSet.add('High');
      });
      payload.standardsAvailable = Array.from(standardsSet);
      payload.boardsByStandard = {};
      STANDARD_RANGES.forEach((key) => { payload.boardsByStandard[key] = []; });
      boards.forEach((board) => {
        const g = map[board];
        if (Array.isArray(g?.primary) && g.primary.length > 0) payload.boardsByStandard['1-5'].push(board);
        if (Array.isArray(g?.middle) && g.middle.length > 0) payload.boardsByStandard['6-10'].push(board);
        if (Array.isArray(g?.high) && g.high.length > 0) payload.boardsByStandard['11-12'].push(board);
      });
      payload.admissionsOpenByStandard = formData.admissionsOpenByStandard && typeof formData.admissionsOpenByStandard === 'object' ? formData.admissionsOpenByStandard : defaultAdmissionsOpenByStandard();
      payload.admissionsOpen = STANDARD_RANGES.some((key) => payload.admissionsOpenByStandard[key] === true);
    }
    setSubmitting(true);
    try {
      await institutionAPI.update(id, payload);
      toast.success('Institution updated successfully');
      fetchInstitution();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to update institution');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCourse = () => {
    setEditingCourseId(null);
    setCourseForm({ name: '', code: '', degree: '', description: '', duration: '', eligibility: '', isActive: true });
    setShowCourseForm(true);
  };

  const handleEditCourse = (course) => {
    setEditingCourseId(course.id);
    setCourseForm({
      name: course.name || '',
      code: course.code || '',
      degree: course.degree || '',
      description: course.description || '',
      duration: course.duration || '',
      eligibility: course.eligibility || '',
      isActive: course.isActive !== undefined ? course.isActive : true,
    });
    setShowCourseForm(true);
  };

  const courseOptionsByDegree = (degree) => {
    if (!degree) return [];
    const base = DEGREE_TO_COURSES[degree] || [];
    const currentName = courseForm?.name;
    if (currentName && !base.includes(currentName)) return [currentName, ...base];
    return base;
  };

  const handleCourseSubmit = async (e) => {
    e.preventDefault();
    if (isCourseFieldVisible('name') && isCourseFieldRequired('name') && !courseForm.name?.trim()) {
      toast.error('Course name is required'); return;
    }
    if (!courseForm.degree?.trim()) { toast.error('Degree is required'); return; }
    if (isCourseFieldVisible('code') && isCourseFieldRequired('code') && !courseForm.code?.trim()) {
      toast.error('Course code is required'); return;
    }
    if (isCourseFieldVisible('description') && isCourseFieldRequired('description') && !courseForm.description?.trim()) {
      toast.error('Description is required'); return;
    }
    if (isCourseFieldVisible('duration') && isCourseFieldRequired('duration') && !courseForm.duration?.trim()) {
      toast.error('Duration is required'); return;
    }
    if (isCourseFieldVisible('eligibility') && isCourseFieldRequired('eligibility') && !courseForm.eligibility?.trim()) {
      toast.error('Eligibility is required'); return;
    }
    setCourseSubmitting(true);
    try {
      if (editingCourseId) {
        await courseAPI.update(editingCourseId, { ...courseForm, institution: id });
        toast.success('Course updated');
      } else {
        await courseAPI.create({ ...courseForm, institution: id });
        toast.success('Course added');
      }
      setShowCourseForm(false);
      setEditingCourseId(null);
      fetchInstitution();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save course');
    } finally {
      setCourseSubmitting(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!deletingCourse) return;
    setCourseSubmitting(true);
    try {
      await courseAPI.delete(deletingCourse.id);
      toast.success('Course deleted');
      setDeletingCourse(null);
      fetchInstitution();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete');
    } finally {
      setCourseSubmitting(false);
    }
  };

  if (loading || !formData) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/institutions')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" aria-label="Back">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Edit Institution</h1>
          <p className="text-sm text-gray-600 mt-0.5">{formData.name}</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 w-full">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Institution Name <span className="text-red-500">*</span></label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
                <select name="type" value={formData.type} onChange={handleInputChange} className="input-field" required>
                  <option value="School">School</option>
                  <option value="College">College</option>
                </select>
              </div>
            </div>

            {isInstitutionFieldVisible('logoUrl') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo {isInstitutionFieldRequired('logoUrl') && <span className="text-red-500">*</span>}</label>
              <input
                type="text"
                name="logoUrl"
                value={
                  formData.logoUrl && typeof formData.logoUrl === 'string' && formData.logoUrl.startsWith('data:')
                    ? ''
                    : (formData.logoUrl || '')
                }
                onChange={(e) => setFormData((prev) => ({ ...prev, logoUrl: e.target.value }))}
                onPaste={(e) => {
                  const pasted = (e.clipboardData?.getData('text') || '').trim();
                  if (pasted) {
                    e.preventDefault();
                    setFormData((prev) => ({ ...prev, logoUrl: pasted }));
                  }
                }}
                placeholder="https://example.com/logo.png"
                className="input-field"
                required={isInstitutionFieldRequired('logoUrl')}
              />
              <p className="text-xs text-gray-500 mt-1">Paste a direct link or upload below. Max {MAX_LOGO_FILE_SIZE_LABEL}.</p>
              <div className="mt-2 flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer text-sm font-medium text-gray-700">
                  <span>📁</span>
                  <span>Upload from device</span>
                  <input type="file" accept="image/*" onChange={handleLogoFileChange} className="hidden" />
                </label>
                {formData.logoUrl && (
                  <div className="flex items-center gap-2">
                    <img src={formData.logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-contain bg-gray-100 border" onError={(e) => e.target.style.display = 'none'} />
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, logoUrl: '' }))} className="text-xs text-red-600 hover:underline">Remove</button>
                  </div>
                )}
              </div>
            </div>
            )}

            {isSchool && (
              <>
                <div className="space-y-4">
                  <p className="text-sm font-medium text-gray-700">Select board(s) {isInstitutionFieldRequired('boardsOffered') && <span className="text-red-500">*</span>}</p>
                  <div className="flex flex-wrap gap-2">
                    {BOARD_OPTIONS.map((opt) => (
                      <label key={opt} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={selectedBoards.includes(opt)} onChange={() => toggleBoard(opt)} className="rounded" />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                  {validationErrors.boards && <p className="text-sm text-red-600">{validationErrors.boards}</p>}
                  {selectedBoards.length > 0 && selectedBoards.map((board) => (
                    <div key={board} className="space-y-1">
                      <p className="text-sm font-medium text-gray-800">Grades for {board}</p>
                      <BoardGradeSelector value={boardGradeMap[board]} onChange={(v) => updateBoardGrades(board, v)} />
                    </div>
                  ))}
                  {validationErrors.grades && <p className="text-sm text-red-600">{validationErrors.grades}</p>}
                </div>
                {hasSeniorSecondary && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">🔬 Streams (for 11–12) {isInstitutionFieldRequired('streamsOffered') && <span className="text-red-500">*</span>}</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {STREAM_OPTIONS.map((opt) => (
                        <label key={opt} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={(formData.streamsOffered || []).includes(opt)} onChange={() => toggleMulti('streamsOffered', opt)} className="rounded" />
                          <span className="text-sm">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {isInstitutionFieldVisible('pincode') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pin Code {isInstitutionFieldRequired('pincode') && <span className="text-red-500">*</span>}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handlePincodeChange}
                  className="input-field flex-1 min-w-0"
                  placeholder="e.g., 560001"
                  maxLength={6}
                  required={isInstitutionFieldRequired('pincode')}
                />
                <button
                  type="button"
                  onClick={handlePincodeLookup}
                  disabled={locationOptions.loading || !formData?.pincode || formData.pincode.length !== 6}
                  className="btn-secondary shrink-0 px-4"
                >
                  {locationOptions.loading ? 'Looking up...' : 'Lookup'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Enter 6-digit pincode and click Lookup to fill City and State</p>
            </div>
            )}

            {isInstitutionFieldVisible('address') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address {isInstitutionFieldRequired('address') && <span className="text-red-500">*</span>}</label>
              <input type="text" name="address" value={formData.address} onChange={handleInputChange} className="input-field" required={isInstitutionFieldRequired('address')} />
            </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isInstitutionFieldVisible('city') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City {isInstitutionFieldRequired('city') && <span className="text-red-500">*</span>}</label>
                {locationOptions.cities.length > 0 ? (
                  <select name="city" value={formData.city} onChange={handleInputChange} className="input-field" required={isInstitutionFieldRequired('city')}>
                    <option value="">Select City</option>
                    {[...new Set([...(formData.city ? [formData.city] : []), ...locationOptions.cities])].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" name="city" value={formData.city} onChange={handleInputChange} className="input-field" placeholder="Enter pincode first or type manually" required={isInstitutionFieldRequired('city')} />
                )}
              </div>
              )}
              {isInstitutionFieldVisible('state') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State {isInstitutionFieldRequired('state') && <span className="text-red-500">*</span>}</label>
                {locationOptions.states.length > 0 ? (
                  <select name="state" value={formData.state} onChange={handleInputChange} className="input-field" required={isInstitutionFieldRequired('state')}>
                    <option value="">Select State</option>
                    {[...new Set([...(formData.state ? [formData.state] : []), ...locationOptions.states])].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" name="state" value={formData.state} onChange={handleInputChange} className="input-field" placeholder="Enter pincode first or type manually" required={isInstitutionFieldRequired('state')} />
                )}
              </div>
              )}
            </div>

            {isInstitutionFieldVisible('isActive') && (
            <div>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleInputChange} className="rounded" />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
            )}

            {((formData?.type === 'School' ? institutionFields.schoolCustomFields : institutionFields.collegeCustomFields) || []).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(formData?.type === 'School' ? institutionFields.schoolCustomFields : institutionFields.collegeCustomFields || []).map((f) => (
                <div key={f.key}>
                  <CustomFieldInput
                    field={f}
                    value={formData?.customData?.[f.key]}
                    onChange={handleCustomFieldChange}
                    required={f.required}
                  />
                </div>
              ))}
            </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={() => navigate('/admin/institutions')} className="btn-secondary" disabled={submitting}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Updating...' : 'Update Institution'}</button>
            </div>
          </form>
        </div>

        {formData.type === 'College' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Courses</h2>
              <button type="button" onClick={handleAddCourse} className="btn-primary text-sm py-2 px-4">
                + Add Course
              </button>
            </div>

            {showCourseForm && (
              <form onSubmit={handleCourseSubmit} className="mb-6 p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-4">
                <h3 className="font-medium text-gray-800">{editingCourseId ? 'Edit Course' : 'Add New Course'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Degree <span className="text-red-500">*</span></label>
                    <SearchableSelect
                      value={courseForm.degree}
                      onChange={(v) => setCourseForm((prev) => {
                        const baseCourses = DEGREE_TO_COURSES[v] || [];
                        const keepName = v && prev.name && baseCourses.includes(prev.name);
                        return { ...prev, degree: v, name: keepName ? prev.name : '' };
                      })}
                      options={[...new Set([...(courseForm.degree && !DEGREE_OPTIONS.includes(courseForm.degree) ? [courseForm.degree] : []), ...DEGREE_OPTIONS])]}
                      placeholder="Search or select degree..."
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course Name <span className="text-red-500">*</span></label>
                    <SearchableSelect
                      value={courseForm.name}
                      onChange={(v) => setCourseForm((prev) => ({ ...prev, name: v }))}
                      options={courseOptionsByDegree(courseForm.degree)}
                      placeholder={courseForm.degree ? 'Search or select course...' : 'Select degree first'}
                      className={`input-field ${!courseForm.degree ? 'cursor-not-allowed bg-gray-50 opacity-75' : ''}`}
                      required
                      disabled={!courseForm.degree}
                      allowCustom
                    />
                    {!courseForm.degree && <p className="text-xs text-amber-600 mt-0.5">Select a degree to see course options</p>}
                  </div>
                </div>
                {isCourseFieldVisible('code') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course Code {isCourseFieldRequired('code') && <span className="text-red-500">*</span>}</label>
                    <input type="text" value={courseForm.code} onChange={(e) => setCourseForm(prev => ({ ...prev, code: e.target.value }))} className="input-field" required={isCourseFieldRequired('code')} />
                  </div>
                )}
                {isCourseFieldVisible('description') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description {isCourseFieldRequired('description') && <span className="text-red-500">*</span>}</label>
                    <textarea value={courseForm.description} onChange={(e) => setCourseForm(prev => ({ ...prev, description: e.target.value }))} className="input-field" rows={2} required={isCourseFieldRequired('description')} />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isCourseFieldVisible('duration') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration {isCourseFieldRequired('duration') && <span className="text-red-500">*</span>}</label>
                      <SearchableSelect
                        value={courseForm.duration}
                        onChange={(v) => setCourseForm((prev) => ({ ...prev, duration: v }))}
                        options={courseForm.duration && !DURATION_OPTIONS.includes(courseForm.duration) ? [courseForm.duration, ...DURATION_OPTIONS] : DURATION_OPTIONS}
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
                        value={courseForm.eligibility}
                        onChange={(v) => setCourseForm((prev) => ({ ...prev, eligibility: v }))}
                        options={(() => {
                          const base = ELIGIBILITY_OPTIONS;
                          const current = (courseForm.eligibility || '').split(',').map((s) => s.trim()).filter(Boolean);
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
                <div>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={courseForm.isActive} onChange={(e) => setCourseForm(prev => ({ ...prev, isActive: e.target.checked }))} className="rounded" />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary" disabled={courseSubmitting}>{courseSubmitting ? 'Saving...' : (editingCourseId ? 'Update' : 'Add')}</button>
                  <button type="button" onClick={() => { setShowCourseForm(false); setEditingCourseId(null); }} className="btn-secondary">Cancel</button>
                </div>
              </form>
            )}

            {courses.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">No courses yet. Click &quot;Add Course&quot; to create one.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Course Name</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Degree</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Code</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Duration</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {courses.map((course) => (
                      <tr key={course.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{course.name}</div>
                          {course.description && <div className="text-sm text-gray-500 line-clamp-1">{course.description}</div>}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{course.degree || '—'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{course.code || '—'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{course.duration || '—'}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${course.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                            {course.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button onClick={() => setViewingCourse(course)} className="p-2 rounded-lg text-gray-600 hover:bg-gray-100" title="View">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                          <button onClick={() => handleEditCourse(course)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50" title="Edit">✏️</button>
                          <button onClick={() => setDeletingCourse(course)} className="p-2 rounded-lg text-red-600 hover:bg-red-50" title="Delete">🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {viewingCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-gray-900">Course Details</h2>
              <button onClick={() => setViewingCourse(null)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Course Name</dt>
                <dd className="mt-0.5 text-gray-900 font-medium">{viewingCourse.name}</dd>
              </div>
              {viewingCourse.description && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Description</dt>
                  <dd className="mt-0.5 text-gray-700">{viewingCourse.description}</dd>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Degree</dt>
                  <dd className="mt-0.5 text-gray-900">{viewingCourse.degree || '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Code</dt>
                  <dd className="mt-0.5 text-gray-900">{viewingCourse.code || '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Duration</dt>
                  <dd className="mt-0.5 text-gray-900">{viewingCourse.duration || '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-0.5">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${viewingCourse.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                      {viewingCourse.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </dd>
                </div>
              </div>
              {viewingCourse.eligibility && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Eligibility</dt>
                  <dd className="mt-0.5 text-gray-900">{viewingCourse.eligibility}</dd>
                </div>
              )}
            </dl>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setViewingCourse(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {deletingCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Delete Course</h2>
            <p className="text-gray-600 mb-6">Are you sure you want to delete <strong>{deletingCourse.name}</strong>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingCourse(null)} className="btn-secondary" disabled={courseSubmitting}>Cancel</button>
              <button onClick={handleDeleteCourse} className="btn-primary bg-red-600 hover:bg-red-700" disabled={courseSubmitting}>{courseSubmitting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditInstitution;

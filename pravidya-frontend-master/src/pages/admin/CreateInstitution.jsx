import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { institutionAPI, adminAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { fetchLocationByPincode } from '../../utils/pincodeLookup';
import { BoardGradeSelector, defaultBoardGradeMapValue, hasAnyGrade } from '../../components/BoardGradeSelector';
import CustomFieldInput from '../../components/CustomFieldInput';

const BOARD_OPTIONS = ['CBSE', 'ICSE', 'State Board', 'IB', 'IGCSE'];
const STANDARD_RANGES = ['1-5', '6-10', '11-12'];
const STREAM_OPTIONS = ['Science', 'Commerce', 'Arts'];

const defaultBoardsByStandard = () => ({ '1-5': [], '6-10': [], '11-12': [] });
const defaultAdmissionsOpenByStandard = () => ({ '1-5': true, '6-10': true, '11-12': true });
const defaultBoardGradeMap = () => ({});

const MAX_LOGO_SIZE = 256;
const MAX_LOGO_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_LOGO_FILE_SIZE_LABEL = '2 MB';

const CreateInstitution = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    type: 'College',
    address: '',
    pincode: '',
    city: '',
    state: '',
    isActive: true,
    logoUrl: '',
    boardsOffered: [],
    standardsAvailable: [],
    streamsOffered: [],
    admissionsOpen: true,
    admissionsOpenByStandard: defaultAdmissionsOpenByStandard(),
    boardsByStandard: defaultBoardsByStandard(),
    boardGradeMap: defaultBoardGradeMap(),
    customData: {},
  });
  const [institutionFields, setInstitutionFields] = useState({ customFields: [], requiredFields: {} });

  const isInstitutionFieldVisible = (key) => institutionFields[key] !== false;
  const isInstitutionFieldRequired = (key) =>
    ['name', 'type'].includes(key) || institutionFields.requiredFields?.[key] === true;
  const [submitting, setSubmitting] = useState(false);

  const filterOutColorField = (arr) => (arr || []).filter((f) => f.key !== 'color');

  const fetchSettings = () => {
    adminAPI.getSettings().then((res) => {
      const d = res.data?.data?.institutionFields;
      if (d) {
        const rf = d && typeof d.requiredFields === 'object' ? d.requiredFields : {};
        setInstitutionFields((prev) => ({
          ...prev,
          ...d,
          customFields: filterOutColorField(d.customFields),
          schoolCustomFields: filterOutColorField(d.schoolCustomFields),
          collegeCustomFields: filterOutColorField(d.collegeCustomFields),
          requiredFields: { ...(prev.requiredFields || {}), ...rf },
        }));
      }
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
  const [validationErrors, setValidationErrors] = useState({ boards: '', grades: '' });
  const [locationOptions, setLocationOptions] = useState({ cities: [], states: [], loading: false });

  const isSchool = formData.type === 'School';
  const boardGradeMap = formData.boardGradeMap && typeof formData.boardGradeMap === 'object' ? formData.boardGradeMap : defaultBoardGradeMap();
  const selectedBoards = Object.keys(boardGradeMap).filter((b) => b);
  const hasSeniorSecondary = selectedBoards.some((b) => (boardGradeMap[b]?.high || []).length > 0);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'type') {
        if (value === 'College') {
          next.boardsOffered = [];
          next.standardsAvailable = [];
          next.streamsOffered = [];
          next.admissionsOpen = true;
          next.admissionsOpenByStandard = defaultAdmissionsOpenByStandard();
          next.boardsByStandard = defaultBoardsByStandard();
          next.boardGradeMap = defaultBoardGradeMap();
        }
      }
      return next;
    });
  };

  const toggleMulti = (field, option) => {
    setFormData(prev => {
      const arr = prev[field] || [];
      const set = new Set(arr);
      if (set.has(option)) set.delete(option);
      else set.add(option);
      return { ...prev, [field]: Array.from(set) };
    });
  };

  const toggleBoard = (board) => {
    setFormData(prev => {
      const map = { ...(prev.boardGradeMap && typeof prev.boardGradeMap === 'object' ? prev.boardGradeMap : {}) };
      if (map[board]) delete map[board];
      else map[board] = defaultBoardGradeMapValue();
      return { ...prev, boardGradeMap: map };
    });
    setValidationErrors(prev => ({ ...prev, boards: '', grades: '' }));
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
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, etc.)');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_LOGO_FILE_SIZE_BYTES) {
      toast.error(`Logo file is too large. Maximum allowed size is ${MAX_LOGO_FILE_SIZE_LABEL}.`);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width; let h = img.height;
        if (w > MAX_LOGO_SIZE || h > MAX_LOGO_SIZE) {
          if (w > h) { h = (h / w) * MAX_LOGO_SIZE; w = MAX_LOGO_SIZE; } else { w = (w / h) * MAX_LOGO_SIZE; h = MAX_LOGO_SIZE; }
        }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const resized = canvas.toDataURL('image/jpeg', 0.85);
        setFormData(prev => ({ ...prev, logoUrl: resized }));
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
    if (Object.keys(formData.customData || {}).length > 0) {
      payload.customData = formData.customData;
    }
    if (formData.type === 'School') {
      const map = formData.boardGradeMap && typeof formData.boardGradeMap === 'object' ? formData.boardGradeMap : {};
      const boards = Object.keys(map).filter((b) => b);
      if (isInstitutionFieldRequired('boardsOffered') && boards.length === 0) {
        setValidationErrors(prev => ({ ...prev, boards: 'Select at least one board.' }));
        return;
      }
      const boardWithoutGrades = boards.find((b) => !hasAnyGrade(map[b]));
      if (boardWithoutGrades) {
        setValidationErrors(prev => ({ ...prev, grades: `Select at least one grade for ${boardWithoutGrades}.` }));
        return;
      }
      const hasSeniorSecondary = boards.some((b) => (map[b]?.high || []).length > 0);
      if (hasSeniorSecondary && isInstitutionFieldVisible('streamsOffered') && isInstitutionFieldRequired('streamsOffered') && (!formData.streamsOffered || formData.streamsOffered.length === 0)) {
        toast.error('Select at least one stream for 11–12');
        return;
      }
      setValidationErrors({ boards: '', grades: '' });
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
      const anyGradeOpen = STANDARD_RANGES.some((key) => payload.admissionsOpenByStandard[key] === true);
      payload.admissionsOpen = anyGradeOpen;
    }
    setSubmitting(true);
    try {
      const res = await institutionAPI.create(payload);
      toast.success('Institution created successfully');
      const created = res.data?.data?.institution;
      if (created?.id && formData.type === 'College') {
        navigate(`/admin/institutions/${created.id}/edit`);
      } else {
        navigate('/admin/institutions');
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to create institution');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/institutions')}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Back to institutions"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Add New Institution</h1>
            <p className="text-sm text-gray-600 mt-0.5">Create a new school or college</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 w-full">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Institution Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="input-field"
                required
              />
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
            <p className="text-xs text-gray-500 mt-1">Paste a direct link to the logo image, or upload below.</p>
            <p className="text-xs text-gray-500">Recommended size: 256×256. Max file size: {MAX_LOGO_FILE_SIZE_LABEL}. Larger images are auto-resized.</p>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer text-sm font-medium text-gray-700">
                <span>📁</span>
                <span>Upload from device</span>
                <input type="file" accept="image/*" onChange={handleLogoFileChange} className="hidden" />
              </label>
              {formData.logoUrl && formData.logoUrl.startsWith('data:') && (
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, logoUrl: '' }))}
                  className="text-xs text-primary-600 hover:underline"
                >
                  Clear upload to use URL instead
                </button>
              )}
              {formData.logoUrl && (
                <span className="text-xs text-gray-500">
                  Logo set {formData.logoUrl.startsWith('data:') ? '(uploaded)' : '(from URL)'}
                </span>
              )}
            </div>
            {formData.logoUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img src={formData.logoUrl} alt="Logo preview" className="w-12 h-12 rounded-lg object-contain bg-gray-100 border border-gray-200" onError={(e) => e.target.style.display = 'none'} />
                <span className="text-xs text-gray-500">Preview</span>
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, logoUrl: '' }))} className="text-xs text-red-600 hover:underline ml-2">Remove logo</button>
              </div>
            )}
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
                    <BoardGradeSelector value={boardGradeMap[board]} onChange={(value) => updateBoardGrades(board, value)} />
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

          {((formData.type === 'School' ? institutionFields.schoolCustomFields : institutionFields.collegeCustomFields) || []).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(formData.type === 'School' ? institutionFields.schoolCustomFields : institutionFields.collegeCustomFields || []).map((f) => (
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
            <button type="button" onClick={() => navigate('/admin/institutions')} className="btn-secondary" disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Institution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateInstitution;

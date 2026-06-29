import { useState, useEffect, useRef } from 'react';
import { counselorAPI, schoolAPI, adminAPI } from '../../services/api';
import toast from 'react-hot-toast';

const AdminCounselors = () => {
  const [counselors, setCounselors] = useState([]);
  const [counselorStats, setCounselorStats] = useState({});
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCounselor, setEditingCounselor] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    mobile: '',
    expertise: [],
    languages: [],
    availability: 'ACTIVE',
    maxCapacity: 50,
    schoolId: '',
    customData: {},
  });
  const [expertiseInput, setExpertiseInput] = useState('');
  const [languageInput, setLanguageInput] = useState('');
  const [customExpertise, setCustomExpertise] = useState('');
  const [customLanguage, setCustomLanguage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCounselor, setSelectedCounselor] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [deletingCounselor, setDeletingCounselor] = useState(null);
  const fileInputRef = useRef(null);
  const [counselorFields, setCounselorFields] = useState({
    username: true, email: true, password: true, fullName: true, mobile: true,
    expertise: true, languages: true, availability: true, maxCapacity: true, schoolId: true,
    customFields: [],
    requiredFields: { username: true, email: true, password: true },
  });

  // Username, Email, Password are always required for new accounts; others use "Required when shown" from Settings
  const isFieldRequired = (fieldKey, isNewAccount = !editingCounselor) => {
    if (isNewAccount && ['username', 'email', 'password'].includes(fieldKey)) return true;
    const rf = counselorFields.requiredFields || {};
    return rf[fieldKey] === true;
  };

  // Predefined options
  const EXPERTISE_OPTIONS = [
    'Academic Counseling',
    'Career Guidance',
    'Admissions Support',
    'Parent Counseling',
    'International Admissions',
    'Financial Aid Guidance',
    'Other'
  ];

  const LANGUAGE_OPTIONS = [
    'English',
    'Hindi',
    'Kannada',
    'Marathi',
    'Tamil',
    'Telugu',
    'Other'
  ];

  useEffect(() => {
    fetchCounselors();
    fetchSchools();
    adminAPI.getSettings().then((res) => {
      const data = res.data?.data;
      if (data?.counselorFields) setCounselorFields(prev => ({ ...prev, ...data.counselorFields }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // Refresh counselor stats periodically for live status, but avoid excessive polling
    if (counselors.length === 0) return;

    // Do an immediate refresh when the list changes
    refreshCounselorStats();

    // Then poll at a more reasonable interval (2 minutes)
    const interval = setInterval(() => {
      refreshCounselorStats();
    }, 120000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counselors.length]);

  const refreshCounselorStats = async () => {
    if (counselors.length === 0) return;
    try {
      const response = await counselorAPI.getAll({ includeStats: true, limit: 200 });
      const list = response.data?.data?.counselors || response.data?.counselors || [];
      const statsMap = {};
      list.forEach((c) => {
        if (c.stats) statsMap[c.id || c._id] = c.stats;
      });
      setCounselorStats(statsMap);
    } catch (error) {
      console.error('Failed to refresh counselor stats:', error);
    }
  };

  const fetchSchools = async () => {
    try {
      const response = await schoolAPI.getAll();
      setSchools(response.data.data.schools || []);
    } catch (error) {
      console.error('Failed to load schools');
    }
  };

  const fetchCounselors = async () => {
    setLoading(true);
    try {
      // Single request with includeStats=true (batch stats from backend — much faster)
      const response = await counselorAPI.getAll({ includeStats: true, limit: 200 });
      const counselorsList = response.data?.data?.counselors || response.data?.counselors || [];
      setCounselors(counselorsList);
      const statsMap = {};
      counselorsList.forEach((c) => {
        if (c.stats) statsMap[c.id || c._id] = c.stats;
      });
      setCounselorStats(statsMap);
    } catch (error) {
      console.error('Failed to load counselors:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load counselors';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleExpertiseChange = (e) => {
    const selected = Array.from(e.target.selectedOptions, option => option.value);
    const hasOther = selected.includes('Other');
    
    setFormData(prev => {
      const newExpertise = selected.filter(v => v !== 'Other');
      if (hasOther && customExpertise.trim()) {
        newExpertise.push(customExpertise.trim());
      }
      return { ...prev, expertise: newExpertise };
    });
  };

  const handleLanguageChange = (e) => {
    const selected = Array.from(e.target.selectedOptions, option => option.value);
    const hasOther = selected.includes('Other');
    
    setFormData(prev => {
      const newLanguages = selected.filter(v => v !== 'Other');
      if (hasOther && customLanguage.trim()) {
        newLanguages.push(customLanguage.trim());
      }
      return { ...prev, languages: newLanguages };
    });
  };

  const handleRemoveExpertise = (item) => {
    setFormData(prev => ({
      ...prev,
      expertise: prev.expertise.filter(exp => exp !== item)
    }));
  };

  const handleRemoveLanguage = (item) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.filter(lang => lang !== item)
    }));
  };

  const handleCustomFieldChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      customData: { ...prev.customData, [key]: value }
    }));
  };

  const handleMultiCheckboxChange = (key, option, checked) => {
    setFormData(prev => {
      const current = Array.isArray(prev.customData?.[key]) ? prev.customData[key] : [];
      const next = checked ? [...current, option] : current.filter((o) => o !== option);
      return { ...prev, customData: { ...prev.customData, [key]: next } };
    });
  };

  const handleEdit = async (counselor) => {
    try {
      // Refetch settings so custom fields are up to date
      const settingsRes = await adminAPI.getSettings().catch(() => null);
      if (settingsRes?.data?.data?.counselorFields) {
        setCounselorFields((prev) => ({ ...prev, ...settingsRes.data.data.counselorFields }));
      }
      const counselorId = counselor.id || counselor._id;
      const response = await counselorAPI.getById(counselorId);
      const counselorData = response.data.data.counselor;
      setEditingCounselor(counselorId);
      setFormData({
        username: counselorData.user?.username || counselorData.userId?.username || '',
        email: counselorData.user?.email || counselorData.userId?.email || '',
        password: '', // Don't pre-fill password
        fullName: counselorData.fullName || '',
        mobile: counselorData.mobile || '',
        expertise: Array.isArray(counselorData.expertise) ? counselorData.expertise : [],
        languages: Array.isArray(counselorData.languages) ? counselorData.languages : [],
        availability: counselorData.availability || 'ACTIVE',
        maxCapacity: counselorData.maxCapacity || 50,
        schoolId: counselorData.schoolId || counselorData.school?.id || '',
        customData: (counselorData.customData && typeof counselorData.customData === 'object') ? { ...counselorData.customData } : {},
      });
      setShowModal(true);
    } catch (error) {
      toast.error('Failed to load counselor details');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (counselorFields.fullName !== false && isFieldRequired('fullName') && !formData.fullName?.trim()) {
      toast.error('Please fill Full Name');
      return;
    }
    if (counselorFields.mobile !== false && isFieldRequired('mobile') && !formData.mobile?.trim()) {
      toast.error('Please fill Mobile Number');
      return;
    }
    if (counselorFields.expertise !== false && isFieldRequired('expertise') && formData.expertise.length === 0) {
      toast.error('Please add at least one expertise area');
      return;
    }
    if (counselorFields.languages !== false && isFieldRequired('languages') && formData.languages.length === 0) {
      toast.error('Please add at least one language');
      return;
    }
    if (counselorFields.schoolId !== false && isFieldRequired('schoolId') && !formData.schoolId) {
      toast.error('Please select a School');
      return;
    }
    if (counselorFields.availability !== false && isFieldRequired('availability') && !formData.availability) {
      toast.error('Please select Availability');
      return;
    }
    if (counselorFields.maxCapacity !== false && isFieldRequired('maxCapacity') && (!formData.maxCapacity || formData.maxCapacity < 1)) {
      toast.error('Please enter a valid Max Capacity');
      return;
    }
    const customFields = counselorFields.customFields || [];
    for (const f of customFields) {
      if (f.required) {
        const val = formData.customData?.[f.key];
        if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
          toast.error(`Please fill ${f.label}`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      if (editingCounselor) {
        const updateData = {};
        if (counselorFields.fullName !== false) updateData.fullName = formData.fullName;
        if (counselorFields.mobile !== false) updateData.mobile = formData.mobile;
        if (counselorFields.expertise !== false) updateData.expertise = formData.expertise;
        if (counselorFields.languages !== false) updateData.languages = formData.languages;
        if (counselorFields.availability !== false) updateData.availability = formData.availability;
        if (counselorFields.maxCapacity !== false) updateData.maxCapacity = formData.maxCapacity;
        if (counselorFields.schoolId !== false) updateData.schoolId = formData.schoolId || null;
        const customFields = counselorFields.customFields || [];
        if (customFields.length > 0) {
          const customData = {};
          customFields.forEach(({ key }) => {
            if (formData.customData?.[key] !== undefined) customData[key] = formData.customData[key];
          });
          updateData.customData = Object.keys(customData).length > 0 ? customData : null;
        }
        await counselorAPI.update(editingCounselor, updateData);
        toast.success('Counselor updated successfully');
      } else {
        // Create new counselor
        if (!formData.username || !formData.email || !formData.password) {
          toast.error('Please fill all required fields');
          setSubmitting(false);
          return;
        }
        const createData = {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          fullName: counselorFields.fullName !== false ? (formData.fullName || '') : 'N/A',
          mobile: counselorFields.mobile !== false ? (formData.mobile || '') : '',
          expertise: counselorFields.expertise !== false ? formData.expertise : [],
          languages: counselorFields.languages !== false ? formData.languages : [],
          availability: counselorFields.availability !== false ? formData.availability : 'ACTIVE',
          maxCapacity: counselorFields.maxCapacity !== false ? formData.maxCapacity : 50,
          schoolId: counselorFields.schoolId !== false ? (formData.schoolId || null) : null,
        };
        const customFields = counselorFields.customFields || [];
        if (customFields.length > 0 && formData.customData && Object.keys(formData.customData).length > 0) {
          createData.customData = formData.customData;
        }
        await counselorAPI.create(createData);
        toast.success('Counselor created successfully');
      }
      setShowModal(false);
      setEditingCounselor(null);
      setFormData({
        username: '',
        email: '',
        password: '',
        fullName: '',
        mobile: '',
        expertise: [],
        languages: [],
        availability: 'ACTIVE',
        maxCapacity: 50,
        schoolId: '',
        customData: {},
      });
      setExpertiseInput('');
      setLanguageInput('');
      setCustomExpertise('');
      setCustomLanguage('');
      fetchCounselors();
    } catch (error) {
      const errorMessage = error.response?.data?.message || 
        (editingCounselor ? 'Failed to update counselor' : 'Failed to create counselor');
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCounselor(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      fullName: '',
      mobile: '',
      expertise: [],
      languages: [],
      availability: 'ACTIVE',
      maxCapacity: 50,
      customData: {},
    });
    setExpertiseInput('');
    setLanguageInput('');
  };

  const handleAddNew = () => {
    setEditingCounselor(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      fullName: '',
      mobile: '',
      expertise: [],
      languages: [],
      availability: 'ACTIVE',
      maxCapacity: 50,
      schoolId: '',
      customData: {},
    });
    setExpertiseInput('');
    setLanguageInput('');
    setCustomExpertise('');
    setCustomLanguage('');
    setShowModal(true);
    // Refetch settings so custom fields are up to date when opening the form
    adminAPI.getSettings().then((res) => {
      const data = res.data?.data;
      if (data?.counselorFields) setCounselorFields((prev) => ({ ...prev, ...data.counselorFields }));
    }).catch(() => {});
  };

  const handleDelete = (counselor) => {
    setDeletingCounselor(counselor);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCounselor) return;
    setSubmitting(true);
    try {
      const id = deletingCounselor.id || deletingCounselor._id;
      await counselorAPI.delete(id);
      toast.success('Counselor deleted successfully');
      setDeletingCounselor(null);
      fetchCounselors();
    } catch (error) {
      const data = error.response?.data;
      const path = data?.path;
      const errorMessage = data?.message || 'Failed to delete counselor';
      toast.error(path ? `${errorMessage} (${path})` : errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = async (counselor) => {
    const counselorId = counselor.id || counselor._id;
    setLoadingDetails(true);
    setSelectedCounselor(null);
    setShowDetailsModal(true);
    
    try {
      // Refetch settings so custom field definitions are up to date
      const settingsRes = await adminAPI.getSettings().catch(() => null);
      if (settingsRes?.data?.data?.counselorFields) {
        setCounselorFields((prev) => ({ ...prev, ...settingsRes.data.data.counselorFields }));
      }
      // Fetch full counselor details
      const [detailsResponse, statsResponse] = await Promise.all([
        counselorAPI.getById(counselorId),
        counselorAPI.getStats(counselorId).catch(() => null) // Stats might fail, but continue anyway
      ]);
      
      const counselorData = detailsResponse.data.data.counselor;
      const stats = statsResponse?.data?.data || null;
      
      setSelectedCounselor({
        ...counselorData,
        stats
      });
    } catch (error) {
      console.error('Failed to load counselor details:', error);
      toast.error('Failed to load counselor details');
      setShowDetailsModal(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Counselors Management</h1>
          <p className="text-gray-600 mt-1">Manage counselor accounts and profiles</p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col items-end gap-2">
            <div className="relative group w-full sm:w-auto flex justify-end">
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10">
                Export counselor import template (Excel)
              </span>
              <button
                type="button"
                className="btn-secondary text-sm w-full sm:w-auto"
                onClick={async () => {
                try {
                  const res = await counselorAPI.export();
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'counselors_export.xlsx';
                  document.body.appendChild(link);
                  link.click();
                  window.URL.revokeObjectURL(url);
                  link.remove();
                  toast.success('Counselors exported');
                } catch (error) {
                  toast.error('Failed to export counselors');
                }
              }}
            >
              Export bulk counselors
            </button>
            </div>
            <div className="relative group w-full sm:w-auto flex justify-end">
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10">
                Download Excel template for importing counselors
              </span>
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 bg-transparent border-0 cursor-pointer p-0"
                onClick={async () => {
                try {
                  const res = await counselorAPI.exportTemplate();
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'counselor_import_template.xlsx';
                  document.body.appendChild(link);
                  link.click();
                  window.URL.revokeObjectURL(url);
                  link.remove();
                  toast.success('Template downloaded');
                } catch (error) {
                  toast.error('Failed to download counselor template');
                }
              }}
            >
              Download counselor template
            </button>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2">
            <div className="relative group w-full sm:w-auto">
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10">
                Import counselors from Excel file
              </span>
              <button
                type="button"
                className="btn-primary text-sm w-full"
                disabled={importing}
                onClick={() => setShowImportModal(true)}
              >
                {importing ? 'Importing...' : 'Import Counselors'}
              </button>
            </div>
            <button
              onClick={handleAddNew}
              className="btn-primary w-full"
            >
              Add New Counselor
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setImporting(true);
          setImportResult(null);
          try {
            const res = await counselorAPI.import(file);
            setImportResult(res.data.data);
            toast.success('Counselor import completed');
            fetchCounselors();
          } catch (error) {
            const message =
              error.response?.data?.message ||
              'Failed to import counselors';
            toast.error(message);
          } finally {
            setImporting(false);
            e.target.value = '';
          }
        }}
      />

      {/* Import warning modal: template download + choose file */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowImportModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Import Counselors</h3>
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              Ensure your data is correctly formatted according to the template below. Incorrect formatting may cause import errors.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                className="btn-secondary text-sm w-full"
                onClick={async () => {
                  try {
                    const res = await counselorAPI.exportTemplate();
                    const url = window.URL.createObjectURL(new Blob([res.data]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'counselor_import_template.xlsx';
                    document.body.appendChild(link);
                    link.click();
                    window.URL.revokeObjectURL(url);
                    link.remove();
                    toast.success('Template downloaded');
                  } catch (error) {
                    toast.error('Failed to download template');
                  }
                }}
              >
                Download import template
              </button>
              <button
                type="button"
                className="btn-primary text-sm w-full"
                onClick={() => {
                  setShowImportModal(false);
                  fileInputRef.current?.click();
                }}
              >
                Choose file to import
              </button>
              <button
                type="button"
                className="text-sm text-gray-600 hover:text-gray-800"
                onClick={() => setShowImportModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && counselors.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-16 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded mb-4"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : counselors.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No counselors found</div>
      ) : (
        <>
        {importResult && (
          <div className="mb-4 p-3 rounded border border-gray-200 bg-gray-50 text-sm text-gray-700">
            <div>
              <span className="font-semibold">Import summary:</span>{' '}
              {importResult.inserted} inserted, {importResult.failed} failed,{' '}
              {importResult.skipped} skipped, {importResult.totalRows} total rows.
            </div>
            {importResult.errors && importResult.errors.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 pr-2">Row</th>
                      <th className="text-left py-1">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.errors.map((err, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="py-1 pr-2">{err.row}</td>
                        <td className="py-1 text-gray-600">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {counselors.map((counselor) => {
            const counselorId = counselor.id || counselor._id;
            const stats = counselorStats[counselorId] || counselor.stats;
            // Presence status should reflect counselor clock-in/clock-out (not static availability).
            // Anything other than OFFLINE means they are clocked in (ACTIVE / AWAY / ON_BREAK / IN_MEETING).
            const rawPresenceStatus = stats?.presenceStatus || 'OFFLINE';
            const isClockedIn = rawPresenceStatus && rawPresenceStatus !== 'OFFLINE';
            const presenceStatus = isClockedIn ? 'ACTIVE' : 'OFFLINE';
            const expertiseList = Array.isArray(counselor.expertise) ? counselor.expertise : (typeof counselor.expertise === 'string' ? [counselor.expertise] : []);
            const languageList = Array.isArray(counselor.languages) ? counselor.languages : (typeof counselor.languages === 'string' ? [counselor.languages] : []);
            
            return (
              <div key={counselorId} className="card hover:shadow-lg transition-shadow">
                {/* Header with Avatar and Name */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-lg">
                      {counselor.fullName?.charAt(0) || 'C'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{counselor.fullName}</h3>
                      <p className="text-xs text-gray-500">{counselor.user?.email || counselor.userId?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        presenceStatus === 'ACTIVE'
                          ? 'bg-green-500 animate-pulse'
                          : 'bg-gray-400'
                      }`}
                      title={`Status: ${presenceStatus}${isClockedIn && rawPresenceStatus !== 'ACTIVE' ? ` (${rawPresenceStatus})` : ''}`}
                    ></div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        presenceStatus === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {presenceStatus}
                    </span>
                  </div>
                </div>

                {/* Expertise Tags */}
                <div className="mb-3">
                  <div className="flex flex-wrap gap-1">
                    {expertiseList.filter((e) => (e && String(e).trim())).slice(0, 3).map((exp, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {String(exp).trim()}
                      </span>
                    ))}
                    {expertiseList.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        +{expertiseList.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                {/* Languages */}
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">Languages</p>
                  <div className="flex flex-wrap gap-1">
                    {languageList.filter((l) => (l && String(l).trim())).slice(0, 3).map((lang, idx) => (
                      <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        {String(lang).trim()}
                      </span>
                    ))}
                    {languageList.length > 3 && (
                      <span className="text-xs text-gray-500">+{languageList.length - 3} more</span>
                    )}
                  </div>
                </div>

                {/* Leads Progress */}
                <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Leads Progress</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-semibold">{stats?.totalLeads || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">New:</span>
                      <span className="font-semibold">{stats?.newLeads || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-600">In Progress:</span>
                      <span className="font-semibold">{stats?.inProgress || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600">Converted:</span>
                      <span className="font-semibold">{stats?.enrolled || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Training Completion */}
                {stats && (
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">Training Completion</span>
                      <span className="text-xs font-semibold">{stats.trainingCompletion || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${stats.trainingCompletion || 0}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {stats.trainingCompleted || 0} / {stats.trainingTotal || 0} modules
                    </p>
                  </div>
                )}

                {/* Load Capacity */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600">Load</span>
                    <span className="text-xs font-semibold">
                      {stats?.currentLoad || counselor.currentLoad || 0} / {counselor.maxCapacity || 50}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        (stats?.loadPercentage || 0) > 80 ? 'bg-red-600' :
                        (stats?.loadPercentage || 0) > 60 ? 'bg-yellow-600' : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.min(stats?.loadPercentage || 0, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Last Active */}
                {stats?.lastActiveAt && (
                  <p className="text-xs text-gray-500 mb-3">
                    Last active: {new Date(stats.lastActiveAt).toLocaleString()}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t items-center">
                  <button
                    onClick={() => handleEdit(counselor)}
                    className="flex-1 btn-secondary text-sm py-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleViewDetails(counselor)}
                    className="flex-1 btn-primary text-sm py-2"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleDelete(counselor)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete counselor"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCounselor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Delete Counselor</h2>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete <strong>{deletingCounselor.fullName}</strong>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeletingCounselor(null)} className="btn-secondary" disabled={submitting}>Cancel</button>
                <button onClick={handleConfirmDelete} className="btn-primary bg-red-600 hover:bg-red-700" disabled={submitting}>
                  {submitting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Counselor Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingCounselor ? 'Edit Counselor' : 'Add New Counselor'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingCounselor && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Username <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="username"
                          value={formData.username}
                          onChange={handleInputChange}
                          className="input-field"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className="input-field"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          className="input-field"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>
                  </>
                )}

                {(counselorFields.fullName !== false || counselorFields.mobile !== false) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {counselorFields.fullName !== false && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name {isFieldRequired('fullName') && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="input-field"
                      required={isFieldRequired('fullName')}
                    />
                  </div>
                  )}
                  {counselorFields.mobile !== false && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mobile Number {isFieldRequired('mobile') && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="tel"
                      name="mobile"
                      value={formData.mobile}
                      onChange={handleInputChange}
                      className="input-field"
                      required={isFieldRequired('mobile')}
                    />
                  </div>
                  )}
                </div>
                )}

                {(counselorFields.schoolId !== false || counselorFields.availability !== false) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {counselorFields.schoolId !== false && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      School {isFieldRequired('schoolId') ? <span className="text-red-500">*</span> : '(Optional)'}
                    </label>
                    <select
                      name="schoolId"
                      value={formData.schoolId}
                      onChange={handleInputChange}
                      className="input-field"
                      required={isFieldRequired('schoolId')}
                    >
                      <option value="">No School Assigned</option>
                      {schools.map(school => (
                        <option key={school.id} value={school.id}>{school.name}</option>
                      ))}
                    </select>
                  </div>
                  )}
                  {counselorFields.availability !== false && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Availability {isFieldRequired('availability') && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      name="availability"
                      value={formData.availability}
                      onChange={handleInputChange}
                      className="input-field"
                      required={isFieldRequired('availability')}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                  )}
                </div>
                )}

                {counselorFields.maxCapacity !== false && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Capacity {isFieldRequired('maxCapacity') && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="number"
                    name="maxCapacity"
                    value={formData.maxCapacity}
                    onChange={handleInputChange}
                    className="input-field"
                    min="1"
                    required={isFieldRequired('maxCapacity')}
                  />
                </div>
                )}

                {(counselorFields.customFields || []).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(counselorFields.customFields || []).map(({ key, label, placeholder, type: fieldType, options: fieldOptions, required: customRequired }) => (
                    <div key={key}>
                      {fieldType === 'checkbox' && Array.isArray(fieldOptions) && fieldOptions.length > 0 ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">{label} {customRequired && <span className="text-red-500">*</span>}</label>
                          <div className="flex flex-wrap gap-3">
                            {fieldOptions.map((opt) => {
                              const selected = Array.isArray(formData.customData?.[key]) ? formData.customData[key] : [];
                              const isChecked = selected.includes(opt);
                              return (
                                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => handleMultiCheckboxChange(key, opt, e.target.checked)}
                                    className="rounded"
                                  />
                                  <span className="text-sm text-gray-700">{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : fieldType === 'dropdown' && Array.isArray(fieldOptions) && fieldOptions.length > 0 ? (
                        <>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{label} {customRequired && <span className="text-red-500">*</span>}</label>
                          <select
                            value={formData.customData?.[key] ?? ''}
                            onChange={(e) => handleCustomFieldChange(key, e.target.value)}
                            className="input-field"
                            required={customRequired}
                          >
                            <option value="">Select {label}</option>
                            {fieldOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </>
                      ) : fieldType === 'textarea' ? (
                        <>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{label} {customRequired && <span className="text-red-500">*</span>}</label>
                          <textarea
                            value={formData.customData?.[key] ?? ''}
                            onChange={(e) => handleCustomFieldChange(key, e.target.value)}
                            className="input-field w-full min-h-[80px]"
                            placeholder={placeholder || `Enter ${label.toLowerCase()}`}
                            required={customRequired}
                            rows={3}
                          />
                        </>
                      ) : fieldType === 'email' ? (
                        <>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{label} {customRequired && <span className="text-red-500">*</span>}</label>
                          <input
                            type="email"
                            value={formData.customData?.[key] ?? ''}
                            onChange={(e) => handleCustomFieldChange(key, e.target.value)}
                            className="input-field"
                            placeholder={placeholder || `email@example.com`}
                            required={customRequired}
                          />
                        </>
                      ) : fieldType === 'number' ? (
                        <>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{label} {customRequired && <span className="text-red-500">*</span>}</label>
                          <input
                            type="number"
                            value={formData.customData?.[key] ?? ''}
                            onChange={(e) => handleCustomFieldChange(key, e.target.value)}
                            className="input-field"
                            placeholder={placeholder || `Enter ${label.toLowerCase()}`}
                            required={customRequired}
                          />
                        </>
                      ) : fieldType === 'url' ? (
                        <>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{label} {customRequired && <span className="text-red-500">*</span>}</label>
                          <input
                            type="url"
                            value={formData.customData?.[key] ?? ''}
                            onChange={(e) => handleCustomFieldChange(key, e.target.value)}
                            className="input-field"
                            placeholder={placeholder || `https://example.com`}
                            required={customRequired}
                          />
                        </>
                      ) : fieldType === 'date' ? (
                        <>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{label} {customRequired && <span className="text-red-500">*</span>}</label>
                          <input
                            type="date"
                            value={formData.customData?.[key] ?? ''}
                            onChange={(e) => handleCustomFieldChange(key, e.target.value)}
                            className="input-field"
                            required={customRequired}
                          />
                        </>
                      ) : fieldType === 'time' ? (
                        <>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{label} {customRequired && <span className="text-red-500">*</span>}</label>
                          <input
                            type="time"
                            value={formData.customData?.[key] ?? ''}
                            onChange={(e) => handleCustomFieldChange(key, e.target.value)}
                            className="input-field"
                            required={customRequired}
                          />
                        </>
                      ) : (
                        <>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{label} {customRequired && <span className="text-red-500">*</span>}</label>
                          <input
                            type="text"
                            value={formData.customData?.[key] ?? ''}
                            onChange={(e) => handleCustomFieldChange(key, e.target.value)}
                            className="input-field"
                            placeholder={placeholder || `Enter ${label.toLowerCase()}`}
                            required={customRequired}
                          />
                        </>
                      )}
                    </div>
                  ))}
                </div>
                )}

                {counselorFields.expertise !== false && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expertise {isFieldRequired('expertise') && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    multiple
                    size={5}
                    value={formData.expertise.filter(exp => EXPERTISE_OPTIONS.includes(exp))}
                    onChange={handleExpertiseChange}
                    className="input-field w-full"
                    required={isFieldRequired('expertise')}
                  >
                    {EXPERTISE_OPTIONS.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                  
                  {formData.expertise.some(exp => !EXPERTISE_OPTIONS.includes(exp)) && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={customExpertise}
                        onChange={(e) => {
                          setCustomExpertise(e.target.value);
                          const customExps = formData.expertise.filter(exp => !EXPERTISE_OPTIONS.includes(exp));
                          if (e.target.value.trim() && !customExps.includes(e.target.value.trim())) {
                            setFormData(prev => ({
                              ...prev,
                              expertise: [...prev.expertise.filter(exp => EXPERTISE_OPTIONS.includes(exp)), e.target.value.trim()]
                            }));
                          }
                        }}
                        placeholder="Custom expertise (if 'Other' selected)"
                        className="input-field w-full"
                      />
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.expertise.map((exp, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2"
                      >
                        {exp}
                        <button
                          type="button"
                          onClick={() => handleRemoveExpertise(exp)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                )}

                {counselorFields.languages !== false && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Languages {isFieldRequired('languages') && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    multiple
                    size={5}
                    value={formData.languages.filter(lang => LANGUAGE_OPTIONS.includes(lang))}
                    onChange={handleLanguageChange}
                    className="input-field w-full"
                    required={isFieldRequired('languages')}
                  >
                    {LANGUAGE_OPTIONS.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                  
                  {formData.languages.some(lang => !LANGUAGE_OPTIONS.includes(lang)) && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={customLanguage}
                        onChange={(e) => {
                          setCustomLanguage(e.target.value);
                          const customLangs = formData.languages.filter(lang => !LANGUAGE_OPTIONS.includes(lang));
                          if (e.target.value.trim() && !customLangs.includes(e.target.value.trim())) {
                            setFormData(prev => ({
                              ...prev,
                              languages: [...prev.languages.filter(lang => LANGUAGE_OPTIONS.includes(lang)), e.target.value.trim()]
                            }));
                          }
                        }}
                        placeholder="Custom language (if 'Other' selected)"
                        className="input-field w-full"
                      />
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.languages.map((lang, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-2"
                      >
                        {lang}
                        <button
                          type="button"
                          onClick={() => handleRemoveLanguage(lang)}
                          className="text-green-600 hover:text-green-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="btn-secondary"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submitting}
                  >
                    {submitting 
                      ? (editingCounselor ? 'Updating...' : 'Creating...') 
                      : (editingCounselor ? 'Update Counselor' : 'Create Counselor')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Counselor Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Counselor Details</h2>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedCounselor(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {loadingDetails ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading counselor details...</p>
                </div>
              ) : selectedCounselor ? (
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Full Name</label>
                        <p className="text-gray-900 font-medium">{selectedCounselor.fullName}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Email</label>
                        <p className="text-gray-900">{selectedCounselor.user?.email || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Username</label>
                        <p className="text-gray-900">{selectedCounselor.user?.username || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Mobile</label>
                        <p className="text-gray-900">{selectedCounselor.mobile || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Availability</label>
                        <p className="text-gray-900">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            selectedCounselor.availability === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {selectedCounselor.availability}
                          </span>
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Account Status</label>
                        <p className="text-gray-900">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            selectedCounselor.user?.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {selectedCounselor.user?.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Custom Fields */}
                  {selectedCounselor.customData && typeof selectedCounselor.customData === 'object' && Object.keys(selectedCounselor.customData).length > 0 && (() => {
                    const customFields = counselorFields.customFields || [];
                    const entries = customFields.length > 0
                      ? customFields
                          .filter(({ key }) => {
                            const v = selectedCounselor.customData[key];
                            if (v == null) return false;
                            if (Array.isArray(v)) return v.length > 0;
                            return v !== '';
                          })
                          .map(({ key, label, type: fieldType }) => ({ key, label, fieldType }))
                      : Object.entries(selectedCounselor.customData)
                          .filter(([, v]) => v != null && v !== '')
                          .map(([key]) => ({
                            key,
                            label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                            fieldType: null
                          }));
                    const formatValue = (val, type) => {
                      if (Array.isArray(val)) return val.length ? val.join(', ') : '—';
                      if (typeof val === 'boolean') return val ? 'Yes' : 'No';
                      return String(val);
                    };
                    if (entries.length === 0) return null;
                    return (
                      <div className="border-b pb-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Custom Fields</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {entries.map(({ key, label, fieldType }) => (
                            <div key={key}>
                              <label className="text-sm font-medium text-gray-500">{label}</label>
                              <p className="text-gray-900">{formatValue(selectedCounselor.customData[key], fieldType)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Expertise & Languages */}
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Expertise & Languages</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-2 block">Expertise</label>
                        <div className="flex flex-wrap gap-2">
                          {selectedCounselor.expertise && selectedCounselor.expertise.length > 0 ? (
                            selectedCounselor.expertise.map((exp, idx) => (
                              <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                                {exp}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-sm">No expertise listed</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-2 block">Languages</label>
                        <div className="flex flex-wrap gap-2">
                          {selectedCounselor.languages && selectedCounselor.languages.length > 0 ? (
                            selectedCounselor.languages.map((lang, idx) => (
                              <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                                {lang}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-sm">No languages listed</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Statistics */}
                  {selectedCounselor.stats && (
                    <div className="border-b pb-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Leads</p>
                          <p className="text-2xl font-bold text-blue-600">{selectedCounselor.stats.totalLeads || 0}</p>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">New Leads</p>
                          <p className="text-2xl font-bold text-yellow-600">{selectedCounselor.stats.newLeads || 0}</p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">In Progress</p>
                          <p className="text-2xl font-bold text-orange-600">{selectedCounselor.stats.inProgress || 0}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Enrolled</p>
                          <p className="text-2xl font-bold text-green-600">{selectedCounselor.stats.enrolled || 0}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-gray-600">Training Completion</span>
                            <span className="text-sm font-semibold">{selectedCounselor.stats.trainingCompletion || 0}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-purple-600 h-2 rounded-full"
                              style={{ width: `${selectedCounselor.stats.trainingCompletion || 0}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {selectedCounselor.stats.trainingCompleted || 0} / {selectedCounselor.stats.trainingTotal || 0} modules
                          </p>
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-gray-600">Current Load</span>
                            <span className="text-sm font-semibold">
                              {selectedCounselor.stats.currentLoad || 0} / {selectedCounselor.maxCapacity || 50}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                (selectedCounselor.stats.loadPercentage || 0) > 80 ? 'bg-red-600' :
                                (selectedCounselor.stats.loadPercentage || 0) > 60 ? 'bg-yellow-600' : 'bg-blue-600'
                              }`}
                              style={{ width: `${Math.min(selectedCounselor.stats.loadPercentage || 0, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      {selectedCounselor.stats.lastActiveAt && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-600">
                            Last Active: <span className="font-medium">{new Date(selectedCounselor.stats.lastActiveAt).toLocaleString()}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assigned Leads */}
                  {selectedCounselor.assignedLeads && selectedCounselor.assignedLeads.length > 0 && (
                    <div className="border-b pb-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Leads ({selectedCounselor.assignedLeads.length})</h3>
                      <div className="max-h-60 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parent Name</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Classification</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {selectedCounselor.assignedLeads.slice(0, 10).map((lead, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-900">{lead.studentName || 'N/A'}</td>
                                <td className="px-4 py-2 text-gray-900">{lead.parentName || 'N/A'}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    lead.status === 'ENROLLED' ? 'bg-green-100 text-green-800' :
                                    lead.status === 'NEW' ? 'bg-blue-100 text-blue-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {lead.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    lead.classification === 'NEW' ? 'bg-gray-100 text-gray-800' :
                                    lead.classification === 'COUNSELING_IN_PROGRESS' ? 'bg-amber-100 text-amber-800' :
                                    lead.classification === 'PRIORITY' ? 'bg-red-100 text-red-800' :
                                    lead.classification === 'ADMISSION_CONFIRMED' ? 'bg-green-100 text-green-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {lead.classification === 'NEW' ? 'New' : lead.classification === 'COUNSELING_IN_PROGRESS' ? 'Counseling In Progress' : lead.classification === 'PRIORITY' ? 'Priority' : lead.classification === 'ADMISSION_CONFIRMED' ? 'Admission Confirmed' : lead.classification || '—'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {selectedCounselor.assignedLeads.length > 10 && (
                          <p className="text-xs text-gray-500 mt-2 text-center">
                            Showing 10 of {selectedCounselor.assignedLeads.length} leads
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Capacity Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Capacity Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Max Capacity</label>
                        <p className="text-gray-900 font-medium">{selectedCounselor.maxCapacity || 50}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Current Load</label>
                        <p className="text-gray-900 font-medium">{selectedCounselor.currentLoad || 0}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDetailsModal(false);
                        setSelectedCounselor(null);
                      }}
                      className="btn-secondary"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDetailsModal(false);
                        handleEdit(selectedCounselor);
                      }}
                      className="btn-primary"
                    >
                      Edit Counselor
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No details available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCounselors;

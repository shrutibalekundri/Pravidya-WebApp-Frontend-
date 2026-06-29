import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Bot, UserCircle } from 'lucide-react';
import { leadAPI, counselorAPI, adminAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  { value: 'instagram_ads', label: 'Instagram' },
  { value: 'facebook_ads', label: 'Facebook' },
  { value: 'website', label: 'Website' },
  { value: 'whatsapp_direct', label: 'WhatsApp' },
  { value: 'referral', label: 'Referral' },
  // Leads created using forms / admin create-lead should appear as "Manual Entry"
  { value: 'manual_entry', label: 'Manual Entry' },
  { value: 'unknown', label: 'Not set' },
];
const SOURCE_CHART_ENTRIES = SOURCE_OPTIONS.filter((o) => o.value);
const SOURCE_CHART_COLORS = ['#E1306C', '#1877F2', '#22C55E', '#25D366', '#F59E0B', '#8B5CF6', '#6B7280'];

const CLASSIFICATION_LABELS = { NEW: 'New', COUNSELING_IN_PROGRESS: 'Counseling In Progress', PRIORITY: 'Priority', ADMISSION_CONFIRMED: 'Admission Confirmed' };

// Check if assigned counselor speaks the lead's preferred language
const hasLanguageMismatch = (lead, counselor) => {
  if (!lead?.preferredLanguage || !counselor?.languages?.length) return false;
  const preferredLangs = (lead.preferredLanguage || '')
    .toString()
    .split(',')
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);
  if (preferredLangs.length === 0) return false;
  const counselorLangs = counselor.languages.map((l) => (l || '').toString().trim().toLowerCase()).filter(Boolean);
  const hasMatch = preferredLangs.some((pl) => counselorLangs.some((cl) => cl === pl));
  return !hasMatch;
};

const AdminLeads = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    classification: '',
    priority: '',
    status: '',
    assigned: '',
    autoAssigned: '',
    source: '',
    search: '',
  });
  const [leadsBySource, setLeadsBySource] = useState(null);
  const [searchInput, setSearchInput] = useState(''); // Separate state for search input
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const searchTimeoutRef = useRef(null);
  
  // Manual assignment modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [availableCounselors, setAvailableCounselors] = useState([]);
  const [loadingCounselors, setLoadingCounselors] = useState(false);
  const [selectedCounselorId, setSelectedCounselorId] = useState('');
  const [assignmentReason, setAssignmentReason] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importValidationErrors, setImportValidationErrors] = useState(null); // { row, missingFields: [{ fieldName, message }] }[]
  const [importFormatError, setImportFormatError] = useState(null); // { message } when file format is wrong
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef(null);
  // View lead details modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewLead, setViewLead] = useState(null);
  const [loadingView, setLoadingView] = useState(false);
  // Delete confirmation
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
    }, 500); // 500ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchInput]);

  useEffect(() => {
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    adminAPI.getLeadsBySource()
      .then((res) => {
        if (res.data?.success && res.data?.data) setLeadsBySource(res.data.data);
      })
      .catch(() => {});
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        page: pagination.page,
        limit: pagination.limit,
      };
      Object.keys(params).forEach(key => {
        if (params[key] === '') delete params[key];
      });

      const response = await leadAPI.getAll(params);
      setLeads(response.data.data.leads);
      setPagination(prev => ({
        ...prev,
        total: response.data.data.pagination?.total || 0,
        pages: response.data.data.pagination?.pages || 1,
      }));
    } catch (error) {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getStatusBadge = (status) => {
    const colors = {
      NEW: 'bg-blue-100 text-blue-800',
      CONTACTED: 'bg-yellow-100 text-yellow-800',
      FOLLOW_UP: 'bg-orange-100 text-orange-800',
      ENROLLED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      ON_HOLD: 'bg-gray-100 text-gray-800',
      CALL_NOT_CONNECTED: 'bg-amber-100 text-amber-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const isAutoReassignedByInactivity = (lead) => {
    const r = (lead?.assignmentReason || '').toString().toLowerCase();
    return r.includes('auto-reassigned') && r.includes('inactivity');
  };

  const handleAssignClick = async (lead) => {
    setSelectedLead(lead);
    setShowAssignModal(true);
    setLoadingCounselors(true);
    setSelectedCounselorId('');
    setAssignmentReason('');
    
    try {
      // Fetch ALL counselors for manual assignment
      // Admin can visually compare and select the best counselor
      const response = await counselorAPI.getAllForAssignment();
      const counselors = response.data.data.counselors || [];
      
      setAvailableCounselors(counselors);
      
      if (counselors.length === 0) {
        toast.error('No counselors found. Please create counselors first.');
      } else {
        toast.success(`Loaded ${counselors.length} counselor(s) for assignment`);
      }
    } catch (error) {
      console.error('Error loading counselors:', error);
      
      // Check if it's a database connection error
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load counselors';
      const isDbError = errorMessage.includes('database') || 
                       errorMessage.includes('Can\'t reach') || 
                       errorMessage.includes('connection');
      
      if (isDbError) {
        toast.error(
          'Database connection error. Please check: 1) Neon database is active (not paused), 2) Backend server is running',
          { duration: 5000 }
        );
      } else {
        toast.error(errorMessage);
      }
      
      setAvailableCounselors([]);
    } finally {
      setLoadingCounselors(false);
    }
  };

  const handleAutoAssign = async (lead) => {
    try {
      const res = await leadAPI.autoAssign(lead.id || lead._id);
      const counselorName = res.data?.data?.lead?.assignedCounselor?.fullName;
      toast.success(counselorName ? `Assigned to ${counselorName}` : 'Auto assignment attempted');
      fetchLeads();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Auto assignment failed');
    }
  };

  const handleAssignSubmit = async () => {
    if (!selectedCounselorId) {
      toast.error('Please select a counselor');
      return;
    }

    setAssigning(true);
    try {
      await leadAPI.assign(selectedLead.id || selectedLead._id, selectedCounselorId, assignmentReason);
      toast.success('Lead assigned successfully');
      setShowAssignModal(false);
      setSelectedLead(null);
      fetchLeads(); // Refresh leads list
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign lead');
    } finally {
      setAssigning(false);
    }
  };

  const handleViewClick = async (lead) => {
    setShowViewModal(true);
    setViewLead(null);
    setLoadingView(true);
    try {
      const response = await leadAPI.getById(lead.id || lead._id);
      setViewLead(response.data.data.lead);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load lead details');
      setShowViewModal(false);
    } finally {
      setLoadingView(false);
    }
  };

  const handleDeleteClick = (lead) => {
    setLeadToDelete(lead);
  };

  const handleDeleteConfirm = async () => {
    if (!leadToDelete) return;
    setDeleting(true);
    try {
      await leadAPI.delete(leadToDelete.id || leadToDelete._id);
      toast.success('Lead deleted successfully');
      setLeadToDelete(null);
      fetchLeads();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to delete lead';
      const path = error.response?.data?.path;
      toast.error(path ? `${msg} (${path})` : msg, { duration: path ? 6000 : 4000 });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leads Management</h1>
          <p className="text-gray-600 mt-1">View and manage all admission leads</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="relative group w-full sm:w-auto flex justify-end">
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10">
              Create a new lead manually
            </span>
            <button
              type="button"
              className="btn-primary text-sm w-full sm:w-auto"
              onClick={() => navigate('/admin/leads/create')}
            >
              Add New Lead
            </button>
          </div>
          <div className="relative group w-full sm:w-auto flex justify-end">
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10">
              Export all leads to Excel
            </span>
            <button
              type="button"
              className="btn-secondary text-sm w-full sm:w-auto"
              onClick={async () => {
              try {
                const params = {};
                const res = await leadAPI.export(params);
                const blob = res.data instanceof Blob ? res.data : new Blob([res.data], {
                  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'leads_export.xlsx';
                document.body.appendChild(link);
                link.click();
                window.URL.revokeObjectURL(url);
                link.remove();
                toast.success('Leads exported successfully');
              } catch (error) {
                console.error('Export leads error:', error);
                toast.error(error.response?.data?.message || 'Failed to export leads');
              }
            }}
          >
            Export bulk leads
          </button>
          </div>
          <div className="relative group w-full sm:w-auto flex justify-end">
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10">
              Import leads from Excel file
            </span>
            <button
              type="button"
              className="btn-primary text-sm w-full sm:w-auto"
              disabled={importing}
              onClick={() => setShowImportModal(true)}
            >
              {importing ? 'Importing...' : 'Import Leads'}
            </button>
          </div>
          <div className="relative group w-full sm:w-auto flex justify-end">
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10">
              Download Excel template for importing leads
            </span>
            <button
              type="button"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 bg-transparent border-0 cursor-pointer p-0"
              onClick={async () => {
              try {
                const res = await leadAPI.exportTemplate();
                const blob = res.data instanceof Blob ? res.data : new Blob([res.data], {
                  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'lead_import_template.xlsx';
                document.body.appendChild(link);
                link.click();
                window.URL.revokeObjectURL(url);
                link.remove();
                toast.success('Template downloaded');
              } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to download template');
              }
            }}
          >
            Download lead template
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
          setImportValidationErrors(null);
          setImportFormatError(null);
          try {
            const res = await leadAPI.import(file);
            const data = res.data.data;
            setImportResult(data);
            if (data.validationErrors && data.validationErrors.length > 0) {
              setImportValidationErrors(data.validationErrors);
              const hasDup = data.validationErrors.some((e) => e.duplicate);
              const hasMissing = data.validationErrors.some((e) => e.missingFields?.length);
              let msg = 'Import aborted: ';
              if (hasMissing && hasDup) msg += 'some rows have empty fields or are duplicates.';
              else if (hasDup) msg += 'duplicate leads (same Student Name, Parent Name, Phone and Email).';
              else msg += 'some rows have empty required fields.';
              toast.error(msg);
            } else {
              toast.success('Lead import completed');
            }
            fetchLeads();
          } catch (error) {
            const data = error.response?.data;
            const message = data?.message || 'Failed to import leads';
            const isFormatError = data?.formatError === true;
            if (isFormatError) {
              setImportFormatError({ message });
            } else {
              toast.error(message);
            }
          } finally {
            setImporting(false);
            e.target.value = '';
          }
        }}
      />

      {/* Import warning modal: template download link + choose file */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowImportModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Import Leads</h3>
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              Ensure your data is correctly formatted according to the template below. Incorrect formatting may cause import errors.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                className="btn-secondary text-sm w-full"
                onClick={async () => {
                  try {
                    const res = await leadAPI.exportTemplate();
                    const blob = res.data instanceof Blob ? res.data : new Blob([res.data], {
                      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    });
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'lead_import_template.xlsx';
                    document.body.appendChild(link);
                    link.click();
                    window.URL.revokeObjectURL(url);
                    link.remove();
                    toast.success('Template downloaded successfully');
                  } catch (error) {
                    toast.error(error.response?.data?.message || 'Failed to download template');
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

      {/* Wrong format error popup – user sees exactly what went wrong and can download template */}
      {importFormatError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setImportFormatError(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-red-800 mb-2">Wrong file format</h3>
            <p className="text-sm text-gray-700 mb-4">{importFormatError.message}</p>
            <p className="text-sm text-gray-600 mb-4">Use the &quot;Download lead template&quot; link to get the correct Excel format, then fill in your data and import again.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={async () => {
                  try {
                    const res = await leadAPI.exportTemplate();
                    const blob = res.data instanceof Blob ? res.data : new Blob([res.data], {
                      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    });
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'lead_import_template.xlsx';
                    document.body.appendChild(link);
                    link.click();
                    window.URL.revokeObjectURL(url);
                    link.remove();
                    toast.success('Template downloaded');
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to download template');
                  }
                }}
              >
                Download lead template
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => setImportFormatError(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import validation errors popup (missing fields + duplicates) */}
      {importValidationErrors && importValidationErrors.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setImportValidationErrors(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Import errors</h3>
              <p className="text-sm text-gray-600 mt-1">No leads were inserted. Fix the following and upload again.</p>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <ul className="space-y-4">
                {importValidationErrors.map((err, idx) => (
                  <li key={idx} className="border border-amber-200 rounded-lg p-3 bg-amber-50">
                    <span className="font-medium text-gray-900">Row {err.row}</span>
                    {err.duplicate ? (
                      <p className="mt-2 text-sm text-amber-800 font-medium">{err.message}</p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-sm text-gray-700">
                        {(err.missingFields || []).map((f, i) => (
                          <li key={i}>
                            <span className="font-medium text-amber-800">{f.fieldName}</span>
                            <span className="text-amber-700"> — {f.message}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setImportValidationErrors(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <input
            type="text"
            placeholder="Search..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input-field"
          />
          <select
            value={filters.classification}
            onChange={(e) => handleFilterChange('classification', e.target.value)}
            className="input-field"
          >
            <option value="">All Classifications</option>
            <option value="NEW">New</option>
            <option value="COUNSELING_IN_PROGRESS">Counseling In Progress</option>
            <option value="PRIORITY">Priority</option>
            <option value="ADMISSION_CONFIRMED">Admission Confirmed</option>
          </select>
          <select
            value={filters.priority}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
            className="input-field"
          >
            <option value="">All Priorities</option>
            <option value="LOW">LOW</option>
            <option value="NORMAL">NORMAL</option>
            <option value="HIGH">HIGH</option>
            <option value="URGENT">URGENT</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="input-field"
          >
            <option value="">All Status</option>
            <option value="NEW">NEW</option>
            <option value="CONTACTED">CONTACTED</option>
            <option value="FOLLOW_UP">FOLLOW_UP</option>
            <option value="ENROLLED">ENROLLED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="ON_HOLD">ON_HOLD</option>
            <option value="CALL_NOT_CONNECTED">CALL_NOT_CONNECTED</option>
          </select>
          <select
            value={filters.assigned}
            onChange={(e) => handleFilterChange('assigned', e.target.value)}
            className="input-field"
          >
            <option value="">All Assignments</option>
            <option value="true">Assigned</option>
            <option value="false">Unassigned</option>
          </select>
          <select
            value={filters.autoAssigned}
            onChange={(e) => handleFilterChange('autoAssigned', e.target.value)}
            className="input-field"
          >
            <option value="">All Types</option>
            <option value="true">Auto Assigned</option>
            <option value="false">Manual Assigned</option>
          </select>
          <select
            value={filters.source}
            onChange={(e) => handleFilterChange('source', e.target.value)}
            className="input-field"
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Leads Distribution by Source - Pie Chart */}
      {leadsBySource && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Leads Distribution by Source</h2>
          <div className="w-full max-w-md h-80 mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={SOURCE_CHART_ENTRIES.map((opt) => ({
                    name: opt.label,
                    value: leadsBySource[opt.value] ?? 0,
                  })).filter((d) => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {SOURCE_CHART_ENTRIES.map((opt) => ({ name: opt.label, value: leadsBySource[opt.value] ?? 0 })).filter((d) => d.value > 0).map((_, i) => (
                    <Cell key={i} fill={SOURCE_CHART_COLORS[i % SOURCE_CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, 'Leads']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Leads Table */}
      <div className="card">
        {loading && leads.length === 0 ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 py-3 border-b animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-4 bg-gray-200 rounded w-40"></div>
                <div className="h-4 bg-gray-200 rounded w-28"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No leads found</div>
        ) : (
          <>
            {importResult && (
              <div className="mb-4 p-3 rounded border border-gray-200 bg-gray-50 text-sm text-gray-700">
                <span className="font-semibold">Import summary:</span>{' '}
                ✔ Inserted: {importResult.inserted}
                {importResult.skipped != null && importResult.skipped > 0 && (
                  <> · ⚠ Skipped: {importResult.skipped}</>
                )}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Lead ID</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Student</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Parent</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Course</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Assignment</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Date</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id || lead._id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm text-primary-600">{lead.leadId || (lead.id ? `ID-${String(lead.id).slice(-8)}` : '—')}</span>
                      </td>
                      <td className="py-3 px-4">{lead.studentName}</td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{lead.parentName}</div>
                          <div className="text-sm text-gray-500">{lead.parentMobile}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {lead.course?.name || (lead.importedCourseName ? `${lead.importedCourseName} (course not available)` : 'N/A')}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(lead.status)}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {lead.assignedCounselor ? (
                          <div>
                            <div className="text-sm font-medium">
                              {lead.assignedCounselor.fullName}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              {lead.autoAssigned ? (
                                <span className="text-green-600 inline-flex items-center gap-1"><Bot className="w-3.5 h-3.5" /> Auto</span>
                              ) : (
                                <span className="text-blue-600 inline-flex items-center gap-1"><UserCircle className="w-3.5 h-3.5" /> Manual</span>
                              )}
                              {isAutoReassignedByInactivity(lead) && (
                                <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
                                  Auto reassigned (inactivity)
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleAssignClick(lead)}
                              className="text-xs text-primary-600 hover:text-primary-700 mt-1 font-medium"
                            >
                              Reassign Counselor
                            </button>
                          </div>
                        ) : (
                          <div>
                            <span className="text-red-500 text-sm block mb-1">Unassigned</span>
                            <button
                              onClick={() => handleAutoAssign(lead)}
                              className="text-xs btn-primary py-1 px-2 font-medium"
                            >
                              Assign
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {format(new Date(lead.submittedAt), 'MMM dd, yyyy')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewClick(lead)}
                            className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="View details"
                            aria-label="View lead details"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/leads/${lead.id}/edit`)}
                            className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Edit lead"
                            aria-label="Edit lead"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(lead)}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete lead"
                            aria-label="Delete lead"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <div className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} leads
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (pagination.page > 1) {
                      setPagination(prev => ({ ...prev, page: prev.page - 1 }));
                    }
                  }}
                  disabled={pagination.page <= 1}
                  className={`btn-secondary ${
                    pagination.page <= 1 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:bg-gray-300 cursor-pointer'
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    const maxPage = Math.ceil(pagination.total / pagination.limit);
                    if (pagination.page < maxPage) {
                      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
                    }
                  }}
                  disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                  className={`btn-secondary ${
                    pagination.page >= Math.ceil(pagination.total / pagination.limit)
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:bg-gray-300 cursor-pointer'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Manual Assignment Modal */}
      {showAssignModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Assign Counselor</h2>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedLead(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Lead Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Lead Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Student:</span>{' '}
                    <span className="font-medium">{selectedLead.studentName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Parent:</span>{' '}
                    <span className="font-medium">{selectedLead.parentName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Course:</span>{' '}
                    <span className="font-medium">
                      {selectedLead.course?.name || (selectedLead.importedCourseName ? `${selectedLead.importedCourseName} (course not available)` : 'N/A')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Language:</span>{' '}
                    <span className="font-medium">{selectedLead.preferredLanguage}</span>
                  </div>
                </div>
              </div>

              {/* Counselor Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Counselor <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-500 ml-2">({availableCounselors.length} available)</span>
                </label>
                {loadingCounselors ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Loading all counselors...</p>
                  </div>
                ) : availableCounselors.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                    <p className="text-gray-600 font-medium mb-2">No counselors found</p>
                    <p className="text-sm text-gray-500 mb-4">
                      No counselors are available in the system
                    </p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={async () => {
                          setLoadingCounselors(true);
                          try {
                            const response = await counselorAPI.getAllForAssignment();
                            setAvailableCounselors(response.data.data.counselors || []);
                            if (response.data.data.counselors?.length === 0) {
                              toast.error('No counselors exist. Please create counselors first.');
                            } else {
                              toast.success('Counselors refreshed');
                            }
                          } catch (error) {
                            toast.error('Failed to refresh counselors');
                          } finally {
                            setLoadingCounselors(false);
                          }
                        }}
                        className="btn-secondary text-sm"
                      >
                        Refresh List
                      </button>
                      <button
                        onClick={() => {
                          setShowAssignModal(false);
                          window.location.href = '/admin/counselors';
                        }}
                        className="btn-primary text-sm"
                      >
                        Create Counselor
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto border rounded-lg p-2">
                    {availableCounselors.map((counselor) => (
                      <div
                        key={counselor.id}
                        onClick={() => setSelectedCounselorId(counselor.id)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedCounselorId === counselor.id
                            ? 'border-primary-600 bg-primary-50 shadow-md'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">{counselor.fullName}</div>
                            <div className="text-sm text-gray-600 mt-1 space-y-1">
                              <div>Email: {counselor.email}</div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  counselor.availability === 'ACTIVE'
                                    ? 'bg-green-100 text-green-800'
                                    : counselor.availability === 'AWAY'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {counselor.availability}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs ${
                                  counselor.presenceStatus === 'ONLINE' || counselor.presenceStatus === 'ACTIVE'
                                    ? 'bg-blue-100 text-blue-800'
                                    : counselor.presenceStatus === 'AWAY'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {counselor.presenceStatus}
                                </span>
                                <span className="text-gray-600">
                                  Load: {counselor.currentLoad}/{counselor.maxCapacity} ({counselor.loadPercentage}%)
                                </span>
                              </div>
                            </div>
                            <div className="mt-2 space-y-2">
                              <div>
                                <span className="text-xs font-medium text-gray-500">Expertise:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {counselor.expertise && counselor.expertise.length > 0 ? (
                                    counselor.expertise.map((exp, idx) => (
                                      <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                        {exp}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-gray-400">None</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500">Languages:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {counselor.languages && counselor.languages.length > 0 ? (
                                    counselor.languages.map((lang, idx) => (
                                      <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                        {lang}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-gray-400">None</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selectedCounselorId === counselor.id
                              ? 'border-primary-600 bg-primary-600'
                              : 'border-gray-300'
                          }`}>
                            {selectedCounselorId === counselor.id && (
                              <span className="text-white text-xs">✓</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignment Reason */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assignment Reason (Optional)
                </label>
                <textarea
                  value={assignmentReason}
                  onChange={(e) => setAssignmentReason(e.target.value)}
                  placeholder="e.g., Manual assignment due to specific expertise requirement"
                  className="input-field"
                  rows="3"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedLead(null);
                  }}
                  className="btn-secondary"
                  disabled={assigning}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignSubmit}
                  className="btn-primary"
                  disabled={assigning || !selectedCounselorId}
                >
                  {assigning ? 'Assigning...' : 'Assign Counselor'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Lead Details Modal */}
      {showViewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Lead Details</h2>
                <button
                  type="button"
                  onClick={() => { setShowViewModal(false); setViewLead(null); }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              {loadingView ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
                </div>
              ) : viewLead ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500 block">Lead ID</span>
                      <span className="font-mono font-medium">{viewLead.leadId || '—'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">Status</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(viewLead.status)}`}>
                        {viewLead.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">Classification</span>
                      <span className="font-medium">{viewLead.classification ? (CLASSIFICATION_LABELS[viewLead.classification] ?? viewLead.classification) : '—'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">Priority</span>
                      <span className="font-medium">{viewLead.priority || '—'}</span>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Student</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div><span className="text-gray-500">Name:</span> {viewLead.studentName}</div>
                      <div><span className="text-gray-500">Class:</span> {viewLead.currentClass || '—'}</div>
                      <div><span className="text-gray-500">Date of birth:</span> {viewLead.dateOfBirth ? format(new Date(viewLead.dateOfBirth), 'MMM dd, yyyy') : '—'}</div>
                      <div><span className="text-gray-500">Gender:</span> {viewLead.gender || '—'}</div>
                      {viewLead.boardUniversity && <div><span className="text-gray-500">Board/University:</span> {viewLead.boardUniversity}</div>}
                      {viewLead.marksPercentage != null && <div><span className="text-gray-500">Marks %:</span> {viewLead.marksPercentage}</div>}
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Parent / Guardian</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div><span className="text-gray-500">Name:</span> {viewLead.parentName}</div>
                      <div><span className="text-gray-500">Mobile:</span> {viewLead.parentMobile}</div>
                      <div><span className="text-gray-500">Email:</span> {viewLead.parentEmail}</div>
                      <div><span className="text-gray-500">City:</span> {viewLead.parentCity || '—'}</div>
                      <div><span className="text-gray-500">Preferred language:</span> {viewLead.preferredLanguage || '—'}</div>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Admission</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div><span className="text-gray-500">Institution:</span> {viewLead.institution?.name || '—'}</div>
                      <div><span className="text-gray-500">Course:</span> {viewLead.course?.name || viewLead.importedCourseName || 'N/A'}</div>
                      <div><span className="text-gray-500">Academic year:</span> {viewLead.academicYear || '—'}</div>
                      <div><span className="text-gray-500">Counseling mode:</span> {viewLead.preferredCounselingMode || '—'}</div>
                    </div>
                  </div>
                  {viewLead.assignedCounselor && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Assignment</h3>
                      {hasLanguageMismatch(viewLead, viewLead.assignedCounselor) && (
                        <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                          <div className="flex items-start gap-2">
                            <span className="text-lg flex-shrink-0" aria-hidden>⚠️</span>
                            <div>
                              <p>The assigned counselor does not speak the lead&apos;s preferred language ({viewLead.preferredLanguage || '—'}). Consider reassigning to a counselor who does.</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowViewModal(false);
                                  setViewLead(null);
                                  handleAssignClick(viewLead);
                                }}
                                className="mt-2 text-amber-800 font-medium hover:underline underline-offset-2"
                              >
                                Reassign Counselor →
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="text-sm">
                        <span className="text-gray-500">Counselor:</span> {viewLead.assignedCounselor.fullName}
                        {viewLead.assignedCounselor.mobile && <span className="ml-2 text-gray-600">({viewLead.assignedCounselor.mobile})</span>}
                        <span className="ml-2 text-xs inline-flex items-center gap-1">
                        {viewLead.autoAssigned ? (<><Bot className="w-3.5 h-3.5 text-green-600" /> Auto</>) : (<><UserCircle className="w-3.5 h-3.5 text-blue-600" /> Manual</>)}
                      </span>
                      </div>
                    </div>
                  )}
                  {viewLead.customData && typeof viewLead.customData === 'object' && Object.keys(viewLead.customData).length > 0 && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Additional Fields</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {Object.entries(viewLead.customData).map(([key, val]) => {
                          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).replace(/[-_]/g, ' ');
                          const display = val == null ? '—' : Array.isArray(val) ? val.join(', ') : String(val);
                          if (display === '—' || display === '') return null;
                          return (
                            <div key={key}><span className="text-gray-500">{label}:</span> {display}</div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {(viewLead.notes || viewLead.leadSource || viewLead.sourceCollege) && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Other</h3>
                      <div className="text-sm space-y-1">
                        {viewLead.notes && <div><span className="text-gray-500">Notes:</span> {viewLead.notes}</div>}
                        {viewLead.leadSource && <div><span className="text-gray-500">Source:</span> {viewLead.leadSource}</div>}
                        {viewLead.sourceCollege && <div><span className="text-gray-500">Source college:</span> {viewLead.sourceCollege}</div>}
                      </div>
                    </div>
                  )}
                  <div className="border-t pt-4 text-sm text-gray-500">
                    Submitted: {format(new Date(viewLead.submittedAt), 'MMM dd, yyyy HH:mm')}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {leadToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => !deleting && setLeadToDelete(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Lead</h3>
            <p className="text-gray-600 text-sm mb-4">
              Are you sure you want to delete lead <strong>{leadToDelete.leadId || (leadToDelete.studentName && `${leadToDelete.studentName}’s`) || 'this'}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setLeadToDelete(null)}
                className="btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminLeads;

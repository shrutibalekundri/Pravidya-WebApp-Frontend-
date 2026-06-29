import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Video, FileText, FileSpreadsheet, Presentation, Link2, Search, File, Clock, Package, Calendar } from 'lucide-react';
import { trainingModuleAPI, schoolAPI, counselorAPI } from '../../services/api';
import toast from 'react-hot-toast';

const CONTENT_TYPE_ICONS = {
  VIDEO: Video,
  PDF: FileText,
  DOCUMENT: FileText,
  EXCEL: FileSpreadsheet,
  PPT: Presentation,
  LINK: Link2,
};

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '');

function formatFileSize(bytes) {
  if (bytes == null || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getVideoThumbnail(module) {
  if (module?.thumbnail) {
    const t = module.thumbnail;
    return t.startsWith('http') ? t : `${API_BASE}${t}`;
  }
  const url = module?.fileUrl || module?.contentUrl || '';
  if (typeof url !== 'string') return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);
  if (m) return `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg`;
  return null;
}

/** Capture a frame from an uploaded video file and return as JPEG Blob (for automatic thumbnail). */
function captureVideoThumbnail(videoFile) {
  return new Promise((resolve, reject) => {
    if (!videoFile || !videoFile.type.startsWith('video/')) {
      reject(new Error('Not a video file'));
      return;
    }
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    const url = URL.createObjectURL(videoFile);
    video.src = url;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video'));
    };

    video.onloadeddata = () => {
      const seekTime = Math.min(1, Math.max(0, (video.duration || 1) * 0.1));
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) resolve(blob);
            else reject(new Error('Failed to create thumbnail'));
          },
          'image/jpeg',
          0.85
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    };
  });
}

function getVideoPreviewUrl(module) {
  const url = module?.fileUrl || module?.contentUrl || '';
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http')) return url;
  return url.startsWith('/') ? `${API_BASE}${url}` : `${API_BASE}/${url}`;
}

const CONTENT_TYPES = [
  { value: 'VIDEO', label: 'Video', iconColor: 'text-purple-600' },
  { value: 'PDF', label: 'PDF', iconColor: 'text-red-600' },
  { value: 'DOCUMENT', label: 'Document (DOC/DOCX)', iconColor: 'text-blue-600' },
  { value: 'EXCEL', label: 'Excel (XLS/XLSX)', iconColor: 'text-emerald-600' },
  { value: 'PPT', label: 'PPT/PPTX', iconColor: 'text-amber-600' },
  { value: 'LINK', label: 'Link (URL)', iconColor: 'text-gray-600' },
];

function getContentTypeIconComponent(contentType) {
  const Icon = CONTENT_TYPE_ICONS[contentType] || File;
  return Icon;
}

function getContentTypeBadgeColor(contentType) {
  const colors = {
    VIDEO: 'bg-purple-100 text-purple-800',
    PDF: 'bg-red-100 text-red-800',
    DOCUMENT: 'bg-blue-100 text-blue-800',
    EXCEL: 'bg-emerald-100 text-emerald-800',
    PPT: 'bg-amber-100 text-amber-800',
    LINK: 'bg-gray-100 text-gray-800',
  };
  return colors[contentType] || 'bg-gray-100 text-gray-800';
}

const TRAINING_VIEW_STORAGE_KEY = 'pravidya_training_view';

function getStoredTrainingView() {
  try {
    const raw = localStorage.getItem(TRAINING_VIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const layout = ['cards', 'list', 'details', 'tiles', 'content'].includes(parsed?.viewLayout) ? parsed.viewLayout : 'cards';
    const iconSize = ['extraLarge', 'large', 'medium', 'small'].includes(parsed?.viewIconSize) ? parsed.viewIconSize : 'medium';
    const sortBy = ['name', 'dateModified', 'type', 'size', 'dateCreated', 'title'].includes(parsed?.sortBy) ? parsed.sortBy : 'dateModified';
    const sortOrder = parsed?.sortOrder === 'asc' || parsed?.sortOrder === 'desc' ? parsed.sortOrder : 'desc';
    const groupBy = ['none', 'name', 'type', 'dateModified', 'dateCreated', 'status'].includes(parsed?.groupBy) ? parsed.groupBy : 'none';
    return {
      viewLayout: layout,
      viewIconSize: iconSize,
      showDetailsPane: Boolean(parsed?.showDetailsPane),
      showPreviewPane: Boolean(parsed?.showPreviewPane),
      sortBy,
      sortOrder,
      groupBy,
    };
  } catch {
    return null;
  }
}

function saveTrainingView(state) {
  try {
    localStorage.setItem(TRAINING_VIEW_STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}
}

const TrainingModules = () => {
  const [modules, setModules] = useState([]);
  const [schools, setSchools] = useState([]);
  const [counselors, setCounselors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, limit: 9, total: 0, pages: 1 });
  const [previewModule, setPreviewModule] = useState(null);
  // View options (like file explorer) – persisted so they survive tab switch
  const stored = getStoredTrainingView();
  const [viewLayout, setViewLayout] = useState(stored?.viewLayout ?? 'cards');
  const [viewIconSize, setViewIconSize] = useState(stored?.viewIconSize ?? 'medium');
  const [showDetailsPane, setShowDetailsPane] = useState(stored?.showDetailsPane ?? false);
  const [showPreviewPane, setShowPreviewPane] = useState(stored?.showPreviewPane ?? false);
  const [selectedModule, setSelectedModule] = useState(null); // for details/preview panes
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  // Sort options (like file explorer) – persisted
  const [sortBy, setSortBy] = useState(stored?.sortBy ?? 'dateModified');
  const [sortOrder, setSortOrder] = useState(stored?.sortOrder ?? 'desc');
  const [groupBy, setGroupBy] = useState(stored?.groupBy ?? 'none');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [sortMoreOpen, setSortMoreOpen] = useState(false);
  const [groupByOpen, setGroupByOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contentType: 'VIDEO',
    contentUrl: '',
    duration: '',
    tags: '',
    schoolId: '',
    isPublished: false,
    counselorIds: [],
  });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchModules();
    fetchSchools();
    fetchCounselors();
  }, []);

  const fetchModules = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: pagination.limit };
      if (searchInput.trim()) params.search = searchInput.trim();
      if (typeFilter) params.contentType = typeFilter;
      if (statusFilter === 'published') params.isPublished = 'true';
      if (statusFilter === 'draft') params.isPublished = 'false';
      const response = await trainingModuleAPI.getAll(params);
      const data = response.data?.data || {};
      setModules(data.modules || []);
      if (data.pagination) setPagination((prev) => ({ ...prev, ...data.pagination }));
    } catch (error) {
      toast.error('Failed to load training modules');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchools = async () => {
    try {
      const response = await schoolAPI.getAll({ limit: 300 });
      setSchools(response.data.data?.schools ?? response.data.data ?? []);
    } catch (_) {
      setSchools([]);
    }
  };

  const fetchCounselors = async () => {
    try {
      const response = await counselorAPI.getAll({ limit: 200 });
      setCounselors(response.data.data?.counselors ?? response.data.data ?? []);
    } catch (_) {
      setCounselors([]);
    }
  };

  useEffect(() => {
    fetchModules(1);
  }, [searchInput, typeFilter, statusFilter]);

  // Persist view/sort state so it survives tab switch and page reload
  useEffect(() => {
    saveTrainingView({
      viewLayout,
      viewIconSize,
      showDetailsPane,
      showPreviewPane,
      sortBy,
      sortOrder,
      groupBy,
    });
  }, [viewLayout, viewIconSize, showDetailsPane, showPreviewPane, sortBy, sortOrder, groupBy]);

  const goToPage = (p) => {
    fetchModules(p);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCounselorToggle = (counselorId) => {
    setFormData((prev) => {
      const ids = prev.counselorIds || [];
      const next = ids.includes(counselorId) ? ids.filter((id) => id !== counselorId) : [...ids, counselorId];
      return { ...prev, counselorIds: next };
    });
  };

  const handleAddNew = () => {
    setEditingModule(null);
    setFile(null);
    setFormData({
      title: '',
      description: '',
      contentType: 'VIDEO',
      contentUrl: '',
      duration: '',
      tags: '',
      schoolId: '',
      isPublished: false,
      counselorIds: [],
    });
    setShowModal(true);
  };

  const handleEdit = async (module) => {
    setEditingModule(module);
    setFile(null);
    let counselorIds = [];
    try {
      const res = await trainingModuleAPI.getById(module.id);
      counselorIds = (res.data?.data?.assignments ?? []).map((a) => a.counselorId);
    } catch (_) {}
    setFormData({
      title: module.title,
      description: module.description || '',
      contentType: module.contentType || 'VIDEO',
      contentUrl: module.contentUrl || module.linkUrl || '',
      duration: module.duration?.toString() || '',
      tags: Array.isArray(module.tags) ? module.tags.join(', ') : '',
      schoolId: module.schoolId || '',
      isPublished: module.isPublished ?? false,
      counselorIds,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isLink = formData.contentType === 'LINK';
      if (editingModule) {
        const payload = {
          title: formData.title,
          description: formData.description || null,
          contentType: formData.contentType,
          contentUrl: isLink ? formData.contentUrl : undefined,
          duration: formData.duration ? parseInt(formData.duration) : null,
          tags: formData.tags ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
          schoolId: formData.schoolId || null,
          isPublished: formData.isPublished,
          counselorIds: formData.counselorIds,
        };
        await trainingModuleAPI.update(editingModule.id, payload);
        toast.success('Training module updated');
      } else {
        const form = new FormData();
        form.append('title', formData.title);
        form.append('description', formData.description || '');
        form.append('contentType', formData.contentType);
        form.append('duration', formData.duration || '');
        form.append('tags', JSON.stringify(formData.tags ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : []));
        form.append('schoolId', formData.schoolId || '');
        form.append('isPublished', formData.isPublished);
        form.append('counselorIds', JSON.stringify(formData.counselorIds || []));
        if (isLink) form.append('contentUrl', formData.contentUrl);
        else if (formData.contentType === 'VIDEO' && formData.contentUrl?.trim()) {
          form.append('contentUrl', formData.contentUrl.trim());
        } else if (file) {
          form.append('file', file);
          // Backend uses single file upload (media folder); thumbnail not sent to avoid extra file
        } else {
          toast.error('Please upload a file or provide a link/URL');
          setSubmitting(false);
          return;
        }
        await trainingModuleAPI.create(form);
        toast.success('Training module created');
      }
      setShowModal(false);
      fetchModules();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (module) => {
    try {
      await trainingModuleAPI.update(module.id, { isPublished: !module.isPublished });
      toast.success(module.isPublished ? 'Unpublished' : 'Published');
      fetchModules();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this training module?')) return;
    try {
      await trainingModuleAPI.delete(id);
      toast.success('Deleted');
      fetchModules();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const list = Array.isArray(counselors) ? counselors : [];
  const assignedCount = (module) => module._count?.assignments ?? 0;

  const filteredModules = modules.filter((m) => {
    const n = assignedCount(m);
    if (assignmentFilter === 'assigned') return n > 0;
    if (assignmentFilter === 'unassigned') return n === 0;
    return true;
  });

  // Sort: compare by sortBy, then apply sortOrder
  const getSortValue = (m, key) => {
    switch (key) {
      case 'name':
      case 'title':
        return (m.title || '').toLowerCase();
      case 'dateModified':
        return new Date(m.updatedAt || m.createdAt || 0).getTime();
      case 'type':
        return (m.contentType || '').toLowerCase();
      case 'size':
        return m.fileSize ?? 0;
      case 'dateCreated':
        return new Date(m.createdAt || 0).getTime();
      default:
        return 0;
    }
  };
  const sortedModules = [...filteredModules].sort((a, b) => {
    const key = sortBy;
    const aVal = getSortValue(a, key);
    const bVal = getSortValue(b, key);
    let cmp = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') cmp = aVal.localeCompare(bVal);
    else cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortOrder === 'desc' ? -cmp : cmp;
  });

  // Group by (optional): partition into { groupLabel: modules[] }
  const getGroupKey = (m) => {
    switch (groupBy) {
      case 'type':
        return m.contentType || 'Other';
      case 'status':
        return m.isPublished ? 'Published' : 'Draft';
      case 'dateCreated':
        return m.createdAt ? format(new Date(m.createdAt), 'MMMM yyyy') : 'Unknown';
      case 'dateModified':
        return m.updatedAt ? format(new Date(m.updatedAt), 'MMMM yyyy') : (m.createdAt ? format(new Date(m.createdAt), 'MMMM yyyy') : 'Unknown');
      case 'name':
        const t = (m.title || '').trim();
        return t ? t[0].toUpperCase() : '—';
      case 'none':
      default:
        return null;
    }
  };
  const groupedModules = groupBy && groupBy !== 'none'
    ? sortedModules.reduce((acc, m) => {
        const key = getGroupKey(m);
        if (!acc[key]) acc[key] = [];
        acc[key].push(m);
        return acc;
      }, {})
    : null;
  const displayGroups = groupBy && groupBy !== 'none'
    ? Object.entries(groupedModules).sort(([a], [b]) => a.localeCompare(b))
    : null;

  const gridCols = viewLayout === 'cards' || viewLayout === 'tiles'
    ? viewIconSize === 'extraLarge'
      ? 'grid-cols-1 md:grid-cols-2'
      : viewIconSize === 'large'
        ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        : viewIconSize === 'small'
          ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5'
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
    : 'grid-cols-1';
  const thumbHeight = viewLayout === 'cards'
    ? viewIconSize === 'extraLarge'
      ? 'h-56'
      : viewIconSize === 'large'
        ? 'h-48'
        : viewIconSize === 'small'
          ? 'h-32'
          : 'h-44'
    : viewLayout === 'tiles'
      ? 'h-28'
      : 'h-44';
  const sections = displayGroups || [[null, sortedModules]];
  const showPanes = (showDetailsPane || showPreviewPane) && (selectedModule || sortedModules.length > 0);

  const renderModuleThumb = (module, thumbClass = '') => {
    const isVideo = module.contentType === 'VIDEO';
    const thumb = getVideoThumbnail(module);
    const isYouTube = (module?.fileUrl || module?.contentUrl || '').includes('youtube') || (module?.fileUrl || module?.contentUrl || '').includes('youtu.be');
    const typeInfo = CONTENT_TYPES.find((c) => c.value === (module.contentType || 'DOCUMENT'));
    return (
      <div className={`relative w-full bg-gray-50 flex-shrink-0 overflow-hidden ${thumbClass}`}>
        {isVideo ? (
          <>
            {thumb ? (
              <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl text-gray-400">🎥</div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[16px] border-l-white border-b-[10px] border-b-transparent ml-1" />
              </div>
            </div>
            {isYouTube && <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-medium rounded">YouTube</span>}
            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-white text-xs font-medium rounded">{module.duration ? `${module.duration} min` : '—'}</span>
          </>
        ) : (
          <div className={`w-full h-full flex flex-col items-center justify-center gap-2 p-4 ${typeInfo?.iconColor || 'text-gray-600'}`}>
            {(() => { const Icon = getContentTypeIconComponent(module.contentType); return <Icon className="w-14 h-14" strokeWidth={1.5} />; })()}
            <span className={`text-xs px-2 py-1 rounded font-medium ${getContentTypeBadgeColor(module.contentType)}`}>{module.contentType || 'DOCUMENT'}</span>
          </div>
        )}
        <span className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-medium shadow ${module.isPublished ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}`}>
          {module.isPublished ? 'Published' : 'Draft'}
        </span>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Modules</h1>
          <p className="text-sm text-gray-600 mt-0.5">Manage training materials for counselors</p>
        </div>
        <button onClick={handleAddNew} className="btn-primary inline-flex items-center gap-2">
          <span>Upload Content</span>
          <span className="text-lg leading-none">+</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search modules..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            aria-label="Search modules"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 min-w-[140px]"
          aria-label="Filter by type"
        >
          <option value="">All Types</option>
          {CONTENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 min-w-[140px]"
          aria-label="Filter by status"
        >
          <option value="">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select
          value={assignmentFilter}
          onChange={(e) => setAssignmentFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 min-w-[180px]"
          aria-label="Filter by assignment"
        >
          <option value="all">Assigned to Everyone</option>
          <option value="assigned">Assigned only</option>
          <option value="unassigned">Unassigned</option>
        </select>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setSortDropdownOpen((o) => !o); setSortMoreOpen(false); setGroupByOpen(false); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            aria-expanded={sortDropdownOpen}
            aria-haspopup="true"
            aria-label="Sort options"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
            Sort
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {sortDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => { setSortDropdownOpen(false); setSortMoreOpen(false); setGroupByOpen(false); }} aria-hidden="true" />
              <div className="absolute right-0 mt-1 z-20 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {[
                  { value: 'name', label: 'Name' },
                  { value: 'dateModified', label: 'Date modified' },
                  { value: 'type', label: 'Type' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setSortBy(opt.value); setSortDropdownOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100"
                  >
                    {sortBy === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
                    <span className={sortBy === opt.value ? 'font-medium' : ''}>{opt.label}</span>
                  </button>
                ))}
                <div
                  className={`relative ${sortMoreOpen ? 'pr-48' : ''}`}
                  onMouseEnter={() => { setSortMoreOpen(true); setGroupByOpen(false); }}
                  onMouseLeave={() => setSortMoreOpen(false)}
                >
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-100"
                  >
                    <span>More</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                  {sortMoreOpen && (
                    <div className="absolute left-full top-0 ml-0.5 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-30">
                      {[
                        { value: 'size', label: 'Size' },
                        { value: 'dateCreated', label: 'Date created' },
                        { value: 'title', label: 'Title' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => { setSortBy(opt.value); setSortDropdownOpen(false); setSortMoreOpen(false); }}
                          className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100"
                        >
                          {sortBy === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
                          <span className={sortBy === opt.value ? 'font-medium' : ''}>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="my-1 border-t border-gray-100" />
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</div>
                {[
                  { value: 'asc', label: 'Ascending' },
                  { value: 'desc', label: 'Descending' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setSortOrder(opt.value); setSortDropdownOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100"
                  >
                    {sortOrder === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
                    <span className={sortOrder === opt.value ? 'font-medium' : ''}>{opt.label}</span>
                  </button>
                ))}
                <div
                  className={`relative ${groupByOpen ? 'pr-48' : ''}`}
                  onMouseEnter={() => { setGroupByOpen(true); setSortMoreOpen(false); }}
                  onMouseLeave={() => setGroupByOpen(false)}
                >
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-100"
                  >
                    <span>Group by</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                  {groupByOpen && (
                    <div className="absolute left-full top-0 ml-0.5 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-30"
                    >
                      {[
                        { value: 'none', label: 'None' },
                        { value: 'name', label: 'Name' },
                        { value: 'type', label: 'Type' },
                        { value: 'dateModified', label: 'Date modified' },
                        { value: 'dateCreated', label: 'Date created' },
                        { value: 'status', label: 'Status' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => { setGroupBy(opt.value); setSortDropdownOpen(false); setGroupByOpen(false); }}
                          className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100"
                        >
                          {groupBy === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
                          <span className={groupBy === opt.value ? 'font-medium' : ''}>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* View options dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setViewDropdownOpen((o) => !o)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            aria-expanded={viewDropdownOpen}
            aria-haspopup="true"
            aria-label="View options"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            View
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {viewDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setViewDropdownOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 mt-1 z-20 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Icon size</div>
                {[
                  { value: 'extraLarge', label: 'Extra large icons' },
                  { value: 'large', label: 'Large icons' },
                  { value: 'medium', label: 'Medium icons' },
                  { value: 'small', label: 'Small icons' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setViewIconSize(opt.value); setViewDropdownOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100"
                  >
                    {viewIconSize === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
                    <span className={viewIconSize === opt.value ? 'font-medium' : ''}>{opt.label}</span>
                  </button>
                ))}
                <div className="my-1 border-t border-gray-100" />
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Layout</div>
                {[
                  { value: 'cards', label: 'Cards' },
                  { value: 'list', label: 'List' },
                  { value: 'details', label: 'Details' },
                  { value: 'tiles', label: 'Tiles' },
                  { value: 'content', label: 'Content' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setViewLayout(opt.value); setViewDropdownOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100"
                  >
                    {viewLayout === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
                    <span className={viewLayout === opt.value ? 'font-medium' : ''}>{opt.label}</span>
                  </button>
                ))}
                <div className="my-1 border-t border-gray-100" />
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Panes</div>
                <button
                  type="button"
                  onClick={() => { setShowDetailsPane((v) => !v); setViewDropdownOpen(false); }}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100"
                >
                  {showDetailsPane && <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
                  <span className={showDetailsPane ? 'font-medium' : ''}>Details pane</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPreviewPane((v) => !v); setViewDropdownOpen(false); }}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100"
                >
                  {showPreviewPane && <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
                  <span className={showPreviewPane ? 'font-medium' : ''}>Preview pane</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={showPanes ? 'flex gap-4' : ''}>
        <div className={showPanes ? 'flex-1 min-w-0' : ''}>
      {loading ? (
        <div className={`grid ${gridCols} gap-4`}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-white p-4 animate-pulse h-40" />
          ))}
        </div>
      ) : modules.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center text-gray-500">
          No training modules. Click &quot;Upload Content&quot; to add one.
        </div>
      ) : (
        <>
          {viewLayout === 'list' && (
            <div className="space-y-4">
              {sections.map(([groupLabel, mods]) => (
                <div key={groupLabel ?? 'all'}>
                  {groupLabel && (
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200">{groupLabel}</h3>
                  )}
                  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y">
                    {mods.map((module) => {
                      const count = assignedCount(module);
                      return (
                        <div
                          key={module.id}
                          onClick={() => setSelectedModule(module)}
                          className={`flex items-center gap-4 p-3 hover:bg-gray-50 cursor-pointer ${selectedModule?.id === module.id ? 'bg-primary-50' : ''}`}
                        >
                          <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                            {renderModuleThumb(module, 'w-full h-full')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900">{module.title}</div>
                            <div className="text-sm text-gray-500">
                              {module.contentType} · {formatFileSize(module.fileSize)} · {module.createdAt ? format(new Date(module.createdAt), 'MMM d, yyyy') : '—'} · Assigned to {count} counselor{count !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button type="button" onClick={(e) => { e.stopPropagation(); setPreviewModule(module); }} className="py-1.5 px-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Preview</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleEdit(module); }} className="py-1.5 px-3 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg">Edit</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(module.id); }} className="py-1.5 px-3 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg">Delete</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewLayout === 'details' && (
            <div className="space-y-4">
              {sections.map(([groupLabel, mods]) => (
                <div key={groupLabel ?? 'all'}>
                  {groupLabel && (
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200">{groupLabel}</h3>
                  )}
                  <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Title</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Assigned</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mods.map((module) => {
                          const count = assignedCount(module);
                          return (
                            <tr
                              key={module.id}
                              onClick={() => setSelectedModule(module)}
                              className={`border-b hover:bg-gray-50 cursor-pointer ${selectedModule?.id === module.id ? 'bg-primary-50' : ''}`}
                            >
                              <td className="py-3 px-4 font-medium text-gray-900">{module.title}</td>
                              <td className="py-3 px-4 text-gray-600">{module.contentType || '—'}</td>
                              <td className="py-3 px-4 text-gray-600">{formatFileSize(module.fileSize)}</td>
                              <td className="py-3 px-4 text-gray-600">{module.createdAt ? format(new Date(module.createdAt), 'MMM d, yyyy') : '—'}</td>
                              <td className="py-3 px-4 text-gray-600">{count} counselor{count !== 1 ? 's' : ''}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${module.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                  {module.isPublished ? 'Published' : 'Draft'}
                                </span>
                              </td>
                              <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => setPreviewModule(module)} className="py-1 px-2 text-gray-600 hover:bg-gray-200 rounded">Preview</button>
                                  <button type="button" onClick={() => handleEdit(module)} className="py-1 px-2 text-blue-600 hover:bg-blue-50 rounded">Edit</button>
                                  <button type="button" onClick={() => handleDelete(module.id)} className="py-1 px-2 text-red-600 hover:bg-red-50 rounded">Delete</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(viewLayout === 'cards' || viewLayout === 'tiles' || viewLayout === 'content') && (
          <div className="space-y-4">
            {sections.map(([groupLabel, mods]) => (
              <div key={groupLabel ?? 'all'}>
                {groupLabel && (
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200">{groupLabel}</h3>
                )}
                <div className={`grid ${gridCols} gap-4`}>
            {mods.map((module) => {
              const count = assignedCount(module);
              const typeInfo = CONTENT_TYPES.find((c) => c.value === (module.contentType || 'DOCUMENT'));
              const isCompact = viewLayout === 'tiles';
              return (
                <div
                  key={module.id}
                  className={`rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-md hover:shadow-xl transition-all duration-200 flex flex-col group h-full ${selectedModule?.id === module.id ? 'ring-2 ring-primary-500' : ''}`}
                  onClick={() => setSelectedModule(module)}
                >
                  <div
                    className={`relative w-full ${thumbHeight} bg-gray-50 flex-shrink-0 cursor-pointer hover:opacity-95 overflow-hidden`}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setPreviewModule(module); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreviewModule(module); } }}
                    aria-label={`Preview ${module.title}`}
                  >
                    {renderModuleThumb(module, `w-full h-full`)}
                  </div>
                  <div className="p-4 flex flex-col flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1">{module.title}</h3>
                    {viewLayout === 'content' && module.description && (
                      <p className="text-sm text-gray-500 line-clamp-3 mb-2">{module.description}</p>
                    )}
                    {!isCompact && (
                      <>
                        {module.description && viewLayout === 'cards' && (
                          <p className="text-sm text-gray-500 line-clamp-2 mb-2">{module.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2 flex-wrap">
                          {module.contentType === 'VIDEO' && module.duration && <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {module.duration} min</span>}
                          {(module.fileSize != null && module.fileSize > 0) && <span className="inline-flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {formatFileSize(module.fileSize)}</span>}
                          {module.createdAt && (
                            <span className="inline-flex items-center gap-1" title={format(new Date(module.createdAt), 'PPpp')}><Calendar className="w-3.5 h-3.5" /> {format(new Date(module.createdAt), 'MMM d, yyyy h:mm a')}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-3 mt-auto">
                          <div className="flex -space-x-2">
                            {count > 0 ? (
                              <>
                                <div className="w-6 h-6 rounded-full bg-indigo-200 border-2 border-white flex items-center justify-center text-[10px] font-medium text-indigo-800" />
                                <div className="w-6 h-6 rounded-full bg-blue-200 border-2 border-white flex items-center justify-center text-[10px] font-medium text-blue-800" />
                                <div className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-[10px] font-medium text-gray-700">
                                  {count > 2 ? `+${count - 2}` : ''}
                                </div>
                              </>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] text-gray-500">0</div>
                            )}
                          </div>
                          <span className="text-sm text-gray-600">Assigned to {count} counselor{count !== 1 ? 's' : ''}</span>
                        </div>
                      </>
                    )}
                    {isCompact && (
                      <div className="text-xs text-gray-500 mt-1">Assigned to {count}</div>
                    )}
                    <div className="flex gap-2 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => setPreviewModule(module)} className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">👁 Preview</button>
                      <button type="button" onClick={() => handleEdit(module)} className="flex-1 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg">✏ Edit</button>
                      <button type="button" onClick={() => handleDelete(module.id)} className="py-2 px-3 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg">🗑 Delete</button>
                    </div>
                    </div>
                  </div>
                );
            })}
                </div>
              </div>
            ))}
          </div>
          )}

          {pagination.pages > 1 && (
            <div className="flex justify-end items-center gap-1 pt-4">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => goToPage(pagination.page - 1)}
                className="px-3 py-1.5 rounded border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                ‹
              </button>
              {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goToPage(p)}
                    className={`min-w-[2rem] px-2 py-1.5 rounded text-sm font-medium ${pagination.page === p ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={pagination.page >= pagination.pages}
                onClick={() => goToPage(pagination.page + 1)}
                className="px-3 py-1.5 rounded border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                ›
              </button>
            </div>
          )}
        </>
      )}
        </div>

        {/* Details / Preview panes */}
        {showPanes && (
          <div className="w-80 flex-shrink-0 flex flex-col gap-4">
            {showDetailsPane && (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow">
                <div className="px-3 py-2 bg-gray-50 border-b font-medium text-gray-700 text-sm">Details pane</div>
                <div className="p-3 text-sm min-h-[120px]">
                  {selectedModule ? (
                    <div className="space-y-2">
                      <div><span className="text-gray-500">Title:</span> {selectedModule.title}</div>
                      <div><span className="text-gray-500">Type:</span> {selectedModule.contentType || '—'}</div>
                      <div><span className="text-gray-500">Size:</span> {formatFileSize(selectedModule.fileSize)}</div>
                      <div><span className="text-gray-500">Date:</span> {selectedModule.createdAt ? format(new Date(selectedModule.createdAt), 'MMM d, yyyy h:mm a') : '—'}</div>
                      <div><span className="text-gray-500">Assigned:</span> {assignedCount(selectedModule)} counselor(s)</div>
                      <div><span className="text-gray-500">Status:</span> {selectedModule.isPublished ? 'Published' : 'Draft'}</div>
                      {selectedModule.description && (
                        <div className="pt-2 border-t"><span className="text-gray-500">Description:</span> <span className="text-gray-700">{selectedModule.description}</span></div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400">Select a module to view details.</p>
                  )}
                </div>
              </div>
            )}
            {showPreviewPane && (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow flex-1 min-h-0 flex flex-col">
                <div className="px-3 py-2 bg-gray-50 border-b font-medium text-gray-700 text-sm">Preview pane</div>
                <div className="p-3 flex-1 min-h-0 overflow-auto">
                  {selectedModule ? (
                    <div className="space-y-2">
                      <div className="font-medium text-gray-900">{selectedModule.title}</div>
                      <button
                        type="button"
                        onClick={() => setPreviewModule(selectedModule)}
                        className="text-sm text-primary-600 hover:underline"
                      >
                        Open full preview →
                      </button>
                      {selectedModule.contentType === 'VIDEO' && (
                        <div className="rounded-lg overflow-hidden bg-gray-100 aspect-video mt-2">
                          {renderModuleThumb(selectedModule, 'w-full h-full')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400">Select a module to preview.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewModule && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setPreviewModule(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Preview: {previewModule.title}</h2>
                {previewModule.createdAt && (
                  <p className="text-sm text-gray-500 mt-0.5">Uploaded {format(new Date(previewModule.createdAt), 'MMM d, yyyy h:mm a')}</p>
                )}
              </div>
              <button type="button" onClick={() => setPreviewModule(null)} className="text-gray-500 hover:text-gray-700 p-1">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {previewModule.contentType === 'VIDEO' && (() => {
                const url = getVideoPreviewUrl(previewModule);
                const rawUrl = previewModule.fileUrl || previewModule.contentUrl || '';
                const ytMatch = rawUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);
                const ytWatchUrl = ytMatch ? `https://www.youtube.com/watch?v=${ytMatch[1]}` : null;
                if (ytMatch) {
                  return (
                    <div className="space-y-3">
                      <div className="aspect-video bg-black rounded-lg overflow-hidden">
                        <iframe
                          src={`https://www.youtube.com/embed/${ytMatch[1]}`}
                          title={previewModule.title}
                          className="w-full h-full"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      </div>
                      {ytWatchUrl && (
                        <>
                          <a
                            href={ytWatchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                          >
                            Watch on YouTube
                          </a>
                          <p className="text-xs text-gray-500">
                            If the video doesn’t play above (embedding disabled by owner), open it on YouTube using the button.
                          </p>
                        </>
                      )}
                    </div>
                  );
                }
                if (url) {
                  return (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                      <video src={url} controls className="w-full h-full" />
                    </div>
                  );
                }
                return <p className="text-gray-500">No video URL available.</p>;
              })()}
              {previewModule.contentType === 'PDF' && (() => {
                const url = getVideoPreviewUrl(previewModule) || previewModule.contentUrl;
                if (url) {
                  return (
                    <iframe src={url} title={previewModule.title} className="w-full h-[70vh] rounded-lg border" />
                  );
                }
                return <p className="text-gray-500">No PDF URL available.</p>;
              })()}
              {['DOCUMENT', 'EXCEL', 'PPT', 'LINK'].includes(previewModule.contentType) && (() => {
                const url = getVideoPreviewUrl(previewModule) || previewModule.contentUrl;
                if (url) {
                  return (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:underline font-medium">
                      Open in new tab / Download
                    </a>
                  );
                }
                return <p className="text-gray-500">No content URL available.</p>;
              })()}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{editingModule ? 'Edit Training Module' : 'Upload Content'}</h2>
                <button type="button" onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title *</label>
                  <input type="text" name="title" value={formData.title} onChange={handleInputChange} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea name="description" value={formData.description} onChange={handleInputChange} className="input-field" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Content Type *</label>
                  <select name="contentType" value={formData.contentType} onChange={handleInputChange} className="input-field">
                    {CONTENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                {formData.contentType === 'LINK' ? (
                  <div>
                    <label className="block text-sm font-medium mb-1">URL *</label>
                    <input type="url" name="contentUrl" value={formData.contentUrl} onChange={handleInputChange} className="input-field" placeholder="https://..." />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">File Upload *</label>
                      <input
                        type="file"
                        accept="video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="input-field"
                      />
                      {editingModule && <p className="text-xs text-gray-500 mt-1">Leave empty to keep current file.</p>}
                    </div>
                    {formData.contentType === 'VIDEO' && (
                      <div>
                        <label className="block text-sm font-medium mb-1">Video URL (optional)</label>
                        <input type="url" name="contentUrl" value={formData.contentUrl} onChange={handleInputChange} className="input-field" placeholder="YouTube or direct video URL" />
                      </div>
                    )}
                  </>
                )}
                {formData.contentType === 'VIDEO' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
                    <input type="number" name="duration" value={formData.duration} onChange={handleInputChange} className="input-field" min="1" placeholder="e.g. 45" />
                  </div>
                )}
                <div className="border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium mb-1">Assign to counselors (who can view this content)</label>
                  <p className="text-xs text-gray-500 mb-2">Only selected counselors will see this module in their Training dashboard.</p>
                  <div className="border rounded-lg p-3 max-h-44 overflow-y-auto space-y-2 bg-gray-50">
                    {list.length === 0 ? (
                      <p className="text-sm text-gray-500">Loading counselors… If none appear, ensure counselors exist in the system.</p>
                    ) : (
                      <>
                        <div className="flex gap-2 mb-2 pb-2 border-b border-gray-200">
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, counselorIds: list.map((c) => c.id) }))}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, counselorIds: [] }))}
                            className="text-xs text-gray-600 hover:underline"
                          >
                            Clear
                          </button>
                          <span className="text-xs text-gray-500 ml-auto">
                            {(formData.counselorIds || []).length} selected
                          </span>
                        </div>
                        {list.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-white/60 rounded px-1 py-0.5">
                            <input
                              type="checkbox"
                              checked={(formData.counselorIds || []).includes(c.id)}
                              onChange={() => handleCounselorToggle(c.id)}
                            />
                            <span className="text-sm">{c.fullName ?? c.user?.fullName ?? c.email ?? c.id}</span>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">School (optional)</label>
                  <select name="schoolId" value={formData.schoolId} onChange={handleInputChange} className="input-field">
                    <option value="">All Schools</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={formData.isPublished ? 'published' : 'draft'}
                    onChange={(e) => setFormData((prev) => ({ ...prev, isPublished: e.target.value === 'published' }))}
                    className="input-field"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Saving...' : 'Save'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingModules;

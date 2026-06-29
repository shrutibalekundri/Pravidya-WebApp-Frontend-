import { useState, useEffect, useRef } from 'react';
import { Video, FileText, FileSpreadsheet, Presentation, Link2, File, Search, Clock, BookOpen, Book, Building2, X } from 'lucide-react';
import { trainingModuleAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const CONTENT_TYPE_ICONS = { VIDEO: Video, PDF: FileText, DOCUMENT: FileText, EXCEL: FileSpreadsheet, PPT: Presentation, LINK: Link2 };

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '');

function formatDuration(minutes) {
  if (!minutes) return '0:00';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}:00`;
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

const COUNSELOR_TRAINING_VIEW_KEY = 'pravidya_counselor_training_view';

function getStoredCounselorTrainingView() {
  try {
    const raw = localStorage.getItem(COUNSELOR_TRAINING_VIEW_KEY);
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
      sortBy,
      sortOrder,
      groupBy,
      searchInput: typeof parsed?.searchInput === 'string' ? parsed.searchInput : '',
      typeFilter: typeof parsed?.typeFilter === 'string' ? parsed.typeFilter : '',
      statusFilter: typeof parsed?.statusFilter === 'string' ? parsed.statusFilter : '',
      assignmentFilter: ['all', 'assigned'].includes(parsed?.assignmentFilter) ? parsed.assignmentFilter : 'all',
      showDetail: Boolean(parsed?.showDetail),
      selectedModuleId: typeof parsed?.selectedModuleId === 'string' ? parsed.selectedModuleId : null,
    };
  } catch {
    return null;
  }
}

function saveCounselorTrainingView(state) {
  try {
    localStorage.setItem(COUNSELOR_TRAINING_VIEW_KEY, JSON.stringify(state));
  } catch (_) {}
}

const CounselorTraining = () => {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    setLoading(true);
    try {
      const response = await trainingModuleAPI.getAll();
      setModules(response.data.data.modules || []);
    } catch (error) {
      toast.error('Failed to load training modules');
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (module) => {
    try {
      const response = await trainingModuleAPI.getById(module.id);
      setSelectedModule(response.data.data);
      setShowDetail(true);
    } catch (error) {
      toast.error('Failed to load module details');
    }
  };

  const handleUpdateProgress = async (moduleId, status) => {
    try {
      await trainingModuleAPI.updateProgress(moduleId, status);
      toast.success('Progress updated successfully');
      fetchModules();
      if (selectedModule?.id === moduleId) {
        const response = await trainingModuleAPI.getById(moduleId);
        setSelectedModule(response.data.data);
      }
    } catch (error) {
      toast.error('Failed to update progress');
    }
  };

  const getContentTypeIconComponent = (contentType) => CONTENT_TYPE_ICONS[contentType] || File;

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'NOT_STARTED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Resolve YouTube embed URL from watch or short link
  const getYouTubeEmbedUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    let videoId = null;
    if (trimmed.includes('youtube.com/watch?v=')) {
      const m = trimmed.match(/[?&]v=([^&]+)/);
      videoId = m ? m[1] : null;
    } else if (trimmed.includes('youtu.be/')) {
      const m = trimmed.match(/youtu\.be\/([^?&]+)/);
      videoId = m ? m[1] : null;
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  const isYouTubeUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return /youtube\.com\/watch|youtu\.be\//.test(url.trim());
  };

  const isDriveUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return /drive\.google\.com/.test(url.trim());
  };

  const stored = getStoredCounselorTrainingView();
  const [searchInput, setSearchInput] = useState(stored?.searchInput ?? '');
  const [typeFilter, setTypeFilter] = useState(stored?.typeFilter ?? '');
  const [statusFilter, setStatusFilter] = useState(stored?.statusFilter ?? '');
  const [assignmentFilter, setAssignmentFilter] = useState(stored?.assignmentFilter ?? 'all');
  const [viewLayout, setViewLayout] = useState(stored?.viewLayout ?? 'cards');
  const [viewIconSize, setViewIconSize] = useState(stored?.viewIconSize ?? 'medium');
  const [sortBy, setSortBy] = useState(stored?.sortBy ?? 'dateModified');
  const [sortOrder, setSortOrder] = useState(stored?.sortOrder ?? 'desc');
  const [groupBy, setGroupBy] = useState(stored?.groupBy ?? 'none');
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [sortMoreOpen, setSortMoreOpen] = useState(false);
  const [groupByOpen, setGroupByOpen] = useState(false);

  const filteredModules = modules.filter((m) => {
    const q = (searchInput || '').trim().toLowerCase();
    if (q) {
      const title = (m.title || '').toLowerCase();
      const desc = (m.description || '').toLowerCase();
      if (!title.includes(q) && !desc.includes(q)) return false;
    }
    if (typeFilter && (m.contentType || '') !== typeFilter) return false;
    const progressStatus = m.userProgress?.status || 'NOT_STARTED';
    if (statusFilter && progressStatus !== statusFilter) return false;
    if (assignmentFilter === 'assigned') return true;
    return true;
  });

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
    const aVal = getSortValue(a, sortBy);
    const bVal = getSortValue(b, sortBy);
    let cmp = typeof aVal === 'string' && typeof bVal === 'string' ? aVal.localeCompare(bVal) : (aVal < bVal ? -1 : aVal > bVal ? 1 : 0);
    return sortOrder === 'desc' ? -cmp : cmp;
  });
  const getGroupKey = (m) => {
    const status = m.userProgress?.status || 'NOT_STARTED';
    switch (groupBy) {
      case 'type':
        return m.contentType || 'Other';
      case 'status':
        return status.replace('_', ' ');
      case 'dateCreated':
        return m.createdAt ? format(new Date(m.createdAt), 'MMMM yyyy') : 'Unknown';
      case 'dateModified':
        return m.updatedAt ? format(new Date(m.updatedAt), 'MMMM yyyy') : (m.createdAt ? format(new Date(m.createdAt), 'MMMM yyyy') : 'Unknown');
      case 'name':
        const t = (m.title || '').trim();
        return t ? t[0].toUpperCase() : '—';
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
  const sections = groupedModules ? Object.entries(groupedModules).sort(([a], [b]) => a.localeCompare(b)) : [[null, sortedModules]];
  const gridCols = viewLayout === 'cards' || viewLayout === 'tiles'
    ? viewIconSize === 'extraLarge' ? 'grid-cols-1 md:grid-cols-2' : viewIconSize === 'large' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : viewIconSize === 'small' ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
    : 'grid-cols-1';
  const thumbHeight = viewLayout === 'cards'
    ? viewIconSize === 'extraLarge' ? 'h-56' : viewIconSize === 'large' ? 'h-48' : viewIconSize === 'small' ? 'h-32' : 'h-44'
    : viewLayout === 'tiles' ? 'h-28' : 'h-44';

  useEffect(() => {
    saveCounselorTrainingView({
      viewLayout,
      viewIconSize,
      sortBy,
      sortOrder,
      groupBy,
      searchInput,
      typeFilter,
      statusFilter,
      assignmentFilter,
      showDetail,
      selectedModuleId: selectedModule?.id ?? null,
    });
  }, [viewLayout, viewIconSize, sortBy, sortOrder, groupBy, searchInput, typeFilter, statusFilter, assignmentFilter, showDetail, selectedModule?.id]);

  const restoreAttemptedRef = useRef(false);
  useEffect(() => {
    if (restoreAttemptedRef.current) return;
    const s = getStoredCounselorTrainingView();
    if (!s?.showDetail || !s?.selectedModuleId) {
      restoreAttemptedRef.current = true;
      return;
    }
    restoreAttemptedRef.current = true;
    trainingModuleAPI.getById(s.selectedModuleId)
      .then((res) => {
        setSelectedModule(res.data.data);
        setShowDetail(true);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Assigned Training</h1>
        <p className="text-gray-600 mt-1">Training modules assigned to you. View content and track your progress.</p>
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
          <option value="VIDEO">Video</option>
          <option value="PDF">PDF</option>
          <option value="DOCUMENT">Document</option>
          <option value="EXCEL">Excel</option>
          <option value="PPT">PPT</option>
          <option value="LINK">Link</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 min-w-[140px]"
          aria-label="Filter by status"
        >
          <option value="">All Status</option>
          <option value="NOT_STARTED">Not started</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <select
          value={assignmentFilter}
          onChange={(e) => setAssignmentFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 min-w-[180px]"
          aria-label="Filter by assignment"
        >
          <option value="all">Assigned to Everyone</option>
          <option value="assigned">Assigned to me</option>
        </select>
        <div className="relative">
          <button
            type="button"
            onClick={() => { setSortDropdownOpen((o) => !o); setSortMoreOpen(false); setGroupByOpen(false); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
            Sort
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {sortDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => { setSortDropdownOpen(false); setSortMoreOpen(false); setGroupByOpen(false); }} aria-hidden="true" />
              <div className="absolute left-0 mt-1 z-20 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {[{ value: 'name', label: 'Name' }, { value: 'dateModified', label: 'Date modified' }, { value: 'type', label: 'Type' }].map((opt) => (
                  <button key={opt.value} type="button" onClick={() => { setSortBy(opt.value); setSortDropdownOpen(false); }} className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100">
                    {sortBy === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
                    <span className={sortBy === opt.value ? 'font-medium' : ''}>{opt.label}</span>
                  </button>
                ))}
                <div className={`relative ${sortMoreOpen ? 'pr-48' : ''}`} onMouseEnter={() => { setSortMoreOpen(true); setGroupByOpen(false); }} onMouseLeave={() => setSortMoreOpen(false)}>
                  <button type="button" className="w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-100">
                    <span>More</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                  {sortMoreOpen && (
                    <div className="absolute left-full top-0 ml-0.5 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-30">
                      {[{ value: 'size', label: 'Size' }, { value: 'dateCreated', label: 'Date created' }, { value: 'title', label: 'Title' }].map((opt) => (
                        <button key={opt.value} type="button" onClick={() => { setSortBy(opt.value); setSortDropdownOpen(false); setSortMoreOpen(false); }} className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100">
                          {sortBy === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
                          <span className={sortBy === opt.value ? 'font-medium' : ''}>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="my-1 border-t border-gray-100" />
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</div>
                {[{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }].map((opt) => (
                  <button key={opt.value} type="button" onClick={() => { setSortOrder(opt.value); setSortDropdownOpen(false); }} className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100">
                    {sortOrder === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
                    <span className={sortOrder === opt.value ? 'font-medium' : ''}>{opt.label}</span>
                  </button>
                ))}
                <div className={`relative ${groupByOpen ? 'pr-48' : ''}`} onMouseEnter={() => { setGroupByOpen(true); setSortMoreOpen(false); }} onMouseLeave={() => setGroupByOpen(false)}>
                  <button type="button" className="w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-100">
                    <span>Group by</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                  {groupByOpen && (
                    <div className="absolute left-full top-0 ml-0.5 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-30">
                      {[{ value: 'none', label: 'None' }, { value: 'name', label: 'Name' }, { value: 'type', label: 'Type' }, { value: 'dateModified', label: 'Date modified' }, { value: 'dateCreated', label: 'Date created' }, { value: 'status', label: 'Status' }].map((opt) => (
                        <button key={opt.value} type="button" onClick={() => { setGroupBy(opt.value); setSortDropdownOpen(false); setGroupByOpen(false); }} className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100">
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
        <div className="relative">
          <button type="button" onClick={() => setViewDropdownOpen((o) => !o)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            View
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {viewDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setViewDropdownOpen(false)} aria-hidden="true" />
              <div className="absolute left-0 mt-1 z-20 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Icon size</div>
                {[{ value: 'extraLarge', label: 'Extra large icons' }, { value: 'large', label: 'Large icons' }, { value: 'medium', label: 'Medium icons' }, { value: 'small', label: 'Small icons' }].map((opt) => (
                  <button key={opt.value} type="button" onClick={() => { setViewIconSize(opt.value); setViewDropdownOpen(false); }} className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100">
                    {viewIconSize === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
                    <span className={viewIconSize === opt.value ? 'font-medium' : ''}>{opt.label}</span>
                  </button>
                ))}
                <div className="my-1 border-t border-gray-100" />
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Layout</div>
                {[{ value: 'cards', label: 'Cards' }, { value: 'list', label: 'List' }, { value: 'details', label: 'Details' }, { value: 'tiles', label: 'Tiles' }, { value: 'content', label: 'Content' }].map((opt) => (
                  <button key={opt.value} type="button" onClick={() => { setViewLayout(opt.value); setViewDropdownOpen(false); }} className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100">
                    {viewLayout === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
                    <span className={viewLayout === opt.value ? 'font-medium' : ''}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : modules.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No training modules available</div>
      ) : filteredModules.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No modules match your search or filters. Try changing the search or filter options.</div>
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
                      const status = (module.userProgress?.status || 'NOT_STARTED');
                      return (
                        <div key={module.id} className="flex items-center gap-4 p-3 hover:bg-gray-50">
                          <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">
                            {(() => { const Icon = getContentTypeIconComponent(module.contentType); return <Icon className="w-5 h-5 text-gray-600" strokeWidth={1.5} />; })()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900">{module.title}</div>
                            <div className="text-sm text-gray-500">
                              {module.contentType} · {module.createdAt ? format(new Date(module.createdAt), 'MMM d, yyyy') : '—'} · <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(status)}`}>{status.replace('_', ' ')}</span>
                            </div>
                          </div>
                          <button type="button" onClick={() => handleView(module)} className="btn-primary text-sm py-1.5 px-3">
                            {status === 'NOT_STARTED' ? 'Start' : status === 'IN_PROGRESS' ? 'Continue' : 'Review'}
                          </button>
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
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mods.map((module) => {
                          const status = (module.userProgress?.status || 'NOT_STARTED');
                          return (
                            <tr key={module.id} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-4 font-medium text-gray-900">{module.title}</td>
                              <td className="py-3 px-4 text-gray-600">{module.contentType || '—'}</td>
                              <td className="py-3 px-4 text-gray-600">{module.createdAt ? format(new Date(module.createdAt), 'MMM d, yyyy') : '—'}</td>
                              <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(status)}`}>{status.replace('_', ' ')}</span></td>
                              <td className="py-3 px-4"><button type="button" onClick={() => handleView(module)} className="text-primary-600 hover:underline text-sm">{status === 'NOT_STARTED' ? 'Start' : status === 'IN_PROGRESS' ? 'Continue' : 'Review'}</button></td>
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
                  <div className={`grid ${gridCols} gap-6`}>
                    {mods.map((module) => {
                      const progress = module.userProgress;
                      const status = progress?.status || 'NOT_STARTED';
                      const isVideo = module.contentType === 'VIDEO';
                      const thumb = getVideoThumbnail(module);
                      const isCompact = viewLayout === 'tiles';

                      if (isVideo) {
                        return (
                          <div key={module.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-md hover:shadow-lg transition-all duration-200 flex flex-col h-full">
                            <div
                              className={`relative w-full ${thumbHeight} flex-shrink-0 bg-gray-900 overflow-hidden cursor-pointer`}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleView(module)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleView(module); } }}
                              aria-label={`Play ${module.title}`}
                            >
                              {thumb ? (
                                <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-600"><Video className="w-12 h-12" strokeWidth={1.5} /></div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                                <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg pointer-events-none">
                                  <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[16px] border-l-white border-b-[10px] border-b-transparent ml-1" />
                                </div>
                              </div>
                              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-white text-xs font-medium rounded">{formatDuration(module.duration)}</span>
                            </div>
                            <div className="p-4 flex flex-col flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{module.title}</h3>
                                <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(status)}`}>{status.replace('_', ' ')}</span>
                              </div>
                              {!isCompact && (
                                <>
                                  <p className="text-sm text-gray-500 mb-2">{(module.viewsCount ?? 0)} views • Uploaded {format(new Date(module.createdAt), 'MMM d, yyyy h:mm a')}</p>
                                  {module.description && <p className="text-sm text-gray-600 line-clamp-2 mb-3 flex-1">{module.description}</p>}
                                </>
                              )}
                              <button onClick={() => handleView(module)} className="btn-primary w-full mt-auto">
                                {status === 'NOT_STARTED' ? 'Start Learning' : status === 'IN_PROGRESS' ? 'Continue' : 'Review'}
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={module.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-md hover:shadow-lg transition-all duration-200 p-4 flex flex-col h-full">
                          <div className="flex items-start justify-between mb-4">
                            {(() => { const Icon = getContentTypeIconComponent(module.contentType); return <Icon className="w-10 h-10 text-gray-600" strokeWidth={1.5} />; })()}
                            <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(status)}`}>{status.replace('_', ' ')}</span>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">{module.title}</h3>
                          {module.description && !isCompact && <p className="text-sm text-gray-600 mb-4 line-clamp-2">{module.description}</p>}
                          {!isCompact && (
                            <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                              <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {module.duration ? `${module.duration} min` : 'N/A'}</span>
                              <span>Uploaded {format(new Date(module.createdAt), 'MMM d, yyyy h:mm a')}</span>
                            </div>
                          )}
                          <button onClick={() => handleView(module)} className="btn-primary w-full mt-auto">
                            {status === 'NOT_STARTED' ? 'Start Learning' : status === 'IN_PROGRESS' ? 'Continue' : 'Review'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Module Detail Modal */}
      {showDetail && selectedModule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedModule.title}</h2>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedModule.institution && (
                    <span className="text-sm text-gray-600 px-2 py-1 bg-blue-100 rounded inline-flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" /> {selectedModule.institution.name}
                    </span>
                  )}
                  {selectedModule.course && (
                    <span className="text-sm text-gray-600 px-2 py-1 bg-purple-100 rounded inline-flex items-center gap-1">
                      <Book className="w-3.5 h-3.5" /> {selectedModule.course.name}
                    </span>
                  )}
                  {selectedModule.school && (
                    <span className="text-sm text-gray-600 px-2 py-1 bg-green-100 rounded inline-flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" /> {selectedModule.school.name}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setShowDetail(false)} className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100" aria-label="Close">
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {selectedModule.description && (
              <p className="text-gray-700 mb-4">{selectedModule.description}</p>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="font-medium">{selectedModule.duration ? `${selectedModule.duration} minutes` : 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Your Progress</p>
                <p className={`font-medium ${getStatusColor(selectedModule.userProgress?.status || 'NOT_STARTED')} px-2 py-1 rounded inline-block`}>
                  {selectedModule.userProgress?.status?.replace('_', ' ') || 'NOT STARTED'}
                </p>
              </div>
              {selectedModule.createdAt && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Uploaded</p>
                  <p className="font-medium">{format(new Date(selectedModule.createdAt), 'MMM d, yyyy h:mm a')}</p>
                </div>
              )}
            </div>

            {/* Content: Video embed, PDF/view link, Document/Excel download */}
            <div className="space-y-3 mb-6">
              {(() => {
                const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace('/api', '');
                const getFileUrl = (url) => {
                  if (!url) return null;
                  if (url.startsWith('http://') || url.startsWith('https://')) return url;
                  if (url.startsWith('/uploads/') || url.startsWith('/media/')) return `${API_BASE}${url}`;
                  return url;
                };
                const type = selectedModule.contentType || 'DOCUMENT';
                const fileUrl = getFileUrl(selectedModule.fileUrl || selectedModule.contentUrl || selectedModule.videoUrl || selectedModule.documentUrl);
                const linkUrl = selectedModule.linkUrl || (type === 'LINK' ? fileUrl : null);

                if (linkUrl && type === 'LINK') {
                  return (
                    <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="block p-3 border rounded-lg hover:bg-gray-50">
                      <Link2 className="w-5 h-5 mr-2 inline-block text-gray-600" />
                      <span className="text-blue-600 hover:underline">Open Link</span>
                    </a>
                  );
                }
                if (fileUrl && (type === 'VIDEO' || type === 'PDF' || type === 'DOCUMENT' || type === 'EXCEL' || type === 'PPT')) {
                  if (type === 'VIDEO') {
                    const ytEmbed = getYouTubeEmbedUrl(fileUrl);
                    const ytWatchUrl = (() => {
                      if (!fileUrl || typeof fileUrl !== 'string') return null;
                      const m = fileUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?\s]+)/);
                      return m ? `https://www.youtube.com/watch?v=${m[1]}` : null;
                    })();
                    if (ytEmbed) {
                      return (
                        <div className="border rounded-lg overflow-hidden bg-black">
                          <iframe
                            src={ytEmbed}
                            title={selectedModule.title}
                            className="w-full aspect-video max-h-[400px]"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                          <div className="p-3 bg-gray-50 border-t flex flex-wrap items-center gap-2">
                            <p className="text-sm text-gray-600 flex-1">Video: {selectedModule.title}</p>
                            {ytWatchUrl && (
                              <a
                                href={ytWatchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                              >
                                Watch on YouTube
                              </a>
                            )}
                          </div>
                          {ytWatchUrl && (
                            <p className="px-3 pb-2 text-xs text-gray-500">
                              If the video doesn’t play above (embedding disabled by owner), use the button to watch on YouTube.
                            </p>
                          )}
                        </div>
                      );
                    }
                    if (isDriveUrl(fileUrl)) {
                      return (
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block p-3 border rounded-lg hover:bg-gray-50">
                          <Video className="w-5 h-5 mr-2 inline-block text-gray-600" />
                          <span className="text-blue-600 hover:underline">Open video (Google Drive)</span>
                        </a>
                      );
                    }
                    return (
                      <div className="border rounded-lg overflow-hidden bg-black">
                        <video src={fileUrl} controls className="w-full max-h-[400px]" />
                        <p className="p-2 text-sm text-gray-600">Video: {selectedModule.title}</p>
                      </div>
                    );
                  }
                  const isPdf = type === 'PDF' || (fileUrl && fileUrl.toLowerCase().endsWith('.pdf'));
                  if (isPdf) {
                    return (
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block p-3 border rounded-lg hover:bg-gray-50">
                        <FileText className="w-5 h-5 mr-2 inline-block text-gray-600" />
                        <span className="text-blue-600 hover:underline">Open PDF in new tab</span>
                      </a>
                    );
                  }
                  return (
                    <a href={fileUrl} download className="block p-3 border rounded-lg hover:bg-gray-50">
                      {(() => { const Icon = type === 'EXCEL' ? FileSpreadsheet : type === 'PPT' ? Presentation : FileText; return <Icon className="w-5 h-5 mr-2 inline-block text-gray-600" />; })()}
                      <span className="text-blue-600 hover:underline">Download {type === 'EXCEL' ? 'Excel' : type === 'PPT' ? 'Presentation' : 'Document'}</span>
                    </a>
                  );
                }
                return (
                  <p className="text-sm text-gray-500">No content URL available.</p>
                );
              })()}
            </div>

            {/* Progress Actions */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Update Your Progress:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdateProgress(selectedModule.id, 'NOT_STARTED')}
                  className={`btn-secondary text-sm ${selectedModule.userProgress?.status === 'NOT_STARTED' ? 'bg-gray-200' : ''}`}
                >
                  Not Started
                </button>
                <button
                  onClick={() => handleUpdateProgress(selectedModule.id, 'IN_PROGRESS')}
                  className={`btn-secondary text-sm ${selectedModule.userProgress?.status === 'IN_PROGRESS' ? 'bg-blue-200' : ''}`}
                >
                  In Progress
                </button>
                <button
                  onClick={() => handleUpdateProgress(selectedModule.id, 'COMPLETED')}
                  className={`btn-secondary text-sm ${selectedModule.userProgress?.status === 'COMPLETED' ? 'bg-green-200' : ''}`}
                >
                  Completed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CounselorTraining;

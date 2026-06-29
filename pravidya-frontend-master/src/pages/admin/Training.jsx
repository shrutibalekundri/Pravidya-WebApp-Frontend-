import { useState, useEffect } from 'react';
import { BookOpen, Book, Building2, Clock, Users } from 'lucide-react';
import { trainingModuleAPI, institutionAPI, courseAPI, counselorAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

function formatDuration(minutes) {
  if (!minutes) return '0:00';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}:00`;
}

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '');

function getVideoThumbnail(module) {
  if (module?.thumbnail) return module.thumbnail;
  const url = module?.fileUrl || module?.contentUrl || '';
  if (typeof url !== 'string') return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);
  if (m) return `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg`;
  return null;
}

function getVideoPreviewUrl(module) {
  const url = module?.fileUrl || module?.contentUrl || '';
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
}

const AdminTraining = () => {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [deletingModule, setDeletingModule] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [counselors, setCounselors] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contentType: 'DOCUMENT',
    contentUrl: '',
    duration: '',
    tags: '',
    institutionId: '',
    courseId: '',
    schoolId: '',
    isPublished: true,
    counselorIds: [],
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchModules();
    fetchInstitutions();
    fetchCounselors();
  }, []);

  useEffect(() => {
    if (formData.institutionId) {
      fetchCourses(formData.institutionId);
    } else {
      setCourses([]);
      setFormData(prev => ({ ...prev, courseId: '' }));
    }
  }, [formData.institutionId]);

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

  const fetchInstitutions = async () => {
    try {
      const response = await institutionAPI.getAll();
      setInstitutions(response.data.data.institutions || []);
    } catch (error) {
      console.error('Failed to load institutions:', error);
    }
  };

  const fetchCourses = async (institutionId) => {
    try {
      const response = await courseAPI.getAll({ institutionId });
      setCourses(response.data.data.courses || []);
    } catch (error) {
      console.error('Failed to load courses:', error);
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

  const handleCounselorToggle = (counselorId) => {
    setFormData((prev) => {
      const ids = prev.counselorIds || [];
      const next = ids.includes(counselorId) ? ids.filter((id) => id !== counselorId) : [...ids, counselorId];
      return { ...prev, counselorIds: next };
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear file when type changes to LINK
    if (name === 'contentType' && value === 'LINK') {
      setSelectedFile(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        toast.error('File size must be less than 100MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleAddNew = () => {
    setEditingModule(null);
    setFormData({
      title: '',
      description: '',
      contentType: 'DOCUMENT',
      contentUrl: '',
      duration: '',
      tags: '',
      institutionId: '',
      courseId: '',
      schoolId: '',
      isPublished: true,
      counselorIds: [],
    });
    setSelectedFile(null);
    setShowModal(true);
  };

  const handleEdit = async (module) => {
    setEditingModule(module.id);
    let counselorIds = [];
    try {
      const res = await trainingModuleAPI.getById(module.id);
      counselorIds = (res.data?.data?.assignments ?? []).map((a) => a.counselorId);
    } catch (_) {}
    setFormData({
      title: module.title || '',
      description: module.description || '',
      contentType: module.contentType || (module.videoUrl ? 'VIDEO' : module.documentUrl ? 'DOCUMENT' : 'LINK'),
      contentUrl: module.contentUrl || module.videoUrl || module.documentUrl || module.linkUrl || '',
      duration: module.duration || '',
      tags: module.tags ? module.tags.join(', ') : '',
      institutionId: module.institutionId || '',
      courseId: module.courseId || '',
      schoolId: module.schoolId || '',
      isPublished: module.isPublished !== undefined ? module.isPublished : true,
      counselorIds,
    });
    setSelectedFile(null);
    setShowModal(true);
  };

  const handleDelete = (module) => {
    setDeletingModule(module);
  };

  const confirmDelete = async () => {
    if (!deletingModule) return;
    
    setSubmitting(true);
    try {
      await trainingModuleAPI.delete(deletingModule.id);
      toast.success('Training module deleted successfully');
      setDeletingModule(null);
      fetchModules();
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to delete training module';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.contentType) {
      toast.error('Please fill all required fields');
      return;
    }

    if (formData.contentType === 'LINK') {
      if (!formData.contentUrl) {
        toast.error('Please provide a URL for link type');
        return;
      }
    } else {
      if (!editingModule && !selectedFile) {
        toast.error('Please select a file');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (editingModule) {
        // Update module
        const updateData = {
          title: formData.title,
          description: formData.description,
          contentType: formData.contentType,
          contentUrl: formData.contentUrl,
          duration: formData.duration ? parseInt(formData.duration) : null,
          tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(t => t) : [],
          institutionId: formData.institutionId || null,
          courseId: formData.courseId || null,
          schoolId: formData.schoolId || null,
          isPublished: formData.isPublished,
          counselorIds: formData.counselorIds || [],
        };
        await trainingModuleAPI.update(editingModule, updateData);
        toast.success('Training module updated successfully');
      } else {
        // Create new module with file upload
        const submitData = new FormData();
        submitData.append('title', formData.title);
        submitData.append('description', formData.description);
        submitData.append('contentType', formData.contentType);
        submitData.append('duration', formData.duration || '');
        submitData.append('tags', JSON.stringify(formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(t => t) : []));
        submitData.append('institutionId', formData.institutionId || '');
        submitData.append('courseId', formData.courseId || '');
        submitData.append('schoolId', formData.schoolId || '');
        submitData.append('isPublished', formData.isPublished);
        submitData.append('counselorIds', JSON.stringify(formData.counselorIds || []));
        
        if (formData.contentType === 'LINK') {
          submitData.append('contentUrl', formData.contentUrl);
        } else if (selectedFile) {
          submitData.append('file', selectedFile);
        }

        await trainingModuleAPI.create(submitData);
        toast.success('Training module created successfully');
      }
      setShowModal(false);
      setEditingModule(null);
      setFormData({
        title: '',
        description: '',
        contentType: 'DOCUMENT',
        contentUrl: '',
        duration: '',
        tags: '',
        institutionId: '',
        courseId: '',
        schoolId: '',
        isPublished: true,
        counselorIds: [],
      });
      setSelectedFile(null);
      fetchModules();
    } catch (error) {
      const errorMessage = error.response?.data?.message || 
        (editingModule ? 'Failed to update training module' : 'Failed to create training module');
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingModule(null);
    setFormData({
      title: '',
      description: '',
      contentType: 'DOCUMENT',
      contentUrl: '',
      duration: '',
      tags: '',
      institutionId: '',
      courseId: '',
      schoolId: '',
      isPublished: true,
      counselorIds: [],
    });
    setSelectedFile(null);
  };

  const getTypeIcon = (contentType) => {
    switch (contentType) {
      case 'VIDEO':
        return '🎥';
      case 'DOCUMENT':
        return '📄';
      case 'LINK':
        return '🔗';
      default:
        return '📎';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Training Modules</h1>
          <p className="text-gray-600 mt-1">Manage training materials for counselors</p>
        </div>
        <button onClick={handleAddNew} className="btn-primary">Upload Content</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">Loading...</div>
        ) : modules.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No training modules found. Click "Upload Content" to create one.
          </div>
        ) : (
          modules.map((module) => {
            const isVideo = module.contentType === 'VIDEO';
            const thumb = getVideoThumbnail(module);
            if (isVideo) {
              const videoUrl = getVideoPreviewUrl(module);
              const showVideoPreview = !thumb && videoUrl;
              return (
                <div key={module.id} className="col-span-full rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row">
                  <div className="relative w-full sm:w-64 flex-shrink-0 aspect-video bg-gray-900">
                    {thumb ? (
                      <img src={thumb} alt="" className="w-full h-full object-cover" />
                    ) : showVideoPreview ? (
                      <video
                        src={videoUrl}
                        preload="metadata"
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                        onLoadedMetadata={(e) => { e.target.currentTime = 0.5; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl text-gray-600">🎥</div>
                    )}
                    {/* Play button overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                      <div className="w-14 h-14 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg">
                        <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[16px] border-l-white border-b-[10px] border-b-transparent ml-1" />
                      </div>
                    </div>
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-white text-xs font-medium rounded">
                      {formatDuration(module.duration)}
                    </span>
                  </div>
                  <div className="flex-1 p-4 flex flex-col min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{module.title}</h3>
                      <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${module.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {module.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">
                      {(module.viewsCount ?? 0)} views • {formatDistanceToNow(new Date(module.createdAt), { addSuffix: true })}
                    </p>
                    {module.createdBy && (
                      <p className="text-sm text-gray-600 mb-2">
                        {module.createdBy.username || module.createdBy.email}
                      </p>
                    )}
                    {module.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3 flex-1">{module.description}</p>
                    )}
                    <div className="flex gap-2 mt-auto">
                      <button onClick={() => handleEdit(module)} className="btn-secondary text-sm">Edit</button>
                      <button onClick={() => handleDelete(module)} className="btn-secondary text-sm">Delete</button>
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div key={module.id} className="card hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-4xl">{getTypeIcon(module.contentType)}</div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${module.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {module.isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{module.title}</h3>
                {module.description && <p className="text-sm text-gray-600 mb-4 line-clamp-2">{module.description}</p>}
                <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-4">
                  {module.institution && <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded inline-flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {module.institution.name}</span>}
                  {module.course && <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded inline-flex items-center gap-1"><Book className="w-3.5 h-3.5" /> {module.course.name}</span>}
                  {module.school && <span className="px-2 py-1 bg-green-100 text-green-800 rounded inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {module.school.name}</span>}
                </div>
                <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                  <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {module.duration ? `${module.duration} min` : 'N/A'}</span>
                  <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {module._count?.progress || 0} learners</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(module)} className="btn-secondary flex-1 text-sm">Edit</button>
                  <button onClick={() => handleDelete(module)} className="btn-secondary text-sm">Delete</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Upload/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingModule ? 'Edit Training Module' : 'Upload Training Content'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="input-field"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="contentType"
                  value={formData.contentType}
                  onChange={handleInputChange}
                  className="input-field"
                  required
                >
                  <option value="DOCUMENT">Document</option>
                  <option value="VIDEO">Video</option>
                  <option value="LINK">Link</option>
                </select>
              </div>

              {formData.contentType === 'LINK' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    name="contentUrl"
                    value={formData.contentUrl}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="https://example.com"
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="input-field"
                    accept={formData.contentType === 'VIDEO' ? 'video/*' : 'application/pdf,.doc,.docx'}
                    required={!editingModule}
                  />
                  {selectedFile && (
                    <p className="text-sm text-gray-600 mt-1">Selected: {selectedFile.name}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    name="duration"
                    value={formData.duration}
                    onChange={handleInputChange}
                    className="input-field"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Institution (optional)
                </label>
                <select
                  name="institutionId"
                  value={formData.institutionId}
                  onChange={handleInputChange}
                  className="input-field"
                >
                  <option value="">Select Institution</option>
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>

              {formData.institutionId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Course (optional)
                  </label>
                  <select
                    name="courseId"
                    value={formData.courseId}
                    onChange={handleInputChange}
                    className="input-field"
                  >
                    <option value="">Select Course</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign to counselors (who can view this content)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Only selected counselors will see this module in their Training dashboard. Leave empty to assign to no one (you can edit later).
                </p>
                <div className="border rounded-lg p-3 max-h-44 overflow-y-auto space-y-2 bg-gray-50">
                  {counselors.length === 0 ? (
                    <p className="text-sm text-gray-500">Loading counselors… If none appear, ensure counselors exist in the system.</p>
                  ) : (
                    <>
                      <div className="flex gap-2 mb-2 pb-2 border-b border-gray-200">
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, counselorIds: counselors.map((c) => c.id) }))}
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
                      {counselors.map((c) => (
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
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isPublished"
                    checked={formData.isPublished}
                    onChange={handleInputChange}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Publish immediately (visible to counselors)
                  </span>
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary flex-1"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : editingModule ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingModule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Delete Training Module</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{deletingModule.title}"? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingModule(null)}
                className="btn-secondary flex-1"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
                disabled={submitting}
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTraining;

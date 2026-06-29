import { useState, useEffect } from 'react';
import { historicalFilesAPI, institutionAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const getUploadUrl = (fileUrl) => {
  if (!fileUrl) return '#';
  if (fileUrl.startsWith('http')) return fileUrl;
  const path = fileUrl.startsWith('/') ? fileUrl : '/' + fileUrl;
  if (import.meta.env.DEV) {
    return path;
  }
  const base = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  const origin = base.replace(/\/api\/?$/, '') || 'http://localhost:8000';
  return origin + path.replace(/\/\/+/g, '/');
};

const FILE_ICONS = { xlsx: '📊', xls: '📊', pdf: '📄', docx: '📝', doc: '📝', jpg: '🖼️', jpeg: '🖼️', png: '🖼️' };

function PreviewModal({ file, onClose, getUploadUrl }) {
  if (!file) return null;
  const extFromName = (file.fileName || '').split('.').pop() || '';
  const ext = (file.fileType || extFromName).toLowerCase().replace(/^\./, '');
  const isExcel = ['xlsx', 'xls'].includes(ext);
  const isPdf = ext === 'pdf';
  const isWord = ['docx', 'doc'].includes(ext);
  const isImage = ['jpg', 'jpeg', 'png'].includes(ext);
  const rows = Array.isArray(file.parsedData) ? file.parsedData : [];
  const headers = rows.length && typeof rows[0] === 'object' ? Object.keys(rows[0]).filter((k) => !k.startsWith('_')) : [];
  const downloadUrl = file.fileUrl ? getUploadUrl(file.fileUrl) : '#';

  let content = null;
  if (isExcel && rows.length > 0) {
    content = (
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b bg-gray-50">
            {headers.map((h) => (
              <th key={h} className="text-left py-2 px-3 font-medium text-gray-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((row, i) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              {headers.map((h) => (
                <td key={h} className="py-2 px-3">{row[h] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else if (isExcel && rows.length === 0) {
    content = (
      <p className="text-gray-500 py-8 text-center">
        No table data could be parsed.
        <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="block mt-2 text-primary-600 hover:underline">Download file to view</a>
      </p>
    );
  } else if (isPdf) {
    content = <iframe title="PDF" src={downloadUrl} className="w-full h-[70vh] border-0 rounded" />;
  } else if (isWord) {
    content = <div className="prose max-w-none whitespace-pre-wrap text-sm">{file.extractedText || 'No text extracted'}</div>;
  } else if (isImage) {
    content = <img src={downloadUrl} alt={file.fileName} className="max-w-full h-auto rounded" />;
  } else {
    content = (
      <p className="text-gray-500 py-8 text-center">
        Preview not available for this file type.
        <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="block mt-2 text-primary-600 hover:underline">Download file</a>
      </p>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900">Preview: {file.fileName}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
        </div>
        <div className="p-4 overflow-auto flex-1">
          {content}
        </div>
      </div>
    </div>
  );
}

export default function HistoricalRecords() {
  const [list, setList] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'table'
  const [institutionFilter, setInstitutionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [actioning, setActioning] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fetchList = () => {
    const params = {};
    if (institutionFilter) params.institutionId = institutionFilter;
    if (statusFilter) params.status = statusFilter;
    historicalFilesAPI.getList(params).then((r) => {
      setList(r.data?.data?.files || []);
    }).catch(() => toast.error('Failed to load records')).finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    fetchList();
  }, [institutionFilter, statusFilter]);

  useEffect(() => {
    institutionAPI.getAll({ limit: 200 }).then((r) => {
      const data = r.data?.data?.institutions ?? r.data?.institutions ?? [];
      setInstitutions(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  const handleVerify = async (file) => {
    setActioning(file.id);
    try {
      await historicalFilesAPI.verify(file.id);
      toast.success('Verified');
      fetchList();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setActioning(null);
    }
  };

  const handleLock = async (file) => {
    setActioning(file.id);
    try {
      await historicalFilesAPI.lock(file.id);
      toast.success('Locked');
      fetchList();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setActioning(null);
    }
  };

  const openPreview = async (file) => {
    setLoadingPreview(true);
    try {
      const res = await historicalFilesAPI.getById(file.id);
      setPreviewFile(res.data?.data || file);
    } catch (e) {
      toast.error('Failed to load preview');
      setPreviewFile(file);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDelete = async (file) => {
    if (file.status === 'LOCKED') {
      toast.error('Locked files cannot be deleted');
      return;
    }
    if (!window.confirm('Delete this record?')) return;
    setActioning(file.id);
    try {
      await historicalFilesAPI.delete(file.id);
      toast.success('Deleted');
      fetchList();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setActioning(null);
    }
  };

  if (loading && list.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={institutionFilter}
          onChange={(e) => setInstitutionFilter(e.target.value)}
          className="input-field py-2 text-sm w-48"
        >
          <option value="">All institutions</option>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field py-2 text-sm w-40"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="LOCKED">Locked</option>
        </select>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('card')}
            className={`px-4 py-2 text-sm font-medium ${viewMode === 'card' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'}`}
          >
            Card View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 text-sm font-medium ${viewMode === 'table' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'}`}
          >
            Table View
          </button>
        </div>
      </div>

      {viewMode === 'card' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((file) => {
            const ext = (file.fileType || '').toLowerCase();
            const icon = FILE_ICONS[ext] || '📁';
            return (
              <div key={file.id} className="bg-white rounded-xl border-2 border-gray-100 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{file.fileName}</p>
                    <p className="text-xs text-gray-500">{file.institution?.name}</p>
                    <p className="text-xs text-gray-500">{file.category} · {file.uploadedAt ? format(new Date(file.uploadedAt), 'dd MMM yyyy') : '—'}</p>
                    <span className={`inline-flex mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                      file.status === 'VERIFIED' ? 'bg-green-100 text-green-800' : file.status === 'LOCKED' ? 'bg-gray-200 text-gray-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {file.status}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button type="button" onClick={() => openPreview(file)} disabled={loadingPreview} className="px-3 py-1.5 rounded-lg bg-primary-100 text-primary-700 text-sm font-medium hover:bg-primary-200 disabled:opacity-50">Preview</button>
                  <a href={getUploadUrl(file.fileUrl)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200">Download</a>
                  {file.status !== 'LOCKED' && (
                    <>
                      {file.status === 'PENDING' && (
                        <button type="button" onClick={() => handleVerify(file)} disabled={actioning === file.id} className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 disabled:opacity-50">Verify</button>
                      )}
                      <button type="button" onClick={() => handleLock(file)} disabled={actioning === file.id} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 disabled:opacity-50">Lock</button>
                      <button type="button" onClick={() => handleDelete(file)} disabled={actioning === file.id} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 disabled:opacity-50">Delete</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Institution</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">File Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">File Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Uploaded By</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Upload Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-500">No records</td></tr>
                ) : (
                  list.map((file) => (
                    <tr key={file.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{file.institution?.name}</td>
                      <td className="py-3 px-4">{file.fileName}</td>
                      <td className="py-3 px-4 uppercase">{file.fileType}</td>
                      <td className="py-3 px-4">{file.category}</td>
                      <td className="py-3 px-4">{file.uploadedBy?.username}</td>
                      <td className="py-3 px-4">{file.uploadedAt ? format(new Date(file.uploadedAt), 'dd MMM yyyy') : '—'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          file.status === 'VERIFIED' ? 'bg-green-100 text-green-800' : file.status === 'LOCKED' ? 'bg-gray-200 text-gray-800' : 'bg-amber-100 text-amber-800'
                        }`}>{file.status}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => openPreview(file)} disabled={loadingPreview} className="text-primary-600 hover:underline text-xs disabled:opacity-50">Preview</button>
                          <a href={getUploadUrl(file.fileUrl)} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-xs">Download</a>
                          {file.status !== 'LOCKED' && (
                            <>
                              {file.status === 'PENDING' && <button type="button" onClick={() => handleVerify(file)} disabled={actioning === file.id} className="text-green-600 hover:underline text-xs">Verify</button>}
                              <button type="button" onClick={() => handleLock(file)} disabled={actioning === file.id} className="text-gray-600 hover:underline text-xs">Lock</button>
                              <button type="button" onClick={() => handleDelete(file)} disabled={actioning === file.id} className="text-red-600 hover:underline text-xs">Delete</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} getUploadUrl={getUploadUrl} />}
    </div>
  );
}

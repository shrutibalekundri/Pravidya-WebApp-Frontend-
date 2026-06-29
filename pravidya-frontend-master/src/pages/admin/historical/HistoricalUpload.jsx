import { useState, useEffect, useRef } from 'react';
import { historicalFilesAPI, institutionAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const getUploadUrl = (fileUrl) => {
  if (!fileUrl) return '#';
  if (fileUrl.startsWith('http')) return fileUrl;
  const path = fileUrl.startsWith('/') ? fileUrl : '/' + fileUrl;
  if (import.meta.env.DEV) return path;
  const base = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  const origin = base.replace(/\/api\/?$/, '') || 'http://localhost:8000';
  return origin + path.replace(/\/\/+/g, '/');
};

const FILE_ICONS = {
  xlsx: '📊',
  xls: '📊',
  pdf: '📄',
  docx: '📝',
  doc: '📝',
  jpg: '🖼️',
  jpeg: '🖼️',
  png: '🖼️',
};

function FileCard({ file, onPreview, onDownload, onDelete, isLocked }) {
  const ext = (file.fileType || '').toLowerCase();
  const icon = FILE_ICONS[ext] || '📁';
  const sizeStr = file.fileSize ? (file.fileSize < 1024 ? `${file.fileSize} B` : `${(file.fileSize / 1024).toFixed(1)} KB`) : '—';

  return (
    <div className="bg-white rounded-xl border-2 border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <span className="text-3xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate" title={file.fileName}>{file.fileName}</p>
          <p className="text-xs text-gray-500 mt-0.5">Type: {file.fileType?.toUpperCase()}</p>
          <p className="text-xs text-gray-500">{file.institution?.name || '—'}</p>
          <p className="text-xs text-gray-500">{file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : '—'} · {sizeStr}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={() => onPreview(file)}
          className="px-3 py-1.5 rounded-lg bg-primary-100 text-primary-700 text-sm font-medium hover:bg-primary-200"
        >
          Preview
        </button>
        <a
          href={getUploadUrl(file.fileUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
        >
          Download
        </a>
        {!isLocked && (
          <button
            type="button"
            onClick={() => onDelete(file)}
            className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

export default function HistoricalUpload() {
  const [institutions, setInstitutions] = useState([]);
  const [institutionId, setInstitutionId] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [category, setCategory] = useState('Both');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [uploadedCards, setUploadedCards] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    institutionAPI.getAll({ limit: 200 }).then((r) => {
      const list = r.data?.data?.institutions ?? r.data?.institutions ?? [];
      setInstitutions(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  const allowedTypes = '.xlsx,.xls,.pdf,.docx,.doc,.jpg,.jpeg,.png';
  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected]);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    setFiles((prev) => [...prev, ...dropped]);
  };
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const removeFile = (index) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!institutionId) {
      toast.error('Please select an institution');
      return;
    }
    if (files.length === 0) {
      toast.error('Please select at least one file');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('institutionId', institutionId);
      if (academicYear) formData.append('academicYear', academicYear);
      formData.append('category', category);
      if (description) formData.append('description', description);
      files.forEach((f) => formData.append('files', f));
      const res = await historicalFilesAPI.upload(formData);
      const created = res.data?.data?.files || [];
      setUploadedCards((prev) => [...created, ...prev]);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = '';
      toast.success(`Uploaded ${created.length} file(s)`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await historicalFilesAPI.delete(file.id);
      setUploadedCards((prev) => prev.filter((f) => f.id !== file.id));
      toast.success('Deleted');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border-2 border-gray-100 p-6 shadow-sm space-y-5">
        <h3 className="text-lg font-semibold text-gray-900">Upload historical data</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Institution (required)</label>
          <select
            value={institutionId}
            onChange={(e) => setInstitutionId(e.target.value)}
            className="input-field w-full max-w-md"
            required
          >
            <option value="">Select institution</option>
            {institutions.map((inst) => (
              <option key={inst.id} value={inst.id}>{inst.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year (optional)</label>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="e.g. 2023-24"
            className="input-field w-full max-w-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-field w-full max-w-md"
          >
            <option value="Marketing">Marketing</option>
            <option value="Publicity">Publicity</option>
            <option value="Both">Both</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="input-field w-full max-w-md"
            placeholder="Brief description"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Files (Excel, PDF, Word, Images)</label>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={allowedTypes}
            onChange={handleFileSelect}
            className="hidden"
          />
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors max-w-md ${
              dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
            }`}
          >
            <p className="text-gray-600">Drag and drop files here or click to browse</p>
            <p className="text-xs text-gray-500 mt-1">.xlsx, .xls, .pdf, .docx, .doc, .jpg, .jpeg, .png</p>
          </div>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1 max-w-md">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate">{f.name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-red-600 hover:underline ml-2">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="submit"
          disabled={uploading || !institutionId || files.length === 0}
          className="btn-primary disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      {uploadedCards.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Uploaded files</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {uploadedCards.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                onPreview={setPreviewFile}
                onDownload={() => window.open(getUploadUrl(file.fileUrl), '_blank')}
                onDelete={handleDelete}
                isLocked={file.status === 'LOCKED'}
              />
            ))}
          </div>
        </div>
      )}

      {previewFile && (
        <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} getUploadUrl={getUploadUrl} />
      )}
    </div>
  );
}

function PreviewModal({ file, onClose, getUploadUrl }) {
  const ext = (file.fileType || '').toLowerCase();
  const isExcel = ['xlsx', 'xls'].includes(ext);
  const isPdf = ext === 'pdf';
  const isWord = ['docx', 'doc'].includes(ext);
  const isImage = ['jpg', 'jpeg', 'png'].includes(ext);
  const data = file.parsedData;
  const rows = Array.isArray(data) ? data : [];
  const headers = rows.length && typeof rows[0] === 'object' ? Object.keys(rows[0]).filter((k) => !k.startsWith('_')) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900">Preview: {file.fileName}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
        </div>
        <div className="p-4 overflow-auto flex-1">
          {isExcel && rows.length > 0 && (
            <>
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
              {rows.length > 100 && <p className="text-gray-500 text-sm mt-2">Showing first 100 rows</p>}
            </>
          )}
          {isExcel && rows.length === 0 && <p className="text-gray-500">No table data</p>}
          {isPdf && (
            <iframe title="PDF" src={getUploadUrl(file.fileUrl)} className="w-full h-[70vh] border-0 rounded" />
          )}
          {isWord && (
            <div className="prose max-w-none whitespace-pre-wrap text-sm">{file.extractedText || 'No text extracted'}</div>
          )}
          {isImage && (
            <img src={getUploadUrl(file.fileUrl)} alt={file.fileName} className="max-w-full h-auto rounded" />
          )}
          {!isExcel && !isPdf && !isWord && !isImage && (
            <p className="text-gray-500">Preview not available. <a href={getUploadUrl(file.fileUrl)} target="_blank" rel="noopener noreferrer" className="text-primary-600">Download</a></p>
          )}
        </div>
      </div>
    </div>
  );
}

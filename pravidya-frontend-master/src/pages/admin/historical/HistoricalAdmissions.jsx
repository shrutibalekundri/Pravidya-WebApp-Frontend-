import { useState, useEffect, Fragment } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { historicalAdmissionAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const STATUS_CLASS = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  VERIFIED: 'bg-green-100 text-green-800',
  LOCKED: 'bg-amber-100 text-amber-800',
};

const CATEGORY_LABEL = { Admissions: 'Admissions', Marketing: 'Marketing', Publicity: 'Publicity' };

export default function HistoricalAdmissions() {
  const [searchParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [options, setOptions] = useState({ institutions: [], courses: [], academicYears: [] });
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState({
    institutionId: searchParams.get('institutionId') || '',
    courseId: searchParams.get('courseId') || '',
    academicYear: searchParams.get('academicYear') || '',
    category: searchParams.get('category') || '',
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
    dateFrom: '',
    dateTo: '',
    sort: searchParams.get('sort') || 'createdAt',
    order: searchParams.get('order') || 'desc',
  });
  const [expandedId, setExpandedId] = useState(null);
  const [viewRecord, setViewRecord] = useState(null);
  const [actioning, setActioning] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importInstitutionId, setImportInstitutionId] = useState('');
  const [importFiles, setImportFiles] = useState([]);
  const [importMoreFiles, setImportMoreFiles] = useState([]);
  const [importing, setImporting] = useState(false);

  const limit = 20;

  const fetchOptions = () => {
    historicalAdmissionAPI.getOptions().then((r) => {
      const data = r.data?.data || {};
      setOptions({
        institutions: data.institutions || [],
        courses: data.courses || [],
        academicYears: data.academicYears || [],
      });
    }).catch(() => toast.error('Failed to load options'));
  };

  const fetchList = () => {
    setLoading(true);
    const params = { page, limit, ...filters };
    Object.keys(params).forEach((k) => { if (params[k] === '') delete params[k]; });
    historicalAdmissionAPI.getList(params).then((r) => {
      const data = r.data?.data || {};
      setList(data.list || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    }).catch(() => toast.error('Failed to load entries')).finally(() => setLoading(false));
  };

  useEffect(() => { fetchOptions(); }, []);
  useEffect(() => { fetchList(); }, [page, filters.institutionId, filters.courseId, filters.academicYear, filters.category, filters.status, filters.search, filters.sort, filters.order]);

  const handleLock = async (row) => {
    if (row.status !== 'VERIFIED') {
      toast.error('Only VERIFIED entries can be locked.');
      return;
    }
    setActioning(row.id);
    try {
      await historicalAdmissionAPI.lock(row.id);
      toast.success('Locked');
      fetchList();
      setViewRecord(null);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setActioning(null);
    }
  };

  const handleUnlock = async (row) => {
    if (row.status !== 'LOCKED') return;
    setActioning(row.id);
    try {
      await historicalAdmissionAPI.unlock(row.id);
      toast.success('Unlocked');
      fetchList();
      setViewRecord(null);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setActioning(null);
    }
  };

  const handleImportSubmit = async () => {
    if (!importInstitutionId) {
      toast.error('Select an institution.');
      return;
    }
    const allFiles = [...importFiles, ...importMoreFiles];
    if (allFiles.length === 0) {
      toast.error('Choose at least one file.');
      return;
    }
    setImporting(true);
    try {
      const year = new Date().getFullYear();
      const { data: createRes } = await historicalAdmissionAPI.create({
        institutionId: importInstitutionId,
        academicYear: String(year),
        category: 'Admissions',
        status: 'DRAFT',
      });
      const entryId = createRes?.data?.id;
      if (!entryId) throw new Error('Create failed');
      const formData = new FormData();
      allFiles.forEach((f) => formData.append('files', f));
      await historicalAdmissionAPI.uploadDocumentsOnly(entryId, formData);
      toast.success('Data and files imported.');
      setShowImportModal(false);
      setImportInstitutionId('');
      setImportFiles([]);
      setImportMoreFiles([]);
      fetchList();
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const getUploadUrl = (fileUrl) => {
    if (!fileUrl) return '#';
    if (fileUrl.startsWith('http')) return fileUrl;
    const path = fileUrl.startsWith('/') ? fileUrl : '/' + fileUrl;
    if (import.meta.env.DEV) return path;
    const base = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    const origin = base.replace(/\/api\/?$/, '') || 'http://localhost:8000';
    return origin + path.replace(/\/\/+/g, '/');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <span>📊</span> Historical Admissions & Publicity Data
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage and analyse historical admissions and marketing/publicity data by institution</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="btn-secondary py-2 px-4 text-sm"
          >
            Import
          </button>
          <Link
            to="/admin/historical-admissions/entries/create"
            className="btn-primary py-2 px-4 text-sm"
          >
            + Add entry
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 whitespace-nowrap">Institution</span>
          <select
            value={filters.institutionId}
            onChange={(e) => setFilters((f) => ({ ...f, institutionId: e.target.value, page: 1 }))}
            className="input-field py-2 text-sm w-40"
          >
            <option value="">All</option>
            {options.institutions.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 whitespace-nowrap">Academic Year</span>
          <select
            value={filters.academicYear}
            onChange={(e) => setFilters((f) => ({ ...f, academicYear: e.target.value, page: 1 }))}
            className="input-field py-2 text-sm w-28"
          >
            <option value="">All</option>
            {options.academicYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 whitespace-nowrap">Course</span>
          <select
            value={filters.courseId}
            onChange={(e) => setFilters((f) => ({ ...f, courseId: e.target.value, page: 1 }))}
            className="input-field py-2 text-sm w-44"
          >
            <option value="">All</option>
            {options.courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name} {c.code ? `(${c.code})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 whitespace-nowrap">Category</span>
          <select
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value, page: 1 }))}
            className="input-field py-2 text-sm w-32"
          >
            <option value="">All</option>
            <option value="Admissions">Admissions</option>
            <option value="Marketing">Marketing</option>
            <option value="Publicity">Publicity</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 whitespace-nowrap">Status</span>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
            className="input-field py-2 text-sm w-32"
          >
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="VERIFIED">Verified</option>
            <option value="LOCKED">Locked</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 whitespace-nowrap">Sort by</span>
          <select
            value={`${filters.sort}-${filters.order}`}
            onChange={(e) => {
              const [sort, order] = e.target.value.split('-');
              setFilters((f) => ({ ...f, sort, order, page: 1 }));
            }}
            className="input-field py-2 text-sm w-40"
          >
            <option value="createdAt-desc">Created date (newest)</option>
            <option value="createdAt-asc">Created date (oldest)</option>
            <option value="updatedAt-desc">Updated (newest)</option>
            <option value="academicYear-desc">Year (desc)</option>
            <option value="title-asc">Title A–Z</option>
          </select>
          <span className="text-gray-400">▼</span>
        </div>
        <input
          type="text"
          placeholder="dd-mm-yyyy"
          value={filters.dateFrom}
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value, page: 1 }))}
          className="input-field py-2 text-sm w-28"
          title="Date from"
        />
        <input
          type="text"
          placeholder="dd-mm-yyyy"
          value={filters.dateTo}
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value, page: 1 }))}
          className="input-field py-2 text-sm w-28"
          title="Date to"
        />
        <input
          type="text"
          placeholder="Search in table (Institution, course, source...)"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
          className="input-field py-2 text-sm w-52"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
        {loading && list.length === 0 ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 w-8"></th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Institution</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Academic Year</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Course</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Confirmed Adm.</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Category</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Created</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="py-2 px-4">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                          className="p-1 rounded hover:bg-gray-200"
                        >
                          {expandedId === row.id ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="py-2 px-4 font-medium text-gray-900">{row.institution?.name || '—'}</td>
                      <td className="py-2 px-4 text-gray-600">{row.academicYear || '—'}</td>
                      <td className="py-2 px-4 text-gray-700">{row.course?.name || row.title || '—'}</td>
                      <td className="py-2 px-4 text-gray-700">
                        {row.applicationData?.confirmedAdmissions != null ? String(row.applicationData.confirmedAdmissions) : '—'}
                      </td>
                      <td className="py-2 px-4">
                        <span className="text-gray-700">{CATEGORY_LABEL[row.category] || row.category}</span>
                      </td>
                      <td className="py-2 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[row.status] || 'bg-gray-100 text-gray-800'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-gray-500">{row.createdAt ? format(new Date(row.createdAt), 'dd MMM yyyy') : '—'}</td>
                      <td className="py-2 px-4">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => setViewRecord(row)}
                            className="px-2 py-1 rounded bg-primary-100 text-primary-700 text-xs font-medium hover:bg-primary-200"
                          >
                            View
                          </button>
                          {row.status !== 'LOCKED' && (
                            <Link
                              to={`/admin/historical-admissions/entries/${row.id}/edit`}
                              className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200"
                            >
                              Edit
                            </Link>
                          )}
                          {row.status === 'VERIFIED' && (
                            <button
                              type="button"
                              onClick={() => handleLock(row)}
                              disabled={actioning === row.id}
                              className="px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs font-medium hover:bg-amber-200 disabled:opacity-50"
                            >
                              Lock
                            </button>
                          )}
                          {row.status === 'LOCKED' && (
                            <button
                              type="button"
                              onClick={() => handleUnlock(row)}
                              disabled={actioning === row.id}
                              className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 disabled:opacity-50"
                            >
                              Unlock
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === row.id && (
                      <tr key={`${row.id}-exp`} className="bg-gray-50/80">
                        <td colSpan={9} className="py-3 px-4">
                          <div className="text-sm text-gray-600 space-y-1">
                            {row.description && <p><span className="font-medium">Description:</span> {row.description}</p>}
                            {row.images?.length > 0 && (
                              <>
                                <p className="font-medium mt-2">Documents:</p>
                                <ul className="list-disc list-inside">
                                  {row.images.map((img) => (
                                    <li key={img.id}>
                                      <a href={getUploadUrl(img.fileUrl)} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">{img.fileName}</a>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Total {total} entries</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded border border-gray-200 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-600">Page {page} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded border border-gray-200 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowImportModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Import data & files</h3>
              <button type="button" onClick={() => setShowImportModal(false)} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Upload <strong>any files</strong> — PDF, images, Word, Excel, CSV, or any format. <strong>No specific columns or structure required.</strong><br />
              All files are attached to a record. If you upload an Excel/CSV with columns Year, Course, Total Admissions, Category, you can optionally import as table rows; otherwise everything is added as attachments.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Institution *</label>
                <select
                  value={importInstitutionId}
                  onChange={(e) => setImportInstitutionId(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">Select institution</option>
                  {options.institutions.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Files (any type) — PDF, images, Word, Excel, CSV, etc.</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setImportFiles(Array.from(e.target.files || []))}
                  className="input-field w-full text-sm"
                />
                <span className="text-xs text-gray-500 mt-1 block">{importFiles.length ? `${importFiles.length} file(s) chosen` : 'No file chosen'}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">More files (optional) — any type</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setImportMoreFiles(Array.from(e.target.files || []))}
                  className="input-field w-full text-sm"
                />
                <span className="text-xs text-gray-500 mt-1 block">{importMoreFiles.length ? `${importMoreFiles.length} file(s) chosen` : 'No file chosen'}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <button type="button" onClick={() => setShowImportModal(false)} className="btn-secondary py-2 px-4 text-sm">Close</button>
              <button type="button" onClick={handleImportSubmit} disabled={importing} className="btn-primary py-2 px-4 text-sm">Upload</button>
            </div>
          </div>
        </div>
      )}

      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setViewRecord(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Record details</h3>
              <button type="button" onClick={() => setViewRecord(null)} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
            </div>
            <div className="p-4 overflow-auto">
              <dl className="grid grid-cols-1 gap-3 text-sm">
                <div><dt className="font-medium text-gray-600">Institution</dt><dd className="text-gray-900 mt-0.5">{viewRecord.institution?.name || '—'}</dd></div>
                <div><dt className="font-medium text-gray-600">Year</dt><dd className="text-gray-900 mt-0.5">{viewRecord.academicYear || '—'}</dd></div>
                <div><dt className="font-medium text-gray-600">Course</dt><dd className="text-gray-900 mt-0.5">{viewRecord.course?.name || viewRecord.title || '—'}</dd></div>
                <div><dt className="font-medium text-gray-600">Applications received</dt><dd className="text-gray-900 mt-0.5">{viewRecord.applicationData?.applicationsReceived != null ? viewRecord.applicationData.applicationsReceived : '—'}</dd></div>
                <div><dt className="font-medium text-gray-600">Total admissions</dt><dd className="text-gray-900 mt-0.5">{viewRecord.applicationData?.confirmedAdmissions != null ? viewRecord.applicationData.confirmedAdmissions : '—'}</dd></div>
                <div><dt className="font-medium text-gray-600">Conversion %</dt><dd className="text-gray-900 mt-0.5">{viewRecord.applicationData?.applicationsReceived > 0 && viewRecord.applicationData?.confirmedAdmissions != null ? (Math.round(100 * viewRecord.applicationData.confirmedAdmissions / viewRecord.applicationData.applicationsReceived) + '%') : '—'}</dd></div>
                <div><dt className="font-medium text-gray-600">Male / Female</dt><dd className="text-gray-900 mt-0.5">{viewRecord.applicationData?.maleCount != null || viewRecord.applicationData?.femaleCount != null ? `${viewRecord.applicationData?.maleCount ?? '—'} / ${viewRecord.applicationData?.femaleCount ?? '—'}` : '—'}</dd></div>
                <div><dt className="font-medium text-gray-600">Category</dt><dd className="text-gray-900 mt-0.5">{viewRecord.category || '—'}</dd></div>
                <div><dt className="font-medium text-gray-600">Source of data</dt><dd className="text-gray-900 mt-0.5">{viewRecord.applicationData?.sourceOfData || viewRecord.description || '—'}</dd></div>
                <div><dt className="font-medium text-gray-600">Status</dt><dd className="mt-0.5"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[viewRecord.status] || 'bg-gray-100 text-gray-800'}`}>{viewRecord.status}</span></dd></div>
                <div><dt className="font-medium text-gray-600">Created by</dt><dd className="text-gray-900 mt-0.5">{viewRecord.createdBy?.name || 'admin'} on {viewRecord.createdAt ? format(new Date(viewRecord.createdAt), 'dd MMM yyyy HH:mm') : '—'}</dd></div>
              </dl>
              {viewRecord.images?.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <p className="font-medium text-gray-600 text-sm">Documents</p>
                  <ul className="list-disc list-inside mt-1 text-sm">
                    {viewRecord.images.map((img) => (
                      <li key={img.id}>
                        <a href={getUploadUrl(img.fileUrl)} target="_blank" rel="noopener noreferrer" className="text-primary-600">{img.fileName}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex gap-2">
              {viewRecord.status !== 'LOCKED' && (
                <Link to={`/admin/historical-admissions/entries/${viewRecord.id}/edit`} className="btn-primary py-2 px-4 text-sm">Edit</Link>
              )}
              <button type="button" onClick={() => setViewRecord(null)} className="btn-secondary py-2 px-4 text-sm border border-gray-300">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

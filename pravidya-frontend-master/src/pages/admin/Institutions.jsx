import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { institutionAPI, classAPI } from '../../services/api';

const BOARD_OPTIONS = ['CBSE', 'State Board', 'ICSE', 'IB'];
const GRADE_GROUPS = {
  primary: [1, 2, 3, 4, 5],
  middle: [6, 7, 8, 9, 10],
  high: [11, 12],
};

function formatAddress(inst) {
  return [inst?.address, inst?.city, inst?.state].filter(Boolean).join(', ') || '—';
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

const AdminInstitutions = () => {
  const [institution, setInstitution] = useState(null);
  const [loadingInstitution, setLoadingInstitution] = useState(true);
  const [savingInstitution, setSavingInstitution] = useState(false);

  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editDraft, setEditDraft] = useState({
    name: '',
    type: 'School',
    logoUrl: '',
    address: '',
    city: '',
    state: '',
  });

  const [selectedBoards, setSelectedBoards] = useState([]);
  const [admissionsOpen, setAdmissionsOpen] = useState(true);
  const [intakeCapacity, setIntakeCapacity] = useState('');

  const [classModal, setClassModal] = useState(null); // { mode: 'create'|'edit', row?: classRow }
  const [classDraft, setClassDraft] = useState({ className: '', board: '' });
  const [classGrades, setClassGrades] = useState([]); // for create: array of numbers (1-12)
  const [customClassInput, setCustomClassInput] = useState('');
  const [customClassNames, setCustomClassNames] = useState([]); // for create: array of strings
  const [savingClass, setSavingClass] = useState(false);

  const stats = useMemo(() => {
    return {
      totalClasses: classes.length,
      selectedBoards: selectedBoards.length,
    };
  }, [classes.length, selectedBoards.length]);

  const sortedClasses = useMemo(() => {
    const list = Array.isArray(classes) ? [...classes] : [];
    const gradeRe = /^grade\s*(\d{1,2})$/i;
    const parseGrade = (name) => {
      const m = String(name || '').trim().match(gradeRe);
      if (!m) return null;
      const n = Number(m[1]);
      return Number.isFinite(n) ? n : null;
    };
    return list.sort((a, b) => {
      const aBoard = String(a?.board || '').toLowerCase();
      const bBoard = String(b?.board || '').toLowerCase();
      if (aBoard !== bBoard) return aBoard.localeCompare(bBoard);

      const aG = parseGrade(a?.className);
      const bG = parseGrade(b?.className);
      if (aG != null && bG != null) return aG - bG; // Grade 1..12
      if (aG != null && bG == null) return -1; // Grades first
      if (aG == null && bG != null) return 1;
      return String(a?.className || '').localeCompare(String(b?.className || ''), undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [classes]);

  const fetchInstitution = async () => {
    setLoadingInstitution(true);
    try {
      const res = await institutionAPI.getMe();
      const inst = res?.data?.data?.institution || null;
      setInstitution(inst);
      setSelectedBoards(Array.isArray(inst?.boardsOffered) ? inst.boardsOffered : []);
      setAdmissionsOpen(inst?.admissionsOpen !== false);
      const cap = inst?.customData?.intakeCapacity;
      setIntakeCapacity(cap === 0 ? '0' : cap ? String(cap) : '');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load institution');
      setInstitution(null);
    } finally {
      setLoadingInstitution(false);
    }
  };

  const fetchClasses = async () => {
    setLoadingClasses(true);
    try {
      const res = await classAPI.getAll();
      const list = res?.data?.data?.classes || [];
      setClasses(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load classes');
      setClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  };

  useEffect(() => {
    fetchInstitution();
    fetchClasses();
  }, []);

  const openEditProfile = () => {
    const inst = institution || {};
    setEditDraft({
      name: inst.name || '',
      type: inst.type || 'School',
      logoUrl: inst.logoUrl || '',
      address: inst.address || '',
      city: inst.city || '',
      state: inst.state || '',
    });
    setEditProfileOpen(true);
  };

  const saveProfile = async () => {
    setSavingInstitution(true);
    try {
      const payload = {
        name: editDraft.name?.trim(),
        type: editDraft.type,
        logoUrl: editDraft.logoUrl || null,
        address: editDraft.address || null,
        city: editDraft.city || null,
        state: editDraft.state || null,
      };
      await institutionAPI.updateMe(payload);
      toast.success('Institution profile updated');
      setEditProfileOpen(false);
      await fetchInstitution();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingInstitution(false);
    }
  };

  const toggleBoard = (b) => {
    setSelectedBoards((prev) => {
      const set = new Set(prev || []);
      if (set.has(b)) set.delete(b);
      else set.add(b);
      return [...set];
    });
  };

  const saveAcademicConfig = async () => {
    setSavingInstitution(true);
    try {
      const nextCustomData = {
        ...(institution?.customData && typeof institution.customData === 'object' ? institution.customData : {}),
        intakeCapacity: intakeCapacity === '' ? null : Number(intakeCapacity),
      };
      await institutionAPI.updateMe({
        boardsOffered: selectedBoards,
        admissionsOpen: !!admissionsOpen,
        customData: nextCustomData,
      });
      toast.success('Configuration saved');
      await fetchInstitution();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSavingInstitution(false);
    }
  };

  const openCreateClass = () => {
    const defaultBoard = selectedBoards[0] || '';
    setClassDraft({ className: '', board: defaultBoard });
    setClassGrades([]);
    setCustomClassInput('');
    setCustomClassNames([]);
    setClassModal({ mode: 'create' });
  };

  const openEditClass = (row) => {
    setClassDraft({ className: row?.className || '', board: row?.board || '' });
    setClassGrades([]);
    setCustomClassInput('');
    setCustomClassNames([]);
    setClassModal({ mode: 'edit', row });
  };

  const saveClass = async () => {
    if (!classDraft.board.trim()) {
      toast.error('Board is required');
      return;
    }
    if (classModal?.mode !== 'edit') {
      const grades = (classGrades || []).map(Number).filter((g) => g >= 1 && g <= 12);
      const customs = (customClassNames || []).map((s) => String(s || '').trim()).filter(Boolean);
      if (grades.length === 0 && customs.length === 0) {
        toast.error('Please select grades or add custom classes');
        return;
      }
    } else if (!classDraft.className.trim()) {
      toast.error('Class Name is required');
      return;
    }
    setSavingClass(true);
    try {
      if (classModal?.mode === 'edit') {
        await classAPI.update(classModal.row.id, {
          className: classDraft.className.trim(),
          board: classDraft.board.trim(),
        });
        toast.success('Class updated');
      } else {
        const board = classDraft.board.trim();
        const grades = [...new Set((classGrades || []).map(Number).filter((g) => g >= 1 && g <= 12))].sort((a, b) => a - b);
        const customNames = [...new Set((customClassNames || []).map((s) => String(s || '').trim()).filter(Boolean))];
        const existingKey = new Set(
          (classes || []).map((c) =>
            `${String(c.board || '').toLowerCase()}__${String(c.className || '').toLowerCase()}`
          )
        );
        const toCreate = [
          ...grades.map((g) => ({ className: `Grade ${g}`, board })),
          ...customNames.map((name) => ({ className: name, board })),
        ].filter((x) => !existingKey.has(`${board.toLowerCase()}__${x.className.toLowerCase()}`));

        if (toCreate.length === 0) {
          toast.success('All selected classes already exist');
        } else {
          await Promise.all(toCreate.map((x) => classAPI.create(x)));
          const requested = grades.length + customNames.length;
          const skipped = requested - toCreate.length;
          toast.success(
            skipped > 0
              ? `Classes added (${toCreate.length}) • Skipped duplicates (${skipped})`
              : `Classes added (${toCreate.length})`
          );
        }
      }
      setClassModal(null);
      await fetchClasses();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to save class');
    } finally {
      setSavingClass(false);
    }
  };

  const deleteClass = async (row) => {
    if (!row?.id) return;
    setSavingClass(true);
    try {
      await classAPI.delete(row.id);
      toast.success('Class deleted');
      await fetchClasses();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to delete class');
    } finally {
      setSavingClass(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Institution Setup
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your institution profile and academic configuration.
            </p>
          </div>
          <button
            type="button"
            onClick={openEditProfile}
            disabled={!institution || loadingInstitution}
            className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Edit Profile
          </button>
        </div>
      </div>

      {/* Banner */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-sky-50 to-indigo-50 p-5 sm:p-6">
        {loadingInstitution ? (
          <div className="h-24 rounded-xl bg-white/60 animate-pulse" />
        ) : !institution ? (
          <div className="text-sm text-slate-700">
            Institution not found for this admin.
          </div>
        ) : (
          <div className="flex items-start gap-4">
            {institution.logoUrl ? (
              <img
                src={institution.logoUrl}
                alt="Institution logo"
                className="h-14 w-14 rounded-2xl bg-white object-contain border border-slate-200"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="h-14 w-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold">
                {(institution.name || '?').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
                {institution.name}
              </h2>
              <p className="text-sm text-slate-600">
                {institution.type || '—'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {formatAddress(institution)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Details + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Institution Details
          </h3>
          {loadingInstitution ? (
            <div className="space-y-3">
              <div className="h-4 bg-slate-100 rounded animate-pulse" />
              <div className="h-4 bg-slate-100 rounded animate-pulse" />
              <div className="h-4 bg-slate-100 rounded animate-pulse" />
            </div>
          ) : !institution ? (
            <p className="text-sm text-slate-500">No data.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-slate-500">Name</p>
                <p className="mt-0.5 font-semibold text-slate-900">{institution.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Type</p>
                <p className="mt-0.5 text-slate-900">{institution.type}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-slate-500">Address</p>
                <p className="mt-0.5 text-slate-900">{formatAddress(institution)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Summary
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Selected Boards</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {stats.selectedBoards}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Total Classes</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {stats.totalClasses}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Academic Configuration */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Academic Configuration
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Select boards and manage classes for your institution.
            </p>
          </div>
          <button
            type="button"
            onClick={saveAcademicConfig}
            disabled={savingInstitution || loadingInstitution}
            className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {savingInstitution ? 'Saving...' : 'Save / Update'}
          </button>
        </div>

        {/* Boards */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">
            Boards Selection
          </h4>
          <div className="flex flex-wrap gap-2">
            {BOARD_OPTIONS.map((b) => {
              const checked = selectedBoards.includes(b);
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => toggleBoard(b)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    checked
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {b}
                </button>
              );
            })}
          </div>
        </div>

        {/* Admission settings */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-2">
              Admission Settings
            </h4>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-700">Admissions Open</span>
              <input
                type="checkbox"
                checked={!!admissionsOpen}
                onChange={(e) => setAdmissionsOpen(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-2">
              Intake Capacity
            </h4>
            <input
              type="number"
              min="0"
              value={intakeCapacity}
              onChange={(e) => setIntakeCapacity(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. 120"
            />
          </div>
        </div>

        {/* Classes CRUD */}
        <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Classes Management
              </h4>
              <p className="text-xs text-slate-500">
                Create classes mapped to selected boards.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateClass}
              disabled={selectedBoards.length === 0}
              className="inline-flex items-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              + Add Class
            </button>
          </div>

          {selectedBoards.length === 0 && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Select at least one board to add classes.
            </div>
          )}

          {loadingClasses ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : classes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              No classes added yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-4">Class Name</th>
                    <th className="py-2 pr-4">Board</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClasses.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4 font-medium text-slate-900">
                        {row.className}
                      </td>
                      <td className="py-2 pr-4 text-slate-700">{row.board}</td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditClass(row)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteClass(row)}
                            disabled={savingClass}
                            className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditProfileOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Profile</h3>
                <p className="text-xs text-slate-500">Update your institution profile (single-tenant).</p>
              </div>
              <button
                type="button"
                onClick={() => setEditProfileOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
                <input
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <select
                    value={editDraft.type}
                    onChange={(e) => setEditDraft((p) => ({ ...p, type: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  >
                    <option value="School">School</option>
                    <option value="College">College</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Logo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const dataUrl = await toBase64(f);
                        setEditDraft((p) => ({ ...p, logoUrl: dataUrl }));
                      } catch {
                        toast.error('Failed to read image');
                      }
                    }}
                    className="w-full text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <input
                  value={editDraft.address}
                  onChange={(e) => setEditDraft((p) => ({ ...p, address: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    value={editDraft.city}
                    onChange={(e) => setEditDraft((p) => ({ ...p, city: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                  <input
                    value={editDraft.state}
                    onChange={(e) => setEditDraft((p) => ({ ...p, state: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditProfileOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={savingInstitution}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingInstitution ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Class Modal */}
      {classModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setClassModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">
              {classModal.mode === 'edit' ? 'Edit Class' : 'Add Class'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              {classModal.mode === 'edit'
                ? 'Update the class details.'
                : 'Select board and grades to create classes.'}
            </p>

            <div className="space-y-3">
              {classModal.mode === 'edit' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Class Name</label>
                  <input
                    value={classDraft.className}
                    onChange={(e) => setClassDraft((p) => ({ ...p, className: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="e.g. Grade 10"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Board</label>
                <select
                  value={classDraft.board}
                  onChange={(e) => setClassDraft((p) => ({ ...p, board: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="" disabled>
                    Select board
                  </option>
                  {selectedBoards.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {classModal.mode !== 'edit' && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-800 mb-2">
                    Select Grades for {classDraft.board || 'board'}
                  </p>

                  {(() => {
                    const set = new Set((classGrades || []).map(Number));
                    const allGrades = [...GRADE_GROUPS.primary, ...GRADE_GROUPS.middle, ...GRADE_GROUPS.high];
                    const allSelected = allGrades.every((g) => set.has(g));
                    const someSelected = allGrades.some((g) => set.has(g));
                    const toggleGrade = (g) => {
                      setClassGrades((prev) => {
                        const s = new Set((prev || []).map(Number));
                        if (s.has(g)) s.delete(g);
                        else s.add(g);
                        return [...s].sort((a, b) => a - b);
                      });
                    };
                    const setGroup = (grades, checked) => {
                      setClassGrades((prev) => {
                        const s = new Set((prev || []).map(Number));
                        grades.forEach((g) => (checked ? s.add(g) : s.delete(g)));
                        return [...s].sort((a, b) => a - b);
                      });
                    };

                    return (
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => el && (el.indeterminate = someSelected && !allSelected)}
                            onChange={() => setGroup(allGrades, !allSelected)}
                          />
                          <span className="font-medium">Select All</span>
                          <span className="text-slate-500">(Grades 1–12)</span>
                        </label>

                        {[
                          { key: 'primary', label: 'Primary (1–5)', grades: GRADE_GROUPS.primary },
                          { key: 'middle', label: 'Middle (6–10)', grades: GRADE_GROUPS.middle },
                          { key: 'high', label: 'High (11–12)', grades: GRADE_GROUPS.high },
                        ].map((group) => {
                          const gAll = group.grades.every((g) => set.has(g));
                          const gSome = group.grades.some((g) => set.has(g));
                          return (
                            <div key={group.key}>
                              <label className="flex items-center gap-2 text-xs text-slate-700 mb-2">
                                <input
                                  type="checkbox"
                                  checked={gAll}
                                  ref={(el) => el && (el.indeterminate = gSome && !gAll)}
                                  onChange={() => setGroup(group.grades, !gAll)}
                                />
                                <span className="font-semibold">{group.label}</span>
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {group.grades.map((g) => (
                                  <label
                                    key={g}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={set.has(g)}
                                      onChange={() => toggleGrade(g)}
                                    />
                                    <span>Grade {g}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {classModal.mode !== 'edit' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold text-slate-800 mb-2">
                    Custom Classes
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={customClassInput}
                      onChange={(e) => setCustomClassInput(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="e.g. Nursery, LKG, UKG"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const v = String(customClassInput || '').trim();
                        if (!v) return;
                        setCustomClassNames((prev) => {
                          const next = [...(prev || []), v];
                          return [...new Set(next.map((s) => String(s).trim()).filter(Boolean))];
                        });
                        setCustomClassInput('');
                      }}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Add
                    </button>
                  </div>
                  {customClassNames.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {customClassNames.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
                        >
                          {name}
                          <button
                            type="button"
                            onClick={() =>
                              setCustomClassNames((prev) =>
                                (prev || []).filter((x) => x !== name),
                              )
                            }
                            className="text-slate-500 hover:text-slate-800"
                            aria-label={`Remove ${name}`}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-slate-500">
                    Tip: Add classes like Nursery, LKG, UKG, Pre-primary, etc.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClassModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveClass}
                disabled={savingClass}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {savingClass ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInstitutions;

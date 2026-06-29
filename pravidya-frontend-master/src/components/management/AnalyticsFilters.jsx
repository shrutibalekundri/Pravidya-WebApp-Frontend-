import { useState, useEffect } from 'react';
import { useManagementFilters } from '../../contexts/ManagementFiltersContext';
import { counselorAPI, institutionAPI, courseAPI } from '../../services/api';

export default function AnalyticsFilters() {
  const { filters, updateFilters, params } = useManagementFilters();
  const [courses, setCourses] = useState([]);
  const [counselors, setCounselors] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    Promise.all([
      courseAPI.getAll({ limit: 100 }).then((r) => setCourses(r.data?.data?.courses || r.data?.courses || [])),
      counselorAPI.getAll({ limit: 100 }).then((r) => setCounselors(r.data?.data?.counselors || r.data?.counselors || [])),
      institutionAPI.getAll({ limit: 100 }).then((r) => setInstitutions(r.data?.data?.institutions || r.data?.institutions || [])),
    ]).catch(() => {});
  }, []);

  return (
    <div className="mb-6 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">From</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => updateFilters({ startDate: e.target.value })}
            className="input-field w-auto py-1.5 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">To</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => updateFilters({ endDate: e.target.value })}
            className="input-field w-auto py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          {expanded ? 'Fewer filters' : 'More filters'}
        </button>
      </div>
      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Course</label>
            <select
              value={filters.courseId}
              onChange={(e) => updateFilters({ courseId: e.target.value })}
              className="input-field py-2 text-sm"
            >
              <option value="">All</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Location</label>
            <input
              type="text"
              placeholder="City"
              value={filters.location}
              onChange={(e) => updateFilters({ location: e.target.value })}
              className="input-field py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Counselor</label>
            <select
              value={filters.counselorId}
              onChange={(e) => updateFilters({ counselorId: e.target.value })}
              className="input-field py-2 text-sm"
            >
              <option value="">All</option>
              {counselors.map((c) => (
                <option key={c.id} value={c.id}>{c.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Institution</label>
            <select
              value={filters.institutionId}
              onChange={(e) => updateFilters({ institutionId: e.target.value })}
              className="input-field py-2 text-sm"
            >
              <option value="">All</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Lead Source</label>
            <input
              type="text"
              placeholder="e.g. Website"
              value={filters.leadSource}
              onChange={(e) => updateFilters({ leadSource: e.target.value })}
              className="input-field py-2 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

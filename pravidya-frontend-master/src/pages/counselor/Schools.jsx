import { useState, useEffect } from 'react';
import { institutionAPI } from '../../services/api';
import { getCached, setCached } from '../../utils/counselorCache';
import toast from 'react-hot-toast';

const STANDARD_RANGES = ['1-5', '6-10', '11-12'];

function getAdmissionsByStandard(inst) {
  const adm = inst?.admissionsOpenByStandard;
  if (adm && typeof adm === 'object') {
    return { '1-5': adm['1-5'] !== false, '6-10': adm['6-10'] !== false, '11-12': adm['11-12'] !== false };
  }
  return { '1-5': true, '6-10': true, '11-12': true };
}

// Grades the school offers per board (from boardGradeMap)
function getSchoolGradesByBoard(school) {
  const map = school?.boardGradeMap;
  if (!map || typeof map !== 'object') return [];
  return Object.entries(map)
    .filter(([, g]) => g && typeof g === 'object')
    .map(([board, g]) => {
      const all = [].concat(g.primary || [], g.middle || [], g.high || []).map(Number).filter((n) => n >= 1 && n <= 12);
      return { board, grades: [...new Set(all)].sort((a, b) => a - b) };
    })
    .filter((b) => b.grades.length > 0);
}

// Per-grade admissions grouped by board (matches admin Open Admission structure: CBSE, State Board, etc.)
function getAdmissionsDisplayByBoard(school) {
  const openGrades = school?.admissionsOpenGrades;
  const openSet = Array.isArray(openGrades) && openGrades.length > 0
    ? new Set(openGrades.map((g) => Number(g)).filter((g) => g >= 1 && g <= 12))
    : null;
  const byBoard = getSchoolGradesByBoard(school);
  if (openSet && byBoard.length > 0) {
    const boards = byBoard.map(({ board, grades }) => ({
      board,
      openGrades: grades.filter((g) => openSet.has(g)).sort((a, b) => a - b),
    }));
    const openStreams = Array.isArray(school?.admissionsOpenStreams) ? school.admissionsOpenStreams : [];
    return { type: 'byBoard', boards, openStreams };
  }
  const grades = school?.admissionsOpenGrades;
  if (Array.isArray(grades) && grades.length > 0) {
    const nums = grades.map((g) => Number(g)).filter((g) => g >= 1 && g <= 12).sort((a, b) => a - b);
    if (nums.length > 0) return { type: 'grades', list: nums };
  }
  const byRange = getAdmissionsByStandard(school);
  const openRanges = STANDARD_RANGES.filter((k) => byRange[k] === true).map((k) =>
    k === '1-5' ? '1–5' : k === '6-10' ? '6–10' : '11–12'
  );
  const closedRanges = STANDARD_RANGES.filter((k) => byRange[k] === false).map((k) =>
    k === '1-5' ? '1–5' : k === '6-10' ? '6–10' : '11–12'
  );
  return { type: 'ranges', openRanges, closedRanges };
}

// School has admissions open if admin set admissionsOpen, or admissionsOpenGrades, or admissionsOpenByStandard
function schoolHasOpenAdmissions(school) {
  if (school?.admissionsOpen === true) return true;
  const grades = school?.admissionsOpenGrades;
  if (Array.isArray(grades) && grades.length > 0) return true;
  const byStandard = school?.admissionsOpenByStandard;
  if (byStandard && typeof byStandard === 'object' && (byStandard['1-5'] === true || byStandard['6-10'] === true || byStandard['11-12'] === true)) return true;
  return false;
}

const CounselorSchools = () => {
  const [schools, setSchools] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    const cachedSchools = getCached('schools');
    const cachedColleges = getCached('colleges');
    if (Array.isArray(cachedSchools) && Array.isArray(cachedColleges)) {
      setSchools(cachedSchools);
      setColleges(cachedColleges);
      setLoading(false);
    } else {
      setLoading(true);
    }
    const fetchData = async () => {
      try {
        const [schoolRes, collegeRes] = await Promise.all([
          institutionAPI.getAll({ type: 'School', limit: 200 }),
          institutionAPI.getAll({ type: 'College', limit: 200 }),
        ]);
        const schoolList = schoolRes?.data?.data?.institutions ?? [];
        const collegeList = collegeRes?.data?.data?.institutions ?? [];
        const schoolArr = Array.isArray(schoolList) ? schoolList : [];
        const collegeArr = Array.isArray(collegeList) ? collegeList : [];
        setSchools(schoolArr);
        setColleges(collegeArr);
        setCached('schools', schoolArr);
        setCached('colleges', collegeArr);
      } catch (error) {
        if (!Array.isArray(cachedSchools) || !Array.isArray(cachedColleges)) {
          toast.error(error?.response?.data?.message || 'Failed to load institutions');
          setSchools([]);
          setColleges([]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const schoolsWithOpenAdmissions = schools.filter(schoolHasOpenAdmissions);
  const collegesWithOpenCourses = colleges.filter(
    (c) => (c.courses || []).some((course) => course.admissionsOpen === true)
  );

  const filteredSchools = schoolsWithOpenAdmissions.filter(
    (s) => !searchQuery.trim() || (s.name || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const filteredColleges = collegesWithOpenCourses.filter(
    (c) => !searchQuery.trim() || (c.name || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Schools & Colleges – Open Admissions</h1>
        <p className="text-sm text-slate-600 mt-1">View schools and colleges with admissions currently open.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
        <input
          type="text"
          placeholder="Search institution..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-64 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : (
        <>
          {/* Schools section */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Schools</h2>
            {filteredSchools.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                {schoolsWithOpenAdmissions.length === 0 ? 'No schools with open admissions' : 'No schools match your search'}
              </div>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {filteredSchools.map((school) => {
            const display = getAdmissionsDisplayByBoard(school);
            return (
              <div
                key={school.id || school._id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5"
              >
                <div className="flex items-start gap-3 mb-4">
                  {school.logoUrl ? (
                    <img
                      src={school.logoUrl}
                      alt=""
                      className="w-12 h-12 rounded-xl object-contain bg-slate-100 border border-slate-200 shrink-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <span className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-500 shrink-0">
                      {(school.name || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 truncate">{school.name}</h3>
                    <p className="text-sm text-slate-500 truncate">
                      {[school.city, school.state].filter(Boolean).join(', ') || '—'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="font-medium text-slate-800">Admissions open</p>
                  {display.type === 'byBoard' ? (
                    <div className="space-y-1.5">
                      {display.boards.map(({ board, openGrades }) => (
                        <p key={board} className="text-slate-700">
                          <span className="font-medium text-slate-800">{board}:</span>{' '}
                          {openGrades.length > 0 ? (
                            <span className="text-emerald-700 font-medium">Grades {openGrades.join(', ')}</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </p>
                      ))}
                      {display.openStreams && display.openStreams.length > 0 && (
                        <p className="text-slate-700 pt-1">
                          <span className="font-medium text-slate-800">Streams:</span>{' '}
                          <span className="text-emerald-700 font-medium">{display.openStreams.join(', ')}</span>
                        </p>
                      )}
                    </div>
                  ) : display.type === 'grades' ? (
                    <>
                      <p className="text-emerald-700 font-medium">
                        Open: {display.list.join(', ')}
                      </p>
                      {Array.isArray(school?.admissionsOpenStreams) && school.admissionsOpenStreams.length > 0 && (
                        <p className="text-slate-700 mt-1">
                          <span className="font-medium text-slate-800">Streams:</span>{' '}
                          <span className="text-emerald-700 font-medium">{school.admissionsOpenStreams.join(', ')}</span>
                        </p>
                      )}
                    </>
                  ) : display.openRanges.length > 0 ? (
                    <>
                      <p className="text-emerald-700 font-medium">
                        Open: {display.openRanges.join(', ')}
                      </p>
                      {display.closedRanges.length > 0 && (
                        <p className="text-slate-500">Closed: {display.closedRanges.join(', ')}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-500">None (all closed)</p>
                  )}
                  {Array.isArray(school?.admissionsOpenStreams) && school.admissionsOpenStreams.length > 0 && display.type !== 'byBoard' && display.type !== 'grades' && (
                    <p className="text-slate-700 mt-1">
                      <span className="font-medium text-slate-800">Streams:</span>{' '}
                      <span className="text-emerald-700 font-medium">{school.admissionsOpenStreams.join(', ')}</span>
                    </p>
                  )}
                  {school.boardGradeMap && typeof school.boardGradeMap === 'object' && Object.keys(school.boardGradeMap).length > 0 && display.type !== 'byBoard' && (
                    <p className="text-slate-600 mt-2">
                      Boards: {Object.keys(school.boardGradeMap).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
              </div>
            )}
          </div>

          {/* Colleges with open admissions section */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Colleges</h2>
            {filteredColleges.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                {collegesWithOpenCourses.length === 0 ? 'No colleges with open admissions' : 'No colleges match your search'}
              </div>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {filteredColleges.map((college) => {
                  const openCourses = (college.courses || []).filter((c) => c.admissionsOpen === true);
                  return (
                    <div
                      key={college.id || college._id}
                      className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5"
                    >
                      <div className="flex items-start gap-3 mb-4">
                        {college.logoUrl ? (
                          <img
                            src={college.logoUrl}
                            alt=""
                            className="w-12 h-12 rounded-xl object-contain bg-slate-100 border border-slate-200 shrink-0"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <span className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-500 shrink-0">
                            {(college.name || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-slate-900 truncate">{college.name}</h3>
                          <p className="text-sm text-slate-500 truncate">
                            {[college.city, college.state].filter(Boolean).join(', ') || '—'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <p className="font-medium text-slate-800">Admissions open – courses</p>
                        {openCourses.length > 0 ? (
                          <ul className="space-y-1">
                            {openCourses.map((c) => (
                              <li key={c.id || c._id} className="text-emerald-700 font-medium">
                                • {c.name}{c.code ? ` (${c.code})` : ''}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-slate-500">None</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CounselorSchools;

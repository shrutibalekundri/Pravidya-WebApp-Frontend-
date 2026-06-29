/**
 * Reusable grade selection: all grades 1–12 in one line (Select All + Grade 1 … Grade 12).
 * Value still uses primary/middle/high for compatibility.
 * value: { primary: number[], middle: number[], high: number[] }
 * onChange: (value) => void
 */
const PRIMARY_GRADES = [1, 2, 3, 4, 5];
const MIDDLE_GRADES = [6, 7, 8, 9, 10];
const HIGH_GRADES = [11, 12];
const ALL_GRADES = [...PRIMARY_GRADES, ...MIDDLE_GRADES, ...HIGH_GRADES];

const defaultGradeValue = () => ({
  primary: [],
  middle: [],
  high: [],
});

function sectionForGrade(g) {
  if (g >= 1 && g <= 5) return 'primary';
  if (g >= 6 && g <= 10) return 'middle';
  if (g >= 11 && g <= 12) return 'high';
  return 'primary';
}

export function BoardGradeSelector({ value, onChange }) {
  const v = value && typeof value === 'object' ? value : defaultGradeValue();
  const primary = Array.isArray(v.primary) ? v.primary : [];
  const middle = Array.isArray(v.middle) ? v.middle : [];
  const high = Array.isArray(v.high) ? v.high : [];
  const selectedSet = new Set([...primary, ...middle, ...high]);

  const toggleGrade = (grade) => {
    const section = sectionForGrade(grade);
    const arr = [...(v[section] || [])];
    const idx = arr.indexOf(grade);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(grade);
    arr.sort((a, b) => a - b);
    onChange({ ...v, [section]: arr });
  };

  const selectAll = (checked) => {
    onChange({
      ...v,
      primary: checked ? [...PRIMARY_GRADES] : [],
      middle: checked ? [...MIDDLE_GRADES] : [],
      high: checked ? [...HIGH_GRADES] : [],
    });
  };

  const allSelected = ALL_GRADES.every((g) => selectedSet.has(g));
  const someSelected = ALL_GRADES.some((g) => selectedSet.has(g));

  const selectSection = (section, checked) => {
    const grades = section === 'primary' ? PRIMARY_GRADES : section === 'middle' ? MIDDLE_GRADES : HIGH_GRADES;
    onChange({
      ...v,
      [section]: checked ? [...grades] : [],
    });
  };

  const sections = [
    { key: 'primary', label: 'Primary (1–5)', grades: PRIMARY_GRADES },
    { key: 'middle', label: 'Middle (6–10)', grades: MIDDLE_GRADES },
    { key: 'high', label: 'High (11–12)', grades: HIGH_GRADES },
  ];

  return (
    <div className="space-y-3 p-3 rounded-xl border border-gray-200 bg-gray-50/50">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 shrink-0">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => el && (el.indeterminate = someSelected && !allSelected)}
            onChange={() => selectAll(!allSelected)}
            className="rounded"
          />
          <span>Select All</span>
        </label>
        <span className="text-gray-500 text-sm">(Grades 1–12)</span>
      </div>
      {sections.map(({ key, label, grades }) => {
        const sectionSelected = grades.filter((g) => selectedSet.has(g)).length;
        const sectionAll = sectionSelected === grades.length;
        const sectionSome = sectionSelected > 0;
        return (
          <div key={key} className="space-y-2">
            <label className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={sectionAll}
                ref={(el) => el && (el.indeterminate = sectionSome && !sectionAll)}
                onChange={() => selectSection(key, !sectionAll)}
                className="rounded"
              />
              <span>{label}</span>
            </label>
            <div className="flex flex-wrap gap-2 pl-5">
              {grades.map((g) => (
                <label key={g} className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(g)}
                    onChange={() => toggleGrade(g)}
                    className="rounded"
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
}

export const defaultBoardGradeMapValue = () => ({ primary: [], middle: [], high: [] });

/** Return summary string e.g. "Primary & High" from value */
export function gradeSummary(value) {
  if (!value || typeof value !== 'object') return '';
  const parts = [];
  if (Array.isArray(value.primary) && value.primary.length > 0) parts.push('Primary');
  if (Array.isArray(value.middle) && value.middle.length > 0) parts.push('Middle');
  if (Array.isArray(value.high) && value.high.length > 0) parts.push('High');
  return parts.join(' & ') || '';
}

/** Check if at least one grade is selected */
export function hasAnyGrade(value) {
  if (!value || typeof value !== 'object') return false;
  const p = Array.isArray(value.primary) && value.primary.length > 0;
  const m = Array.isArray(value.middle) && value.middle.length > 0;
  const h = Array.isArray(value.high) && value.high.length > 0;
  return p || m || h;
}

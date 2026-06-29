/**
 * Download call notes content as a .txt file.
 * @param {string} content - Full text of the call summary
 * @param {string} filename - e.g. Counselling_Call_Notes_LEAD-001_2026-03-05.txt
 */
export function downloadCallNotes(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

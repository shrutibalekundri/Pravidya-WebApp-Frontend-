/**
 * Simple sessionStorage cache for counselor panel tabs.
 * When switching tabs, show cached data immediately (if fresh) then refetch in background.
 * Shares leads cache with Dashboard (counselor_leads_${id}) for instant load when navigating.
 */
const CACHE_PREFIX = 'counselor_tab_';
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
const LEADS_CACHE_KEY = 'counselor_leads';

export function getCached(key) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_MAX_AGE_MS) return null;
    return data;
  } catch (_) {
    return null;
  }
}

export function setCached(key, data) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch (_) {}
}

/** Shared with Dashboard: same key so My Leads can show Dashboard cache instantly */
export function getCachedLeads(counselorId) {
  if (!counselorId) return null;
  try {
    const raw = sessionStorage.getItem(`${LEADS_CACHE_KEY}_${counselorId}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_MAX_AGE_MS) return null;
    return Array.isArray(data) ? data : null;
  } catch (_) {
    return null;
  }
}

export function setCachedLeads(counselorId, data) {
  if (!counselorId) return;
  try {
    sessionStorage.setItem(`${LEADS_CACHE_KEY}_${counselorId}`, JSON.stringify({ data: data || [], ts: Date.now() }));
  } catch (_) {}
}

export function isCached(key) {
  return getCached(key) !== null;
}

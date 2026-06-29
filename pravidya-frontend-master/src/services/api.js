import axios from 'axios';

// Backend may auto-shift from 5000 → 50001 when port is busy (see backend log).
// Prefer explicit VITE_API_URL; otherwise default to 50001 for local dev.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:50001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // required so SaaS login cookie (saas_token) is sent on /saas/dashboard etc.
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 404 && import.meta.env.DEV) {
      // Debug 404 in development only
      console.error('404 Error:', error.config?.url);
    }
    
    const url = error.config?.url ?? '';
    const isGetMe = url.includes('auth/me');
    const isLoginRequest =
      url.includes('auth/login') ||
      url.includes('/super-admin/auth/login') ||
      url.includes('/saas/login');
    const isSaasRequest = url.includes('/saas/');
    const isOnboardingRequest =
      url.includes('/super-admin/institutions') ||
      url.includes('/super-admin/staff') ||
      url.includes('/super-admin/onboarding/send-email');
    // Don't clear/redirect on 401 for login, getMe, onboarding flow, or SaaS flows
    // (SaaS login pages should show inline errors instead of bouncing to staff portal)
    if (error.response?.status === 401 && !isGetMe && !isLoginRequest && !isOnboardingRequest && !isSaasRequest) {
      const path = window.location.pathname || '';
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = path.startsWith('/super-admin') ? '/super-admin/login' : '/pravidya/acme/veeman/login';
    }

    // Handle 404 with better error message
    if (error.response?.status === 404) {
      const message = error.response?.data?.message || 'Route not found';
      error.message = message;
    }
    
    return Promise.reject(error);
  }
);

// Super Admin APIs
export const superAdminAPI = {
  login: (institutionId, email, password) =>
    api.post('/super-admin/auth/login', { institutionId, email, password }, { timeout: 15000 }),
  seedPlatform: (email, password) =>
    api.post('/super-admin/auth/seed-platform', { email, password }, { timeout: 15000 }),
  getInstitutions: (params) => api.get('/super-admin/institutions', { params }),
  getInstitution: (id) => api.get(`/super-admin/institutions/${id}`),
  createInstitution: (data) => api.post('/super-admin/institutions', data),
  updateInstitution: (id, data) => api.put(`/super-admin/institutions/${id}`, data),
  getStaff: (params) => api.get('/super-admin/staff', { params }),
  getStaffSettings: () => api.get('/super-admin/staff/settings'),
  createStaff: (data) => api.post('/super-admin/staff', data),
  updateStaff: (id, data) => api.patch(`/super-admin/staff/${id}`, data),
  getDashboard: () => api.get('/super-admin/dashboard'),
};

// Auth APIs
export const authAPI = {
  login: (username, password, role = null) => {
    const path = role === 'ADMIN' ? '/auth/admin/login' : role === 'MANAGEMENT' ? '/auth/management/login' : '/auth/login';
    return api.post(path, { username, password }, { timeout: 15000 });
  },
  getMe: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Lead APIs
export const leadAPI = {
  create: (data) => api.post('/leads', data),
  getAll: (params) => api.get('/leads', { params }),
  search: (query, params = {}) => api.get('/leads/search', { params: { q: query, ...params } }),
  exportTemplate: () =>
    api.get('/leads/export-template', { responseType: 'blob' }),
  export: (params) =>
    api.get('/leads/export', { params, responseType: 'blob' }),
  import: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/leads/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importPreview: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/leads/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importExecute: (file, duplicateDecisions = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('duplicateDecisions', JSON.stringify(duplicateDecisions));
    return api.post('/leads/import/execute', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importErrorReport: (errorReportRows) =>
    api.post('/leads/import/error-report', { errorReportRows }, { responseType: 'blob' }),
  getFormFields: () => api.get('/leads/form-fields'),
  getCreateLeadFormFields: () => api.get('/leads/form-fields', { params: { form: 'createLead' } }),
  getById: (id) => api.get(`/leads/${id}`),
  getByLeadId: (leadId) => api.get(`/leads/by-lead-id/${encodeURIComponent(leadId)}`),
  delete: (id) => api.delete(`/leads/${id}`),
  update: (id, data) => api.put(`/leads/${id}`, data),
  getCallDispositions: () => api.get('/leads/call-dispositions'),
  logCall: (id, data) => api.post(`/leads/${id}/call`, data),
  assign: (id, counselorId, reason) =>
    api.post(`/leads/${id}/assign`, { counselorId, reason }),
  autoAssign: (id) => api.post(`/leads/${id}/auto-assign`),
  autoAssignRoundRobin: (id) => api.post(`/leads/${id}/auto-assign-round-robin`),
  getAvailableCounselors: (params) => api.get('/leads/available-counselors', { params }),
  getStats: () => api.get('/leads/stats/overview'),
};

// Counselor APIs
export const counselorAPI = {
  getAll: (params) => api.get('/counselors', { params }),
  getAllForAssignment: () => api.get('/counselors/all'), // Get ALL counselors for manual assignment
  export: () =>
    api.get('/counselors/export', { responseType: 'blob' }),
  exportTemplate: () =>
    api.get('/counselors/export-template', { responseType: 'blob' }),
  import: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/counselors/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getMe: () => api.get('/counselors/me'),
  getById: (id) => api.get(`/counselors/${id}`),
  create: (data) => api.post('/counselors', data),
  update: (id, data) => api.put(`/counselors/${id}`, data),
  delete: (id) => api.delete(`/counselors/${id}`),
  getLeads: (id) => api.get(`/counselors/${id}/leads`),
  getStats: (id) => api.get(`/counselors/${id}/stats`),
  getDailyPriority: (id) => api.get(`/counselors/${id}/daily-priority`),
  getNewLeadsCount: (id) => api.get(`/counselors/${id}/new-leads-count`),
  getMeetLink: (counselorId) => api.get(`/counselor/meet-link/${counselorId}`),
  saveMeetLink: (counselorId, meetLink) => api.post('/counselor/save-meet-link', { counselorId, meetLink }),
  getGoogleMeetAuthUrl: (counselorId) => api.get('/counselor/google-meet-auth-url', { params: { counselorId } }),
  filterByLanguage: (language, availability) => api.get('/counselors/filter', { 
    params: { language, availability } 
  }),
  chatbot: (message) => api.post('/counselor/chatbot', { message }),
  getHistoricalAnalytics: (params) => api.get('/historical-analytics', { params }),
  voiceCall: {
    getMasterOptions: (categories) => {
      const list = Array.isArray(categories) ? categories : (categories ? [categories] : []);
      return api.get('/counselors/voice-call/master-options', {
        params: { categories: list.join(',') },
      });
    },
    save: (data) => api.post('/counselors/voice-call/save', data),
    getCallHistory: (leadId) => api.get(`/counselors/voice-call/call-history/${leadId}`),
  },
};

// SaaS Academy APIs (multi-tenant onboarding & login)
export const saasAPI = {
  // Encode academyId so IDs like PRV-F-000018 are sent correctly in the path
  getLicense: (academyId) =>
    api.get(`/saas/license/${encodeURIComponent(String(academyId || '').trim())}`),
  checkAdmin: (academyId) =>
    api.get(`/saas/admin-exists/${encodeURIComponent(String(academyId || '').trim())}`),
  onboard: (payload) => api.post('/saas/onboard', payload),
  login: (payload) => api.post('/saas/login', payload),
  getDashboard: () => api.get('/saas/dashboard'),
  // Pravidya onboarding (first-time school setup from Jeetofy)
  getPravidyaStatus: () => api.get('/saas/pravidya/status'),
  onboardPravidya: (payload) => api.post('/saas/pravidya/onboard', payload),
};

// Institution APIs
export const institutionAPI = {
  getAll: (params) => api.get('/institutions', { params }),
  getById: (id) => api.get(`/institutions/${id}`),
  create: (data) => api.post('/institutions', data),
  update: (id, data) => api.put(`/institutions/${id}`, data),
  delete: (id, options = {}) => {
    const qs = options.force ? '?force=true' : '';
    return api.delete(`/institutions/${id}${qs}`);
  },
  // Single-tenant admin panel (one institution per admin)
  getMe: () => api.get('/institution/me'),
  updateMe: (data) => api.put('/institution/me', data),
};

// Classes APIs (single-tenant; scoped by logged-in user's institution)
export const classAPI = {
  getAll: () => api.get('/classes'),
  create: (data) => api.post('/classes', data),
  update: (id, data) => api.put(`/classes/${id}`, data),
  delete: (id) => api.delete(`/classes/${id}`),
};

// Course APIs
export const courseAPI = {
  getAll: (params) => api.get('/courses', { params }),
  getAllGrouped: (params) => api.get('/courses', { params: { ...params, grouped: 'true' } }),
  getById: (id) => api.get(`/courses/${id}`),
  create: (data) => api.post('/courses', data),
  update: (id, data) => api.put(`/courses/${id}`, data),
  updateAdmissionsOpen: (id, admissionsOpen) =>
    api.patch(`/courses/${id}/admissions-open`, { admissionsOpen }),
  delete: (id) => api.delete(`/courses/${id}`),
};

// Session APIs
export const sessionAPI = {
  getAll: (params) => api.get('/sessions', { params }),
  getById: (id) => api.get(`/sessions/${id}`),
  getCounts: () => api.get('/sessions/counts'),
  create: (data) => api.post('/sessions', data),
  update: (id, data) => api.put(`/sessions/${id}`, data),
  delete: (id) => api.delete(`/sessions/${id}`),
  reschedule: (id, data) => api.post(`/sessions/${id}/reschedule`, data),
  retry: (id, data) => api.post(`/sessions/${id}/retry`, data),
};

// Parent feedback
export const feedbackAPI = {
  send: (leadId) => api.post('/feedback/send', { leadId }),
  getForm: (token) => api.get(`/feedback/form/${token}`),
  submit: (payload) => api.post('/feedback/submit', payload),
  getAnalytics: () => api.get('/feedback/analytics'),
  getAll: (params) => api.get('/feedback', { params }),
  getById: (id) => api.get(`/feedback/${id}`),
};

// Training APIs
export const trainingAPI = {
  getAll: (params) => api.get('/training', { params }),
  getById: (id) => api.get(`/training/${id}`),
  create: (formData) => api.post('/training', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`/training/${id}`, data),
  delete: (id) => api.delete(`/training/${id}`),
};

// Todo APIs
export const todoAPI = {
  getAll: (params) => api.get('/todos', { params }),
  getById: (id) => api.get(`/todos/${id}`),
  create: (data) => api.post('/todos', data),
  update: (id, data) => api.put(`/todos/${id}`, data),
  delete: (id) => api.delete(`/todos/${id}`),
};

// Admin APIs
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getActivityLogs: (params) => api.get('/admin/activity-logs', { params }),
  getLeadsBySource: () => api.get('/admin/analytics/leads-by-source'),
  createUser: (data) => api.post('/admin/users', data),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.put('/admin/settings', data),
  getAlerts: (params) => api.get('/admin/alerts', { params }),
  resolveAlert: (id) => api.post(`/admin/alerts/${id}/resolve`),
  getHistoricalAnalytics: (params) => api.get('/historical-analytics', { params }),
};

// School APIs (Phase-1)
export const schoolAPI = {
  getAll: (params) => api.get('/schools', { params }),
  getById: (id) => api.get(`/schools/${id}`),
  create: (data) => api.post('/schools', data),
  update: (id, data) => api.put(`/schools/${id}`, data),
  delete: (id) => api.delete(`/schools/${id}`),
  addPocket: (id, data) => api.post(`/schools/${id}/pockets`, data),
};

// Presence APIs (Phase-1)
export const presenceAPI = {
  recordLogin: () => api.post('/presence/login'),
  updateActivity: () => api.post('/presence/activity'),
  getStatus: (counselorId) => api.get('/presence/status', { params: { counselorId } }),
  clockIn: () => api.post('/presence/clock-in'),
  clockOut: () => api.post('/presence/clock-out'),
  breakStart: (payload) => api.post('/presence/break-start', payload),
  breakEnd: () => api.post('/presence/break-end'),
  getActive: () => api.get('/presence/active'),
  getAllStatus: () => api.get('/presence/all-status'),
  getAttendance: (date) => api.get('/presence/attendance', { params: { date } }),
  getAbsent: (date) => api.get('/presence/absent', { params: { date } }),
  checkInactivity: (counselorId) => api.post('/presence/check-inactivity', { counselorId }),
  checkAllInactivity: () => api.post('/presence/check-all-inactivity'),
  getInactivityAlerts: () => api.get('/presence/inactivity-alerts'),
};

// Training Module APIs (Phase-1)
export const trainingModuleAPI = {
  getAll: (params) => api.get('/training-modules', { params }),
  getById: (id) => api.get(`/training-modules/${id}`),
  create: (formData) => api.post('/training-modules', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`/training-modules/${id}`, data),
  delete: (id) => api.delete(`/training-modules/${id}`),
  updateProgress: (id, status) => api.post(`/training-modules/${id}/progress`, { status }),
  getProgress: (id) => api.get(`/training-modules/${id}/progress`),
};

// Question-Response APIs (Phase-1)
export const questionAPI = {
  getAll: (params) => api.get('/questions', { params }),
  getById: (id) => api.get(`/questions/${id}`),
  create: (data) => api.post('/questions', data),
  update: (id, data) => api.put(`/questions/${id}`, data),
  delete: (id) => api.delete(`/questions/${id}`),
  submitResponse: (id, data) => api.post(`/questions/${id}/responses`, data),
  addScore: (responseId, data) => api.post(`/responses/${responseId}/scores`, data),
  getCounselorResponses: (counselorId) => api.get(`/counselors/${counselorId}/responses`),
};

// Management APIs (Phase-1)
export const managementAPI = {
  getDashboard: () => api.get('/management/dashboard'),
  getAttendanceReport: (params) => api.get('/management/attendance-report', { params }),
  getReleasedAppointments: () => api.get('/management/released-appointments'),
  reassignAppointment: (data) => api.post('/management/reassign-appointment', data),
  getCounselorPerformance: (counselorId) => api.get('/management/counselor-performance', { params: { counselorId } }),
  // Analytics (read-only)
  getOverview: (params) => api.get('/management/analytics/overview', { params }),
  getAnalyticsDashboard: (params) => api.get('/management/analytics/dashboard', { params }),
  getCounselors: (params) => api.get('/management/analytics/counselors', { params }),
  getCounselorDetail: (id) => api.get(`/management/analytics/counselors/${id}`),
  getInstitutions: (params) => api.get('/management/analytics/institutions', { params }),
  getLeads: (params) => api.get('/management/analytics/leads', { params }),
  getRevenue: (params) => api.get('/management/analytics/revenue', { params }),
  getAlerts: () => api.get('/management/analytics/alerts'),
  resolveAlert: (id) => api.post(`/management/analytics/alerts/${id}/resolve`),
  getHistoricalAnalytics: (params) => api.get('/historical-analytics', { params }),
};

// Historical Admissions & Publicity (Admin)
export const historicalFilesAPI = {
  upload: (formData) => api.post('/historical-files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getList: (params) => api.get('/historical-files', { params }),
  getStats: () => api.get('/historical-files/stats'),
  getAnalytics: (params) => api.get('/historical-files/analytics', { params }),
  getById: (id) => api.get(`/historical-files/${id}`),
  delete: (id) => api.delete(`/historical-files/${id}`),
  verify: (id) => api.put(`/historical-files/verify/${id}`),
  lock: (id) => api.put(`/historical-files/lock/${id}`),
};

// Historical Admissions & Marketing Intelligence
export const historicalMarketingAPI = {
  getTemplate: () => api.get('/historical-marketing/template', { responseType: 'blob' }),
  importPreview: (formData) => api.post('/historical-marketing/import/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  importExecute: (data) => api.post('/historical-marketing/import/execute', data),
  photoOcrPreview: (formData) => api.post('/historical-marketing/photo-ocr/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  photoOcrSave: (data) => api.post('/historical-marketing/photo-ocr/save', data),
  getList: (params) => api.get('/historical-marketing', { params }),
  getTrends: (params) => api.get('/historical-marketing/trends', { params }),
  getRecommendations: (params) => api.get('/historical-marketing/recommendations', { params }),
  getDashboard: (params) => api.get('/historical-marketing/dashboard', { params }),
  updateStatus: (id, status) => api.put(`/historical-marketing/${id}/status`, { status }),
  delete: (id) => api.delete(`/historical-marketing/${id}`),
  exportExcel: (params) => api.get('/historical-marketing/export/excel', { params, responseType: 'blob' }),
  exportPdf: (params) => api.get('/historical-marketing/export/pdf', { params, responseType: 'text' }),
  getOptions: () => api.get('/historical-marketing/options'),
};

// Historical Data & Verification (admin upload → verify → counselor sees verified only)
export const historicalVerificationAPI = {
  upload: (formData) =>
    api.post('/historical/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getPending: () => api.get('/historical/pending'),
  getAll: (params) => api.get('/historical/all', { params }),
  getById: (id) => api.get(`/historical/${id}`),
  approve: (id) => api.put(`/historical/${id}/approve`),
  reject: (id, reason) => api.put(`/historical/${id}/reject`, { rejectionReason: reason }),
  getCounselorData: () => api.get('/historical/counselor-data'),
  getCounselorView: (id) => api.get(`/historical/counselor-view/${id}`),
};

// Historical Admissions entries (Admissions / Marketing / Publicity)
export const historicalAdmissionAPI = {
  getOptions: () => api.get('/historical-admissions/options'),
  getList: (params) => api.get('/historical-admissions', { params }),
  getById: (id) => api.get(`/historical-admissions/${id}`),
  create: (data) => api.post('/historical-admissions', data),
  update: (id, data) => api.put(`/historical-admissions/${id}`, data),
  lock: (id) => api.post(`/historical-admissions/${id}/lock`),
  unlock: (id) => api.post(`/historical-admissions/${id}/unlock`),
  uploadDocumentsOnly: (id, formData) =>
    api.post(`/historical-admissions/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  preview: (formData) => api.post('/historical-admissions/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// Intelligence APIs (Central LLM engine)
export const intelligenceAPI = {
  getSources: (params) => api.get('/intelligence/sources', { params }),
  /** Fetch file blob for viewing; use responseType 'blob' and open URL in new tab. */
  viewSource: (sourceId) => api.get(`/intelligence/sources/${sourceId}/view`, { responseType: 'blob' }),
  upload: (file, organizationId) => {
    const formData = new FormData();
    formData.append('file', file);
    if (organizationId) formData.append('organizationId', organizationId);
    return api.post('/intelligence/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  train: (sourceId) => api.post('/intelligence/train', { sourceId }),
  query: (query) => api.post('/intelligence/query', { query }),
  /** Stream response; calls onChunk(text) as data arrives, resolves with full answer when done. */
  async queryStream(query, { onChunk }) {
    const baseURL = api.defaults.baseURL || '';
    const url = `${baseURL}/intelligence/query`;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: query.trim(), stream: true }),
      credentials: 'include',
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Query failed');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullAnswer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              fullAnswer += data.text;
              onChunk?.(data.text);
            }
            if (data.error) throw new Error(data.error);
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }
    return fullAnswer;
  },
  requestRetrain: (query) => api.post('/intelligence/retrain-request', { query }),
};

export default api;

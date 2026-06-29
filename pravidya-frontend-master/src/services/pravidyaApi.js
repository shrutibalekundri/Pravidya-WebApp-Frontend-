import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const pravidyaApi = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

pravidyaApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (e) => Promise.reject(e)
);

export const pravidyaAcademyAPI = {
  getBySlug: (slug) => pravidyaApi.get(`/academy/${slug}`),
};

export const pravidyaAuthAPI = {
  login: (data) => pravidyaApi.post('/pravidya/auth/login', data),
  verifyOtp: (data) => pravidyaApi.post('/pravidya/auth/verify-otp', data),
  resendOtp: (data) => pravidyaApi.post('/pravidya/auth/resend-otp', data),
  getMe: () => pravidyaApi.get('/pravidya/auth/me'),
  logout: () => pravidyaApi.post('/pravidya/auth/logout'),
  forgotPassword: (data) => pravidyaApi.post('/pravidya/auth/forgot-password', data),
  resetPassword: (data) => pravidyaApi.post('/pravidya/auth/reset-password', data),
};

export const pravidyaLeadsAPI = {
  create: (data) => pravidyaApi.post('/pravidya/leads/create', data),
};

import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const AI_TIMEOUT_MS = 95000;
const DOCUMENT_TIMEOUT_MS = 140000;

const apiClient = axios.create({
  baseURL,
  timeout: 30000,
});

export const TOKEN_KEY = 'rm_auth_token';

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } }
};

// Attach the session token to every API call
apiClient.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Add a response interceptor to gracefully handle timeouts and network errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Expired or invalid session: tell the app to return to the login screen
    if (error.response?.status === 401 && !error.config?.url?.includes('/api/auth/login')) {
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent('auth:expired', { detail: error.response.data?.message }));
    }
    if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
      return Promise.reject({
        response: {
          data: {
            success: false,
            message: 'Request timed out. Please try again.'
          }
        }
      });
    }
    if (error.message === 'Network Error') {
      return Promise.reject({
        response: {
          data: {
            success: false,
            message: 'Unable to connect to the Banking AI service.'
          }
        }
      });
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Customers
  getCustomers: () => apiClient.get('/api/customers'),
  getCustomerById: (id) => apiClient.get(`/api/customers/${id}`),
  getCustomer360: (id) => apiClient.get(`/api/customer360/${id}`),

  // Bank-wide
  getBankSummary: () => apiClient.get('/api/bank/summary'),
  getPortfolioInsights: () => apiClient.get('/api/insights/portfolio'),

  // Auth
  login: (userId, password) => apiClient.post('/api/auth/login', { userId, password }),
  me: () => apiClient.get('/api/auth/me'),
  
  // AI Modules
  // AI calls get longer than the backend's AI time budget (80s / 110s) so the server always answers first
  runG1: (customerId) => apiClient.post(`/api/ai/g1/${customerId}`, null, { timeout: AI_TIMEOUT_MS }),
  runG2: (customerId, payload) => apiClient.post(`/api/ai/g2/${customerId}`, payload, { timeout: AI_TIMEOUT_MS }),
  runG3: (formData) => apiClient.post(`/api/ai/g3`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: DOCUMENT_TIMEOUT_MS // OCR + extraction can be slow
  }),
  runG4: (customerId) => apiClient.post(`/api/ai/g4/${customerId}`, null, { timeout: AI_TIMEOUT_MS }),
  
  // History
  getHistory: (params) => apiClient.get('/api/history', { params }),
  getHistoryDetail: (id) => apiClient.get(`/api/history/${id}`)
};

export default apiClient;

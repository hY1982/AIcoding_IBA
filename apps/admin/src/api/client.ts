import axios, { InternalAxiosRequestConfig } from 'axios';

const baseURL =
  (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) ||
  'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function authInterceptor(config: InternalAxiosRequestConfig) {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

apiClient.interceptors.request.use(authInterceptor);

export default apiClient;

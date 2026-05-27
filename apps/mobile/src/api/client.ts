import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const requestFulfilled = (config: InternalAxiosRequestConfig) => {
  // TODO: inject auth token from store when available
  return config;
};

export const requestRejected = (error: unknown) => Promise.reject(error);

export const responseFulfilled = (response: AxiosResponse) => response;

export const responseRejected = (error: unknown) => {
  // TODO: unified error handling (e.g., refresh token, logout)
  return Promise.reject(error);
};

apiClient.interceptors.request.use(requestFulfilled, requestRejected);
apiClient.interceptors.response.use(responseFulfilled, responseRejected);

export default apiClient;

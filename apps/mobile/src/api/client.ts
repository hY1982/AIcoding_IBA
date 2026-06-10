import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { secureStorage } from '@/utils/secureStorage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const requestFulfilled = async (config: InternalAxiosRequestConfig) => {
  try {
    const accessToken = await secureStorage.getItemAsync('accessToken');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  } catch {
    // SecureStore unavailable (e.g. test env), proceed without token
  }
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

import {
  apiClient,
  requestFulfilled,
  requestRejected,
  responseFulfilled,
  responseRejected,
} from './client';
import { InternalAxiosRequestConfig, AxiosResponse } from 'axios';

describe('API Client', () => {
  it('should create an axios instance', () => {
    expect(apiClient).toBeDefined();
  });

  it('should have correct baseURL', () => {
    expect(apiClient.defaults.baseURL).toBe('http://localhost:3000/api/v1');
  });

  it('should have request interceptor', () => {
    expect(apiClient.interceptors.request).toBeDefined();
  });

  it('should have response interceptor', () => {
    expect(apiClient.interceptors.response).toBeDefined();
  });

  it('should have correct default headers', () => {
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
  });

  describe('Request Interceptor', () => {
    it('should pass through config without modification', async () => {
      const mockConfig = { headers: {} } as InternalAxiosRequestConfig;
      const result = await requestFulfilled(mockConfig);
      expect(result).toBe(mockConfig);
    });

    it('should reject on error', async () => {
      const mockError = new Error('Request failed');
      await expect(requestRejected(mockError)).rejects.toBe(mockError);
    });
  });

  describe('Response Interceptor', () => {
    it('should return response without modification', () => {
      const mockResponse = { data: { id: 1 }, status: 200 } as AxiosResponse;
      const result = responseFulfilled(mockResponse);
      expect(result).toBe(mockResponse);
    });

    it('should reject on error', async () => {
      const mockError = new Error('Response failed');
      await expect(responseRejected(mockError)).rejects.toBe(mockError);
    });
  });
});

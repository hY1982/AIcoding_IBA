import { apiClient } from './client';

describe('API Client', () => {
  it('should create an axios instance', () => {
    expect(apiClient).toBeDefined();
  });

  it('should have correct baseURL', () => {
    expect(apiClient.defaults.baseURL).toBe('http://localhost:3000/api/v1');
  });

  it('should have request interceptor', () => {
    const requestInterceptors = apiClient.interceptors.request;
    expect(requestInterceptors).toBeDefined();
  });

  it('should have response interceptor', () => {
    const responseInterceptors = apiClient.interceptors.response;
    expect(responseInterceptors).toBeDefined();
  });

  it('should have correct default headers', () => {
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
  });
});

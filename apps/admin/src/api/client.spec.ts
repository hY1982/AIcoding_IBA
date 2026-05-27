import { apiClient, authInterceptor } from './client';

describe('API Client', () => {
  it('should create axios instance', () => {
    expect(apiClient).toBeDefined();
    expect(apiClient.defaults.baseURL).toBeDefined();
  });

  it('should have correct default baseURL', () => {
    expect(apiClient.defaults.baseURL).toBe('http://localhost:3000/api/v1');
  });

  it('should have Content-Type header', () => {
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('should have request interceptor', () => {
    expect(apiClient.interceptors.request).toBeDefined();
  });
});

describe('authInterceptor', () => {
  afterEach(() => {
    localStorage.removeItem('token');
  });

  it('should inject token when present in localStorage', () => {
    localStorage.setItem('token', 'test-token-123');
    const config = { headers: {} } as any;
    const result = authInterceptor(config);
    expect(result.headers.Authorization).toBe('Bearer test-token-123');
  });

  it('should not inject token when localStorage is empty', () => {
    const config = { headers: {} } as any;
    const result = authInterceptor(config);
    expect(result.headers.Authorization).toBeUndefined();
  });
});

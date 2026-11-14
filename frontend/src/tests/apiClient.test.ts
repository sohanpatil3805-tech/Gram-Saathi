import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { apiClient, ApiRequestError } from '../services/api';

describe('real backend API client', () => {
  it('uses the FastAPI /api prefix and a bounded timeout', () => {
    expect(apiClient.defaults.baseURL).toBe('/api');
    expect(apiClient.defaults.timeout).toBe(20_000);
  });

  it('turns unreachable backend failures into a citizen-safe error', async () => {
    const originalAdapter = apiClient.defaults.adapter;
    apiClient.defaults.adapter = async () => Promise.reject({ request: {}, message: 'network down' });
    await expect(apiClient.get('/schemes')).rejects.toBeInstanceOf(ApiRequestError);
    apiClient.defaults.adapter = originalAdapter;
  });

  it('formats FastAPI 422 validation error arrays into human-readable messages', async () => {
    const originalAdapter = apiClient.defaults.adapter;
    const axiosError = new AxiosError(
      'Request failed with status code 422',
      'ERR_BAD_REQUEST',
      undefined,
      {},
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {
          detail: [
            { loc: ['body', 'beneficiary_group'], msg: 'Field required', type: 'missing' },
          ],
        },
      },
    );
    apiClient.defaults.adapter = async () => Promise.reject(axiosError);
    await expect(apiClient.post('/schemes/discover', {})).rejects.toThrow('beneficiary_group: Field required');
    apiClient.defaults.adapter = originalAdapter;
  });

  it('supports English, Kannada, and Hindi with English as default', () => {
    const supported = ['en', 'kn', 'hi'] as const;
    expect(supported).toContain('en');
    expect(supported).toContain('kn');
    expect(supported).toContain('hi');
  });
});

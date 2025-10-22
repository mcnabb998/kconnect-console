import {
  fetchWithTimeout,
  fetchJsonWithTimeout,
  isCategorizedError,
  NetworkErrorType,
} from '@/lib/fetchWithTimeout';

describe('fetchWithTimeout with error categorization', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const createMockResponse = (overrides: Partial<Response> = {}): Response => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: 'http://example.com',
    clone: function() { return this; },
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    json: async () => ({}),
    text: async () => '',
    ...overrides,
  } as Response);

  describe('fetchWithTimeout', () => {
    it('should return response on successful fetch', async () => {
      const mockResponse = createMockResponse({ status: 200 });
      fetchMock.mockResolvedValue(mockResponse);

      const response = await fetchWithTimeout('http://example.com');
      
      expect(response).toBe(mockResponse);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://example.com',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should categorize connection refused errors', async () => {
      const error = new Error('Failed to fetch');
      fetchMock.mockRejectedValue(error);

      await expect(fetchWithTimeout('http://example.com')).rejects.toMatchObject({
        message: expect.stringContaining('Connection refused'),
        type: NetworkErrorType.CONNECTION_REFUSED,
        troubleshooting: expect.arrayContaining([
          expect.stringContaining('Verify that Kafka Connect is running'),
        ]),
      });
    });

    it('should categorize timeout errors', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      fetchMock.mockRejectedValue(timeoutError);

      await expect(fetchWithTimeout('http://example.com', { timeout: 5000 })).rejects.toMatchObject({
        message: expect.stringContaining('took longer than 5000ms'),
        type: NetworkErrorType.TIMEOUT,
        troubleshooting: expect.arrayContaining([
          expect.stringContaining('Check if the server is under heavy load'),
        ]),
      });
    });

    it('should categorize DNS failures', async () => {
      const error = new Error('getaddrinfo ENOTFOUND example.com');
      fetchMock.mockRejectedValue(error);

      await expect(fetchWithTimeout('http://example.com')).rejects.toMatchObject({
        message: expect.stringContaining('DNS resolution failed'),
        type: NetworkErrorType.DNS_FAILURE,
        troubleshooting: expect.arrayContaining([
          expect.stringContaining('Verify the hostname is correct'),
        ]),
      });
    });

    it('should categorize SSL/TLS errors', async () => {
      const error = new Error('self-signed certificate');
      fetchMock.mockRejectedValue(error);

      await expect(fetchWithTimeout('https://example.com')).rejects.toMatchObject({
        message: expect.stringContaining('SSL/TLS error'),
        type: NetworkErrorType.SSL_TLS_ERROR,
        troubleshooting: expect.arrayContaining([
          expect.stringContaining('Verify SSL/TLS certificates'),
        ]),
      });
    });

    it('should categorize network errors', async () => {
      const error = new Error('ENETUNREACH');
      fetchMock.mockRejectedValue(error);

      await expect(fetchWithTimeout('http://example.com')).rejects.toMatchObject({
        message: expect.stringContaining('Network error'),
        type: NetworkErrorType.NETWORK_ERROR,
        troubleshooting: expect.arrayContaining([
          expect.stringContaining('Check network connectivity'),
        ]),
      });
    });

    it('should handle user-provided signal with categorization', async () => {
      const controller = new AbortController();
      const error = new Error('Failed to fetch');
      fetchMock.mockRejectedValue(error);

      await expect(
        fetchWithTimeout('http://example.com', { signal: controller.signal })
      ).rejects.toMatchObject({
        type: NetworkErrorType.CONNECTION_REFUSED,
        troubleshooting: expect.any(Array),
      });
    });

    it('should preserve original error', async () => {
      const originalError = new Error('ECONNREFUSED');
      fetchMock.mockRejectedValue(originalError);

      try {
        await fetchWithTimeout('http://example.com');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.originalError).toBe(originalError);
      }
    });

    it('should clear timeout on successful response', async () => {
      const mockResponse = createMockResponse();
      fetchMock.mockResolvedValue(mockResponse);

      const response = await fetchWithTimeout('http://example.com', { timeout: 1000 });

      expect(response).toBe(mockResponse);
      // If timeout wasn't cleared, this test would eventually fail
      // No need to advance timers, just verify successful completion
    });

    it('should use custom timeout value in error message', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      fetchMock.mockRejectedValue(timeoutError);

      try {
        await fetchWithTimeout('http://example.com', { timeout: 100 });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('100ms');
        expect(error.type).toBe(NetworkErrorType.TIMEOUT);
      }
    });
  });

  describe('fetchJsonWithTimeout', () => {
    it('should parse JSON on successful response', async () => {
      const data = { message: 'success' };
      const mockResponse = createMockResponse({
        json: async () => data,
      });
      fetchMock.mockResolvedValue(mockResponse);

      const result = await fetchJsonWithTimeout('http://example.com');
      
      expect(result).toEqual(data);
    });

    it('should categorize HTTP errors', async () => {
      const mockResponse = createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      fetchMock.mockResolvedValue(mockResponse);

      await expect(fetchJsonWithTimeout('http://example.com')).rejects.toMatchObject({
        type: NetworkErrorType.HTTP_ERROR,
        status: 500,
        statusText: 'Internal Server Error',
      });
    });

    it('should categorize network errors during JSON fetch', async () => {
      const error = new Error('ECONNREFUSED');
      fetchMock.mockRejectedValue(error);

      await expect(fetchJsonWithTimeout('http://example.com')).rejects.toMatchObject({
        type: NetworkErrorType.CONNECTION_REFUSED,
        troubleshooting: expect.any(Array),
      });
    });

    it('should include Content-Type header', async () => {
      const mockResponse = createMockResponse({
        json: async () => ({}),
      });
      fetchMock.mockResolvedValue(mockResponse);

      await fetchJsonWithTimeout('http://example.com');
      
      const [, options] = fetchMock.mock.calls[0];
      expect((options as RequestInit)?.headers).toMatchObject({
        'Content-Type': 'application/json',
      });
    });

    it('should merge custom headers with Content-Type', async () => {
      const mockResponse = createMockResponse({
        json: async () => ({}),
      });
      fetchMock.mockResolvedValue(mockResponse);

      await fetchJsonWithTimeout('http://example.com', {
        headers: {
          'Authorization': 'Bearer token',
        },
      });
      
      const [, options] = fetchMock.mock.calls[0];
      expect((options as RequestInit)?.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token',
      });
    });
  });

  describe('isCategorizedError', () => {
    it('should identify categorized errors', async () => {
      const error = new Error('ECONNREFUSED');
      fetchMock.mockRejectedValue(error);

      try {
        await fetchWithTimeout('http://example.com');
        fail('Should have thrown');
      } catch (err) {
        expect(isCategorizedError(err)).toBe(true);
        if (isCategorizedError(err)) {
          expect(err.categorized.type).toBe(NetworkErrorType.CONNECTION_REFUSED);
        }
      }
    });

    it('should return false for regular errors', () => {
      const error = new Error('Regular error');
      expect(isCategorizedError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isCategorizedError('string')).toBe(false);
      expect(isCategorizedError(null)).toBe(false);
      expect(isCategorizedError(undefined)).toBe(false);
      expect(isCategorizedError({})).toBe(false);
    });

    it('should handle errors with wrong categorized type', () => {
      const error = new Error('test');
      (error as any).categorized = 'not an object';
      expect(isCategorizedError(error)).toBe(false);
    });
  });

  describe('error message enhancement', () => {
    it('should include URL in timeout error message', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      fetchMock.mockRejectedValue(timeoutError);

      try {
        await fetchWithTimeout('http://example.com:8080/api/test', { timeout: 2000 });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('http://example.com:8080/api/test');
        expect(error.message).toContain('2000ms');
      }
    });

    it('should preserve categorized data through error chain', async () => {
      const error = new Error('ECONNREFUSED');
      fetchMock.mockRejectedValue(error);

      try {
        await fetchWithTimeout('http://example.com');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.categorized).toBeDefined();
        expect(err.type).toBe(NetworkErrorType.CONNECTION_REFUSED);
        expect(err.troubleshooting).toBeInstanceOf(Array);
        expect(err.originalError).toBe(error);
      }
    });
  });

  describe('integration with different error scenarios', () => {
    const errorScenarios = [
      {
        name: 'Kafka Connect not running',
        error: new Error('Failed to fetch'),
        expectedType: NetworkErrorType.CONNECTION_REFUSED,
        expectedInMessage: 'Connection refused',
      },
      {
        name: 'Network timeout',
        error: Object.assign(new Error('Timeout'), { name: 'AbortError' }),
        expectedType: NetworkErrorType.TIMEOUT,
        expectedInMessage: 'timeout',
      },
      {
        name: 'Invalid hostname',
        error: new Error('getaddrinfo ENOTFOUND invalid.example.com'),
        expectedType: NetworkErrorType.DNS_FAILURE,
        expectedInMessage: 'DNS resolution failed',
      },
      {
        name: 'SSL certificate issue',
        error: new Error('unable to verify the first certificate'),
        expectedType: NetworkErrorType.SSL_TLS_ERROR,
        expectedInMessage: 'SSL/TLS error',
      },
      {
        name: 'Network unreachable',
        error: new Error('ENETUNREACH'),
        expectedType: NetworkErrorType.NETWORK_ERROR,
        expectedInMessage: 'Network error',
      },
    ];

    errorScenarios.forEach(({ name, error, expectedType, expectedInMessage }) => {
      it(`should properly categorize: ${name}`, async () => {
        fetchMock.mockRejectedValue(error);

        try {
          await fetchWithTimeout('http://example.com');
          fail(`Should have thrown for ${name}`);
        } catch (err: any) {
          expect(err.type).toBe(expectedType);
          expect(err.message.toLowerCase()).toContain(expectedInMessage.toLowerCase());
          expect(err.troubleshooting).toBeDefined();
          expect(err.troubleshooting.length).toBeGreaterThan(0);
        }
      });
    });
  });
});

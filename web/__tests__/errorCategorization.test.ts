import {
  categorizeNetworkError,
  NetworkErrorType,
  formatErrorMessage,
  getErrorSummary,
} from '@/lib/errorCategorization';

describe('errorCategorization', () => {
  describe('categorizeNetworkError', () => {
    it('should categorize connection refused errors', () => {
      const errors = [
        new Error('Connection refused'),
        new Error('ECONNREFUSED'),
        new Error('connect ECONNREFUSED 127.0.0.1:8080'),
        new Error('Failed to fetch'),
        new Error('NetworkError when attempting to fetch resource'),
      ];

      errors.forEach((error) => {
        const result = categorizeNetworkError(error, 'http://localhost:8080');
        expect(result.type).toBe(NetworkErrorType.CONNECTION_REFUSED);
        expect(result.message).toContain('Connection refused');
        expect(result.troubleshooting).toContain('Verify that Kafka Connect is running');
        expect(result.troubleshooting).toContain('Check if the proxy URL is correct in your configuration');
        expect(result.originalError).toBe(error);
      });
    });

    it('should categorize timeout errors', () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      
      const errors = [
        timeoutError,
        new Error('Connection timed out'),
        new Error('ETIMEDOUT'),
        new Error('The request took longer than 30000ms'),
      ];

      errors.forEach((error) => {
        const result = categorizeNetworkError(error);
        expect(result.type).toBe(NetworkErrorType.TIMEOUT);
        expect(result.message).toContain('timeout');
        expect(result.troubleshooting).toContain('Check if the server is under heavy load');
        expect(result.troubleshooting).toContain('Verify network latency between client and server');
        expect(result.originalError).toBe(error);
      });
    });

    it('should categorize DNS failures', () => {
      const errors = [
        new Error('getaddrinfo ENOTFOUND example.com'),
        new Error('ENOTFOUND'),
        new Error('DNS resolution failed'),
        new Error('Could not resolve host: example.com'),
      ];

      errors.forEach((error) => {
        const result = categorizeNetworkError(error);
        expect(result.type).toBe(NetworkErrorType.DNS_FAILURE);
        expect(result.message).toContain('DNS resolution failed');
        expect(result.troubleshooting).toContain('Verify the hostname is correct');
        expect(result.troubleshooting).toContain('Check DNS server configuration');
        expect(result.originalError).toBe(error);
      });
    });

    it('should categorize SSL/TLS errors', () => {
      const errors = [
        new Error('SSL certificate problem'),
        new Error('TLS handshake failed'),
        new Error('self-signed certificate'),
        new Error('unable to verify the first certificate'),
        new Error('certificate has expired'),
      ];

      errors.forEach((error) => {
        const result = categorizeNetworkError(error);
        expect(result.type).toBe(NetworkErrorType.SSL_TLS_ERROR);
        expect(result.message).toContain('SSL/TLS error');
        expect(result.troubleshooting).toContain('Verify SSL/TLS certificates are valid and not expired');
        expect(result.troubleshooting).toContain('For self-signed certificates, add them to trusted store');
        expect(result.originalError).toBe(error);
      });
    });

    it('should categorize generic network errors', () => {
      const errors = [
        new Error('Network error occurred'),
        new Error('ENETUNREACH'),
        new Error('EHOSTUNREACH'),
        new Error('ECONNRESET'),
        new Error('EPIPE'),
      ];

      errors.forEach((error) => {
        const result = categorizeNetworkError(error);
        expect(result.type).toBe(NetworkErrorType.NETWORK_ERROR);
        expect(result.message).toContain('Network error');
        expect(result.troubleshooting).toContain('Check network connectivity');
        expect(result.troubleshooting).toContain('Verify routing and network configuration');
        expect(result.originalError).toBe(error);
      });
    });

    it('should categorize HTTP errors', () => {
      const errors = [
        new Error('HTTP 404: Not Found'),
        new Error('HTTP 500: Internal Server Error'),
        new Error('HTTP 503: Service Unavailable'),
      ];

      errors.forEach((error) => {
        const result = categorizeNetworkError(error);
        expect(result.type).toBe(NetworkErrorType.HTTP_ERROR);
        expect(result.message).toBe(error.message);
        expect(result.troubleshooting).toContain('Check server logs for more details');
        expect(result.troubleshooting).toContain('Ensure you have proper authentication/authorization');
        expect(result.originalError).toBe(error);
      });
    });

    it('should categorize unknown errors', () => {
      const error = new Error('Something completely unexpected happened');
      const result = categorizeNetworkError(error);
      
      expect(result.type).toBe(NetworkErrorType.UNKNOWN);
      expect(result.message).toBe(error.message);
      expect(result.troubleshooting).toContain('Check the browser console for more details');
      expect(result.troubleshooting).toContain('Review server logs for error information');
      expect(result.originalError).toBe(error);
    });

    it('should handle non-Error values', () => {
      const result = categorizeNetworkError('A string error');
      
      expect(result.type).toBe(NetworkErrorType.UNKNOWN);
      expect(result.message).toBe('A string error');
      expect(result.originalError).toBeInstanceOf(Error);
    });

    it('should prioritize connection refused over other patterns', () => {
      const error = new Error('Network error: ECONNREFUSED');
      const result = categorizeNetworkError(error);
      
      // Should be categorized as CONNECTION_REFUSED, not NETWORK_ERROR
      expect(result.type).toBe(NetworkErrorType.CONNECTION_REFUSED);
    });

    it('should prioritize timeout over network error', () => {
      const error = new Error('Network timeout occurred');
      const result = categorizeNetworkError(error);
      
      // Should be categorized as TIMEOUT, not NETWORK_ERROR
      expect(result.type).toBe(NetworkErrorType.TIMEOUT);
    });
  });

  describe('formatErrorMessage', () => {
    it('should format error with icon and troubleshooting tips', () => {
      const error = new Error('ECONNREFUSED');
      const categorized = categorizeNetworkError(error, 'http://localhost:8080');
      const formatted = formatErrorMessage(categorized, true);
      
      expect(formatted).toContain('🔌');
      expect(formatted).toContain('Connection refused');
      expect(formatted).toContain('Troubleshooting suggestions:');
      expect(formatted).toContain('1. Verify that Kafka Connect is running');
    });

    it('should format error without icon when requested', () => {
      const error = new Error('ECONNREFUSED');
      const categorized = categorizeNetworkError(error, 'http://localhost:8080');
      const formatted = formatErrorMessage(categorized, false);
      
      expect(formatted).not.toContain('🔌');
      expect(formatted).toContain('Connection refused');
      expect(formatted).toContain('Troubleshooting suggestions:');
    });

    it('should number troubleshooting tips correctly', () => {
      const error = new Error('ETIMEDOUT');
      const categorized = categorizeNetworkError(error);
      const formatted = formatErrorMessage(categorized);
      
      expect(formatted).toMatch(/1\. Check if the server is under heavy load/);
      expect(formatted).toMatch(/2\. Verify network latency between client and server/);
      expect(formatted).toMatch(/3\. Increase the timeout duration/);
    });
  });

  describe('getErrorSummary', () => {
    it('should return correct summary for connection refused', () => {
      const error = new Error('ECONNREFUSED');
      const categorized = categorizeNetworkError(error);
      const summary = getErrorSummary(categorized);
      
      expect(summary).toBe('Service not reachable');
    });

    it('should return correct summary for timeout', () => {
      const error = new Error('ETIMEDOUT');
      const categorized = categorizeNetworkError(error);
      const summary = getErrorSummary(categorized);
      
      expect(summary).toBe('Request timed out');
    });

    it('should return correct summary for DNS failure', () => {
      const error = new Error('ENOTFOUND');
      const categorized = categorizeNetworkError(error);
      const summary = getErrorSummary(categorized);
      
      expect(summary).toBe('Hostname not found');
    });

    it('should return correct summary for SSL/TLS error', () => {
      const error = new Error('certificate error');
      const categorized = categorizeNetworkError(error);
      const summary = getErrorSummary(categorized);
      
      expect(summary).toBe('Certificate error');
    });

    it('should return correct summary for network error', () => {
      const error = new Error('ENETUNREACH');
      const categorized = categorizeNetworkError(error);
      const summary = getErrorSummary(categorized);
      
      expect(summary).toBe('Network issue');
    });

    it('should return correct summary for HTTP error', () => {
      const error = new Error('HTTP 500: Internal Server Error');
      const categorized = categorizeNetworkError(error);
      const summary = getErrorSummary(categorized);
      
      expect(summary).toBe('Server error');
    });

    it('should return correct summary for unknown error', () => {
      const error = new Error('Something weird happened');
      const categorized = categorizeNetworkError(error);
      const summary = getErrorSummary(categorized);
      
      expect(summary).toBe('Unknown error');
    });
  });

  describe('edge cases', () => {
    it('should handle empty error messages', () => {
      const error = new Error('');
      const result = categorizeNetworkError(error);
      
      expect(result.type).toBe(NetworkErrorType.UNKNOWN);
      expect(result.originalError).toBe(error);
    });

    it('should handle mixed case error messages', () => {
      const errors = [
        new Error('Connection REFUSED'),
        new Error('TIMEOUT occurred'),
        new Error('Dns Failure'),
        new Error('SSL Error'),
      ];

      const results = errors.map(e => categorizeNetworkError(e));
      
      expect(results[0].type).toBe(NetworkErrorType.CONNECTION_REFUSED);
      expect(results[1].type).toBe(NetworkErrorType.TIMEOUT);
      expect(results[2].type).toBe(NetworkErrorType.DNS_FAILURE);
      expect(results[3].type).toBe(NetworkErrorType.SSL_TLS_ERROR);
    });

    it('should provide URL in connection refused message when available', () => {
      const error = new Error('ECONNREFUSED');
      const result = categorizeNetworkError(error, 'http://example.com:8080');
      
      expect(result.message).toContain('http://example.com:8080');
    });

    it('should handle errors with no stack trace', () => {
      const error = new Error('Test error');
      delete (error as any).stack;
      
      const result = categorizeNetworkError(error);
      expect(result.type).not.toBe(undefined);
      expect(result.troubleshooting.length).toBeGreaterThan(0);
    });
  });
});

# Network Error Categorization

This document describes the network error categorization and troubleshooting system implemented in kconnect-console.

## Overview

The error categorization system automatically detects and categorizes network errors, providing specific troubleshooting guidance for each error type. This makes it easier for users to diagnose and resolve connection issues.

## Supported Error Types

### 1. Connection Refused (`CONNECTION_REFUSED`)
**Common Causes:**
- Kafka Connect service not running
- Incorrect proxy URL configuration
- Service not listening on expected port
- Firewall blocking the connection

**Troubleshooting Steps:**
1. Verify that Kafka Connect is running
2. Check if the proxy URL is correct in your configuration
3. Ensure the service is listening on the expected port
4. Check firewall rules that might be blocking the connection
5. Verify network connectivity between services

**Error Patterns:** `ECONNREFUSED`, `Failed to fetch`, `Connection refused`

### 2. Timeout (`TIMEOUT`)
**Common Causes:**
- Server under heavy load
- Network latency issues
- Firewall delays
- Server not responding

**Troubleshooting Steps:**
1. Check if the server is under heavy load
2. Verify network latency between client and server
3. Increase the timeout duration if operations normally take longer
4. Check for network issues or packet loss
5. Verify firewall rules are not delaying connections

**Error Patterns:** `AbortError`, `ETIMEDOUT`, `timeout`, `timed out`

### 3. DNS Failure (`DNS_FAILURE`)
**Common Causes:**
- Invalid hostname
- DNS server misconfiguration
- Host doesn't exist
- Network DNS issues

**Troubleshooting Steps:**
1. Verify the hostname is correct
2. Check DNS server configuration
3. Ensure the host exists and is reachable
4. Try using an IP address instead of hostname
5. Check /etc/hosts or DNS cache

**Error Patterns:** `ENOTFOUND`, `getaddrinfo`, `DNS`, `name resolution`

### 4. SSL/TLS Error (`SSL_TLS_ERROR`)
**Common Causes:**
- Invalid or expired certificates
- Self-signed certificates not trusted
- Certificate hostname mismatch
- Unsupported SSL/TLS version

**Troubleshooting Steps:**
1. Verify SSL/TLS certificates are valid and not expired
2. Check if the certificate chain is complete
3. For self-signed certificates, add them to trusted store
4. Ensure certificate hostname matches the server hostname
5. Check if SSL/TLS version is supported

**Error Patterns:** `certificate`, `SSL`, `TLS`, `self-signed`, `handshake`

### 5. Network Error (`NETWORK_ERROR`)
**Common Causes:**
- Network connectivity issues
- Routing problems
- Proxy/VPN issues
- Network congestion

**Troubleshooting Steps:**
1. Check network connectivity
2. Verify routing and network configuration
3. Check if the server is accessible from your network
4. Look for proxy or VPN issues
5. Check for network congestion or instability

**Error Patterns:** `ENETUNREACH`, `EHOSTUNREACH`, `ECONNRESET`, `EPIPE`

### 6. HTTP Error (`HTTP_ERROR`)
**Common Causes:**
- Server-side errors (5xx)
- Client errors (4xx)
- Authentication/authorization issues

**Troubleshooting Steps:**
1. Check server logs for more details
2. Verify the request parameters are correct
3. Ensure you have proper authentication/authorization
4. Check if the endpoint exists and is accessible

**Error Patterns:** HTTP status codes in error messages

### 7. Unknown Error (`UNKNOWN`)
**Default category for unrecognized errors**

**Troubleshooting Steps:**
1. Check the browser console for more details
2. Review server logs for error information
3. Try refreshing the page
4. Contact support with error details

## Usage

### Basic Usage

```typescript
import { fetchWithTimeout, isCategorizedError, getErrorSummary } from '@/lib/fetchWithTimeout';

try {
  const response = await fetchWithTimeout('http://localhost:8080/api/connectors');
  const data = await response.json();
} catch (error) {
  if (isCategorizedError(error)) {
    console.log('Error type:', error.type);
    console.log('Summary:', getErrorSummary(error.categorized));
    console.log('Message:', error.message);
    console.log('Troubleshooting:', error.troubleshooting);
  }
}
```

### Manual Categorization

```typescript
import { categorizeNetworkError, formatErrorMessage } from '@/lib/errorCategorization';

try {
  // Some operation that might fail
} catch (error) {
  const categorized = categorizeNetworkError(error, 'http://example.com');
  const formatted = formatErrorMessage(categorized, true); // Include emoji icons
  console.error(formatted);
}
```

### In API Client

The categorization is automatically applied in:
- `fetchWithTimeout()` - Enhanced fetch with timeout support
- `fetchJsonWithTimeout()` - JSON-specific fetch with timeout
- `apiRequest()` in `lib/api.ts` - All Kafka Connect API calls

## Error Object Structure

Categorized errors include the following properties:

```typescript
interface CategorizedError {
  type: NetworkErrorType;           // Error category
  message: string;                   // User-friendly message
  troubleshooting: string[];         // List of troubleshooting steps
  originalError: Error;              // Original error object
}
```

Enhanced error objects thrown by `fetchWithTimeout` also include:

```typescript
{
  message: string;                   // Categorized message
  categorized: CategorizedError;     // Full categorization info
  type: NetworkErrorType;            // Direct access to type
  troubleshooting: string[];         // Direct access to tips
  originalError: Error;              // Original error
}
```

## Testing

The system includes comprehensive test coverage:
- 24 tests for error categorization logic
- 26 tests for fetchWithTimeout integration
- Edge case handling (empty messages, mixed case, etc.)

Run tests:
```bash
npm test -- __tests__/errorCategorization.test.ts
npm test -- __tests__/fetchWithTimeout.test.ts
```

## Examples

See `web/lib/errorCategorization.examples.ts` for detailed usage examples.

## Implementation Files

- `web/lib/errorCategorization.ts` - Core categorization logic
- `web/lib/fetchWithTimeout.ts` - Enhanced fetch with categorization
- `web/lib/api.ts` - Integration with Kafka Connect API
- `web/__tests__/errorCategorization.test.ts` - Categorization tests
- `web/__tests__/fetchWithTimeout.test.ts` - Fetch integration tests

## Future Enhancements

Potential improvements:
- Localization of error messages
- Telemetry/metrics integration
- UI components for displaying categorized errors
- Retry strategies based on error type
- Auto-recovery suggestions

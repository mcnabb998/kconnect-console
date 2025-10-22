/**
 * Network error categorization and troubleshooting guidance
 *
 * Analyzes network errors to provide specific error messages and
 * actionable troubleshooting suggestions.
 */

export enum NetworkErrorType {
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  TIMEOUT = 'TIMEOUT',
  DNS_FAILURE = 'DNS_FAILURE',
  SSL_TLS_ERROR = 'SSL_TLS_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  HTTP_ERROR = 'HTTP_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export interface CategorizedError {
  type: NetworkErrorType;
  message: string;
  troubleshooting: string[];
  originalError: Error;
}

/**
 * Categorize a network error and provide troubleshooting guidance
 */
export function categorizeNetworkError(error: unknown, url?: string): CategorizedError {
  // Convert to Error if not already
  const err = error instanceof Error ? error : new Error(String(error));
  
  // Extract error message for pattern matching
  const message = err.message.toLowerCase();
  const name = err.name.toLowerCase();

  // Connection refused errors
  if (
    message.includes('connection refused') ||
    message.includes('econnrefused') ||
    message.includes('connect econnrefused') ||
    message.includes('failed to fetch') ||
    (message.includes('networkerror') && (message.includes('fetch') || message.includes('fetching')))
  ) {
    return {
      type: NetworkErrorType.CONNECTION_REFUSED,
      message: `Connection refused: Unable to connect to ${url || 'the server'}`,
      troubleshooting: [
        'Verify that Kafka Connect is running',
        'Check if the proxy URL is correct in your configuration',
        'Ensure the service is listening on the expected port',
        'Check firewall rules that might be blocking the connection',
        'Verify network connectivity between services',
      ],
      originalError: err,
    };
  }

  // Timeout errors
  if (
    name.includes('aborterror') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('etimedout') ||
    message.includes('took longer than')
  ) {
    return {
      type: NetworkErrorType.TIMEOUT,
      message: `Request timeout: The server did not respond in time`,
      troubleshooting: [
        'Check if the server is under heavy load',
        'Verify network latency between client and server',
        'Increase the timeout duration if operations normally take longer',
        'Check for network issues or packet loss',
        'Verify firewall rules are not delaying connections',
      ],
      originalError: err,
    };
  }

  // DNS failures
  if (
    message.includes('getaddrinfo') ||
    message.includes('enotfound') ||
    message.includes('dns') ||
    message.includes('name resolution') ||
    message.includes('could not resolve host')
  ) {
    return {
      type: NetworkErrorType.DNS_FAILURE,
      message: `DNS resolution failed: Unable to resolve hostname`,
      troubleshooting: [
        'Verify the hostname is correct',
        'Check DNS server configuration',
        'Ensure the host exists and is reachable',
        'Try using an IP address instead of hostname',
        'Check /etc/hosts or DNS cache',
      ],
      originalError: err,
    };
  }

  // SSL/TLS errors
  if (
    message.includes('ssl') ||
    message.includes('tls') ||
    message.includes('certificate') ||
    message.includes('cert') ||
    message.includes('self-signed') ||
    message.includes('unable to verify') ||
    message.includes('handshake')
  ) {
    return {
      type: NetworkErrorType.SSL_TLS_ERROR,
      message: `SSL/TLS error: Certificate validation failed`,
      troubleshooting: [
        'Verify SSL/TLS certificates are valid and not expired',
        'Check if the certificate chain is complete',
        'For self-signed certificates, add them to trusted store',
        'Ensure certificate hostname matches the server hostname',
        'Check if SSL/TLS version is supported',
      ],
      originalError: err,
    };
  }

  // Generic network errors
  if (
    message.includes('network') ||
    message.includes('enetunreach') ||
    message.includes('ehostunreach') ||
    message.includes('econnreset') ||
    message.includes('epipe')
  ) {
    return {
      type: NetworkErrorType.NETWORK_ERROR,
      message: `Network error: Unable to communicate with the server`,
      troubleshooting: [
        'Check network connectivity',
        'Verify routing and network configuration',
        'Check if the server is accessible from your network',
        'Look for proxy or VPN issues',
        'Check for network congestion or instability',
      ],
      originalError: err,
    };
  }

  // If we have an HTTP error status in the message, categorize as HTTP_ERROR
  // Use specific regex to match only valid HTTP status codes (100-599)
  if (message.includes('http') && /\b[1-5]\d{2}\b/.test(message)) {
    return {
      type: NetworkErrorType.HTTP_ERROR,
      message: err.message,
      troubleshooting: [
        'Check server logs for more details',
        'Verify the request parameters are correct',
        'Ensure you have proper authentication/authorization',
        'Check if the endpoint exists and is accessible',
      ],
      originalError: err,
    };
  }

  // Unknown error type
  return {
    type: NetworkErrorType.UNKNOWN,
    message: err.message || 'An unknown error occurred',
    troubleshooting: [
      'Check the browser console for more details',
      'Review server logs for error information',
      'Try refreshing the page',
      'Contact support with error details',
    ],
    originalError: err,
  };
}

/**
 * Format a categorized error into a user-friendly message
 */
export function formatErrorMessage(categorized: CategorizedError, includeIcon: boolean = true): string {
  const icon = includeIcon ? getErrorIcon(categorized.type) : '';
  const prefix = icon ? `${icon} ` : '';
  
  let message = `${prefix}${categorized.message}`;
  
  if (categorized.troubleshooting.length > 0) {
    message += '\n\nTroubleshooting suggestions:\n';
    message += categorized.troubleshooting.map((tip, idx) => `${idx + 1}. ${tip}`).join('\n');
  }
  
  return message;
}

/**
 * Get an appropriate icon/emoji for the error type
 */
function getErrorIcon(type: NetworkErrorType): string {
  switch (type) {
    case NetworkErrorType.CONNECTION_REFUSED:
      return '🔌';
    case NetworkErrorType.TIMEOUT:
      return '⏱️';
    case NetworkErrorType.DNS_FAILURE:
      return '🌐';
    case NetworkErrorType.SSL_TLS_ERROR:
      return '🔒';
    case NetworkErrorType.NETWORK_ERROR:
      return '📡';
    case NetworkErrorType.HTTP_ERROR:
      return '⚠️';
    case NetworkErrorType.UNKNOWN:
      return '❓';
  }
  // Exhaustiveness check: if a new NetworkErrorType is added, this will cause a compile-time error
  const _exhaustive: never = type;
  return _exhaustive;
}

/**
 * Get a short summary of the error for display in UI
 */
export function getErrorSummary(categorized: CategorizedError): string {
  switch (categorized.type) {
    case NetworkErrorType.CONNECTION_REFUSED:
      return 'Service not reachable';
    case NetworkErrorType.TIMEOUT:
      return 'Request timed out';
    case NetworkErrorType.DNS_FAILURE:
      return 'Hostname not found';
    case NetworkErrorType.SSL_TLS_ERROR:
      return 'Certificate error';
    case NetworkErrorType.NETWORK_ERROR:
      return 'Network issue';
    case NetworkErrorType.HTTP_ERROR:
      return 'Server error';
    case NetworkErrorType.UNKNOWN:
      return 'Unknown error';
    default:
      return 'Error occurred';
  }
}

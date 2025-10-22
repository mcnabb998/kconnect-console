/**
 * Fetch wrapper with timeout support and error categorization
 *
 * Prevents requests from hanging indefinitely by automatically aborting
 * after a specified timeout period. Provides detailed error categorization
 * for better troubleshooting.
 */

import { categorizeNetworkError, CategorizedError, NetworkErrorType } from './errorCategorization';

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
}

/**
 * Fetch with automatic timeout and error categorization
 * @param url - URL to fetch
 * @param options - Fetch options with optional timeout
 * @returns Promise resolving to Response
 * @throws CategorizedError with detailed troubleshooting information
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS, signal, ...fetchOptions } = options;

  // If user provided their own signal, use it; otherwise create timeout controller
  if (signal) {
    try {
      return await fetch(url, { signal, ...fetchOptions });
    } catch (error) {
      // Categorize and re-throw with detailed information
      const categorized = categorizeNetworkError(error, url);
      throw Object.assign(new Error(categorized.message), {
        categorized,
        type: categorized.type,
        troubleshooting: categorized.troubleshooting,
        originalError: categorized.originalError,
      });
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Categorize the error and provide detailed information
    const categorized = categorizeNetworkError(error, url);
    
    // For timeout errors, provide additional context
    if (error instanceof Error && error.name === 'AbortError') {
      categorized.message = `Request timeout: The request to ${url} took longer than ${timeout}ms`;
    }

    // Throw an enhanced error with categorization data
    throw Object.assign(new Error(categorized.message), {
      categorized,
      type: categorized.type,
      troubleshooting: categorized.troubleshooting,
      originalError: categorized.originalError,
    });
  }
}

/**
 * Fetch JSON with automatic timeout and error categorization
 * @param url - URL to fetch
 * @param options - Fetch options with optional timeout
 * @returns Promise resolving to parsed JSON
 * @throws CategorizedError with detailed troubleshooting information
 */
export async function fetchJsonWithTimeout<T = any>(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const categorized = categorizeNetworkError(
      new Error(`HTTP ${response.status}: ${response.statusText}`),
      url
    );
    throw Object.assign(new Error(categorized.message), {
      categorized,
      type: categorized.type,
      troubleshooting: categorized.troubleshooting,
      originalError: categorized.originalError,
      status: response.status,
      statusText: response.statusText,
    });
  }

  return response.json();
}

/**
 * Enhanced error type with categorization information
 */
export interface CategorizedErrorObject extends Error {
  categorized: CategorizedError;
  type: NetworkErrorType;
  troubleshooting: string[];
  originalError: Error;
}

/**
 * Type guard to check if an error has categorization information
 */
export function isCategorizedError(error: unknown): error is CategorizedErrorObject {
  return (
    error instanceof Error &&
    'categorized' in error &&
    typeof (error as any).categorized === 'object'
  );
}

// Re-export types and functions for convenience
export { categorizeNetworkError, NetworkErrorType, formatErrorMessage, getErrorSummary } from './errorCategorization';
export type { CategorizedError } from './errorCategorization';


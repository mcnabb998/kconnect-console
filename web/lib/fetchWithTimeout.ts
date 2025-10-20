/**
 * Fetch wrapper with timeout support
 *
 * Prevents requests from hanging indefinitely by automatically aborting
 * after a specified timeout period.
 */

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
}

/**
 * Fetch with automatic timeout
 * @param url - URL to fetch
 * @param options - Fetch options with optional timeout
 * @returns Promise resolving to Response
 * @throws Error if request times out or network error occurs
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS, signal, ...fetchOptions } = options;

  // If user provided their own signal, use it; otherwise create timeout controller
  if (signal) {
    return fetch(url, { signal, ...fetchOptions });
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

    // Provide helpful timeout error message
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `Request timeout: The request to ${url} took longer than ${timeout}ms. ` +
        `This may indicate the server is slow or unresponsive.`
      );
    }

    throw error;
  }
}

/**
 * Fetch JSON with automatic timeout
 * @param url - URL to fetch
 * @param options - Fetch options with optional timeout
 * @returns Promise resolving to parsed JSON
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
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

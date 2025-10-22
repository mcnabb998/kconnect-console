'use client';

import { useState } from 'react';
import { categorizeNetworkError, NetworkErrorType, getErrorSummary } from '@/lib/errorCategorization';
import type { CategorizedError } from '@/lib/errorCategorization';
import { isCategorizedError } from '@/lib/fetchWithTimeout';

export interface ErrorDisplayProps {
  error: Error | CategorizedError | unknown;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  showDismiss?: boolean;
  context?: string;
}

interface HttpErrorInfo {
  status: number;
  message: string;
  suggestions: string[];
  retryable: boolean;
}

/**
 * Get specific HTTP error information based on status code
 */
function getHttpErrorInfo(status: number): HttpErrorInfo {
  switch (status) {
    case 404:
      return {
        status: 404,
        message: 'Resource Not Found',
        suggestions: [
          'Verify the connector name is correct',
          'Check if the connector was deleted',
          'Ensure the URL path is correct',
          'Refresh the connector list to see current connectors',
        ],
        retryable: false,
      };
    case 409:
      return {
        status: 409,
        message: 'Name Conflict',
        suggestions: [
          'A connector with this name already exists',
          'Choose a different connector name',
          'Delete the existing connector first if you want to replace it',
          'Check for naming conflicts in your configuration',
        ],
        retryable: false,
      };
    case 500:
      return {
        status: 500,
        message: 'Kafka Connect Internal Error',
        suggestions: [
          'Check Kafka Connect server logs for details',
          'Verify Kafka Connect is properly configured',
          'Check if all required Kafka brokers are available',
          'Review connector configuration for errors',
          'Try again in a few moments',
        ],
        retryable: true,
      };
    case 503:
      return {
        status: 503,
        message: 'Service Unavailable',
        suggestions: [
          'Kafka Connect may be restarting or under heavy load',
          'Wait a few moments and try again',
          'Check if Kafka Connect is running',
          'Verify system resources (CPU, memory) are available',
        ],
        retryable: true,
      };
    case 400:
      return {
        status: 400,
        message: 'Bad Request',
        suggestions: [
          'Check your connector configuration for errors',
          'Verify all required fields are provided',
          'Ensure field values are in the correct format',
          'Review the connector documentation',
        ],
        retryable: false,
      };
    case 401:
      return {
        status: 401,
        message: 'Unauthorized',
        suggestions: [
          'Authentication credentials are missing or invalid',
          'Check your authentication configuration',
          'Verify API tokens or credentials are valid',
        ],
        retryable: false,
      };
    case 403:
      return {
        status: 403,
        message: 'Forbidden',
        suggestions: [
          'You do not have permission to perform this action',
          'Check your access permissions',
          'Contact your administrator for access',
        ],
        retryable: false,
      };
    default:
      if (status >= 500) {
        return {
          status,
          message: 'Server Error',
          suggestions: [
            'The server encountered an error',
            'Check server logs for more details',
            'Try again in a few moments',
          ],
          retryable: true,
        };
      } else if (status >= 400) {
        return {
          status,
          message: 'Client Error',
          suggestions: [
            'Check your request parameters',
            'Review the API documentation',
            'Contact support if the issue persists',
          ],
          retryable: false,
        };
      }
      return {
        status,
        message: 'HTTP Error',
        suggestions: ['An unexpected HTTP error occurred', 'Try again or contact support'],
        retryable: true,
      };
  }
}

/**
 * Determine if error is retryable based on type
 */
function isRetryable(categorized: CategorizedError): boolean {
  switch (categorized.type) {
    case NetworkErrorType.CONNECTION_REFUSED:
    case NetworkErrorType.TIMEOUT:
    case NetworkErrorType.NETWORK_ERROR:
      return true;
    case NetworkErrorType.DNS_FAILURE:
    case NetworkErrorType.SSL_TLS_ERROR:
    case NetworkErrorType.HTTP_ERROR:
    case NetworkErrorType.UNKNOWN:
      return false;
    default:
      return false;
  }
}

/**
 * Extract HTTP status code from error if available
 */
function extractHttpStatus(error: any): number | null {
  if (error?.status && typeof error.status === 'number') {
    return error.status;
  }
  if (error?.response?.status && typeof error.response.status === 'number') {
    return error.response.status;
  }
  const message = error?.message || String(error);
  const match = message.match(/HTTP (\d{3})/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  className = '',
  showDismiss = false,
  context,
}: ErrorDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Categorize the error
  const categorized: CategorizedError = isCategorizedError(error)
    ? error.categorized
    : categorizeNetworkError(error);

  // Check for HTTP status code
  const httpStatus = extractHttpStatus(error);
  const httpInfo = httpStatus ? getHttpErrorInfo(httpStatus) : null;

  // Determine if this error is retryable
  const retryable = httpInfo ? httpInfo.retryable : isRetryable(categorized);

  // Get the appropriate icon
  const getIcon = () => {
    if (httpStatus === 404) {
      return (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    }

    switch (categorized.type) {
      case NetworkErrorType.CONNECTION_REFUSED:
        return (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
            />
          </svg>
        );
      case NetworkErrorType.TIMEOUT:
        return (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case NetworkErrorType.DNS_FAILURE:
        return (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            />
          </svg>
        );
      case NetworkErrorType.SSL_TLS_ERROR:
        return (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        );
      default:
        return (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
    }
  };

  // Copy error details to clipboard
  const handleCopy = async () => {
    const errorDetails = [
      `Error Type: ${httpInfo?.message || getErrorSummary(categorized)}`,
      context ? `Context: ${context}` : '',
      httpStatus ? `HTTP Status: ${httpStatus}` : '',
      `Message: ${categorized.message}`,
      '',
      'Stack Trace:',
      categorized.originalError?.stack || 'Not available',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      // Check if clipboard API is available (browser only)
      // eslint-disable-next-line no-undef
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        // eslint-disable-next-line no-undef
        await navigator.clipboard.writeText(errorDetails);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  const suggestions = httpInfo ? httpInfo.suggestions : categorized.troubleshooting;
  const title = httpInfo ? httpInfo.message : getErrorSummary(categorized);

  return (
    <div
      className={`rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-900/20 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 text-rose-400 dark:text-rose-500">{getIcon()}</div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-semibold text-rose-800 dark:text-rose-400">
              {title}
              {httpStatus && (
                <span className="ml-2 inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                  HTTP {httpStatus}
                </span>
              )}
            </h3>
            <div className="mt-2 text-sm text-rose-700 dark:text-rose-300">
              <p>{categorized.message}</p>
            </div>

            {suggestions.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-800 dark:text-rose-400">
                  Troubleshooting Suggestions:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-rose-700 dark:text-rose-300">
                  {suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {retryable && onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 dark:bg-rose-500 dark:hover:bg-rose-600"
                >
                  <svg
                    className="-ml-0.5 mr-1.5 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/50"
              >
                <svg
                  className="-ml-0.5 mr-1.5 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {copied ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  )}
                </svg>
                {copied ? 'Copied!' : 'Copy Details'}
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/50"
                aria-expanded={isExpanded}
              >
                {isExpanded ? 'Hide Details' : 'Show Details'}
                <svg
                  className={`ml-1.5 h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showDismiss && onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="inline-flex items-center rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/50"
                >
                  Dismiss
                </button>
              )}
            </div>

            {isExpanded && categorized.originalError?.stack && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-800 dark:text-rose-400">
                  Technical Details:
                </p>
                <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-rose-900/10 p-3 text-xs text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                  {categorized.originalError.stack}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

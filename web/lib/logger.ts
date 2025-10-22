/**
 * Simple logging utility that respects environment
 * In production, only errors are logged. In development, all logs are shown.
 */

function isDevelopment(): boolean {
  if (typeof window === 'undefined') {
    // Server-side: use process.env.NODE_ENV
    return process.env.NODE_ENV === 'development';
  } else {
    // Client-side: check if running on localhost
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDevelopment()) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  info: (...args: unknown[]) => {
    if (isDevelopment()) {
      console.log('[INFO]', ...args);
    }
  },
  
  warn: (...args: unknown[]) => {
    console.warn('[WARN]', ...args);
  },
  
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args);
  },
};

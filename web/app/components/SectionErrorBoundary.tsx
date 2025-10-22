'use client';

import { Component, ReactNode } from 'react';

interface SectionErrorBoundaryProps {
  children: ReactNode;
  section?: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for wrapping individual sections of the UI.
 * When a section fails, only that section shows an error - the rest of the page continues to work.
 * 
 * Example:
 * <SectionErrorBoundary section="Connector Table">
 *   <ConnectorTable />
 * </SectionErrorBoundary>
 */
export class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const section = this.props.section || 'Unknown section';
    console.error(`SectionErrorBoundary caught an error in ${section}:`, error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      const section = this.props.section || 'section';

      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800">
                Error loading {section}
              </h3>
              <p className="mt-1 text-sm text-red-700">
                {this.state.error.message}
              </p>
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={this.reset}
                  className="inline-flex items-center rounded-md bg-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-red-50"
                >
                  Try Again
                </button>
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-red-700 hover:text-red-800">
                    Show Details
                  </summary>
                  <pre className="mt-2 max-h-32 overflow-auto rounded bg-red-900/10 p-2 text-xs text-red-800">
                    {this.state.error.stack}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

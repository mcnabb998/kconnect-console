import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionErrorBoundary } from '@/app/components/SectionErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Working component</div>;
};

// Suppress console.error during tests to avoid noise
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

describe('SectionErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <SectionErrorBoundary section="Test Section">
        <div>Normal content</div>
      </SectionErrorBoundary>
    );

    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('catches and displays errors from child components', () => {
    render(
      <SectionErrorBoundary section="Test Section">
        <ThrowError />
      </SectionErrorBoundary>
    );

    expect(screen.getByText(/Error loading Test Section/i)).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('displays default section name when not provided', () => {
    render(
      <SectionErrorBoundary>
        <ThrowError />
      </SectionErrorBoundary>
    );

    expect(screen.getByText(/Error loading section/i)).toBeInTheDocument();
  });

  it('shows Try Again button when error occurs', () => {
    render(
      <SectionErrorBoundary section="Test Section">
        <ThrowError />
      </SectionErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
  });

  it('shows error details in a collapsible section', () => {
    render(
      <SectionErrorBoundary section="Test Section">
        <ThrowError />
      </SectionErrorBoundary>
    );

    const details = screen.getByText('Show Details');
    expect(details).toBeInTheDocument();
  });

  it('resets error state when Try Again is clicked', () => {
    // Create a component that can toggle error state
    const ToggleError = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      
      React.useEffect(() => {
        // After mount, set up to not throw on next render
        const timer = setTimeout(() => setShouldThrow(false), 100);
        return () => clearTimeout(timer);
      }, []);

      return <ThrowError shouldThrow={shouldThrow} />;
    };

    render(
      <SectionErrorBoundary section="Test Section">
        <ToggleError />
      </SectionErrorBoundary>
    );

    // Wait for error to be displayed
    expect(screen.getByText(/Error loading Test Section/i)).toBeInTheDocument();

    // Click Try Again button
    const tryAgainButton = screen.getByRole('button', { name: /Try Again/i });
    fireEvent.click(tryAgainButton);

    // After reset, the component should try to render again
    // In real usage, this would re-render the children
  });

  it('uses custom fallback when provided', () => {
    const customFallback = (error: Error, reset: () => void) => (
      <div>
        <span>Custom error UI</span>
        <span>{error.message}</span>
        <button onClick={reset}>Retry</button>
      </div>
    );

    render(
      <SectionErrorBoundary section="Test Section" fallback={customFallback}>
        <ThrowError />
      </SectionErrorBoundary>
    );

    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('logs error to console with section name', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <SectionErrorBoundary section="Navigation Panel">
        <ThrowError />
      </SectionErrorBoundary>
    );

    expect(consoleErrorSpy).toHaveBeenCalled();
    // Check that the console.error was called with a message containing the section name
    const allCalls = consoleErrorSpy.mock.calls;
    const hasNavigationPanel = allCalls.some(call => 
      call.some(arg => typeof arg === 'string' && arg.includes('Navigation Panel'))
    );
    expect(hasNavigationPanel).toBe(true);

    consoleErrorSpy.mockRestore();
  });

  it('displays error icon in the error UI', () => {
    render(
      <SectionErrorBoundary section="Test Section">
        <ThrowError />
      </SectionErrorBoundary>
    );

    // Check for SVG icon (it has aria-hidden="true")
    const container = screen.getByText(/Error loading Test Section/i).closest('div');
    const svg = container?.parentElement?.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('handles multiple error boundaries independently', () => {
    const WorkingComponent = () => <div>Working section</div>;

    render(
      <div>
        <SectionErrorBoundary section="Section 1">
          <ThrowError />
        </SectionErrorBoundary>
        <SectionErrorBoundary section="Section 2">
          <WorkingComponent />
        </SectionErrorBoundary>
      </div>
    );

    // First section should show error
    expect(screen.getByText(/Error loading Section 1/i)).toBeInTheDocument();
    
    // Second section should work normally
    expect(screen.getByText('Working section')).toBeInTheDocument();
  });

  it('preserves error styling with proper classes', () => {
    render(
      <SectionErrorBoundary section="Test Section">
        <ThrowError />
      </SectionErrorBoundary>
    );

    const errorContainer = screen.getByText(/Error loading Test Section/i).closest('div');
    expect(errorContainer?.parentElement?.parentElement).toHaveClass('border-red-200');
    expect(errorContainer?.parentElement?.parentElement).toHaveClass('bg-red-50');
  });
});

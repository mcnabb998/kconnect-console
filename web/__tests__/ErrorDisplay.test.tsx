import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { categorizeNetworkError } from '@/lib/errorCategorization';

// Mock clipboard writeText
const mockClipboardWriteText = jest.fn();

describe('ErrorDisplay Component', () => {
  const mockRetry = jest.fn();
  const mockDismiss = jest.fn();

  beforeEach(() => {
    mockRetry.mockClear();
    mockDismiss.mockClear();
    mockClipboardWriteText.mockClear();
    mockClipboardWriteText.mockResolvedValue(undefined);
    
    // Set up clipboard mock for each test
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockClipboardWriteText,
      },
      writable: true,
      configurable: true,
    });
  });

  describe('Network Errors', () => {
    it('should display connection refused error', () => {
      const error = new Error('Connection refused');
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('Service not reachable')).toBeInTheDocument();
      expect(screen.getByText(/Connection refused/i)).toBeInTheDocument();
    });

    it('should display timeout error', () => {
      const error = new Error('Request timeout');
      error.name = 'AbortError';
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('Request timed out')).toBeInTheDocument();
      expect(screen.getByText('Request timeout: The server did not respond in time')).toBeInTheDocument();
    });

    it('should display DNS failure error', () => {
      const error = new Error('ENOTFOUND example.com');
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('Hostname not found')).toBeInTheDocument();
      expect(screen.getByText(/DNS resolution failed/i)).toBeInTheDocument();
    });

    it('should display SSL/TLS error', () => {
      const error = new Error('SSL certificate problem');
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('Certificate error')).toBeInTheDocument();
      expect(screen.getByText(/SSL\/TLS error/i)).toBeInTheDocument();
    });

    it('should display generic network error', () => {
      const error = new Error('ENETUNREACH');
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('Network issue')).toBeInTheDocument();
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  describe('HTTP Status Errors', () => {
    it('should display 404 error with specific message', () => {
      const error = new Error('HTTP 404: Not Found');
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('Resource Not Found')).toBeInTheDocument();
      expect(screen.getByText('HTTP 404')).toBeInTheDocument();
      expect(screen.getByText(/Verify the connector name is correct/i)).toBeInTheDocument();
    });

    it('should display 409 conflict error', () => {
      const error = new Error('HTTP 409: Conflict');
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('Name Conflict')).toBeInTheDocument();
      expect(screen.getByText('HTTP 409')).toBeInTheDocument();
      expect(screen.getByText(/A connector with this name already exists/i)).toBeInTheDocument();
    });

    it('should display 500 internal server error', () => {
      const error = new Error('HTTP 500: Internal Server Error');
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('Kafka Connect Internal Error')).toBeInTheDocument();
      expect(screen.getByText('HTTP 500')).toBeInTheDocument();
      expect(screen.getByText(/Check Kafka Connect server logs/i)).toBeInTheDocument();
    });

    it('should display 503 service unavailable error', () => {
      const error = new Error('HTTP 503: Service Unavailable');
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('Service Unavailable')).toBeInTheDocument();
      expect(screen.getByText('HTTP 503')).toBeInTheDocument();
      expect(screen.getByText(/Kafka Connect may be restarting/i)).toBeInTheDocument();
    });

    it('should display 400 bad request error', () => {
      const error = new Error('HTTP 400: Bad Request');
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('Bad Request')).toBeInTheDocument();
      expect(screen.getByText('HTTP 400')).toBeInTheDocument();
      expect(screen.getByText(/Check your connector configuration/i)).toBeInTheDocument();
    });

    it('should display 401 unauthorized error', () => {
      const error = new Error('HTTP 401: Unauthorized');
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      expect(screen.getByText('HTTP 401')).toBeInTheDocument();
      expect(screen.getByText(/Authentication credentials/i)).toBeInTheDocument();
    });

    it('should display 403 forbidden error', () => {
      const error = new Error('HTTP 403: Forbidden');
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('Forbidden')).toBeInTheDocument();
      expect(screen.getByText('HTTP 403')).toBeInTheDocument();
      expect(screen.getByText(/You do not have permission/i)).toBeInTheDocument();
    });

    it('should handle error objects with status property', () => {
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('HTTP 404')).toBeInTheDocument();
      expect(screen.getByText('Resource Not Found')).toBeInTheDocument();
    });

    it('should handle error objects with response.status property', () => {
      const error = Object.assign(new Error('Conflict'), { response: { status: 409 } });
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('HTTP 409')).toBeInTheDocument();
      expect(screen.getByText('Name Conflict')).toBeInTheDocument();
    });
  });

  describe('Retry Functionality', () => {
    it('should show retry button for connection refused errors', () => {
      const error = new Error('Connection refused');
      render(<ErrorDisplay error={error} onRetry={mockRetry} />);

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should show retry button for timeout errors', () => {
      const error = new Error('Request timeout');
      render(<ErrorDisplay error={error} onRetry={mockRetry} />);

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should show retry button for 500 errors', () => {
      const error = new Error('HTTP 500: Internal Server Error');
      render(<ErrorDisplay error={error} onRetry={mockRetry} />);

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should show retry button for 503 errors', () => {
      const error = new Error('HTTP 503: Service Unavailable');
      render(<ErrorDisplay error={error} onRetry={mockRetry} />);

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should not show retry button for 404 errors', () => {
      const error = new Error('HTTP 404: Not Found');
      render(<ErrorDisplay error={error} onRetry={mockRetry} />);

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });

    it('should not show retry button for 409 errors', () => {
      const error = new Error('HTTP 409: Conflict');
      render(<ErrorDisplay error={error} onRetry={mockRetry} />);

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });

    it('should not show retry button for DNS errors', () => {
      const error = new Error('ENOTFOUND');
      render(<ErrorDisplay error={error} onRetry={mockRetry} />);

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });

    it('should not show retry button for SSL/TLS errors', () => {
      const error = new Error('SSL certificate problem');
      render(<ErrorDisplay error={error} onRetry={mockRetry} />);

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });

    it('should not show retry button when onRetry is not provided', () => {
      const error = new Error('Connection refused');
      render(<ErrorDisplay error={error} />);

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', async () => {
      const user = userEvent.setup();
      const error = new Error('Connection refused');
      render(<ErrorDisplay error={error} onRetry={mockRetry} />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Copy to Clipboard', () => {
    it('should show copy details button', () => {
      const error = new Error('Test error');
      render(<ErrorDisplay error={error} />);

      expect(screen.getByRole('button', { name: /copy details/i })).toBeInTheDocument();
    });

    it('should show "Copied!" after successful copy', async () => {
      const user = userEvent.setup();
      const error = new Error('Test error');
      render(<ErrorDisplay error={error} />);

      const copyButton = screen.getByRole('button', { name: /copy details/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
      
      // The copy button text changes back after 2 seconds
      await waitFor(() => {
        expect(screen.getByText('Copy Details')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Show/Hide Details', () => {
    it('should show details toggle button', () => {
      const error = new Error('Test error');
      render(<ErrorDisplay error={error} />);

      expect(screen.getByRole('button', { name: /show details/i })).toBeInTheDocument();
    });

    it('should expand details when button clicked', async () => {
      const user = userEvent.setup();
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n  at test.js:1:1';
      render(<ErrorDisplay error={error} />);

      const toggleButton = screen.getByRole('button', { name: /show details/i });
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText('Technical Details:')).toBeInTheDocument();
        expect(screen.getByText(/Error: Test error/)).toBeInTheDocument();
      });
    });

    it('should collapse details when button clicked again', async () => {
      const user = userEvent.setup();
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n  at test.js:1:1';
      render(<ErrorDisplay error={error} />);

      const toggleButton = screen.getByRole('button', { name: /show details/i });
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText('Technical Details:')).toBeInTheDocument();
      });

      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.queryByText('Technical Details:')).not.toBeInTheDocument();
      });
    });

    it('should update button text when expanded', async () => {
      const user = userEvent.setup();
      const error = new Error('Test error');
      render(<ErrorDisplay error={error} />);

      const toggleButton = screen.getByRole('button', { name: /show details/i });
      await user.click(toggleButton);

      expect(screen.getByRole('button', { name: /hide details/i })).toBeInTheDocument();
    });

    it('should have aria-expanded attribute', async () => {
      const user = userEvent.setup();
      const error = new Error('Test error');
      render(<ErrorDisplay error={error} />);

      const toggleButton = screen.getByRole('button', { name: /show details/i });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

      await user.click(toggleButton);

      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Dismiss Functionality', () => {
    it('should show dismiss button when showDismiss is true', () => {
      const error = new Error('Test error');
      render(<ErrorDisplay error={error} onDismiss={mockDismiss} showDismiss />);

      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });

    it('should not show dismiss button when showDismiss is false', () => {
      const error = new Error('Test error');
      render(<ErrorDisplay error={error} onDismiss={mockDismiss} showDismiss={false} />);

      expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
    });

    it('should not show dismiss button when onDismiss is not provided', () => {
      const error = new Error('Test error');
      render(<ErrorDisplay error={error} showDismiss />);

      expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
    });

    it('should call onDismiss when dismiss button is clicked', async () => {
      const user = userEvent.setup();
      const error = new Error('Test error');
      render(<ErrorDisplay error={error} onDismiss={mockDismiss} showDismiss />);

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await user.click(dismissButton);

      expect(mockDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Troubleshooting Suggestions', () => {
    it('should display troubleshooting suggestions', () => {
      const error = new Error('Connection refused');
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('Troubleshooting Suggestions:')).toBeInTheDocument();
      expect(screen.getByText(/Verify that Kafka Connect is running/i)).toBeInTheDocument();
    });

    it('should use HTTP-specific suggestions for HTTP errors', () => {
      const error = new Error('HTTP 404: Not Found');
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText(/Verify the connector name is correct/i)).toBeInTheDocument();
      expect(screen.getByText(/Check if the connector was deleted/i)).toBeInTheDocument();
    });

    it('should display multiple suggestions as list items', () => {
      const error = new Error('Connection refused');
      const { container } = render(<ErrorDisplay error={error} />);

      const list = container.querySelector('ul');
      expect(list).toBeInTheDocument();

      const items = container.querySelectorAll('li');
      expect(items.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA role', () => {
      const error = new Error('Test error');
      render(<ErrorDisplay error={error} />);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    it('should have aria-live attribute', () => {
      const error = new Error('Test error');
      render(<ErrorDisplay error={error} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      const error = new Error('Connection refused');
      render(<ErrorDisplay error={error} onRetry={mockRetry} />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      retryButton.focus();
      expect(retryButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(mockRetry).toHaveBeenCalled();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const error = new Error('Test error');
      const { container } = render(<ErrorDisplay error={error} className="custom-class" />);

      const alert = container.querySelector('[role="alert"]');
      expect(alert).toHaveClass('custom-class');
    });

    it('should retain default classes with custom className', () => {
      const error = new Error('Test error');
      const { container } = render(<ErrorDisplay error={error} className="custom-class" />);

      const alert = container.querySelector('[role="alert"]');
      expect(alert).toHaveClass('rounded-lg');
      expect(alert).toHaveClass('border-rose-200');
      expect(alert).toHaveClass('custom-class');
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-Error objects', () => {
      render(<ErrorDisplay error="String error" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/String error/i)).toBeInTheDocument();
    });

    it('should handle null or undefined error', () => {
      render(<ErrorDisplay error={null} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should handle errors without stack traces', () => {
      const error = new Error('Test error');
      delete (error as any).stack;
      render(<ErrorDisplay error={error} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Test error/i)).toBeInTheDocument();
    });

    it('should handle categorized errors', () => {
      const error = new Error('ECONNREFUSED');
      const categorized = categorizeNetworkError(error);
      const categorizedError = Object.assign(error, { categorized });

      render(<ErrorDisplay error={categorizedError} />);

      expect(screen.getByText('Service not reachable')).toBeInTheDocument();
    });
  });
});

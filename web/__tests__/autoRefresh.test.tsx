import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, useSearchParams } from 'next/navigation';
import Home from '@/app/page';

// Mock fetch globally
global.fetch = jest.fn();

const mockRouter = {
  replace: jest.fn(),
  push: jest.fn(),
};

const mockSearchParams = {
  get: jest.fn(),
  toString: jest.fn(() => ''),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
  mockSearchParams.get.mockReturnValue(null);
  mockRouter.replace.mockClear();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// Helper to mock connector API responses
function mockConnectorAPIs(connectorNames: string[]) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/connectors') && !url.includes('/status')) {
      return Promise.resolve({
        ok: true,
        json: async () => connectorNames,
      });
    }
    if (url.includes('/status')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          connector: { state: 'RUNNING', worker_id: 'worker-1' },
          tasks: [{ id: 0, state: 'RUNNING', worker_id: 'worker-1' }],
        }),
      });
    }
    if (url.includes('/connector')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          name: connectorNames[0],
          config: {
            'connector.class': 'io.confluent.connect.jdbc.JdbcSourceConnector',
            topics: 'test-topic',
          },
          tasks: [],
          type: 'source',
        }),
      });
    }
    return Promise.reject(new Error('Unknown URL: ' + url));
  });
}

describe('Auto-Refresh on Connector List', () => {
  it('should show auto-refresh toggle button', async () => {
    mockConnectorAPIs(['connector-1']);

    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    // Should show auto-refresh button with countdown
    expect(screen.getByRole('button', { name: /auto/i })).toBeInTheDocument();
    expect(screen.getByText(/Auto \(\d+s\)/)).toBeInTheDocument();
  });

  it('should start with auto-refresh enabled by default', async () => {
    mockConnectorAPIs(['connector-1']);

    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    // Should show enabled state (green background)
    const autoButton = screen.getByRole('button', { name: /Disable auto-refresh/i });
    expect(autoButton).toHaveClass('bg-emerald-50');
  });

  it('should toggle auto-refresh when button clicked', async () => {
    const user = userEvent.setup({ delay: null });
    mockConnectorAPIs(['connector-1']);

    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    const autoButton = screen.getByRole('button', { name: /Disable auto-refresh/i });

    // Click to disable
    await user.click(autoButton);

    await waitFor(() => {
      expect(screen.getByText('Auto: OFF')).toBeInTheDocument();
    });

    // Click to enable again
    await user.click(screen.getByRole('button', { name: /Enable auto-refresh/i }));

    await waitFor(() => {
      expect(screen.getByText(/Auto \(\d+s\)/)).toBeInTheDocument();
    });
  });

  it('should refresh connectors every 10 seconds when enabled', async () => {
    mockConnectorAPIs(['connector-1']);
    const fetchSpy = jest.spyOn(global, 'fetch');

    render(<Home />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    const initialCallCount = fetchSpy.mock.calls.length;

    // Advance time by 10 seconds
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Should have made another fetch
    await waitFor(() => {
      expect(fetchSpy.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    // Advance another 10 seconds
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Should have made yet another fetch
    await waitFor(() => {
      expect(fetchSpy.mock.calls.length).toBeGreaterThan(initialCallCount + 3); // +3 because each connector fetch makes multiple calls
    });
  });

  it('should not refresh when auto-refresh is disabled', async () => {
    const user = userEvent.setup({ delay: null });
    mockConnectorAPIs(['connector-1']);
    const fetchSpy = jest.spyOn(global, 'fetch');

    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    // Disable auto-refresh
    const autoButton = screen.getByRole('button', { name: /Disable auto-refresh/i });
    await user.click(autoButton);

    await waitFor(() => {
      expect(screen.getByText('Auto: OFF')).toBeInTheDocument();
    });

    const callCountAfterDisable = fetchSpy.mock.calls.length;

    // Advance time by 20 seconds
    act(() => {
      jest.advanceTimersByTime(20000);
    });

    // Should not have made additional fetches
    await waitFor(() => {
      expect(fetchSpy.mock.calls.length).toBe(callCountAfterDisable);
    });
  });

  it('should update countdown every second', async () => {
    mockConnectorAPIs(['connector-1']);

    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    // Should start at 10 seconds
    expect(screen.getByText(/Auto \(10s\)/)).toBeInTheDocument();

    // Advance 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByText(/Auto \(9s\)/)).toBeInTheDocument();
    });

    // Advance another second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByText(/Auto \(8s\)/)).toBeInTheDocument();
    });
  });

  it('should reset countdown to 10 after reaching 0', async () => {
    mockConnectorAPIs(['connector-1']);

    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    // Advance to just before reset (9 seconds)
    act(() => {
      jest.advanceTimersByTime(9000);
    });

    await waitFor(() => {
      expect(screen.getByText(/Auto \(1s\)/)).toBeInTheDocument();
    });

    // Advance 1 more second (should reset to 10)
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByText(/Auto \(10s\)/)).toBeInTheDocument();
    });
  });

  it('should cleanup intervals on unmount', async () => {
    mockConnectorAPIs(['connector-1']);
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const { unmount } = render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    unmount();

    // Should have cleared both intervals (refresh + countdown)
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
  });

  it('should maintain auto-refresh state across re-renders', async () => {
    const user = userEvent.setup({ delay: null });
    mockConnectorAPIs(['connector-1', 'connector-2']);

    const { rerender } = render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    // Disable auto-refresh
    const autoButton = screen.getByRole('button', { name: /Disable auto-refresh/i });
    await user.click(autoButton);

    await waitFor(() => {
      expect(screen.getByText('Auto: OFF')).toBeInTheDocument();
    });

    // Force re-render
    rerender(<Home />);

    // Should still be disabled
    expect(screen.getByText('Auto: OFF')).toBeInTheDocument();
  });

  it('should show countdown even when loading', async () => {
    // Mock slow fetch
    (global.fetch as jest.Mock).mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => [],
      }), 5000))
    );

    render(<Home />);

    // Should show countdown while loading
    await waitFor(() => {
      expect(screen.getByText(/Auto \(\d+s\)/)).toBeInTheDocument();
    });

    // Countdown should continue during loading
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByText(/Auto \(\d+s\)/)).toBeInTheDocument();
    });
  });

  it('should not break when switching auto-refresh rapidly', async () => {
    const user = userEvent.setup({ delay: null });
    mockConnectorAPIs(['connector-1']);

    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    // Rapidly toggle 5 times
    for (let i = 0; i < 5; i++) {
      const button = screen.getByRole('button', { name: /auto-refresh/i });
      await user.click(button);
    }

    // Should still work - final state should be disabled (odd number of clicks)
    await waitFor(() => {
      expect(screen.getByText('Auto: OFF')).toBeInTheDocument();
    });
  });
});

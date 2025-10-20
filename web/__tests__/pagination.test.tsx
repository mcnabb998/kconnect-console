import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
  mockSearchParams.get.mockReturnValue(null);
  mockRouter.replace.mockClear();
});

// Helper to create mock connectors
function createMockConnectors(count: number) {
  return Array.from({ length: count }, (_, i) => `connector-${i + 1}`);
}

// Helper to mock the API responses
function mockConnectorAPIs(connectorNames: string[]) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    // List connectors endpoint
    if (url.includes('/connectors') && !url.includes('/status')) {
      return Promise.resolve({
        ok: true,
        json: async () => connectorNames,
      });
    }

    // Status endpoint
    if (url.includes('/status')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          connector: { state: 'RUNNING', worker_id: 'worker-1' },
          tasks: [{ id: 0, state: 'RUNNING', worker_id: 'worker-1' }],
        }),
      });
    }

    // Config endpoint
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

describe('Connector List Pagination', () => {
  it('should not show pagination controls with 20 or fewer connectors', async () => {
    const connectors = createMockConnectors(15);
    mockConnectorAPIs(connectors);

    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    // Should not show pagination UI
    expect(screen.queryByText(/Previous/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Next/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Page \d+ of \d+/i)).not.toBeInTheDocument();
  });

  it('should show pagination controls with more than 20 connectors', async () => {
    const connectors = createMockConnectors(50);
    mockConnectorAPIs(connectors);

    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    // Should show pagination UI
    expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/50 total connectors/i)).toBeInTheDocument();
  });

  it('should display only 20 connectors per page', async () => {
    const connectors = createMockConnectors(50);
    mockConnectorAPIs(connectors);

    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    // Count table rows (excluding header)
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');

    // Should have header row + 20 data rows = 21 total
    expect(rows.length).toBe(21);
  });

  it('should navigate to next page when clicking Next button', async () => {
    const user = userEvent.setup();
    const connectors = createMockConnectors(50);
    mockConnectorAPIs(connectors);

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
    });

    const nextButton = screen.getAllByRole('button', { name: /Next/i })[0];
    await user.click(nextButton);

    // Should update URL
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('?page=2', { scroll: false });
    });
  });

  it('should navigate to previous page when clicking Previous button', async () => {
    const user = userEvent.setup();
    const connectors = createMockConnectors(50);
    mockConnectorAPIs(connectors);

    // Start on page 2
    mockSearchParams.get.mockReturnValue('2');
    mockSearchParams.toString.mockReturnValue('page=2');

    render(<Home />);

    // Wait for data to load first
    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    // Should be on page 2
    await waitFor(() => {
      expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    const prevButton = screen.getAllByRole('button', { name: /Previous/i })[0];
    await user.click(prevButton);

    // Should update URL to page 1 (which removes page param)
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/', { scroll: false });
    });
  });

  it('should disable Previous button on first page', async () => {
    const connectors = createMockConnectors(50);
    mockConnectorAPIs(connectors);

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
    });

    const prevButtons = screen.getAllByRole('button', { name: /Previous/i });
    prevButtons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('should disable Next button on last page', async () => {
    const connectors = createMockConnectors(50);
    mockConnectorAPIs(connectors);

    // Start on last page (page 3)
    mockSearchParams.get.mockReturnValue('3');
    mockSearchParams.toString.mockReturnValue('page=3');

    render(<Home />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Page 3 of 3/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    const nextButtons = screen.getAllByRole('button', { name: /Next/i });
    nextButtons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('should reset to page 1 when search term changes', async () => {
    const user = userEvent.setup();
    const connectors = createMockConnectors(50);
    mockConnectorAPIs(connectors);

    // Start on page 2
    mockSearchParams.get.mockReturnValue('2');
    mockSearchParams.toString.mockReturnValue('page=2');

    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Type in search box
    const searchInput = screen.getByPlaceholderText(/Search connectors/i);
    await user.type(searchInput, 'test');

    // Should reset to page 1
    await waitFor(() => {
      // The component should try to navigate to page 1 (root path)
      expect(mockRouter.replace).toHaveBeenCalledWith('/', { scroll: false });
    });
  });

  it('should reset to page 1 when state filter changes', async () => {
    const user = userEvent.setup();
    const connectors = createMockConnectors(50);
    mockConnectorAPIs(connectors);

    // Start on page 2
    mockSearchParams.get.mockReturnValue('2');
    mockSearchParams.toString.mockReturnValue('page=2');

    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Change state filter
    const filterSelect = screen.getByRole('combobox');
    await user.selectOptions(filterSelect, 'running');

    // Should reset to page 1
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/', { scroll: false });
    });
  });

  it('should initialize page from URL query parameter', async () => {
    const connectors = createMockConnectors(50);
    mockConnectorAPIs(connectors);

    // URL has page=2
    mockSearchParams.get.mockReturnValue('2');
    mockSearchParams.toString.mockReturnValue('page=2');

    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading connectors/i)).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should handle invalid page numbers gracefully', async () => {
    const connectors = createMockConnectors(50);
    mockConnectorAPIs(connectors);

    // URL has invalid page number
    mockSearchParams.get.mockReturnValue('0');

    render(<Home />);

    await waitFor(() => {
      // Should default to page 1
      expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
    });
  });

  it('should calculate correct total pages', async () => {
    const testCases = [
      { count: 20, expectedPages: 1 },
      { count: 21, expectedPages: 2 },
      { count: 40, expectedPages: 2 },
      { count: 41, expectedPages: 3 },
      { count: 100, expectedPages: 5 },
    ];

    for (const { count, expectedPages } of testCases) {
      jest.clearAllMocks();
      const connectors = createMockConnectors(count);
      mockConnectorAPIs(connectors);

      const { unmount } = render(<Home />);

      await waitFor(() => {
        if (count > 20) {
          expect(screen.getByText(new RegExp(`Page 1 of ${expectedPages}`, 'i'))).toBeInTheDocument();
        }
      });

      unmount();
    }
  });
});

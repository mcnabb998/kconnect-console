import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Home from '../app/page';

// Mock Next.js navigation hooks
const mockRouter = {
  replace: jest.fn(),
  push: jest.fn(),
};

const mockSearchParams = {
  get: jest.fn(),
  toString: jest.fn(() => ''),
};

describe('Home page', () => {
  const fetchMock = jest.fn();

  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Setup navigation mocks
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    mockSearchParams.get.mockReturnValue(null);
    mockRouter.replace.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('shows a loading indicator while fetching connectors', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    await act(async () => {
      render(<Home />);
    });

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getAllByText(/Loading connectors/i).length).toBeGreaterThan(0);
  });

  it('renders connectors when the fetch succeeds', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ['Connector A', 'Connector B']
    } as Response);

    await act(async () => {
      render(<Home />);
    });

    await waitFor(() => {
      expect(screen.getByText('Connector A')).toBeInTheDocument();
      expect(screen.getByText('Connector B')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/default/connectors',
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('shows an empty state when no connectors are returned', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => []
    } as Response);

    await act(async () => {
      render(<Home />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'No connectors yet' })).toBeInTheDocument();
    });
  });

  it('shows "Create your first connector" CTA and getting started link when no connectors exist', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => []
    } as Response);

    await act(async () => {
      render(<Home />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'No connectors yet' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Create your first connector/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /View getting started guide/i })).toBeInTheDocument();
    });
  });

  it('displays an error message when the fetch fails and allows retry', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false
    } as Response);

    await act(async () => {
      render(<Home />);
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch connectors')).toBeInTheDocument();
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ['Recovered Connector']
    } as Response);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    });

    await waitFor(() => {
      expect(screen.getByText('Recovered Connector')).toBeInTheDocument();
    });
  });

  it('shows filtered empty state with clear filters button when search filters out all connectors', async () => {
    // Mock API responses for connectors
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            connector: { state: 'RUNNING', worker_id: 'worker-1' },
            tasks: [{ id: 0, state: 'RUNNING' }],
          }),
        });
      }
      if (url.includes('/connectors') && !url.includes('/status')) {
        const match = url.match(/\/connectors\/([^/]+)$/);
        if (match) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              name: match[1],
              config: { 'connector.class': 'TestConnector' },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ['my-connector'],
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    await act(async () => {
      render(<Home />);
    });

    // Wait for connectors to load
    await waitFor(() => {
      expect(screen.getByText('my-connector')).toBeInTheDocument();
    });

    // Type in search box to filter out all connectors
    const searchInput = screen.getByPlaceholderText(/Search connectors/i);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    });

    // Check for filtered empty state
    await waitFor(() => {
      expect(screen.getByText(/No connectors match your filters/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Clear filters/i })).toBeInTheDocument();
    });
  });

  it('clears search term when clear filters button is clicked', async () => {
    // Mock API responses
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            connector: { state: 'RUNNING', worker_id: 'worker-1' },
            tasks: [{ id: 0, state: 'RUNNING' }],
          }),
        });
      }
      if (url.includes('/connectors') && !url.includes('/status')) {
        const match = url.match(/\/connectors\/([^/]+)$/);
        if (match) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              name: match[1],
              config: { 'connector.class': 'TestConnector' },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ['test-connector'],
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    await act(async () => {
      render(<Home />);
    });

    // Wait for connectors to load
    await waitFor(() => {
      expect(screen.getByText('test-connector')).toBeInTheDocument();
    });

    // Type in search box to filter
    const searchInput = screen.getByPlaceholderText(/Search connectors/i);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    });

    // Wait for filtered empty state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Clear filters/i })).toBeInTheDocument();
    });

    // Click clear filters button
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Clear filters/i }));
    });

    // Check that search is cleared and connector is visible again
    await waitFor(() => {
      expect(searchInput).toHaveValue('');
      expect(screen.getByText('test-connector')).toBeInTheDocument();
    });
  });

  it('clears state filter when clear filters button is clicked', async () => {
    // Mock API responses
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            connector: { state: 'RUNNING', worker_id: 'worker-1' },
            tasks: [{ id: 0, state: 'RUNNING' }],
          }),
        });
      }
      if (url.includes('/connectors') && !url.includes('/status')) {
        const match = url.match(/\/connectors\/([^/]+)$/);
        if (match) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              name: match[1],
              config: { 'connector.class': 'TestConnector' },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ['running-connector'],
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    await act(async () => {
      render(<Home />);
    });

    // Wait for connectors to load
    await waitFor(() => {
      expect(screen.getByText('running-connector')).toBeInTheDocument();
    });

    // Change state filter to "paused" (no connectors match)
    const stateFilter = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.change(stateFilter, { target: { value: 'paused' } });
    });

    // Wait for filtered empty state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Clear filters/i })).toBeInTheDocument();
    });

    // Click clear filters button
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Clear filters/i }));
    });

    // Check that state filter is cleared and connector is visible again
    await waitFor(() => {
      expect(stateFilter).toHaveValue('all');
      expect(screen.getByText('running-connector')).toBeInTheDocument();
    });
  });
});

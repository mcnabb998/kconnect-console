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

  it('has proper aria-labelledby associations for checkboxes', async () => {
    // Mock responses for connectors list
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ['Test-Connector-1', 'Test-Connector-2']
    } as Response);

    // Mock responses for status endpoints
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        connector: { state: 'RUNNING', worker_id: 'worker-1' },
        tasks: []
      })
    } as Response);

    await act(async () => {
      render(<Home />);
    });

    await waitFor(() => {
      expect(screen.getByText('Test-Connector-1')).toBeInTheDocument();
      expect(screen.getByText('Test-Connector-2')).toBeInTheDocument();
    });

    // Get connector name elements
    const connector1Link = screen.getByText('Test-Connector-1');
    const connector2Link = screen.getByText('Test-Connector-2');

    // Verify they have IDs
    expect(connector1Link.closest('a')).toHaveAttribute('id', 'connector-name-Test-Connector-1');
    expect(connector2Link.closest('a')).toHaveAttribute('id', 'connector-name-Test-Connector-2');

    // Get checkboxes - exclude the select-all checkbox
    const checkboxes = screen.getAllByRole('checkbox').filter(cb => 
      cb.getAttribute('aria-labelledby') !== null
    );

    expect(checkboxes.length).toBe(2);

    // Verify aria-labelledby matches the connector name IDs
    expect(checkboxes[0]).toHaveAttribute('aria-labelledby', 'connector-name-Test-Connector-1');
    expect(checkboxes[1]).toHaveAttribute('aria-labelledby', 'connector-name-Test-Connector-2');
  });
});

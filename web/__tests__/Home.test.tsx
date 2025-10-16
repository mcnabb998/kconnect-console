import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Home from '../app/page';

describe('Home page', () => {
  const fetchMock = jest.fn();

  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('shows a loading indicator while fetching connectors', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    render(<Home />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getAllByText(/Loading connectors/i).length).toBeGreaterThan(0);
  });

  it('renders connectors when the fetch succeeds', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ['Connector A', 'Connector B']
    } as Response);

    render(<Home />);

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

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'No connectors yet' })).toBeInTheDocument();
    });
  });

  it('displays an error message when the fetch fails and allows retry', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false
    } as Response);

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch connectors')).toBeInTheDocument();
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ['Recovered Connector']
    } as Response);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(screen.getByText('Recovered Connector')).toBeInTheDocument();
    });
  });
});

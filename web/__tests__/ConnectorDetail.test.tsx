import { act, render, screen, waitFor } from '@testing-library/react';
import ConnectorDetail from '../app/connectors/[name]/page';
import { useParams, useRouter } from 'next/navigation';

describe('ConnectorDetail page', () => {
  const fetchMock = jest.fn();
  const mockedUseParams = useParams as unknown as jest.Mock;
  const mockedUseRouter = useRouter as unknown as jest.Mock;
  let replace: jest.Mock;
  let push: jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    replace = jest.fn();
    push = jest.fn();
    mockedUseParams.mockReturnValue({ name: 'connector-one' });
    mockedUseRouter.mockReturnValue({ replace, push });
    window.history.replaceState({}, '', '/connectors/connector-one');
  });

  afterEach(() => {
    jest.useRealTimers();
    window.history.replaceState({}, '', '/');
  });

  it('shows a loading indicator while connector details are loading', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    render(<ConnectorDetail />);

    expect(screen.getByText('Loading connector details...')).toBeInTheDocument();
  });

  it('renders connector details and dismisses the creation toast', async () => {
    jest.useFakeTimers();

    const statusResponse = {
      ok: true,
      json: async () => ({
        name: 'connector-one',
        connector: { state: 'RUNNING', worker_id: 'worker-1' },
        tasks: [
          { id: 1, state: 'RUNNING', worker_id: 'worker-1' }
        ],
        type: 'sink'
      })
    } as Response;

    const configResponse = {
      ok: true,
      json: async () => ({
        name: 'connector-one',
        config: {
          'connector.class': 'io.confluent.kafka.connect.datagen.DatagenConnector',
          'tasks.max': '1',
          topics: 'test-topic'
        },
        tasks: [],
        type: 'sink'
      })
    } as Response;

    fetchMock.mockResolvedValueOnce(statusResponse).mockResolvedValueOnce(configResponse);

    window.history.replaceState({}, '', '/connectors/connector-one?created=true');

    render(<ConnectorDetail />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Status' })).toBeInTheDocument();
      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(
        screen.getByText('Connector "connector-one" has been created successfully.')
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText('RUNNING').length).toBeGreaterThan(0);
    expect(screen.getAllByText('worker-1')[0]).toBeInTheDocument();

    expect(replace).toHaveBeenCalledWith('/connectors/connector-one', undefined);

    expect(
      screen.getByText(/"connector.class": "io\.confluent\.kafka\.connect\.datagen\.DatagenConnector"/)
    ).toBeInTheDocument();

    act(() => {
      jest.runOnlyPendingTimers();
    });

    await waitFor(() => {
      expect(
        screen.queryByText('Connector "connector-one" has been created successfully.')
      ).not.toBeInTheDocument();
    });
  });

  it('displays an error message when fetching details fails', async () => {
    const statusFailure = {
      ok: false
    } as Response;

    const configSuccess = {
      ok: true,
      json: async () => ({})
    } as Response;

    fetchMock.mockResolvedValueOnce(statusFailure).mockResolvedValueOnce(configSuccess);

    render(<ConnectorDetail />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch connector details')).toBeInTheDocument();
    });

    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ConnectorDetail from '../app/connectors/[name]/page';
import { useParams, useRouter } from 'next/navigation';

describe('ConnectorDetail page', () => {
  const fetchMock = jest.fn();
  const mockedUseParams = useParams as unknown as jest.Mock;
  const mockedUseRouter = useRouter as unknown as jest.Mock;
  const originalConfirm = window.confirm;

  const baseStatus = {
    name: 'connector-one',
    connector: { state: 'RUNNING', worker_id: 'worker-1' },
    tasks: [],
    type: 'source',
  };

  const baseConfig = {
    name: 'connector-one',
    config: { topics: 'alpha' },
    tasks: [],
    type: 'source',
  };

  const makeResponse = <T,>(data: T, ok = true): Response =>
    ({
      ok,
      json: async () => data,
    }) as Response;

  const queueSuccessfulFetch = (
    status: any = baseStatus,
    config: any = baseConfig
  ) => {
    fetchMock.mockResolvedValueOnce(makeResponse(status));
    fetchMock.mockResolvedValueOnce(makeResponse(config));
  };

  let replace: jest.Mock;
  let push: jest.Mock;

  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    replace = jest.fn();
    push = jest.fn();
    mockedUseParams.mockReturnValue({ name: 'connector-one' });
    mockedUseRouter.mockReturnValue({ replace, push });
    window.history.replaceState({}, '', '/connectors/connector-one');
    window.confirm = originalConfirm;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    window.history.replaceState({}, '', '/');
    window.confirm = originalConfirm;
    consoleErrorSpy.mockRestore();
  });

  it('shows a loading indicator while connector details are loading', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    render(<ConnectorDetail />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText(/Loading connector details/i)).toBeInTheDocument();
  });

  it('renders connector details and dismisses the creation toast', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    queueSuccessfulFetch(
      {
        name: 'connector-one',
        connector: { state: 'RUNNING', worker_id: 'worker-1' },
        tasks: [{ id: 1, state: 'RUNNING', worker_id: 'worker-1' }],
        type: 'sink',
      },
      {
        name: 'connector-one',
        config: {
          'connector.class': 'io.confluent.kafka.connect.datagen.DatagenConnector',
          'tasks.max': '1',
          topics: 'test-topic',
        },
        tasks: [],
        type: 'sink',
      }
    );

    window.history.replaceState({}, '', '/connectors/connector-one?created=true');

    render(<ConnectorDetail />);

    await screen.findByRole('heading', { name: 'Status' });
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(
      screen.getByText('Connector "connector-one" created successfully')
    ).toBeInTheDocument();

    expect(screen.getAllByText('RUNNING').length).toBeGreaterThan(0);
    expect(screen.getAllByText('worker-1')[0]).toBeInTheDocument();

    expect(replace).toHaveBeenCalledWith('/connectors/connector-one', undefined);

    expect(
      screen.getByText(/"connector.class": "io\.confluent\.kafka\.connect\.datagen\.DatagenConnector"/)
    ).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(
        screen.queryByText('Connector "connector-one" created successfully')
      ).not.toBeInTheDocument();
    });

    setTimeoutSpy.mockRestore();
  });

  it('displays an error message when fetching details fails', async () => {
    jest.useFakeTimers();
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

  it('schedules a refresh after successful actions', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    queueSuccessfulFetch();

    render(<ConnectorDetail />);

    await screen.findByText('Connector State');

    fetchMock.mockResolvedValueOnce(makeResponse({}, true));
    queueSuccessfulFetch({
      ...baseStatus,
      connector: { ...baseStatus.connector, state: 'PAUSED' },
    });

    const pauseActionIndex = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(pauseActionIndex + 1);
    });

    const pauseCall = fetchMock.mock.calls[pauseActionIndex];
    expect(pauseCall?.[0]).toContain('/connectors/connector-one/pause');
    expect(pauseCall?.[1]).toMatchObject({ method: 'PUT' });
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getAllByText('PAUSED').length).toBeGreaterThan(0);
    });

    fetchMock.mockResolvedValueOnce(makeResponse({}, true));
    queueSuccessfulFetch();

    const restartActionIndex = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(restartActionIndex + 1);
    });

    const restartCall = fetchMock.mock.calls[restartActionIndex];
    expect(restartCall?.[0]).toContain('/connectors/connector-one/restart');
    expect(restartCall?.[1]).toMatchObject({ method: 'POST' });
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getAllByText('RUNNING').length).toBeGreaterThan(0);
    });

    setTimeoutSpy.mockRestore();
  });

  it('shows errors when actions fail', async () => {
    jest.useFakeTimers();
    queueSuccessfulFetch();

    render(<ConnectorDetail />);

    await screen.findByText('Connector State');

    fetchMock.mockResolvedValueOnce(makeResponse({}, false));

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    // Check for error toast
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      const hasErrorMessage = alerts.some(alert =>
        alert.textContent?.includes('Failed to pause connector')
      );
      expect(hasErrorMessage).toBe(true);
    });
  });

  it('redirects after successful deletion', async () => {
    jest.useFakeTimers();
    queueSuccessfulFetch();

    render(<ConnectorDetail />);

    await screen.findByText('Connector State');

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(makeResponse({}, true));

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/');
    });

    const deleteCall = fetchMock.mock.calls.at(-1);
    expect(deleteCall?.[0]).toContain('/connectors/connector-one');
    expect(deleteCall?.[1]).toMatchObject({ method: 'DELETE' });

    confirmSpy.mockRestore();
  });

  it('does not delete the connector when confirmation is cancelled', async () => {
    jest.useFakeTimers();
    queueSuccessfulFetch();

    render(<ConnectorDetail />);

    await screen.findByText('Connector State');

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(push).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('surfaces errors when deletion fails', async () => {
    jest.useFakeTimers();
    queueSuccessfulFetch();

    render(<ConnectorDetail />);

    await screen.findByText('Connector State');

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(makeResponse({}, false));

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // Check for error toast
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      const hasErrorMessage = alerts.some(alert =>
        alert.textContent?.includes('Failed to delete connector')
      );
      expect(hasErrorMessage).toBe(true);
    });

    expect(push).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('disables all action buttons when any action is in progress', async () => {
    jest.useFakeTimers();
    queueSuccessfulFetch();

    render(<ConnectorDetail />);

    await screen.findByText('Connector State');

    // Mock a slow pause action that won't complete immediately
    fetchMock.mockImplementation(() => new Promise(() => {}));

    const pauseButton = screen.getByRole('button', { name: 'Pause' });
    const restartButton = screen.getByRole('button', { name: 'Restart' });
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    const resumeButton = screen.getByRole('button', { name: 'Resume' });

    // Initially, only Resume should be disabled (connector is RUNNING)
    expect(pauseButton).not.toBeDisabled();
    expect(restartButton).not.toBeDisabled();
    expect(deleteButton).not.toBeDisabled();
    expect(resumeButton).toBeDisabled();

    // Click pause - should disable all buttons
    fireEvent.click(pauseButton);

    // Wait for the loading state to be applied
    await waitFor(() => {
      expect(screen.getByText('Pausing...')).toBeInTheDocument();
    });

    // All buttons should now be disabled while pause is in progress
    expect(pauseButton).toBeDisabled();
    expect(resumeButton).toBeDisabled();
    expect(restartButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
  });
});

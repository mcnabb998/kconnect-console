import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConnectorBulkActions } from '@/components/ConnectorBulkActions';
import { bulkConnectorAction } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  bulkConnectorAction: jest.fn(),
}));

describe('ConnectorBulkActions', () => {
  const bulkActionMock = bulkConnectorAction as jest.MockedFunction<typeof bulkConnectorAction>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('disables actions when nothing is selected', () => {
    render(<ConnectorBulkActions selected={[]} onClearSelection={jest.fn()} />);

    const pauseButton = screen.getByRole('button', { name: 'Pause' });
    expect(pauseButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeDisabled();
  });

  it('runs the chosen action and clears selection on success', async () => {
    const onClearSelection = jest.fn();
    const onActionComplete = jest.fn();
    bulkActionMock.mockResolvedValue({ successes: ['alpha'], failures: [] });

    render(
      <ConnectorBulkActions
        selected={['alpha']}
        onClearSelection={onClearSelection}
        onActionComplete={onActionComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(bulkActionMock).toHaveBeenCalledWith(['alpha'], 'pause');

    await waitFor(() => {
      expect(onClearSelection).toHaveBeenCalled();
      expect(onActionComplete).toHaveBeenCalled();
      expect(screen.getByText('Paused 1 of 1 connector.')).toBeInTheDocument();
    });
  });

  it('shows failures and keeps selection when some actions fail', async () => {
    const onClearSelection = jest.fn();
    bulkActionMock.mockResolvedValue({
      successes: ['alpha'],
      failures: [{ name: 'beta', error: 'Forbidden' }],
    });

    render(<ConnectorBulkActions selected={['alpha', 'beta']} onClearSelection={onClearSelection} />);

    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));

    await waitFor(() => {
      expect(screen.getByText('Restarted 1 of 2 connectors.')).toBeInTheDocument();
      const failureRow = screen.getByText('beta').closest('li');
      expect(failureRow).toHaveTextContent('Forbidden');
    });

    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it('surfaces errors from the API helper', async () => {
    bulkActionMock.mockRejectedValue(new Error('boom'));

    render(<ConnectorBulkActions selected={['alpha']} onClearSelection={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByText('boom')).toBeInTheDocument();
    });
  });
});

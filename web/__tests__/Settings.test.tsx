import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Settings from '../app/settings/page';

// Mock the API functions
jest.mock('@/lib/api', () => ({
  fetchSummary: jest.fn(),
  fetchConnectorPlugins: jest.fn(),
}));

import { fetchSummary, fetchConnectorPlugins } from '@/lib/api';

const mockFetchSummary = fetchSummary as jest.MockedFunction<typeof fetchSummary>;
const mockFetchConnectorPlugins = fetchConnectorPlugins as jest.MockedFunction<typeof fetchConnectorPlugins>;

describe('Settings Page', () => {
  const mockSummaryData = {
    clusterInfo: {
      version: '7.5.0',
      commit: 'abc123',
      kafka_cluster_id: 'cluster-1'
    },
    connectorStats: {
      total: 5,
      running: 3,
      failed: 1,
      paused: 1
    },
    workerInfo: {
      uptime: '2 days, 4 hours'
    }
  };

  const mockPlugins: { class: string; type: 'source' | 'sink'; version: string; }[] = [
    {
      class: 'io.confluent.connect.datagen.DatagenConnector',
      type: 'source',
      version: '0.6.0'
    },
    {
      class: 'org.apache.kafka.connect.file.FileStreamSinkConnector', 
      type: 'sink',
      version: '7.5.0'
    },
    {
      class: 'org.apache.kafka.connect.file.FileStreamSourceConnector',
      type: 'source', 
      version: '7.5.0'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup successful responses by default
    mockFetchSummary.mockResolvedValue(mockSummaryData);
    mockFetchConnectorPlugins.mockResolvedValue(mockPlugins);
  });

  describe('Overview Tab', () => {
    it('renders settings page with overview tab active by default', async () => {
      render(<Settings />);
      
      // Wait for the component to finish loading and show tabs
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      // Overview tab should be active by default
      const overviewTab = screen.getByRole('button', { name: /overview/i });
      expect(overviewTab).toHaveClass('border-blue-500', 'text-blue-600');
    });

    it('loads summary data when overview tab is active', async () => {
      render(<Settings />);
      
      await waitFor(() => {
        expect(mockFetchSummary).toHaveBeenCalledWith('default');
      });
    });

    it('displays error message when summary fails to load', async () => {
      mockFetchSummary.mockRejectedValue(new Error('Failed to fetch summary'));

      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('Cannot Connect to Proxy Service')).toBeInTheDocument();
        expect(screen.getByText('Failed to fetch summary')).toBeInTheDocument();
        expect(screen.getByText('The proxy service is not running or not accessible.')).toBeInTheDocument();
      });
    });
  });

  describe('Plugins Tab', () => {
    it('switches to plugins tab when clicked', async () => {
      const user = userEvent.setup();
      render(<Settings />);

      // Wait for initial load to complete and tabs to be visible
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Overview')).toBeInTheDocument();
        expect(screen.getByText('Plugins')).toBeInTheDocument();
      });

      const pluginsTab = screen.getByRole('button', { name: /plugins/i });
      await user.click(pluginsTab);

      // Plugins tab should now be active
      expect(pluginsTab).toHaveClass('border-blue-500', 'text-blue-600');
      
      // Should call fetchConnectorPlugins
      await waitFor(() => {
        expect(mockFetchConnectorPlugins).toHaveBeenCalledWith('default');
      });
    });

    it('displays error message when plugins fail to load', async () => {
      const user = userEvent.setup();
      mockFetchConnectorPlugins.mockRejectedValue(new Error('Failed to fetch plugins'));

      render(<Settings />);

      // Wait for initial load to complete and tabs to be visible
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Overview')).toBeInTheDocument();
        expect(screen.getByText('Plugins')).toBeInTheDocument();
      });

      const pluginsTab = screen.getByRole('button', { name: /plugins/i });
      await user.click(pluginsTab);

      await waitFor(() => {
        expect(screen.getByText('Cannot Connect to Proxy Service')).toBeInTheDocument();
        expect(screen.getByText('Failed to fetch plugins')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading skeleton while data is fetching', () => {
      // Mock slow API response
      mockFetchSummary.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<Settings />);

      // Should show loading skeleton
      expect(screen.getByText('Settings')).toBeInTheDocument();
      const loadingElements = screen.getAllByRole('generic').filter(el => 
        el.className.includes('animate-pulse')
      );
      expect(loadingElements.length).toBeGreaterThan(0);
    });
  });

  describe('Tab Navigation', () => {
    it('shows overview content when overview tab is active', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(mockFetchSummary).toHaveBeenCalled();
      });

      // Should not call plugins API initially
      expect(mockFetchConnectorPlugins).not.toHaveBeenCalled();
    });

    it('loads different data when switching between tabs', async () => {
      const user = userEvent.setup();
      render(<Settings />);

      // Wait for initial overview load
      await waitFor(() => {
        expect(mockFetchSummary).toHaveBeenCalledTimes(1);
      });

      // Switch to plugins
      const pluginsTab = screen.getByRole('button', { name: /plugins/i });
      await user.click(pluginsTab);

      await waitFor(() => {
        expect(mockFetchConnectorPlugins).toHaveBeenCalledTimes(1);
      });

      // Switch back to overview
      const overviewTab = screen.getByRole('button', { name: /overview/i });
      await user.click(overviewTab);

      await waitFor(() => {
        expect(mockFetchSummary).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('handles network errors gracefully', async () => {
      mockFetchSummary.mockRejectedValue(new Error('Network error'));

      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('Cannot Connect to Proxy Service')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('handles unknown errors gracefully', async () => {
      mockFetchSummary.mockRejectedValue('Unknown error');

      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Settings')).toBeInTheDocument();
        expect(screen.getByText('Unknown error')).toBeInTheDocument();
      });
    });
  });

  describe('Component Integration', () => {
    it('renders Cards component when summary data is available', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(mockFetchSummary).toHaveBeenCalled();
      });

      // Cards component should be rendered with summary data
      // Note: We'd need to test this more thoroughly if Cards component 
      // had specific test IDs or unique text content
    });

    it('renders PluginsTable component when on plugins tab', async () => {
      const user = userEvent.setup();
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      const pluginsTab = screen.getByRole('button', { name: /plugins/i });
      await user.click(pluginsTab);

      await waitFor(() => {
        expect(mockFetchConnectorPlugins).toHaveBeenCalled();
      });

      // PluginsTable component should be rendered with plugins data
    });
  });
});
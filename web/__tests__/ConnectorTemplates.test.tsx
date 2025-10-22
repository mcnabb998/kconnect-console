import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import NewConnectorPage from '../app/connectors/templates/page';

// Mock Next.js navigation hooks
const mockRouter = {
  push: jest.fn(),
};

// Mock API functions
jest.mock('@/lib/api', () => ({
  listPlugins: jest.fn(),
  validateConfig: jest.fn(),
  createConnector: jest.fn(),
  checkPluginAvailability: jest.fn(),
  KafkaConnectApiError: class KafkaConnectApiError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'KafkaConnectApiError';
    }
  },
  extractValidationErrors: jest.fn(() => ({})),
}));

// Mock the connector templates
jest.mock('@/data/connectorTemplates', () => ({
  connectorTemplates: [
    {
      id: 'datagen-source',
      name: 'DataGen Source',
      description: 'Generate sample data for testing',
      connectorClass: 'io.confluent.kafka.connect.datagen.DatagenConnector',
      type: 'source',
      category: 'other',
      icon: '🎲',
      defaultConfig: {
        'connector.class': 'io.confluent.kafka.connect.datagen.DatagenConnector',
        'tasks.max': '1',
      },
      requiredFields: ['kafka.topic'],
      documentation: 'https://docs.confluent.io/kafka-connect-datagen/current/',
    },
    {
      id: 'jdbc-source',
      name: 'JDBC Source',
      description: 'Connect to any JDBC-compatible database',
      connectorClass: 'io.confluent.connect.jdbc.JdbcSourceConnector',
      type: 'source',
      category: 'database',
      icon: '🗄️',
      defaultConfig: {
        'connector.class': 'io.confluent.connect.jdbc.JdbcSourceConnector',
        'tasks.max': '1',
      },
      requiredFields: ['connection.url'],
      documentation: 'https://docs.confluent.io/kafka-connect-jdbc/current/',
    },
  ],
  getTemplatesByCategory: jest.fn(),
}));

describe('NewConnectorPage - Template UX', () => {
  const { listPlugins, checkPluginAvailability, validateConfig } = require('@/lib/api');

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    
    // Default mock responses
    listPlugins.mockResolvedValue([
      {
        class: 'io.confluent.kafka.connect.datagen.DatagenConnector',
        type: 'source',
        version: '0.6.0',
      },
    ]);
    
    validateConfig.mockResolvedValue({
      configs: [],
    });
  });

  it('renders available templates as clickable with proper styling', async () => {
    // Only DataGen is available
    checkPluginAvailability.mockResolvedValue(
      new Set(['io.confluent.kafka.connect.datagen.DatagenConnector'])
    );

    await act(async () => {
      render(<NewConnectorPage />);
    });

    await waitFor(() => {
      // Find the card by finding the title and going up to the parent div with p-4 class
      const datagenTitle = screen.getByText('DataGen Source');
      const datagenCard = datagenTitle.closest('.p-4');
      expect(datagenCard).toHaveClass('cursor-pointer');
      expect(datagenCard).not.toHaveClass('cursor-not-allowed');
      expect(datagenCard).not.toHaveClass('pointer-events-none');
      expect(screen.getByText('🟢 Available')).toBeInTheDocument();
    });
  });

  it('renders unavailable templates with disabled styling', async () => {
    // No plugins available
    checkPluginAvailability.mockResolvedValue(new Set());

    await act(async () => {
      render(<NewConnectorPage />);
    });

    await waitFor(() => {
      const datagenTitle = screen.getByText('DataGen Source');
      const datagenCard = datagenTitle.closest('.p-4');
      expect(datagenCard).toHaveClass('cursor-not-allowed');
      expect(datagenCard).toHaveClass('pointer-events-none');
      expect(datagenCard).toHaveClass('opacity-60');
      expect(screen.getAllByText('🔴 Unavailable')[0]).toBeInTheDocument();
    });
  });

  it('shows plugin class name and installation link for unavailable templates', async () => {
    checkPluginAvailability.mockResolvedValue(new Set());

    await act(async () => {
      render(<NewConnectorPage />);
    });

    await waitFor(() => {
      // Both templates are unavailable, so we'll see two instances
      expect(screen.getAllByText('⚠️ Plugin Not Installed').length).toBeGreaterThan(0);
      expect(screen.getByText('io.confluent.kafka.connect.datagen.DatagenConnector')).toBeInTheDocument();
      expect(screen.getAllByText('📖 Installation Guide').length).toBeGreaterThan(0);
    });
  });

  it('applies strikethrough to unavailable template names', async () => {
    checkPluginAvailability.mockResolvedValue(new Set());

    await act(async () => {
      render(<NewConnectorPage />);
    });

    await waitFor(() => {
      const datagenTitle = screen.getByText('DataGen Source');
      expect(datagenTitle).toHaveClass('line-through');
      expect(datagenTitle).toHaveClass('text-gray-500');
    });
  });

  it('prevents clicking on unavailable templates', async () => {
    checkPluginAvailability.mockResolvedValue(new Set());

    await act(async () => {
      render(<NewConnectorPage />);
    });

    await waitFor(() => {
      const datagenTitle = screen.getByText('DataGen Source');
      const datagenCard = datagenTitle.closest('.p-4');
      // The card should have pointer-events-none class
      expect(datagenCard).toHaveClass('pointer-events-none');
    });

    // Try to click the card - it should not navigate
    const datagenTitle = screen.getByText('DataGen Source');
    const datagenCard = datagenTitle.closest('.p-4');
    if (datagenCard) {
      fireEvent.click(datagenCard);
    }

    // The step should still be 'template', not 'configure'
    expect(screen.getByText('Choose a Connector Template')).toBeInTheDocument();
    expect(screen.queryByText('Configure Connector')).not.toBeInTheDocument();
  });

  it('allows clicking on available templates and proceeds to configuration', async () => {
    checkPluginAvailability.mockResolvedValue(
      new Set(['io.confluent.kafka.connect.datagen.DatagenConnector'])
    );

    await act(async () => {
      render(<NewConnectorPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('DataGen Source')).toBeInTheDocument();
    });

    // Click the available template
    const datagenTitle = screen.getByText('DataGen Source');
    const datagenCard = datagenTitle.closest('.p-4');
    if (datagenCard) {
      await act(async () => {
        fireEvent.click(datagenCard);
      });
    }

    // Should navigate to configure step
    await waitFor(() => {
      expect(screen.getByText('Configure Connector')).toBeInTheDocument();
    });
  });

  it('sorts templates with available ones first', async () => {
    // Only JDBC is available
    checkPluginAvailability.mockResolvedValue(
      new Set(['io.confluent.connect.jdbc.JdbcSourceConnector'])
    );

    await act(async () => {
      render(<NewConnectorPage />);
    });

    await waitFor(() => {
      const templates = screen.getAllByText(/Source$/);
      // JDBC should come before DataGen since it's available
      expect(templates[0].textContent).toBe('JDBC Source');
    });
  });

  it('shows installation guide link that opens in new tab', async () => {
    checkPluginAvailability.mockResolvedValue(new Set());

    await act(async () => {
      render(<NewConnectorPage />);
    });

    await waitFor(() => {
      const links = screen.getAllByText('📖 Installation Guide');
      const link = links[0] as HTMLAnchorElement;
      expect(link).toHaveAttribute('href', 'https://docs.confluent.io/kafka-connect-datagen/current/');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});

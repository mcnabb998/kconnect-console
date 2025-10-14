import { render, screen } from '@testing-library/react';
import PluginsTable from '@/components/settings/PluginsTable';

describe('PluginsTable', () => {
  const mockPlugins = [
    {
      class: 'io.confluent.kafka.connect.datagen.DatagenConnector',
      type: 'source',
      version: '1.0.0'
    },
    {
      class: 'org.apache.kafka.connect.file.FileStreamSinkConnector',
      type: 'sink',
      version: '7.5.0'
    }
  ];

  it('renders plugins table with data', () => {
    render(<PluginsTable plugins={mockPlugins} />);
    
    // Check if table headers are present
    expect(screen.getByText('Plugin')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('Class')).toBeInTheDocument();
    
    // Check if plugin data is displayed
    expect(screen.getByText('DatagenConnector')).toBeInTheDocument();
    expect(screen.getByText('FileStreamSinkConnector')).toBeInTheDocument();
    expect(screen.getByText('source')).toBeInTheDocument();
    expect(screen.getByText('sink')).toBeInTheDocument();
  });

  it('shows correct plugin count', () => {
    render(<PluginsTable plugins={mockPlugins} />);
    expect(screen.getByText('Showing 2 of 2 plugins')).toBeInTheDocument();
  });

  it('shows empty state when no plugins', () => {
    render(<PluginsTable plugins={[]} />);
    expect(screen.getByText('No plugins found matching your criteria')).toBeInTheDocument();
  });
});
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import TransformationsTab, {
  applyToConnectorConfig,
  parseFromConnectorConfig,
} from '@/app/connectors/[name]/TransformationsTab';
import type { ConnectorGetResponse, SMTItem } from '@/types/connect';

jest.mock('@/lib/connectApi', () => ({
  getConnector: jest.fn(),
  putConnectorConfig: jest.fn(),
  listPlugins: jest.fn(),
  validateTransform: jest.fn(),
}));

const { listPlugins, validateTransform } = jest.requireMock('@/lib/connectApi');

describe('SMT utilities', () => {
  it('parses and applies connector config roundtrip', () => {
    const baseConfig = {
      'connector.class': 'demo',
      transforms: 'a,b',
      'transforms.a.type': 'InsertField',
      'transforms.a.static.field': 'env',
      'transforms.a.static.value': 'prod',
      'transforms.b.type': 'ReplaceField',
      'transforms.b.blacklist': 'password',
    };

    const parsed = parseFromConnectorConfig(baseConfig);
    expect(parsed).toEqual<SMTItem[]>([
      {
        alias: 'a',
        className: 'InsertField',
        params: {
          'static.field': 'env',
          'static.value': 'prod',
        },
      },
      {
        alias: 'b',
        className: 'ReplaceField',
        params: {
          blacklist: 'password',
        },
      },
    ]);

    const rebuilt = applyToConnectorConfig(baseConfig, parsed);
    expect(rebuilt).toMatchObject({
      transforms: 'a,b',
      'transforms.a.type': 'InsertField',
      'transforms.a.static.field': 'env',
      'transforms.a.static.value': 'prod',
      'transforms.b.type': 'ReplaceField',
      'transforms.b.blacklist': 'password',
    });
  });
});

describe('TransformationsTab', () => {
  const connector: ConnectorGetResponse = {
    name: 'alpha',
    config: {
      'connector.class': 'demo',
      transforms: 'mask',
      'transforms.mask.type': 'org.example.MaskField',
      'transforms.mask.blacklist': 'secret',
    },
  };

  beforeEach(() => {
    jest.useFakeTimers();
    listPlugins.mockResolvedValue([
      { class: 'org.example.MaskField', type: 'transformation', title: 'Mask Field' },
      { class: 'org.example.InsertField', type: 'transformation', title: 'Insert Field' },
    ]);
    validateTransform.mockResolvedValue({ error_count: 0, configs: [] });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('renders existing transforms and runs validation', async () => {
    render(<TransformationsTab name="alpha" initialConnector={connector} />);

    expect(await screen.findByText('Mask Field')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Transformations/i })).toBeInTheDocument();

    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(validateTransform).toHaveBeenCalledWith(
        'org.example.MaskField',
        expect.objectContaining({ 'transforms.mask.type': 'org.example.MaskField' })
      );
    });
  });

  it('allows adding and removing transforms', async () => {
    render(<TransformationsTab name="alpha" initialConnector={connector} />);

    await screen.findByText('Mask Field');

    fireEvent.click(screen.getByRole('button', { name: 'Add Transform' }));
    const aliasInputs = screen.getAllByLabelText('Alias');
    fireEvent.change(aliasInputs[aliasInputs.length - 1], { target: { value: 'adder' } });
    const classSelects = screen.getAllByLabelText('Class');
    fireEvent.change(classSelects[classSelects.length - 1], {
      target: { value: 'org.example.InsertField' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
    const fieldInputs = screen.getAllByPlaceholderText('field');
    const valueInputs = screen.getAllByPlaceholderText('value');
    const fieldInput = fieldInputs[fieldInputs.length - 1];
    const valueInput = valueInputs[valueInputs.length - 1];
    fireEvent.change(fieldInput, { target: { value: 'static.field' } });
    fireEvent.change(valueInput, { target: { value: 'env' } });
    const confirmButtons = screen.getAllByRole('button', { name: 'Add Transform' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('adder')).toBeInTheDocument();
    });

    const newCard = screen.getByText('adder').closest('li');
    if (!newCard) {
      throw new Error('Transform card not found');
    }
    const removeButton = within(newCard).getByRole('button', { name: 'Remove' });
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByText('adder')).not.toBeInTheDocument();
    });

    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });
  });

  it('surfaces validation errors in the editor', async () => {
    validateTransform.mockResolvedValueOnce({
      error_count: 1,
      configs: [
        {
          definition: { name: 'transforms.mask.blacklist', required: true },
          errors: ['Required'],
        },
      ],
    });

    render(<TransformationsTab name="alpha" initialConnector={connector} />);

    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });

    await screen.findByText(/validation error/i);
    expect(screen.getByText(/Required/)).toBeInTheDocument();
  });
});

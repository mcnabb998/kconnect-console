import {
  bulkConnectorAction,
  checkPluginAvailability,
  createConnector,
  extractValidationErrors,
  fetchClusterInfo,
  fetchConnectorPlugins,
  fetchSummary,
  getConnector,
  KafkaConnectApiError,
  listConnectors,
  listPlugins,
  performConnectorAction,
  validateConfig,
} from '@/lib/api';

describe('lib/api', () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  // Helper function to create properly mocked Response objects
  const createMockResponse = (overrides: Partial<Response> = {}): Response => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: 'http://example.com',
    clone: function() { return this; },
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    json: async () => ({}),
    text: async () => '',
    ...overrides,
  } as Response);

  beforeEach(() => {
    jest.resetAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const jsonResponse = (value: unknown, init: Partial<Response> = {}) => 
    createMockResponse({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify(value),
      json: async () => value,
      ...init,
    });

  it('lists plugins via the proxy API', async () => {
    const payload = [
      { class: 'a', type: 'source', version: '1' },
      { class: 'b', type: 'sink', version: '2' },
    ];
    fetchMock.mockResolvedValue(jsonResponse(payload));

    const plugins = await listPlugins();

    expect(plugins).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/default/connector-plugins',
      expect.any(Object)
    );
    const [, options] = fetchMock.mock.calls[0];
    expect((options as RequestInit | undefined)?.method ?? 'GET').toBe('GET');
  });

  it('propagates empty JSON bodies as undefined', async () => {
    fetchMock.mockResolvedValue(createMockResponse({
      ok: true,
      status: 204,
      statusText: 'No Content',
      text: async () => '',
      json: async () => {
        throw new Error('not called');
      },
    }));

    await expect(performConnectorAction('alpha', 'delete')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/default/connectors/alpha/delete',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('wraps HTTP failures in KafkaConnectApiError', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ message: 'connect down' }),
      text: async () => JSON.stringify({ message: 'connect down' }),
    } as Response);

    await expect(listConnectors()).rejects.toThrow(KafkaConnectApiError);

    try {
      await listConnectors();
    } catch (error) {
      expect(error).toBeInstanceOf(KafkaConnectApiError);
      const apiError = error as KafkaConnectApiError;
      expect(apiError.status).toBe(503);
      expect(apiError.data).toEqual({ message: 'connect down' });
    }
  });

  it('falls back to status text when error payload is not JSON', async () => {
    fetchMock.mockResolvedValue(createMockResponse({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('boom');
      },
      text: async () => '',
    }));

    await expect(getConnector('alpha')).rejects.toThrow('HTTP 500: Internal Server Error');
  });

  it('translates network failures into categorized errors', async () => {
    fetchMock.mockRejectedValue(new Error('socket closed'));

    try {
      await createConnector('alpha', { 'tasks.max': '1' });
      fail('Should have thrown');
    } catch (error: any) {
      // Should contain the original error message
      expect(error.message).toContain('socket closed');
      // Should have categorization metadata
      expect(error.categorized).toBeDefined();
      expect(error.troubleshooting).toBeDefined();
      expect(error.type).toBeDefined();
    }
  });

  it('sends connector creation requests with the name embedded in config', async () => {
    const payload = { name: 'alpha', config: { name: 'alpha', 'tasks.max': '1' }, tasks: [], type: 'source' };
    fetchMock.mockResolvedValue(
      jsonResponse(payload, {
        status: 201,
        statusText: 'Created',
      })
    );

    const result = await createConnector('alpha', { 'tasks.max': '1', type: 'source' as any });

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/default/connectors',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'alpha',
          config: { 'tasks.max': '1', type: 'source', name: 'alpha' },
        }),
      })
    );
  });

  it('validates connector configs using PUT and returns parsed payloads', async () => {
    const validation = { name: 'test', error_count: 0, groups: [], configs: [] };
    fetchMock.mockResolvedValue(jsonResponse(validation));

    const response = await validateConfig('class', { foo: 'bar' });

    expect(response).toEqual(validation);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/default/connector-plugins/class/config/validate',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('derives plugin availability using the connector list', async () => {
    const plugins = [
      { class: 'a', type: 'source', version: '1' },
      { class: 'b', type: 'sink', version: '1' },
    ];
    fetchMock.mockResolvedValue(jsonResponse(plugins));

    const available = await checkPluginAvailability(['a', 'c']);

    expect(Array.from(available)).toEqual(['a']);
  });

  it('aggregates bulk connector actions and surfaces failures', async () => {
    const success = {
      ok: true,
      status: 202,
      statusText: 'Accepted',
      text: async () => '',
      json: async () => ({})
    } as Response;

    const failure = {
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => ({ message: 'already paused' }),
      text: async () => JSON.stringify({ message: 'already paused' })
    } as Response;

    fetchMock
      .mockResolvedValueOnce(success)
      .mockResolvedValueOnce(failure);

    const result = await bulkConnectorAction(['alpha', 'beta'], 'pause');

    expect(result.successes).toEqual(['alpha']);
    expect(result.failures).toEqual([{ name: 'beta', error: 'already paused' }]);
  });

  it('exposes helper wrappers for summary and cluster info', async () => {
    const summaryPayload = { total: 1 };
    const clusterPayload = { cluster: 'default' };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(clusterPayload))
      .mockResolvedValueOnce(jsonResponse(summaryPayload))
      .mockResolvedValueOnce(jsonResponse([]));

    const cluster = await fetchClusterInfo();
    const summary = await fetchSummary();
    const plugins = await fetchConnectorPlugins();

    expect(cluster).toEqual(clusterPayload);
    expect(summary).toEqual(summaryPayload);
    expect(plugins).toEqual([]);
  });

  it('extracts validation errors from mixed response shapes', () => {
    const validation = {
      name: 'demo',
      error_count: 2,
      groups: [],
      configs: [
        {
          definition: { name: 'username' },
          value: { name: 'username', errors: ['Required'], recommended_values: '', value: null, visible: true },
        },
        {
          definition: { name: 'password' },
          value: { name: 'password', errors: 'Too short', recommended_values: '', value: null, visible: true },
        },
      ],
      value: {
        errors: {
          foo: ['bar'],
        },
      },
    };

    const errors = extractValidationErrors(validation as any);

    expect(errors).toEqual({
      username: ['Required'],
      password: ['Too short'],
      foo: ['bar'],
    });
  });
});

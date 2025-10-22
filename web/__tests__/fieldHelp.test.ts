import { getFieldHelp } from '@/data/fieldHelp';

describe('fieldHelp', () => {
  describe('getFieldHelp', () => {
    it('returns help for common fields', () => {
      const help = getFieldHelp('name');
      expect(help).toBeDefined();
      expect(help?.description).toContain('Unique name');
      expect(help?.examples).toContain('my-postgres-source');
    });

    it('returns help for tasks.max', () => {
      const help = getFieldHelp('tasks.max');
      expect(help).toBeDefined();
      expect(help?.description).toContain('Maximum number');
      expect(help?.tips).toBeDefined();
      expect(help?.tips?.length).toBeGreaterThan(0);
    });

    it('returns help for key.converter', () => {
      const help = getFieldHelp('key.converter');
      expect(help).toBeDefined();
      expect(help?.examples).toContain('org.apache.kafka.connect.json.JsonConverter');
    });

    it('returns JDBC-specific help for connection.url', () => {
      const help = getFieldHelp('connection.url', 'io.confluent.connect.jdbc.JdbcSourceConnector');
      expect(help).toBeDefined();
      expect(help?.description).toContain('JDBC connection URL');
      expect(help?.examples).toBeDefined();
      expect(help?.examples?.some(ex => ex.includes('jdbc:postgresql'))).toBe(true);
    });

    it('returns JDBC-specific help for mode', () => {
      const help = getFieldHelp('mode', 'io.confluent.connect.jdbc.JdbcSourceConnector');
      expect(help).toBeDefined();
      expect(help?.description).toContain('tracks changes');
      expect(help?.examples).toContain('incrementing');
      expect(help?.examples).toContain('timestamp');
    });

    it('returns Elasticsearch-specific help for connection.url', () => {
      const help = getFieldHelp('connection.url', 'io.confluent.connect.elasticsearch.ElasticsearchSinkConnector');
      expect(help).toBeDefined();
      expect(help?.description).toContain('Elasticsearch');
      expect(help?.examples?.some(ex => ex.includes('9200'))).toBe(true);
    });

    it('returns S3-specific help for s3.bucket.name', () => {
      const help = getFieldHelp('s3.bucket.name', 'io.confluent.connect.s3.S3SinkConnector');
      expect(help).toBeDefined();
      expect(help?.description).toContain('S3 bucket');
      expect(help?.tips).toBeDefined();
    });

    it('returns datagen-specific help for quickstart', () => {
      const help = getFieldHelp('quickstart', 'io.confluent.kafka.connect.datagen.DatagenConnector');
      expect(help).toBeDefined();
      expect(help?.description).toContain('template');
      expect(help?.examples).toContain('orders');
    });

    it('returns undefined for unknown fields', () => {
      const help = getFieldHelp('unknown.field.name');
      expect(help).toBeUndefined();
    });

    it('returns undefined for unknown connector class', () => {
      const help = getFieldHelp('some.field', 'com.unknown.connector.UnknownConnector');
      expect(help).toBeUndefined();
    });

    it('prioritizes common field help over plugin-specific', () => {
      // 'name' is in common fields, should return that even with JDBC connector
      const help = getFieldHelp('name', 'io.confluent.connect.jdbc.JdbcSourceConnector');
      expect(help).toBeDefined();
      expect(help?.description).toContain('Unique name');
    });

    it('handles case-insensitive connector class matching', () => {
      // Test with different case
      const help = getFieldHelp('connection.url', 'IO.CONFLUENT.CONNECT.JDBC.JDBCSOURCECONNECTOR');
      expect(help).toBeDefined();
      expect(help?.description).toContain('JDBC');
    });

    it('includes documentation links where available', () => {
      const help = getFieldHelp('connector.class');
      expect(help?.documentation).toBeDefined();
      expect(help?.documentation).toContain('http');
    });

    it('includes tips for transforms field', () => {
      const help = getFieldHelp('transforms');
      expect(help).toBeDefined();
      expect(help?.tips).toBeDefined();
      expect(help?.tips?.length).toBeGreaterThan(0);
      expect(help?.documentation).toBeDefined();
    });

    it('provides examples for JDBC insert.mode', () => {
      const help = getFieldHelp('insert.mode', 'io.confluent.connect.jdbc.JdbcSinkConnector');
      expect(help).toBeDefined();
      expect(help?.examples).toContain('insert');
      expect(help?.examples).toContain('upsert');
      expect(help?.examples).toContain('update');
      expect(help?.tips).toBeDefined();
    });

    it('provides examples for S3 compression', () => {
      const help = getFieldHelp('s3.compression.type', 'io.confluent.connect.s3.S3SinkConnector');
      expect(help).toBeDefined();
      expect(help?.examples).toContain('gzip');
      expect(help?.examples).toContain('snappy');
    });
  });
});

// Field-level help data with examples and documentation links
// This provides context-sensitive help for common Kafka Connect configuration fields

export interface FieldHelp {
  description?: string;
  examples?: string[];
  documentation?: string;
  tips?: string[];
}

// Plugin-specific help organized by connector class prefix
export interface PluginFieldHelp {
  [fieldName: string]: FieldHelp;
}

// Common field help that applies across all connectors
export const commonFieldHelp: Record<string, FieldHelp> = {
  'name': {
    description: 'Unique name for this connector instance',
    examples: ['my-postgres-source', 'sales-db-sink'],
    tips: ['Use descriptive names that indicate the data source/destination', 'Avoid spaces and special characters']
  },
  'connector.class': {
    description: 'Fully qualified class name of the connector plugin',
    examples: ['io.confluent.connect.jdbc.JdbcSourceConnector'],
    documentation: 'https://docs.confluent.io/platform/current/connect/userguide.html'
  },
  'tasks.max': {
    description: 'Maximum number of parallel tasks for this connector',
    examples: ['1', '4', '10'],
    tips: [
      'Start with 1 and increase if needed',
      'More tasks = higher throughput but more resource usage',
      'For databases, typically equals number of tables being processed'
    ]
  },
  'key.converter': {
    description: 'Converter class for record keys',
    examples: [
      'org.apache.kafka.connect.json.JsonConverter',
      'org.apache.kafka.connect.storage.StringConverter',
      'io.confluent.connect.avro.AvroConverter'
    ],
    tips: ['Must match the data format of your keys', 'JsonConverter is common for most use cases']
  },
  'value.converter': {
    description: 'Converter class for record values',
    examples: [
      'org.apache.kafka.connect.json.JsonConverter',
      'org.apache.kafka.connect.storage.StringConverter',
      'io.confluent.connect.avro.AvroConverter'
    ],
    tips: ['Must match the data format of your values', 'Use Avro for schema evolution support']
  },
  'key.converter.schemas.enable': {
    description: 'Whether to include schema in serialized key',
    examples: ['true', 'false'],
    tips: ['Set to false for simple string/numeric keys', 'Set to true for complex structured keys']
  },
  'value.converter.schemas.enable': {
    description: 'Whether to include schema in serialized value',
    examples: ['true', 'false'],
    tips: ['Set to false for schemaless JSON', 'Set to true for schema-aware processing']
  },
  'transforms': {
    description: 'Comma-separated list of transformation aliases',
    examples: ['addField', 'route,flatten', 'timestampConverter,maskPII'],
    tips: ['Transformations are applied in the order listed', 'Each alias must have corresponding transform.* configs'],
    documentation: 'https://docs.confluent.io/platform/current/connect/transforms/overview.html'
  },
  'errors.tolerance': {
    description: 'Behavior when encountering errors',
    examples: ['none', 'all'],
    tips: ['none = fail fast on any error', 'all = log errors and continue processing']
  },
  'errors.log.enable': {
    description: 'Whether to log errors',
    examples: ['true', 'false'],
    tips: ['Enable for production to track issues', 'Logs appear in Connect worker logs']
  },
  'errors.log.include.messages': {
    description: 'Whether to include message content in error logs',
    examples: ['true', 'false'],
    tips: ['Enable for debugging', 'May expose sensitive data in logs']
  }
};

// JDBC-specific field help
export const jdbcFieldHelp: PluginFieldHelp = {
  'connection.url': {
    description: 'JDBC connection URL for the database',
    examples: [
      'jdbc:postgresql://localhost:5432/mydb',
      'jdbc:mysql://localhost:3306/mydb',
      'jdbc:sqlserver://localhost:1433;databaseName=mydb',
      'jdbc:oracle:thin:@localhost:1521:orcl'
    ],
    tips: ['Include all required connection parameters', 'Use appropriate JDBC driver format']
  },
  'connection.user': {
    description: 'Database username for authentication',
    examples: ['admin', 'kafka_user', 'readonly_user'],
    tips: ['Ensure user has necessary permissions', 'Source connectors need SELECT', 'Sink connectors need INSERT/UPDATE']
  },
  'connection.password': {
    description: 'Database password (will be redacted in logs)',
    tips: ['Consider using secrets management', 'Password is stored in connector config']
  },
  'table.whitelist': {
    description: 'Comma-separated list of tables to include',
    examples: ['users,orders,products', 'public.customers'],
    tips: ['Use schema-qualified names for clarity', 'Leave empty to include all tables']
  },
  'table.blacklist': {
    description: 'Comma-separated list of tables to exclude',
    examples: ['tmp_*,audit_log'],
    tips: ['Supports wildcards', 'Processed after whitelist']
  },
  'mode': {
    description: 'How the connector tracks changes',
    examples: ['incrementing', 'timestamp', 'timestamp+incrementing', 'bulk'],
    tips: [
      'incrementing: uses auto-increment column',
      'timestamp: uses timestamp column',
      'timestamp+incrementing: combines both for reliability',
      'bulk: reads entire table each time (no change tracking)'
    ]
  },
  'incrementing.column.name': {
    description: 'Column name for incrementing mode',
    examples: ['id', 'user_id', 'order_number'],
    tips: ['Must be auto-incrementing', 'Must be unique and never null', 'Typically a primary key']
  },
  'timestamp.column.name': {
    description: 'Column name for timestamp mode',
    examples: ['updated_at', 'modified_time', 'last_modified'],
    tips: ['Must be updated on every change', 'Use TIMESTAMP or DATETIME type', 'Cannot be NULL']
  },
  'poll.interval.ms': {
    description: 'How often to poll the database (milliseconds)',
    examples: ['5000', '60000', '300000'],
    tips: ['Lower = more frequent updates, higher database load', 'Default is 5 seconds (5000ms)', 'Adjust based on data freshness needs']
  },
  'topic.prefix': {
    description: 'Prefix for generated topic names',
    examples: ['jdbc-', 'db-', 'prod-mysql-'],
    tips: ['Topic name will be: prefix + table name', 'Use to avoid naming conflicts']
  },
  'batch.max.rows': {
    description: 'Maximum rows per batch',
    examples: ['100', '1000', '10000'],
    tips: ['Larger batches = better throughput but more memory', 'Start with default (100) and tune as needed']
  },
  'auto.create': {
    description: 'Automatically create tables if they don\'t exist',
    examples: ['true', 'false'],
    tips: ['Useful for development', 'Consider disabling in production for safety']
  },
  'auto.evolve': {
    description: 'Automatically add new columns to tables',
    examples: ['true', 'false'],
    tips: ['Enables schema evolution', 'Does not drop columns or change types']
  },
  'insert.mode': {
    description: 'How records are written to the database',
    examples: ['insert', 'upsert', 'update'],
    tips: [
      'insert: always INSERT (fails on duplicates)',
      'upsert: INSERT or UPDATE if key exists',
      'update: only UPDATE existing records'
    ]
  },
  'pk.mode': {
    description: 'How primary key is determined',
    examples: ['none', 'kafka', 'record_key', 'record_value'],
    tips: [
      'none: no primary key',
      'kafka: use Kafka coordinates (topic+partition+offset)',
      'record_key: use record key fields',
      'record_value: use fields from record value'
    ]
  },
  'pk.fields': {
    description: 'Fields to use as primary key',
    examples: ['id', 'user_id,order_id', 'email'],
    tips: ['Comma-separated for composite keys', 'Required when pk.mode is record_key or record_value']
  }
};

// Elasticsearch-specific field help
export const elasticsearchFieldHelp: PluginFieldHelp = {
  'connection.url': {
    description: 'Elasticsearch cluster URL',
    examples: ['http://localhost:9200', 'https://elastic.example.com:9200'],
    tips: ['Can specify multiple URLs separated by commas', 'Use https:// for secure connections']
  },
  'type.name': {
    description: 'Type name for Elasticsearch documents',
    examples: ['_doc', 'kafka-connect'],
    tips: ['Use _doc for Elasticsearch 7+', 'Custom type names deprecated in newer versions']
  },
  'key.ignore': {
    description: 'Whether to ignore the record key',
    examples: ['true', 'false'],
    tips: ['Set to true if using value-based document IDs', 'Set to false to use key as document ID']
  },
  'schema.ignore': {
    description: 'Ignore schemas and index raw JSON',
    examples: ['true', 'false'],
    tips: ['Set to true for schemaless JSON', 'Set to false to leverage schema information']
  },
  'behavior.on.null.values': {
    description: 'How to handle null record values',
    examples: ['ignore', 'delete', 'fail'],
    tips: [
      'ignore: skip null records',
      'delete: delete document from index',
      'fail: stop connector on null'
    ]
  },
  'behavior.on.malformed.documents': {
    description: 'How to handle malformed documents',
    examples: ['ignore', 'warn', 'fail'],
    tips: ['warn is recommended for production', 'Check logs for malformed document details']
  }
};

// S3-specific field help
export const s3FieldHelp: PluginFieldHelp = {
  's3.bucket.name': {
    description: 'Name of the S3 bucket',
    examples: ['my-kafka-archive', 'prod-data-lake'],
    tips: ['Bucket must exist before starting connector', 'Ensure IAM permissions are configured']
  },
  's3.region': {
    description: 'AWS region of the S3 bucket',
    examples: ['us-east-1', 'eu-west-1', 'ap-southeast-2'],
    tips: ['Must match your bucket region', 'Default is us-east-1']
  },
  'flush.size': {
    description: 'Number of records per file',
    examples: ['1000', '10000', '100000'],
    tips: ['Larger = fewer files but less frequent writes', 'Balance between file count and write frequency']
  },
  'rotate.interval.ms': {
    description: 'Time before rotating to new file (milliseconds)',
    examples: ['60000', '300000', '3600000'],
    tips: ['60000 = 1 minute', '3600000 = 1 hour', 'Creates new file after time expires']
  },
  'rotate.schedule.interval.ms': {
    description: 'Time between scheduled rotations (milliseconds)',
    examples: ['3600000', '86400000'],
    tips: ['86400000 = daily rotation', 'Useful for time-based partitioning']
  },
  's3.compression.type': {
    description: 'Compression algorithm for files',
    examples: ['none', 'gzip', 'snappy'],
    tips: ['gzip: best compression, slower', 'snappy: fast compression, larger files', 'none: no compression']
  },
  'format.class': {
    description: 'Output file format',
    examples: [
      'io.confluent.connect.s3.format.json.JsonFormat',
      'io.confluent.connect.s3.format.avro.AvroFormat',
      'io.confluent.connect.s3.format.parquet.ParquetFormat'
    ],
    tips: ['JSON: human-readable', 'Avro: schema evolution support', 'Parquet: efficient for analytics']
  },
  'storage.class': {
    description: 'Storage implementation class',
    examples: ['io.confluent.connect.s3.storage.S3Storage'],
    tips: ['Usually keep as default', 'Required for S3 sink connector']
  }
};

// Datagen source-specific field help
export const datagenFieldHelp: PluginFieldHelp = {
  'kafka.topic': {
    description: 'Target Kafka topic for generated data',
    examples: ['test-data', 'sample-orders', 'demo-events'],
    tips: ['Topic will be auto-created if it doesn\'t exist', 'Use descriptive names for test data']
  },
  'quickstart': {
    description: 'Predefined data template',
    examples: ['orders', 'users', 'pageviews', 'ratings', 'stock_trades'],
    tips: [
      'orders: e-commerce order data',
      'users: user profile data',
      'pageviews: website analytics',
      'stock_trades: financial market data'
    ]
  },
  'max.interval': {
    description: 'Maximum time between messages (milliseconds)',
    examples: ['100', '1000', '5000'],
    tips: ['Lower = higher message rate', '100ms = ~10 messages/second', 'Useful for controlling throughput']
  },
  'iterations': {
    description: 'Total number of messages to generate',
    examples: ['1000', '10000', '-1'],
    tips: ['-1 = infinite (keeps generating)', 'Positive number = stops after that many messages', 'Use finite for testing']
  },
  'schema.filename': {
    description: 'Custom Avro schema file',
    examples: ['/path/to/schema.avsc'],
    tips: ['Alternative to using quickstart templates', 'Allows full control over generated data structure']
  },
  'schema.keyfield': {
    description: 'Field to use as message key',
    examples: ['id', 'user_id', 'order_id'],
    tips: ['Must be a field in your schema', 'Ensures related records have same partition']
  }
};

// Function to get field help based on connector class and field name
export function getFieldHelp(
  fieldName: string,
  connectorClass?: string
): FieldHelp | undefined {
  // First check common fields
  if (commonFieldHelp[fieldName]) {
    return commonFieldHelp[fieldName];
  }

  // Then check plugin-specific fields
  if (connectorClass) {
    const classLower = connectorClass.toLowerCase();
    
    if (classLower.includes('jdbc')) {
      return jdbcFieldHelp[fieldName];
    } else if (classLower.includes('elasticsearch')) {
      return elasticsearchFieldHelp[fieldName];
    } else if (classLower.includes('s3')) {
      return s3FieldHelp[fieldName];
    } else if (classLower.includes('datagen')) {
      return datagenFieldHelp[fieldName];
    }
  }

  return undefined;
}

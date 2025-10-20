// Predefined connector templates with common connector configurations
// These templates help users quickly set up connectors for popular use cases

export interface ConnectorTemplate {
  id: string;
  name: string;
  description: string;
  connectorClass: string;
  type: 'source' | 'sink';
  category: 'database' | 'messaging' | 'storage' | 'analytics' | 'other';
  icon?: string;
  available?: boolean; // Will be set dynamically based on installed plugins
  defaultConfig: Record<string, any>;
  requiredFields: string[];
  documentation?: string;
}

export const connectorTemplates: ConnectorTemplate[] = [
  {
    id: 'jdbc-source',
    name: 'JDBC Source',
    description: 'Connect to any JDBC-compatible database (MySQL, PostgreSQL, Oracle, SQL Server)',
    connectorClass: 'io.confluent.connect.jdbc.JdbcSourceConnector',
    type: 'source',
    category: 'database',
    icon: '🗄️',
    defaultConfig: {
      'connector.class': 'io.confluent.connect.jdbc.JdbcSourceConnector',
      'tasks.max': '1',
      'connection.url': '',
      'connection.user': '',
      'connection.password': '',
      'table.whitelist': '',
      'mode': 'incrementing',
      'incrementing.column.name': 'id',
      'topic.prefix': 'jdbc-',
      'poll.interval.ms': '5000'
    },
    requiredFields: ['connection.url', 'connection.user', 'table.whitelist'],
    documentation: 'https://docs.confluent.io/kafka-connect-jdbc/current/source-connector/index.html'
  },
  {
    id: 'jdbc-sink',
    name: 'JDBC Sink',
    description: 'Write data to any JDBC-compatible database',
    connectorClass: 'io.confluent.connect.jdbc.JdbcSinkConnector',
    type: 'sink',
    category: 'database',
    icon: '🗃️',
    defaultConfig: {
      'connector.class': 'io.confluent.connect.jdbc.JdbcSinkConnector',
      'tasks.max': '1',
      'connection.url': '',
      'connection.user': '',
      'connection.password': '',
      'topics': '',
      'auto.create': 'true',
      'auto.evolve': 'true',
      'insert.mode': 'insert'
    },
    requiredFields: ['connection.url', 'connection.user', 'topics'],
    documentation: 'https://docs.confluent.io/kafka-connect-jdbc/current/sink-connector/index.html'
  },
  {
    id: 'elasticsearch-sink',
    name: 'Elasticsearch Sink',
    description: 'Index Kafka topics into Elasticsearch for search and analytics',
    connectorClass: 'io.confluent.connect.elasticsearch.ElasticsearchSinkConnector',
    type: 'sink',
    category: 'analytics',
    icon: '🔍',
    defaultConfig: {
      'connector.class': 'io.confluent.connect.elasticsearch.ElasticsearchSinkConnector',
      'tasks.max': '1',
      'topics': '',
      'connection.url': 'http://localhost:9200',
      'type.name': '_doc',
      'key.ignore': 'false',
      'schema.ignore': 'true'
    },
    requiredFields: ['topics', 'connection.url'],
    documentation: 'https://docs.confluent.io/kafka-connect-elasticsearch/current/'
  },
  {
    id: 's3-sink',
    name: 'Amazon S3 Sink',
    description: 'Archive Kafka topics to Amazon S3 for long-term storage',
    connectorClass: 'io.confluent.connect.s3.S3SinkConnector',
    type: 'sink',
    category: 'storage',
    icon: '☁️',
    defaultConfig: {
      'connector.class': 'io.confluent.connect.s3.S3SinkConnector',
      'tasks.max': '1',
      'topics': '',
      's3.bucket.name': '',
      's3.region': 'us-east-1',
      'storage.class': 'io.confluent.connect.s3.storage.S3Storage',
      'format.class': 'io.confluent.connect.s3.format.json.JsonFormat',
      'flush.size': '1000',
      'rotate.interval.ms': '3600000'
    },
    requiredFields: ['topics', 's3.bucket.name', 's3.region'],
    documentation: 'https://docs.confluent.io/kafka-connect-s3/current/'
  },
  {
    id: 'salesforce-source',
    name: 'Salesforce Source',
    description: 'Stream changes from Salesforce objects to Kafka topics',
    connectorClass: 'io.confluent.salesforce.SalesforceSourceConnector',
    type: 'source',
    category: 'other',
    icon: '⚡',
    defaultConfig: {
      'connector.class': 'io.confluent.salesforce.SalesforceSourceConnector',
      'tasks.max': '1',
      'salesforce.username': '',
      'salesforce.password': '',
      'salesforce.password.token': '',
      'salesforce.consumer.key': '',
      'salesforce.consumer.secret': '',
      'salesforce.object': 'Account',
      'kafka.topic': 'salesforce-account',
      'connection.timeout': '30000'
    },
    requiredFields: ['salesforce.username', 'salesforce.password', 'salesforce.consumer.key', 'salesforce.consumer.secret', 'salesforce.object'],
    documentation: 'https://docs.confluent.io/kafka-connectors/salesforce/current/'
  },
  {
    id: 'eventbridge-sink',
    name: 'AWS EventBridge Sink',
    description: 'Send Kafka events to AWS EventBridge for serverless event processing',
    connectorClass: 'software.amazon.event.kafkaconnector.EventBridgeSinkConnector',
    type: 'sink',
    category: 'messaging',
    icon: '🚀',
    defaultConfig: {
      'connector.class': 'software.amazon.event.kafkaconnector.EventBridgeSinkConnector',
      'tasks.max': '1',
      'topics': '',
      'aws.eventbridge.connector.id': '',
      'aws.eventbridge.eventbus.arn': '',
      'aws.eventbridge.region': 'us-east-1',
      'aws.eventbridge.detail.types': 'kafka-connect-${topic}',
      'aws.eventbridge.retries.max': '2',
      'aws.eventbridge.retries.delay': '200'
    },
    requiredFields: ['aws.eventbridge.connector.id', 'topics', 'aws.eventbridge.eventbus.arn', 'aws.eventbridge.region'],
    documentation: 'https://github.com/aws/eventbridge-kafka-connector'
  },
  {
    id: 'datagen-source',
    name: 'DataGen Source',
    description: 'Generate sample data for testing and development',
    connectorClass: 'io.confluent.kafka.connect.datagen.DatagenConnector',
    type: 'source',
    category: 'other',
    icon: '🎲',
    defaultConfig: {
      'connector.class': 'io.confluent.kafka.connect.datagen.DatagenConnector',
      'tasks.max': '1',
      'kafka.topic': 'test-data',
      'quickstart': 'users',
      'key.converter': 'org.apache.kafka.connect.storage.StringConverter',
      'value.converter': 'org.apache.kafka.connect.json.JsonConverter',
      'value.converter.schemas.enable': 'false',
      'max.interval': '1000',
      'iterations': '1000000'
    },
    requiredFields: ['kafka.topic', 'quickstart'],
    documentation: 'https://docs.confluent.io/kafka-connect-datagen/current/'
  },
  {
    id: 'mongodb-source',
    name: 'MongoDB Source',
    description: 'Stream changes from MongoDB collections using change streams',
    connectorClass: 'com.mongodb.kafka.connect.MongoSourceConnector',
    type: 'source',
    category: 'database',
    icon: '🍃',
    defaultConfig: {
      'connector.class': 'com.mongodb.kafka.connect.MongoSourceConnector',
      'tasks.max': '1',
      'connection.uri': 'mongodb://localhost:27017',
      'database': '',
      'collection': '',
      'topic.prefix': 'mongo',
      'pipeline': '[]'
    },
    requiredFields: ['connection.uri', 'database', 'collection'],
    documentation: 'https://docs.mongodb.com/kafka-connector/current/'
  },
  {
    id: 'mongodb-sink',
    name: 'MongoDB Sink',
    description: 'Write Kafka topic data to MongoDB collections',
    connectorClass: 'com.mongodb.kafka.connect.MongoSinkConnector',
    type: 'sink',
    category: 'database',
    icon: '🍃',
    defaultConfig: {
      'connector.class': 'com.mongodb.kafka.connect.MongoSinkConnector',
      'tasks.max': '1',
      'connection.uri': 'mongodb://localhost:27017',
      'database': '',
      'collection': '',
      'topics': '',
      'change.data.capture.handler': 'com.mongodb.kafka.connect.sink.cdc.mongodb.ChangeStreamHandler'
    },
    requiredFields: ['connection.uri', 'database', 'topics'],
    documentation: 'https://docs.mongodb.com/kafka-connector/current/'
  },
  {
    id: 'debezium-mysql',
    name: 'Debezium MySQL CDC',
    description: 'Capture data changes from MySQL using Debezium',
    connectorClass: 'io.debezium.connector.mysql.MySqlConnector',
    type: 'source',
    category: 'database',
    icon: '🐬',
    defaultConfig: {
      'connector.class': 'io.debezium.connector.mysql.MySqlConnector',
      'tasks.max': '1',
      'database.hostname': 'localhost',
      'database.port': '3306',
      'database.user': '',
      'database.password': '',
      'database.server.id': '184054',
      'topic.prefix': 'mysql-server',
      'database.include.list': '',
      'schema.history.internal.kafka.bootstrap.servers': 'localhost:9092',
      'schema.history.internal.kafka.topic': 'schema-changes.mysql'
    },
    requiredFields: ['database.hostname', 'database.user', 'database.password', 'database.include.list', 'schema.history.internal.kafka.bootstrap.servers'],
    documentation: 'https://debezium.io/documentation/reference/connectors/mysql.html'
  }
];

export function getTemplateById(id: string): ConnectorTemplate | undefined {
  return connectorTemplates.find(template => template.id === id);
}

export function getTemplatesByCategory(category: string): ConnectorTemplate[] {
  return connectorTemplates.filter(template => template.category === category);
}

export function getTemplatesByType(type: 'source' | 'sink'): ConnectorTemplate[] {
  return connectorTemplates.filter(template => template.type === type);
}
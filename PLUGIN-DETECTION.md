# Connector Templates and Plugin Detection

This update adds dynamic connector plugin detection and template-based connector creation to the Kafka Connect Console.

## Features Added

### 1. **Dynamic Plugin Detection**
- The console now automatically detects which connector plugins are installed on the Kafka Connect cluster
- Uses the Kafka Connect REST API `/connector-plugins` endpoint to get real-time plugin availability
- Shows visual indicators for available vs missing plugins

### 2. **Connector Templates**
- Pre-configured templates for popular connectors (JDBC, Elasticsearch, S3, MongoDB, Debezium, etc.)
- Templates include:
  - Default configuration values
  - Required field validation
  - Documentation links
  - Category organization
  - Visual badges showing availability

### 3. **Enhanced Connector Creation Wizard**
- Template-based creation workflow (`/connectors/templates`)
- Plugin availability checking with visual badges:
  - 🟢 "Available" - Plugin is installed and ready to use
  - 🔴 "Missing plugin" - Plugin JAR needs to be installed on the worker
- Search and filter templates by category
- Automatic configuration validation
- Refresh button to reload plugin status

### 4. **Capabilities Page**
- Comprehensive view of all installed connector plugins (`/capabilities`)
- Expandable plugin details showing configuration options
- Links to available templates
- Statistics on plugin types and template availability
- Real-time configuration schema loading

### 5. **Updated Navigation**
- Added "Create Connector" and "Capabilities" to main navigation
- Updated home page with quick start guides
- Improved user experience with clear visual indicators

## File Structure

```
web/
├── data/
│   └── connectorTemplates.ts          # Predefined connector templates
├── app/
│   ├── connectors/
│   │   ├── templates/
│   │   │   └── page.tsx              # New template-based creation wizard
│   │   └── new/page.tsx              # Enhanced existing creation page
│   ├── capabilities/
│   │   └── page.tsx                  # New capabilities exploration page
│   └── components/
│       └── Navigation.tsx            # Updated navigation
└── lib/
    └── api.ts                        # Added plugin availability checking
```

## API Endpoints Used

The Go proxy already had the required routes:
- `GET /api/{cluster}/connector-plugins` - Lists available connector plugins
- `PUT /api/{cluster}/connector-plugins/{class}/config/validate` - Validates connector configuration

These routes properly proxy to the Kafka Connect REST API and include error handling and data redaction.

## Usage

### Creating a Connector with Templates

1. Navigate to **Create Connector** from the main navigation
2. Browse available templates with visual availability indicators
3. Select a template (only available ones are clickable)
4. Fill in the required configuration fields
5. Validate and create the connector

### Exploring Plugin Capabilities

1. Navigate to **Capabilities** from the main navigation
2. View all installed plugins with statistics
3. Click on any plugin to expand and see:
   - Configuration options and requirements
   - Available templates (if any)
   - Documentation links
4. Filter by plugin type or template availability

### Refreshing Plugin Status

Both the template creation page and capabilities page include "Refresh" buttons to reload the current plugin status from the Kafka Connect cluster.

## Benefits

1. **Improved UX**: Users immediately see which connectors they can actually deploy
2. **Reduced Errors**: No more failed connector creation due to missing plugins
3. **Faster Setup**: Pre-configured templates speed up connector creation
4. **Better Discovery**: Capabilities page helps users explore available options
5. **Self-Service**: Users can independently verify what's available without needing admin access

## Template System

The template system is designed to be easily extensible. New templates can be added to `/web/data/connectorTemplates.ts` with:

- Connector class name (for availability checking)
- Default configuration values
- Required field definitions
- Category and metadata
- Documentation links

The system automatically matches templates to installed plugins and provides appropriate visual feedback.
# @vibase/core

Easily read and mutate Postgres data using MCP.

## Overview

`@vibase/core` provides the foundational components for creating MCP (Model Context Protocol) servers on top of Postgres using simple configuration files.

- Run on your own machine with STDIO
- Deploy on lambda
- Or package in a DXT

## Features

- **YAML Configuration**: Define MCP tools using simple YAML configuration files
- **PostgreSQL Support**: Direct SQL execution against PostgreSQL databases with connection pooling
- **Safe SQL Generation**: Uses [pg-sql2](https://www.npmjs.com/package/pg-sql2) for safe SQL query construction
- **Type Safety**: Full TypeScript support with Zod validation
- **Connection Management**: Automatic connection pooling and cleanup

## Installation

```bash
pnpm install @vibase/core
```

## Quick Start

1. **Create a YAML configuration file** (`config.yaml`):

```yaml
sources:
  todo_db:
    kind: postgres
    connection_string: postgres://user:password@localhost:5432/todo_management

tools:
  get_boards:
    kind: postgres-sql
    source: todo_db
    description: Retrieve all todo boards
    statement: SELECT id, name, description FROM boards ORDER BY created_at DESC;
    parameters: []

  search_tasks:
    kind: postgres-sql
    source: todo_db
    description: Search tasks by title or description
    parameters:
      - name: search_term
        type: string
        description: Search term to match against task title or description
        required: true
    statement: |
      SELECT t.id, t.title, t.priority, s.name as stage_name
      FROM tasks t
      JOIN stages s ON t.stage_id = s.id
      WHERE t.title ILIKE '%' || $1 || '%' OR t.description ILIKE '%' || $1 || '%';
```

2. **Create and run the MCP server**:

```typescript
import { loadConfigFromYaml, createMcpServerFromConfig } from "@vibase/core";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

async function main() {
  // Step 1: Load and validate configuration
  const config = loadConfigFromYaml("./config.yaml");

  // Step 2: Create server from configuration
  const { server, cleanup } = createMcpServerFromConfig(config);

  // Step 3: Connect transport and start server
  const transport = new StdioServerTransport();

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });

  await server.connect(transport);
}

main().catch(console.error);
```

## API Reference

### Configuration Loading

#### `loadConfigFromYaml(configPath: string): ToolboxConfig`

Loads and validates configuration from a YAML file.

**Parameters:**

- `configPath`: Path to the YAML configuration file

**Returns:**

- `ToolboxConfig`: Validated configuration object

**Throws:**

- Configuration validation errors
- File not found errors
- YAML parsing errors

#### `loadConfigFromYamlString(yamlContent: string): ToolboxConfig`

Loads and validates configuration from a YAML string.

**Parameters:**

- `yamlContent`: YAML configuration as a string

**Returns:**

- `ToolboxConfig`: Validated configuration object

**Throws:**

- Configuration validation errors
- YAML parsing errors

### Server Creation

#### `createMcpServerFromConfig(config: ToolboxConfig, options?: ServerOptions): { server: McpServer; cleanup: () => Promise<void> }`

Creates an MCP server from a validated configuration object.

**Parameters:**

- `config`: Validated configuration object
- `options`: Optional server configuration options

**Returns:**

- `server`: The MCP server instance
- `cleanup`: Async function to clean up database connections

## Configuration Format

### Sources

Define database connections:

```yaml
sources:
  source-name:
    kind: postgres
    connection_string: postgres://user:password@host:port/database
```

### Tools

Define SQL-based tools:

```yaml
tools:
  tool-name:
    kind: postgres-sql
    source: source-name # References a source
    description: Human-readable description
    parameters:
      - name: param_name
        type: string | number | boolean
        description: Parameter description
        required: true | false # Optional, defaults to true
    statement: SELECT * FROM table WHERE column = $1;
```

## Examples

### Todo Management System

```yaml
sources:
  todo_db:
    kind: postgres
    connection_string: postgres://user:password@localhost:5432/todo_management

tools:
  get_overdue_tasks:
    kind: postgres-sql
    source: todo_db
    description: Get all tasks that are past their due date
    statement: |
      SELECT t.id, t.title, t.due_date, s.name as stage_name
      FROM tasks t
      JOIN stages s ON t.stage_id = s.id
      WHERE t.due_date < NOW() AND s.name != 'Done'
      ORDER BY t.due_date ASC;
    parameters: []

  get_tasks_by_priority:
    kind: postgres-sql
    source: todo_db
    description: Get tasks filtered by priority level
    parameters:
      - name: priority_level
        type: string
        description: Priority level (Low, Medium, High, Critical)
        required: true
    statement: |
      SELECT t.id, t.title, t.priority, s.name as stage_name
      FROM tasks t
      JOIN stages s ON t.stage_id = s.id
      WHERE t.priority = $1;
```

## Security Considerations

- Always use parameterized queries (enforced by this package)
- Store database credentials securely (consider environment variables)
- Limit database user permissions to only what's needed
- Use SSL connections for production databases
- Validate and sanitize user input before using in queries

## Contributing

Contributions are welcome!

## License

Apache 2.0

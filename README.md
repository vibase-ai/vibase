# @vibase/core

Easily read and mutate Postgres data using MCP.

## Overview

`@vibase/core` provides the foundational components for creating MCP (Model Context Protocol) servers on top of Postgres using simple configuration files.

- Run on your own machine with STDIO
- Deploy on lambda or Cloudflare workers
- Package in a [Claude Desktop Extension](https://www.anthropic.com/engineering/desktop-extensions)

## Features

- **YAML Configuration**: Define MCP tools using simple YAML configuration files
- **PostgreSQL Support**: Direct SQL execution against PostgreSQL databases with connection pooling
- **Safe SQL Generation**: Uses parameterized queries for safe SQL query construction
- **Type Safety**: Full TypeScript support with Zod validation
- **Connection Management**: Automatic connection pooling and cleanup

## Installation

```bash
npm install -g @vibase/core
```

## Quick Start

1. **Create a YAML configuration file** (`tools.yaml`):

```yaml
sources:
  todo_db:
    kind: postgres
    connection_string: postgres://user:password@localhost:5432/todo_management

tools:
  get_boards:
    kind: postgres
    source: todo_db
    description: Retrieve all todo boards
    statement: SELECT id, name, description FROM boards ORDER BY created_at DESC;
    parameters: []

  search_tasks:
    kind: postgres
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

```bash
npx @vibase/core tools.yaml
```

## API Reference

Use Vibase with any TypeScript MCP server.

### Configuration

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

#### `createMcpServerFromConfig(config: ToolboxConfig, options?: ServerOptions): { server: McpServer; cleanup: () => Promise<void>; plugins: PluginRegistry }`

Creates an MCP server from a validated configuration object.

**Parameters:**

- `config`: Validated configuration object
- `options`: Optional server configuration options

**Returns:**

- `server`: The MCP server instance
- `cleanup`: Async function to clean up database connections
- `plugins`: Plugin registry for registering custom plugins

#### `addToolsToMcpServer(server: McpServer, config: ToolboxConfig): { cleanup: () => Promise<void>; plugins: PluginRegistry }`

Adds tools from configuration to an existing MCP server. This is useful when you want to add tools to a server that was created separately.

**Parameters:**

- `server`: Existing MCP server instance
- `config`: Validated configuration object

**Returns:**

- `cleanup`: Async function to clean up database connections
- `plugins`: Plugin registry for registering custom plugins

**Example:**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { addToolsToMcpServer, loadConfigFromYaml } from "@vibase/core";

// Create server manually
const server = new McpServer({
  name: "My Custom Server",
  version: "1.0.0",
});

// Load configuration and add tools
const config = loadConfigFromYaml("./config.yaml");
const { cleanup, plugins } = addToolsToMcpServer(server, config);

// Register plugins if needed
const authPlugin = {
  name: "auth",
  callbacks: {
    beforeQuery: (context) => {
      return { pgSettings: new Map([["role", "authenticated"]]) };
    }
  }
};
plugins.register(authPlugin);

// Connect transport and handle cleanup
process.on("SIGINT", async () => {
  await cleanup();
  process.exit(0);
});
```

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
    kind: postgres
    source: source-name # References a source
    description: Human-readable description
    parameters:
      - name: param_name
        type: string | number | boolean
        description: Parameter description
        required: true | false # Optional, defaults to true
    statement: SELECT * FROM table WHERE column = $1;
```

## Plugins API

`@vibase/core` includes a plugin system that allows you to modify query execution behavior. The most common use case is implementing authentication with JWT tokens and PostgreSQL Row Level Security (RLS).

### Plugin Registration

```typescript
import { createMcpServerFromConfig, loadConfigFromYaml } from "@vibase/core";

// Create server and get plugins registry
const config = loadConfigFromYaml("./config.yaml");
const { server, plugins } = createMcpServerFromConfig(config);

// Register a plugin
const myPlugin = {
  name: "my-plugin",
  callbacks: {
    beforeQuery: (context) => {
      // Plugin logic here
      return { pgSettings: new Map([["role", "authenticated"]]) };
    }
  }
};
plugins.register(myPlugin);
```

### JWT Authentication Plugin Example

Here's how you can implement JWT bearer token authentication:

```typescript
import jwt from "jsonwebtoken";

function createBearerAuthPlugin(jwtSecret: string) {
  return {
    name: "bearer-auth",
    callbacks: {
      beforeQuery: ({ extra }) => {
        const pgSettings = new Map();
        
        try {
          // Extract JWT from authInfo.token or Authorization header
          let token = extra?.authInfo?.token;
          if (!token) {
            const authHeader = extra?.requestInfo?.headers?.authorization;
            if (authHeader?.startsWith('Bearer ')) {
              token = authHeader.replace(/^Bearer\s+/i, '');
            }
          }
          
          if (!token) {
            // No token - set anonymous role
            pgSettings.set('role', 'anonymous');
            return { pgSettings };
          }
          
          // Verify and decode JWT
          const decoded = jwt.verify(token, jwtSecret);
          
          // Set PostgreSQL session variables for RLS
          pgSettings.set('role', 'authenticated');
          pgSettings.set('jwt.claims.sub', decoded.sub);
          pgSettings.set('jwt.claims.role', decoded.role);
          
          return { pgSettings };
          
        } catch (error) {
          // JWT verification failed - set anonymous role
          pgSettings.set('role', 'anonymous');
          return { pgSettings };
        }
      }
    }
  };
}

// Register the plugin
const authPlugin = createBearerAuthPlugin(process.env.JWT_SECRET);
plugins.register(authPlugin);
```

### How Plugins Work

1. **Plugin Structure**: Plugins are objects with a `name` and `callbacks` for different hooks
2. **Plugin Registration**: Use `plugins.register(plugin)` to register a complete plugin
3. **Hook Execution**: Plugin callbacks run before each query (more hooks coming soon)
4. **Context Access**: Callbacks receive context including tool name, parsed arguments, and request metadata
5. **Session Variables**: Plugins return `pgSettings` Maps that become PostgreSQL session variables
6. **Automatic Transactions**: When `pgSettings` are present, queries run in transactions with variables applied
7. **RLS Integration**: SQL queries can access variables via `current_setting('jwt.claims.sub')`

### Plugin Management

```typescript
// Get all registered plugins
const allPlugins = plugins.getRegisteredPlugins();

// Get specific plugin by name
const authPlugin = plugins.getPlugin("bearer-auth");

```

### Row Level Security Integration

With the authentication plugin, your SQL queries can reference JWT claims:

```sql
-- Users can only see their own todos
CREATE POLICY user_todos ON todos
  FOR ALL USING (user_id = current_setting('jwt.claims.sub')::uuid);

-- Query automatically filtered by RLS
SELECT * FROM todos; -- Only returns current user's todos
```

### Plugin Context

Plugin callbacks receive a context object with:

- `toolName`: Name of the tool being executed
- `toolConfig`: Tool configuration from YAML
- `pool`: Database connection pool
- `parsedArgs`: Validated tool arguments
- `extra`: MCP request metadata (authInfo, requestInfo, etc.)
- `query`: The SQL query being executed

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

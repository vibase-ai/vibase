import type { CallToolResult, MessageExtraInfo, TextContent } from "@modelcontextprotocol/sdk/types.js";
import type { PoolClient } from "pg";
import type { ConnectionManager } from "./connection-manager.js";
import type { BeforeQueryContext, Plugins } from "./plugins.js";
import type { PostgresSource, PostgresSqlTool } from "./validate-config.js";

// Symbol for client queuing (like PostGraphile)
const $$queue = Symbol('pg-client-queue');

// Extend PoolClient type to include our queue symbol
interface QueuedPoolClient extends PoolClient {
  [$$queue]?: Promise<any> | null;
}

// Helper function to ensure client operations are queued (like PostGraphile)
async function ensureClientQueue(client: QueuedPoolClient): Promise<void> {
  while (client[$$queue]) {
    await client[$$queue];
  }
}

// Helper function to build connection string from source configuration
function buildConnectionString(source: PostgresSource): string {
  if ("connection_string" in source) {
    return source.connection_string;
  } else {
    // Build connection string from individual parameters
    return `postgresql://${source.user}:${source.password}@${source.host}:${source.port}/${source.database}`;
  }
}

// Helper function to convert named parameters to positional parameters for safe parameterized queries
function buildSafeQuery(
  statement: string,
  parameters: Record<string, any>
): { text: string; values: any[] } {
  let sqlStatement = statement;
  let paramValues: any[] = [];
  
  // Convert named parameters to positional parameters
  if (statement.includes(":")) {
    const paramMap = new Map<string, number>();
    const paramMatches = Array.from(statement.matchAll(/:(\w+)/g));
    
    for (const match of paramMatches) {
      const paramName = match[1];
      if (!paramName || !(paramName in parameters)) {
        throw new Error(`Parameter :${paramName} not provided`);
      }
      
      // Assign position if we haven't seen this parameter before
      if (!paramMap.has(paramName)) {
        paramValues.push(parameters[paramName]);
        paramMap.set(paramName, paramValues.length);
      }
    }
    
    // Replace all named parameters with positional ones
    for (const [paramName, position] of paramMap.entries()) {
      const regex = new RegExp(`:${paramName}\\b`, 'g');
      sqlStatement = sqlStatement.replace(regex, `$${position}`);
    }
    
    return { text: sqlStatement, values: paramValues };
  } else if (statement.includes("$")) {
    // Already has positional parameters
    paramValues = Object.values(parameters);
    return { text: statement, values: paramValues };
  } else {
    // No parameters
    return { text: statement, values: [] };
  }
}

/**
 * Execute a SQL query with the given parameters using parameterized queries for SQL injection protection.
 * Automatically handles transactions when plugins return pgSettings (PostGraphile-inspired approach).
 */
export async function executeQuery(
  toolName: string,
  toolConfig: PostgresSqlTool,
  sourceName: string,
  sourceConfig: PostgresSource,
  connectionManager: ConnectionManager,
  parsedArgs: Record<string, any>,
  extra: MessageExtraInfo = {},
  plugins?: Plugins
): Promise<CallToolResult> {
  let pool: any;
  let client: QueuedPoolClient | undefined;
  let query: string = '';
  let queryResult: any;
  let error: Error | undefined;

  try {
    // Build connection string from source configuration
    const connectionString = buildConnectionString(sourceConfig);

    // Get database connection pool
    pool = connectionManager.getPool(sourceName, connectionString);

    // Build safe SQL query using parameterized queries
    const { text, values } = buildSafeQuery(toolConfig.statement, parsedArgs);
    query = text;

    // Resolve plugin configuration
    let pgSettings: Map<string, string> | undefined;
    if (plugins) {
      const context: BeforeQueryContext = {
        toolName,
        toolConfig,
        pool,
        parsedArgs,
        extra,
        query,
      };
      
      const config = await plugins.executeHook('beforeQuery', context);
      pgSettings = config.pgSettings;
    }

    if (pgSettings && pgSettings.size > 0) {
      // Need dedicated client + transaction (PostGraphile approach)
      client = await pool.connect() as QueuedPoolClient;

      // Ensure operations are queued on this client
      await ensureClientQueue(client);

      // Start the queued operation
      client[$$queue] = (async () => {
        try {
          await client!.query("BEGIN");

          // Apply all settings at once using PostGraphile's approach
          // First, ensure jwt.claims.role is mapped to the actual 'role' setting for RLS
          const enhancedSettings = new Map(pgSettings!);
          if (!enhancedSettings.has('role') && enhancedSettings.has('jwt.claims.role')) {
            // Map jwt.claims.role to the actual PostgreSQL role setting
            enhancedSettings.set('role', enhancedSettings.get('jwt.claims.role')!);
          }
          
          const settingsEntries = Array.from(enhancedSettings.entries()).map(([key, value]) => [key, String(value)]);
          await client!.query({
            text: "SELECT set_config(el->>0, el->>1, true) FROM json_array_elements($1::json) el",
            values: [JSON.stringify(settingsEntries)],
          });

          // Execute the main query with the configured client
          const result = await client!.query(text, values);

          await client!.query("COMMIT");
          return result;
        } catch (e) {
          await client!.query("ROLLBACK");
          throw e;
        }
      })();

      queryResult = await client[$$queue];
    } else {
      // No settings, use pool directly (no transaction needed)
      queryResult = await pool.query(text, values);
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(queryResult.rows, null, 2),
        } as TextContent,
      ],
    };
  } catch (err: any) {
    error = err instanceof Error ? err : new Error(String(err));

    return {
      content: [
        {
          type: "text" as const,
          text: `Error executing tool '${toolName}': ${error.message}`,
        } as TextContent,
      ],
      isError: true,
    };
  } finally {
    // Clean up client queue and release connection
    if (client) {
      client[$$queue] = null;
      client.release();
    }
  }
}


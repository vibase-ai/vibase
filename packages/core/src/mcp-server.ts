import type { ServerOptions } from "@modelcontextprotocol/sdk/server/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ConnectionManager } from "./connection-manager.js";
import { executeQuery } from "./execute-query.js";
import {
  type PostgresSource,
  type PostgresSqlTool,
  type ToolboxConfig,
} from "./validate-config.js";

// Helper function to convert parameter type to Zod schema
function createZodSchema(paramType: string, coerce: boolean = false) {
  switch (paramType) {
    case "string":
      return z.string();
    case "number":
      return coerce ? z.coerce.number() : z.number();
    case "boolean":
      if (coerce) {
        // Custom boolean coercion that properly handles string values and fails for undefined
        return z.union([z.boolean(), z.string(), z.number()]).transform((val) => {
          if (typeof val === 'boolean') return val;
          if (typeof val === 'number') return val !== 0;
          if (typeof val === 'string') {
            const lower = val.toLowerCase().trim();
            if (lower === 'false' || lower === '0' || lower === '' || lower === 'no' || lower === 'off') {
              return false;
            }
            if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') {
              return true;
            }
            // For other strings, use JavaScript's truthiness but be more strict
            return Boolean(val) && val !== '0';
          }
          return Boolean(val);
        });
      } else {
        return z.boolean();
      }
    default:
      return z.string();
  }
}

// Class to extend PostgresSqlTool with Zod shape caching
export class ToolConfigWithShape implements PostgresSqlTool {
  kind: "postgres-sql";
  source: string;
  description: string;
  parameters: PostgresSqlTool["parameters"];
  statement: string;
  protected _zodShape?: Record<string, z.ZodTypeAny>;

  constructor(tool: PostgresSqlTool) {
    this.kind = tool.kind;
    this.source = tool.source;
    this.description = tool.description;
    this.parameters = tool.parameters;
    this.statement = tool.statement;
  }

  getZodShape(): Record<string, z.ZodTypeAny> {
    if (this._zodShape) return this._zodShape;
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const param of this.parameters) {
      // Always use coercion for user-friendly input handling
      let zodType: z.ZodTypeAny = createZodSchema(param.type, true);
      
      // Apply default values for optional parameters
      if (param.default !== undefined) {
        // Use coerced schema to parse the default value
        let coercedDefault: any = zodType.parse(param.default);
        zodType = zodType.default(coercedDefault);
      } else if (param.required === false) {
        // Only make optional if there's no default (since .default() already makes it optional)
        zodType = zodType.optional();
      }
      
      shape[param.name] = zodType;
    }
    this._zodShape = shape;
    return shape;
  }

  validateArgs(args: any) {
    const shape = this.getZodShape();
    const zodSchema = z.object(shape);
    try {
      // Apply manual coercion based on parameter types
      const coercedArgs = { ...args };
      for (const param of this.parameters) {
        const value = coercedArgs[param.name];
        if (value !== undefined) {
          if (param.type === 'string') {
            // Convert numbers to strings for string parameters
            if (typeof value === 'number') {
              coercedArgs[param.name] = String(value);
            } else if (typeof value !== 'string') {
              coercedArgs[param.name] = String(value);
            }
          } else if (param.type === 'number') {
            // Convert strings to numbers for number parameters
            if (typeof value === 'string') {
              const numValue = Number(value);
              if (!isNaN(numValue)) {
                coercedArgs[param.name] = numValue;
              }
            }
            // Keep numbers as numbers (no conversion needed)
          }
          // For boolean and other types, let Zod handle the coercion
        }
      }
      
      const parsedArgs = zodSchema.parse(coercedArgs ?? {});
      return { success: true, parsedArgs };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

/**
 * Add tools from configuration to an existing MCP server
 */
export function addToolsToMcpServer(
  server: McpServer,
  config: ToolboxConfig
): { cleanup: () => Promise<void> } {
  // Initialize connection manager
  const connectionManager = new ConnectionManager();

  // Register tools from configuration
  for (const [toolName, toolConfigRaw] of Object.entries(config.tools)) {
    // Get the source configuration
    const sourceConfig = config.sources[toolConfigRaw.source];
    if (!sourceConfig) {
      throw new Error(
        `Source '${toolConfigRaw.source}' not found for tool '${toolName}'`
      );
    }

    // Wrap toolConfig in ToolConfigWithShape
    const toolConfig = new ToolConfigWithShape(toolConfigRaw);
    const shape = toolConfig.getZodShape();

    // Register the tool
    server.tool(
      toolName,
      toolConfig.description,
      shape,
      async (args: any, _extra?: any) => {
        // Use validateArgs for argument validation
        const validation = toolConfig.validateArgs(args ?? {});
        if (!validation.success) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: typeof validation.error === 'string' ? validation.error : '',
              },
            ],
          };
        }
        try {
          // Execute query
          return await executeQuery(
            toolName,
            toolConfig,
            toolConfig.source,
            sourceConfig,
            connectionManager,
            validation.parsedArgs ?? {}
          );
        } catch (err) {
          // Always return structured error for execution failures
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: err instanceof Error ? (err.message ?? '') : String(err),
              },
            ],
          };
        }
      }
    );
  }

  // Return cleanup function
  return {
    cleanup: async () => {
      await connectionManager.closeAll();
    },
  };
}

/**
 * Create an MCP server from a validated configuration object
 * This is a convenience wrapper around addToolsToMcpServer for backward compatibility
 */
export function createMcpServerFromConfig(
  config: ToolboxConfig,
  options: ServerOptions = {}
): { server: McpServer; cleanup: () => Promise<void> } {
  // Create MCP server
  const server = new McpServer({
    name: "Vibase MCP Server",
    version: "1.0.0",
    ...options,
  });

  // Add tools to the server
  const { cleanup } = addToolsToMcpServer(server, config);

  // Return server and cleanup function
  return {
    server,
    cleanup,
  };
}

// Export types for external use
export type { PostgresSource, PostgresSqlTool, ToolboxConfig };


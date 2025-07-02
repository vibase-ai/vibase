import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    addToolsToMcpServer,
    createMcpServerFromConfig,
    ToolConfigWithShape,
} from "../mcp-server.js";
import type { ToolboxConfig } from "../validate-config.js";

// Mock MCP SDK
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    tool: vi.fn(),
  })),
}));

// Mock ConnectionManager
vi.mock("../connection-manager.js", () => ({
  ConnectionManager: vi.fn().mockImplementation(() => ({
    getPool: vi.fn(),
    closeAll: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock executeQuery
vi.mock("../execute-query.js", () => ({
  executeQuery: vi.fn(),
}));

describe("createMcpServerFromConfig", () => {
  let mockMcpServerConstructor: any;
  let mockMcpServer: any;
  let mockTool: any;
  let mockExecuteQuery: any;
  let mockConnectionManager: any;

  beforeEach(async () => {
    const mcpSdk = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const connectionManagerModule = await import("../connection-manager.js");
    const executeQueryModule = await import("../execute-query.js");

    mockTool = vi.fn();
    mockMcpServer = { tool: mockTool };
    mockMcpServerConstructor = vi.mocked(mcpSdk.McpServer);
    mockMcpServerConstructor.mockReturnValue(mockMcpServer);

    mockConnectionManager = {
      getPool: vi.fn(),
      closeAll: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(connectionManagerModule.ConnectionManager).mockReturnValue(
      mockConnectionManager
    );

    mockExecuteQuery = vi.mocked(executeQueryModule.executeQuery);

    vi.clearAllMocks();
  });

  describe("server creation", () => {
    it("should create MCP server with default options", () => {
      const config: ToolboxConfig = {
        sources: {
          test_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test_tool: {
            kind: "postgres-sql",
            source: "test_db",
            description: "Test tool",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      const { server, cleanup } = createMcpServerFromConfig(config);

      expect(mockMcpServerConstructor).toHaveBeenCalledWith({
        name: "Vibase MCP Server",
        version: "1.0.0",
      });
      expect(server).toBe(mockMcpServer);
      expect(cleanup).toBeInstanceOf(Function);
    });

    it("should create MCP server with custom options", () => {
      const config: ToolboxConfig = {
        sources: {},
        tools: {},
      };
      const customOptions = {
        capabilities: {
          tools: {},
        },
      };

      const { server } = createMcpServerFromConfig(config, customOptions);

      expect(mockMcpServerConstructor).toHaveBeenCalledWith({
        name: "Vibase MCP Server",
        version: "1.0.0",
        ...customOptions,
      });
      expect(server).toBe(mockMcpServer);
    });

    it("should handle empty configuration", () => {
      const config: ToolboxConfig = {
        sources: {},
        tools: {},
      };

      const { server } = createMcpServerFromConfig(config);

      expect(mockMcpServerConstructor).toHaveBeenCalled();
      expect(mockTool).not.toHaveBeenCalled();
      expect(server).toBe(mockMcpServer);
    });
  });

  describe("tool registration", () => {
    it("should register a single tool", () => {
      const config: ToolboxConfig = {
        sources: {
          main_db: {
            kind: "postgres",
            connection_string: "postgresql://user:pass@localhost:5432/main",
          },
        },
        tools: {
          get_users: {
            kind: "postgres-sql",
            source: "main_db",
            description: "Get all users",
            parameters: [
              {
                name: "limit",
                type: "number",
                description: "Maximum number of users",
                required: false,
                default: 10,
              },
            ],
            statement: "SELECT * FROM users LIMIT :limit",
          },
        },
      };

      createMcpServerFromConfig(config);

      expect(mockTool).toHaveBeenCalledTimes(1);
      expect(mockTool).toHaveBeenCalledWith(
        "get_users",
        "Get all users",
        { limit: expect.any(Object) },
        expect.any(Function)
      );
    });

    it("should register multiple tools", () => {
      const config: ToolboxConfig = {
        sources: {
          users_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/users",
          },
          orders_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/orders",
          },
        },
        tools: {
          get_user: {
            kind: "postgres-sql",
            source: "users_db",
            description: "Get user by ID",
            parameters: [
              {
                name: "user_id",
                type: "number",
                description: "User ID",
                required: true,
              },
            ],
            statement: "SELECT * FROM users WHERE id = :user_id",
          },
          get_orders: {
            kind: "postgres-sql",
            source: "orders_db",
            description: "Get orders",
            parameters: [],
            statement: "SELECT * FROM orders",
          },
        },
      };

      createMcpServerFromConfig(config);

      expect(mockTool).toHaveBeenCalledTimes(2);
      expect(mockTool).toHaveBeenNthCalledWith(
        1,
        "get_user",
        "Get user by ID",
        { user_id: expect.any(Object) },
        expect.any(Function)
      );
      expect(mockTool).toHaveBeenNthCalledWith(
        2,
        "get_orders",
        "Get orders",
        {},
        expect.any(Function)
      );
    });

    it("should register tools with different parameter types", () => {
      const config: ToolboxConfig = {
        sources: {
          test_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          complex_query: {
            kind: "postgres-sql",
            source: "test_db",
            description: "Complex query with all parameter types",
            parameters: [
              {
                name: "str_param",
                type: "string",
                description: "String parameter",
                required: true,
              },
              {
                name: "num_param",
                type: "number",
                description: "Number parameter",
                required: false,
                default: 0,
              },
              {
                name: "bool_param",
                type: "boolean",
                description: "Boolean parameter",
              },
            ],
            statement:
              "SELECT * FROM test WHERE str_col = :str_param AND num_col = :num_param AND bool_col = :bool_param",
          },
        },
      };

      createMcpServerFromConfig(config);

      expect(mockTool).toHaveBeenCalledWith(
        "complex_query",
        "Complex query with all parameter types",
        {
          str_param: expect.any(Object),
          num_param: expect.any(Object),
          bool_param: expect.any(Object),
        },
        expect.any(Function)
      );
    });

    it("should throw error for tool with nonexistent source", () => {
      const config: ToolboxConfig = {
        sources: {
          existing_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/existing",
          },
        },
        tools: {
          invalid_tool: {
            kind: "postgres-sql",
            source: "nonexistent_db",
            description: "Tool with invalid source",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      expect(() => createMcpServerFromConfig(config)).toThrow(
        "Source 'nonexistent_db' not found for tool 'invalid_tool'"
      );
    });
  });

  describe("tool execution", () => {
    it("should execute tool handler correctly", async () => {
      const config: ToolboxConfig = {
        sources: {
          test_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test_tool: {
            kind: "postgres-sql",
            source: "test_db",
            description: "Test tool",
            parameters: [
              { name: "param1", type: "string", description: "Test parameter" },
            ],
            statement: "SELECT * FROM test WHERE col = :param1",
          },
        },
      };

      const mockResult = {
        content: [{ type: "text", text: "Test result" }],
      };
      mockExecuteQuery.mockResolvedValue(mockResult);

      createMcpServerFromConfig(config);

      // Get the registered tool handler
      const toolHandler = mockTool.mock.calls[0]?.[3];
      const args = { param1: "test_value" };

      const result = await toolHandler(args);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        "test_tool",
        expect.any(ToolConfigWithShape),
        "test_db",
        config.sources.test_db,
        expect.any(Object),
        args,
        {},
        expect.any(Object)
      );
      expect(result).toBe(mockResult);
    });

    it("should handle tool execution errors", async () => {
      const config: ToolboxConfig = {
        sources: {
          test_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          error_tool: {
            kind: "postgres-sql",
            source: "test_db",
            description: "Tool that causes error",
            parameters: [],
            statement: "SELECT * FROM nonexistent_table",
          },
        },
      };

      const errorResult = {
        content: [{ type: "text", text: "Database error" }],
        isError: true,
      };
      mockExecuteQuery.mockResolvedValue(errorResult);

      createMcpServerFromConfig(config);

      const toolHandler = mockTool.mock.calls[0]?.[3];
      const result = await toolHandler({});

      expect(result).toBe(errorResult);
    });
  });

  describe("tool execution with type coercion and defaults", () => {
    it("should coerce string number args to numbers and pass to executeQuery", async () => {
      const config: ToolboxConfig = {
        sources: {
          test_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test_tool: {
            kind: "postgres-sql",
            source: "test_db",
            description: "Test tool",
            parameters: [
              { name: "limit", type: "number", description: "Limit", required: true },
              { name: "flag", type: "boolean", description: "Flag", required: true },
            ],
            statement: "SELECT * FROM test LIMIT :limit WHERE flag = :flag",
          },
        },
      };
      createMcpServerFromConfig(config);
      // Get the registered tool handler
      const toolHandler = mockTool.mock.calls[0]?.[3];
      // Pass string values for number and boolean
      const args = { limit: "10", flag: "true" };
      const mockResult = { content: [{ type: "text", text: "ok" }] };
      mockExecuteQuery.mockResolvedValue(mockResult);
      await toolHandler(args);
      // Should be coerced to number and boolean
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        "test_tool",
        expect.any(ToolConfigWithShape),
        "test_db",
        config.sources.test_db,
        expect.any(Object),
        expect.objectContaining({ limit: 10, flag: true }),
        {},
        expect.any(Object)
      );
    });
    it("should coerce default string number/boolean to correct type", async () => {
      const config: ToolboxConfig = {
        sources: {
          test_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test_tool: {
            kind: "postgres-sql",
            source: "test_db",
            description: "Test tool",
            parameters: [
              { name: "limit", type: "number", description: "Limit", required: false, default: "5" as any },
              { name: "flag", type: "boolean", description: "Flag", required: false, default: "false" as any },
            ],
            statement: "SELECT * FROM test LIMIT :limit WHERE flag = :flag",
          },
        },
      };
      createMcpServerFromConfig(config);
      // Get the registered tool handler
      const toolHandler = mockTool.mock.calls[0]?.[3];
      // Pass no args, should use defaults
      const mockResult = { content: [{ type: "text", text: "ok" }] };
      mockExecuteQuery.mockResolvedValue(mockResult);
      await toolHandler({});
      // Should be coerced to number and boolean
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        "test_tool",
        expect.any(ToolConfigWithShape),
        "test_db",
        config.sources.test_db,
        expect.any(Object),
        expect.objectContaining({ limit: 5, flag: false }),
        {},
        expect.any(Object)
      );
    });
  });

  describe("cleanup", () => {
    it("should provide cleanup function that closes connections", async () => {
      const config: ToolboxConfig = {
        sources: {
          test_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {},
      };

      const { cleanup } = createMcpServerFromConfig(config);

      await cleanup();

      expect(mockConnectionManager.closeAll).toHaveBeenCalledTimes(1);
    });

    it("should handle cleanup errors gracefully", async () => {
      const config: ToolboxConfig = {
        sources: {},
        tools: {},
      };

      mockConnectionManager.closeAll.mockRejectedValue(
        new Error("Cleanup failed")
      );

      const { cleanup } = createMcpServerFromConfig(config);

      await expect(cleanup()).rejects.toThrow("Cleanup failed");
    });
  });

  describe("integration scenarios", () => {
    it("should handle complex configuration with multiple sources and tools", () => {
      const config: ToolboxConfig = {
        sources: {
          primary_db: {
            kind: "postgres",
            connection_string: "postgresql://user:pass@primary:5432/main",
          },
          analytics_db: {
            kind: "postgres",
            connection_string: "postgresql://user:pass@analytics:5432/data",
          },
          cache_db: {
            kind: "postgres",
            connection_string: "postgresql://user:pass@cache:5432/redis",
          },
        },
        tools: {
          get_user_profile: {
            kind: "postgres-sql",
            source: "primary_db",
            description: "Get complete user profile",
            parameters: [
              {
                name: "user_id",
                type: "number",
                description: "User ID",
                required: true,
              },
            ],
            statement:
              "SELECT * FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = :user_id",
          },
          get_user_analytics: {
            kind: "postgres-sql",
            source: "analytics_db",
            description: "Get user analytics data",
            parameters: [
              {
                name: "user_id",
                type: "number",
                description: "User ID",
                required: true,
              },
              {
                name: "days",
                type: "number",
                description: "Number of days",
                required: false,
                default: 30,
              },
            ],
            statement:
              "SELECT * FROM events WHERE user_id = :user_id AND created_at >= NOW() - INTERVAL :days DAY",
          },
          clear_user_cache: {
            kind: "postgres-sql",
            source: "cache_db",
            description: "Clear user cache",
            parameters: [
              {
                name: "user_id",
                type: "string",
                description: "User ID as string",
                required: true,
              },
            ],
            statement: "DELETE FROM cache WHERE key LIKE :user_id",
          },
        },
      };

      const { server } = createMcpServerFromConfig(config);

      expect(mockMcpServerConstructor).toHaveBeenCalledTimes(1);
      expect(mockTool).toHaveBeenCalledTimes(3);
      expect(server).toBe(mockMcpServer);

      // Verify all tools were registered with correct parameters
      expect(mockTool).toHaveBeenCalledWith(
        "get_user_profile",
        "Get complete user profile",
        { user_id: expect.any(Object) },
        expect.any(Function)
      );
      expect(mockTool).toHaveBeenCalledWith(
        "get_user_analytics",
        "Get user analytics data",
        { user_id: expect.any(Object), days: expect.any(Object) },
        expect.any(Function)
      );
      expect(mockTool).toHaveBeenCalledWith(
        "clear_user_cache",
        "Clear user cache",
        { user_id: expect.any(Object) },
        expect.any(Function)
      );
    });
  });
});

describe("addToolsToMcpServer", () => {
  let mockMcpServer: any;
  let mockTool: any;
  let mockConnectionManager: any;

  beforeEach(async () => {
    const connectionManagerModule = await import("../connection-manager.js");

    mockTool = vi.fn();
    mockMcpServer = { tool: mockTool };

    mockConnectionManager = {
      getPool: vi.fn(),
      closeAll: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(connectionManagerModule.ConnectionManager).mockReturnValue(
      mockConnectionManager
    );

    vi.clearAllMocks();
  });

  describe("tool registration", () => {
    it("should add tools to existing MCP server", () => {
      const config: ToolboxConfig = {
        sources: {
          test_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test_tool: {
            kind: "postgres-sql",
            source: "test_db",
            description: "Test tool",
            parameters: [
              {
                name: "param1",
                type: "string",
                description: "Test parameter",
                required: true,
              },
            ],
            statement: "SELECT * FROM test WHERE col = :param1",
          },
        },
      };

      const { cleanup } = addToolsToMcpServer(mockMcpServer, config);

      expect(mockTool).toHaveBeenCalledTimes(1);
      expect(mockTool).toHaveBeenCalledWith(
        "test_tool",
        "Test tool",
        { param1: expect.any(Object) },
        expect.any(Function)
      );
      expect(cleanup).toBeInstanceOf(Function);
    });

    it("should add multiple tools to existing server", () => {
      const config: ToolboxConfig = {
        sources: {
          db1: {
            kind: "postgres",
            connection_string: "postgresql://localhost/db1",
          },
          db2: {
            kind: "postgres",
            connection_string: "postgresql://localhost/db2",
          },
        },
        tools: {
          tool1: {
            kind: "postgres-sql",
            source: "db1",
            description: "First tool",
            parameters: [],
            statement: "SELECT 1",
          },
          tool2: {
            kind: "postgres-sql",
            source: "db2",
            description: "Second tool",
            parameters: [
              {
                name: "id",
                type: "number",
                description: "ID parameter",
                required: true,
              },
            ],
            statement: "SELECT * FROM table2 WHERE id = :id",
          },
        },
      };

      addToolsToMcpServer(mockMcpServer, config);

      expect(mockTool).toHaveBeenCalledTimes(2);
      expect(mockTool).toHaveBeenNthCalledWith(
        1,
        "tool1",
        "First tool",
        {},
        expect.any(Function)
      );
      expect(mockTool).toHaveBeenNthCalledWith(
        2,
        "tool2",
        "Second tool",
        { id: expect.any(Object) },
        expect.any(Function)
      );
    });

    it("should handle tools with default values", () => {
      const config: ToolboxConfig = {
        sources: {
          test_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          tool_with_defaults: {
            kind: "postgres-sql",
            source: "test_db",
            description: "Tool with defaults",
            parameters: [
              {
                name: "limit",
                type: "number",
                description: "Result limit",
                required: false,
                default: 10,
              },
              {
                name: "status",
                type: "string",
                description: "Status filter",
                required: false,
                default: "active",
              },
            ],
            statement:
              "SELECT * FROM users WHERE status = :status LIMIT :limit",
          },
        },
      };

      addToolsToMcpServer(mockMcpServer, config);

      expect(mockTool).toHaveBeenCalledWith(
        "tool_with_defaults",
        "Tool with defaults",
        {
          limit: expect.any(Object),
          status: expect.any(Object),
        },
        expect.any(Function)
      );
    });

    it("should throw error for nonexistent source", () => {
      const config: ToolboxConfig = {
        sources: {
          valid_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/valid",
          },
        },
        tools: {
          invalid_tool: {
            kind: "postgres-sql",
            source: "nonexistent_db",
            description: "Tool with invalid source",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      expect(() => addToolsToMcpServer(mockMcpServer, config)).toThrow(
        "Source 'nonexistent_db' not found for tool 'invalid_tool'"
      );
    });
  });

  describe("cleanup functionality", () => {
    it("should provide cleanup function that closes connections", async () => {
      const config: ToolboxConfig = {
        sources: {
          test_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {},
      };

      const { cleanup } = addToolsToMcpServer(mockMcpServer, config);

      await cleanup();

      expect(mockConnectionManager.closeAll).toHaveBeenCalledTimes(1);
    });

    it("should handle cleanup errors gracefully", async () => {
      const config: ToolboxConfig = {
        sources: {},
        tools: {},
      };

      mockConnectionManager.closeAll.mockRejectedValue(
        new Error("Cleanup failed")
      );

      const { cleanup } = addToolsToMcpServer(mockMcpServer, config);

      await expect(cleanup()).rejects.toThrow("Cleanup failed");
    });
  });

  describe("compatibility with createMcpServerFromConfig", () => {
    it("should provide the same cleanup functionality", async () => {
      const config: ToolboxConfig = {
        sources: {
          test_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {},
      };

      // Test addToolsToMcpServer cleanup
      const { cleanup: addToolsCleanup } = addToolsToMcpServer(
        mockMcpServer,
        config
      );
      expect(addToolsCleanup).toBeInstanceOf(Function);

      // Test that cleanup works
      await addToolsCleanup();
      expect(mockConnectionManager.closeAll).toHaveBeenCalledTimes(1);

      // Reset for next test
      vi.clearAllMocks();

      // Test createMcpServerFromConfig cleanup
      const { server, cleanup: createServerCleanup } =
        createMcpServerFromConfig(config);
      expect(server).toBeDefined();
      expect(createServerCleanup).toBeInstanceOf(Function);

      // Test that cleanup works
      await createServerCleanup();
      expect(mockConnectionManager.closeAll).toHaveBeenCalledTimes(1);
    });

    it("should handle the same error scenarios", () => {
      const invalidConfig: ToolboxConfig = {
        sources: {
          valid_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/valid",
          },
        },
        tools: {
          invalid_tool: {
            kind: "postgres-sql",
            source: "nonexistent_db",
            description: "Tool with invalid source",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      // Both functions should throw the same error
      expect(() => addToolsToMcpServer(mockMcpServer, invalidConfig)).toThrow(
        "Source 'nonexistent_db' not found for tool 'invalid_tool'"
      );

      expect(() => createMcpServerFromConfig(invalidConfig)).toThrow(
        "Source 'nonexistent_db' not found for tool 'invalid_tool'"
      );
    });
  });
});

describe("ToolConfigWithShape argument validation", () => {
  it("should return error if required argument is missing", () => {
    const toolConfig = new ToolConfigWithShape({
      kind: "postgres-sql",
      source: "db",
      description: "Test tool",
      parameters: [
        {
          name: "required_param",
          type: "string",
          description: "Required parameter",
          required: true,
        },
      ],
      statement: "SELECT * FROM test WHERE col = :required_param",
    });
    const result = toolConfig.validateArgs({});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it("should succeed if required argument is present", () => {
    const toolConfig = new ToolConfigWithShape({
      kind: "postgres-sql",
      source: "db",
      description: "Test tool",
      parameters: [
        {
          name: "required_param",
          type: "string",
          description: "Required parameter",
          required: true,
        },
      ],
      statement: "SELECT * FROM test WHERE col = :required_param",
    });
    const result = toolConfig.validateArgs({ required_param: "test" });
    expect(result.success).toBe(true);
    expect(result.parsedArgs?.required_param).toBe("test");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionManager } from "../connection-manager.js";
import { executeQuery } from "../execute-query.js";
import type { BeforeQueryResult, Plugins } from "../plugins.js";
import type { PostgresSource, PostgresSqlTool } from "../validate-config.js";

// Helper to create test source configuration
const createTestSource = (
  connectionString = "postgresql://localhost/test"
): PostgresSource => ({
  kind: "postgres",
  connection_string: connectionString,
});

// Mock connection manager
const mockConnectionManager = {
  getPool: vi.fn(),
  closeAll: vi.fn(),
} as unknown as ConnectionManager;

describe("executeQuery", () => {
  let mockQuery: any;
  let mockPool: any;

  beforeEach(async () => {
    mockQuery = vi.fn();
    mockPool = { query: mockQuery };
    vi.mocked(mockConnectionManager.getPool).mockReturnValue(mockPool);

    vi.clearAllMocks();
  });

  describe("named parameters", () => {
    it("should execute query with named parameters", async () => {
      const toolName = "get_user";
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Get user by ID",
        parameters: [
          { name: "user_id", type: "number", description: "User ID" },
        ],
        statement: "SELECT * FROM users WHERE id = :user_id",
      };
      const sourceName = "main_db";
      const connectionString = "postgresql://localhost/test";
      const parsedArgs = { user_id: 123 };

      const mockQueryResult = {
        rows: [{ id: 123, name: "John Doe", email: "john@example.com" }],
      };

      mockQuery.mockResolvedValue(mockQueryResult);

      const result = await executeQuery(
        toolName,
        toolConfig,
        sourceName,
        createTestSource(connectionString),
        mockConnectionManager,
        parsedArgs
      );

      expect(mockConnectionManager.getPool).toHaveBeenCalledWith(
        sourceName,
        connectionString
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = $1",
        [123]
      );
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify(mockQueryResult.rows, null, 2),
          },
        ],
      });
    });

    it("should handle multiple named parameters", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Get users with filters",
        parameters: [
          { name: "min_age", type: "number", description: "Minimum age" },
          { name: "status", type: "string", description: "User status" },
        ],
        statement:
          "SELECT * FROM users WHERE age >= :min_age AND status = :status",
      };
      const parsedArgs = { min_age: 18, status: "active" };

      mockQuery.mockResolvedValue({ rows: [] });

      await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        parsedArgs
      );

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE age >= $1 AND status = $2",
        [18, "active"]
      );
    });

    it("should handle duplicate named parameters", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Get user data",
        parameters: [
          { name: "user_id", type: "number", description: "User ID" },
        ],
        statement:
          "SELECT * FROM users WHERE id = :user_id OR parent_id = :user_id",
      };
      const parsedArgs = { user_id: 123 };

      mockQuery.mockResolvedValue({ rows: [] });

      await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        parsedArgs
      );

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = $1 OR parent_id = $1",
        [123]
      );
    });
  });

  describe("positional parameters", () => {
    it("should execute query with positional parameters", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Get user by ID",
        parameters: [
          { name: "user_id", type: "number", description: "User ID" },
        ],
        statement: "SELECT * FROM users WHERE id = $1",
      };
      const parsedArgs = { user_id: 123 };

      mockQuery.mockResolvedValue({ rows: [{ id: 123, name: "John" }] });

      await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        parsedArgs
      );

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = $1",
        [123]
      );
    });

    it("should handle multiple positional parameters", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Get users with filters",
        parameters: [
          { name: "min_age", type: "number", description: "Minimum age" },
          { name: "status", type: "string", description: "Status" },
        ],
        statement: "SELECT * FROM users WHERE age >= $1 AND status = $2",
      };
      const parsedArgs = { min_age: 18, status: "active" };

      mockQuery.mockResolvedValue({ rows: [] });

      await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        parsedArgs
      );

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE age >= $1 AND status = $2",
        [18, "active"]
      );
    });
  });

  describe("SQL injection protection", () => {
    it("should protect against SQL injection in named parameters", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Get user",
        parameters: [
          { name: "input", type: "string", description: "User input" },
        ],
        statement: "SELECT * FROM users WHERE name = :input",
      };
      const maliciousInput = "'; DROP TABLE users; --";
      const parsedArgs = { input: maliciousInput };

      mockQuery.mockResolvedValue({ rows: [] });

      await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        parsedArgs
      );

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE name = $1",
        [maliciousInput]
      );
    });

    it("should protect against SQL injection in positional parameters", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Get user",
        parameters: [
          { name: "input", type: "string", description: "User input" },
        ],
        statement: "SELECT * FROM users WHERE name = $1",
      };
      const maliciousInput = "1 OR 1=1";
      const parsedArgs = { input: maliciousInput };

      mockQuery.mockResolvedValue({ rows: [] });

      await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        parsedArgs
      );

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE name = $1",
        [maliciousInput]
      );
    });

    it("should handle special characters safely", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Search users",
        parameters: [
          { name: "search", type: "string", description: "Search term" },
        ],
        statement: "SELECT * FROM users WHERE name LIKE :search",
      };
      const specialChars = "O'Reilly & Co. (100%)";
      const parsedArgs = { search: specialChars };

      mockQuery.mockResolvedValue({ rows: [] });

      await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        parsedArgs
      );

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE name LIKE $1",
        [specialChars]
      );
    });
  });

  describe("error handling", () => {
    it("should handle database query errors", async () => {
      const toolName = "test";
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [],
        statement: "SELECT * FROM nonexistent_table",
      };

      const dbError = new Error('relation "nonexistent_table" does not exist');
      mockQuery.mockRejectedValue(dbError);

      const result = await executeQuery(
        toolName,
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        {}
      );

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: `Error executing tool '${toolName}': relation "nonexistent_table" does not exist`,
          },
        ],
        isError: true,
      });
    });

    it("should handle connection errors", async () => {
      const toolName = "test";
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [],
        statement: "SELECT 1",
      };

      const connectionError = new Error("Connection refused");
      mockQuery.mockRejectedValue(connectionError);

      const result = await executeQuery(
        toolName,
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        {}
      );

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: `Error executing tool '${toolName}': Connection refused`,
          },
        ],
        isError: true,
      });
    });

    it("should handle pg-sql2 compilation errors", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [
          { name: "param", type: "string", description: "Test param" },
        ],
        statement: "SELECT * FROM users WHERE name = :param",
      };

      const compilationError = new Error("SQL compilation failed");
      mockQuery.mockImplementation(() => {
        throw compilationError;
      });

      const result = await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        { param: "test" }
      );

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "Error executing tool 'test': SQL compilation failed",
          },
        ],
        isError: true,
      });
    });

    it("should handle empty query results", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Empty result query",
        parameters: [],
        statement: "SELECT * FROM users WHERE 1=0",
      };

      mockQuery.mockResolvedValue({ rows: [] });

      const result = await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        {}
      );

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "[]",
          },
        ],
      });
    });

    it("should handle queries with no parameters", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Simple query",
        parameters: [],
        statement: "SELECT COUNT(*) FROM users",
      };

      mockQuery.mockResolvedValue({ rows: [{ count: "5" }] });

      const result = await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        {}
      );

      expect(mockQuery).toHaveBeenCalledWith("SELECT COUNT(*) FROM users", []);
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify([{ count: "5" }], null, 2),
          },
        ],
      });
    });

    it("should handle undefined compiled values", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [
          { name: "param", type: "string", description: "Test param" },
        ],
        statement: "SELECT * FROM users WHERE name = :param",
      };

      mockQuery.mockResolvedValue({ rows: [] });

      const result = await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        { param: "test" }
      );

      expect(result.content[0]?.type).toBe("text");
      expect(result.isError).toBeUndefined();
    });
  });

  describe("connection string building", () => {
    it("should handle connection string source format", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [],
        statement: "SELECT 1",
      };
      const sourceConfig: PostgresSource = {
        kind: "postgres",
        connection_string: "postgresql://user:pass@localhost:5432/testdb",
      };

      mockQuery.mockResolvedValue({ rows: [{ result: 1 }] });

      await executeQuery(
        "test",
        toolConfig,
        "db",
        sourceConfig,
        mockConnectionManager,
        {}
      );

      expect(mockConnectionManager.getPool).toHaveBeenCalledWith(
        "db",
        "postgresql://user:pass@localhost:5432/testdb"
      );
    });

    it("should handle individual parameters source format", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [],
        statement: "SELECT 1",
      };
      const sourceConfig: PostgresSource = {
        kind: "postgres",
        host: "127.0.0.1",
        port: 5432,
        database: "toolbox_db",
        user: "toolbox_user",
        password: "my-password",
      };

      mockQuery.mockResolvedValue({ rows: [{ result: 1 }] });

      await executeQuery(
        "test",
        toolConfig,
        "db",
        sourceConfig,
        mockConnectionManager,
        {}
      );

      expect(mockConnectionManager.getPool).toHaveBeenCalledWith(
        "db",
        "postgresql://toolbox_user:my-password@127.0.0.1:5432/toolbox_db"
      );
    });

    it("should handle parameters with special characters in password", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [],
        statement: "SELECT 1",
      };
      const sourceConfig: PostgresSource = {
        kind: "postgres",
        host: "localhost",
        port: 5433,
        database: "my_db",
        user: "admin@company.com",
        password: "p@ssw0rd!#$",
      };

      mockQuery.mockResolvedValue({ rows: [{ result: 1 }] });

      await executeQuery(
        "test",
        toolConfig,
        "db",
        sourceConfig,
        mockConnectionManager,
        {}
      );

      expect(mockConnectionManager.getPool).toHaveBeenCalledWith(
        "db",
        "postgresql://admin@company.com:p@ssw0rd!#$@localhost:5433/my_db"
      );
    });
  });

  describe("plugin integration", () => {
    let mockClient: any;
    let mockClientQuery: any;
    let mockPool: any;
    let mockPlugins: Plugins;
    
    // Create a symbol similar to $$queue for testing
    const testQueueSymbol = Symbol('pg-client-queue');

    beforeEach(() => {
      // Reset mocks
      mockClientQuery = vi.fn();
      mockClient = {
        query: mockClientQuery,
        release: vi.fn(),
        [testQueueSymbol]: null,
      };
      
      mockPool = {
        query: vi.fn(),
        connect: vi.fn().mockResolvedValue(mockClient),
      };
      
      vi.mocked(mockConnectionManager.getPool).mockReturnValue(mockPool);
      
      // Mock plugins
      mockPlugins = {
        register: vi.fn(),
        registerHook: vi.fn(),
        executeHook: vi.fn(),
      };
    });

    it("should execute query without plugins using pool directly", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [],
        statement: "SELECT * FROM users",
      };

      const mockQueryResult = { rows: [{ id: 1, name: "John" }] };
      mockPool.query.mockResolvedValue(mockQueryResult);

      const result = await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        {},
        {},
        undefined // no plugins
      );

      expect(mockPool.query).toHaveBeenCalledWith("SELECT * FROM users", []);
      expect(mockPool.connect).not.toHaveBeenCalled();
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify(mockQueryResult.rows, null, 2),
          },
        ],
      });
    });

    it("should execute query with plugins that return no pgSettings", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [],
        statement: "SELECT * FROM users",
      };

      // Plugin returns empty result
      vi.mocked(mockPlugins.executeHook).mockResolvedValue({
        pgSettings: new Map(),
      } as BeforeQueryResult);

      const mockQueryResult = { rows: [{ id: 1, name: "John" }] };
      mockPool.query.mockResolvedValue(mockQueryResult);

      const result = await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        {},
        {},
        mockPlugins
      );

      expect(mockPlugins.executeHook).toHaveBeenCalledWith('beforeQuery', expect.objectContaining({
        toolName: 'test',
        toolConfig,
        pool: mockPool,
        parsedArgs: {},
        extra: {},
        query: "SELECT * FROM users",
      }));
      
      // Should use pool directly since no pgSettings
      expect(mockPool.query).toHaveBeenCalledWith("SELECT * FROM users", []);
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it("should execute query with transaction when plugins return pgSettings", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [],
        statement: "SELECT * FROM users WHERE role = current_setting('jwt.claims.role')",
      };

      // Plugin returns pgSettings
      vi.mocked(mockPlugins.executeHook).mockResolvedValue({
        pgSettings: new Map([
          ['role', 'authenticated'],
          ['jwt.claims.sub', 'user-123'],
          ['jwt.claims.role', 'admin'],
        ]),
      } as BeforeQueryResult);

      const mockQueryResult = { rows: [{ id: 1, name: "Admin User" }] };
      mockClientQuery.mockResolvedValue(mockQueryResult);

      const result = await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        {},
        {},
        mockPlugins
      );

      // Should use dedicated client for transaction
      expect(mockPool.connect).toHaveBeenCalled();
      
      // Check transaction flow
      expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
      
      // Check settings application
      expect(mockClientQuery).toHaveBeenCalledWith({
        text: "SELECT set_config(el->>0, el->>1, true) FROM json_array_elements($1::json) el",
        values: [JSON.stringify([
          ['role', 'authenticated'],
          ['jwt.claims.sub', 'user-123'], 
          ['jwt.claims.role', 'admin'],
        ])],
      });
      
      // Check main query execution
      expect(mockClientQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE role = current_setting('jwt.claims.role')",
        []
      );
      
      expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
      
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify(mockQueryResult.rows, null, 2),
          },
        ],
      });
    });

    it("should map jwt.claims.role to role setting when role not explicitly set", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [],
        statement: "SELECT current_setting('role')",
      };

      // Plugin returns only jwt.claims.role (no explicit role)
      vi.mocked(mockPlugins.executeHook).mockResolvedValue({
        pgSettings: new Map([
          ['jwt.claims.role', 'admin'],
          ['jwt.claims.sub', 'user-123'],
        ]),
      } as BeforeQueryResult);

      mockClientQuery.mockResolvedValue({ rows: [{ current_setting: 'admin' }] });

      await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        {},
        {},
        mockPlugins
      );

      // Should enhance settings to include role mapping
      expect(mockClientQuery).toHaveBeenCalledWith({
        text: "SELECT set_config(el->>0, el->>1, true) FROM json_array_elements($1::json) el",
        values: [JSON.stringify([
          ['jwt.claims.role', 'admin'],
          ['jwt.claims.sub', 'user-123'],
          ['role', 'admin'], // Should be added automatically
        ])],
      });
    });

    it("should not override explicit role setting", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [],
        statement: "SELECT current_setting('role')",
      };

      // Plugin returns both role and jwt.claims.role
      vi.mocked(mockPlugins.executeHook).mockResolvedValue({
        pgSettings: new Map([
          ['role', 'authenticated'], // explicit role
          ['jwt.claims.role', 'admin'],
          ['jwt.claims.sub', 'user-123'],
        ]),
      } as BeforeQueryResult);

      mockClientQuery.mockResolvedValue({ rows: [{ current_setting: 'authenticated' }] });

      await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        {},
        {},
        mockPlugins
      );

      // Should keep explicit role setting
      expect(mockClientQuery).toHaveBeenCalledWith({
        text: "SELECT set_config(el->>0, el->>1, true) FROM json_array_elements($1::json) el",
        values: [JSON.stringify([
          ['role', 'authenticated'], // explicit role preserved
          ['jwt.claims.role', 'admin'],
          ['jwt.claims.sub', 'user-123'],
        ])],
      });
    });

    it("should handle transaction rollback on query error", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [],
        statement: "SELECT * FROM non_existent_table",
      };

      vi.mocked(mockPlugins.executeHook).mockResolvedValue({
        pgSettings: new Map([['role', 'authenticated']]),
      } as BeforeQueryResult);

      const queryError = new Error("relation 'non_existent_table' does not exist");
      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce(undefined) // set_config
        .mockRejectedValueOnce(queryError) // main query fails
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const result = await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        {},
        {},
        mockPlugins
      );

      expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
      expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
      
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "Error executing tool 'test': relation 'non_existent_table' does not exist",
          },
        ],
        isError: true,
      });
    });

    it("should handle transaction rollback on settings error", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [],
        statement: "SELECT 1",
      };

      vi.mocked(mockPlugins.executeHook).mockResolvedValue({
        pgSettings: new Map([['invalid_setting', 'value']]),
      } as BeforeQueryResult);

      const settingsError = new Error("unrecognized configuration parameter");
      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(settingsError) // set_config fails
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const result = await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        {},
        {},
        mockPlugins
      );

      expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
      expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
      
      expect(result.isError).toBe(true);
    });

    it("should handle plugin execution errors", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [],
        statement: "SELECT 1",
      };

      const pluginError = new Error("Plugin authentication failed");
      vi.mocked(mockPlugins.executeHook).mockRejectedValue(pluginError);

      const result = await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        {},
        {},
        mockPlugins
      );

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "Error executing tool 'test': Plugin authentication failed",
          },
        ],
        isError: true,
      });
    });

    it("should clean up client queue and connection on success", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [],
        statement: "SELECT 1",
      };

      vi.mocked(mockPlugins.executeHook).mockResolvedValue({
        pgSettings: new Map([['role', 'authenticated']]),
      } as BeforeQueryResult);

      mockClientQuery.mockResolvedValue({ rows: [{ result: 1 }] });

      await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        {},
        {},
        mockPlugins
      );

             // Check that client queue is cleared and connection released
       expect(mockClient[testQueueSymbol]).toBeNull();
       expect(mockClient.release).toHaveBeenCalled();
    });

    it("should clean up client queue and connection on error", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [],
        statement: "SELECT 1",
      };

      vi.mocked(mockPlugins.executeHook).mockResolvedValue({
        pgSettings: new Map([['role', 'authenticated']]),
      } as BeforeQueryResult);

      const error = new Error("Database connection lost");
      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce(undefined) // set_config
        .mockRejectedValueOnce(error); // main query fails

      await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        {},
        {},
        mockPlugins
      );

             // Check cleanup even on error
       expect(mockClient[testQueueSymbol]).toBeNull();
       expect(mockClient.release).toHaveBeenCalled();
    });

    it("should handle client queuing properly", async () => {
      const toolConfig: PostgresSqlTool = {
        kind: "postgres-sql",
        source: "db",
        description: "Test query",
        parameters: [],
        statement: "SELECT 1",
      };

      vi.mocked(mockPlugins.executeHook).mockResolvedValue({
        pgSettings: new Map([['role', 'authenticated']]),
      } as BeforeQueryResult);

             // Simulate a pending queue operation
       const pendingOperation = Promise.resolve();
       mockClient[testQueueSymbol] = pendingOperation;
      
      mockClientQuery.mockResolvedValue({ rows: [{ result: 1 }] });

      await executeQuery(
        "test",
        toolConfig,
        "db",
        createTestSource(),
        mockConnectionManager,
        {},
        {},
        mockPlugins
      );

      // The pending operation should be awaited before starting new operation
      await expect(pendingOperation).resolves.toBeUndefined();
      expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
    });
  });
});

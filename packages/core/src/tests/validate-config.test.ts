import { describe, expect, it } from "vitest";
import { validateConfig } from "../validate-config.js";

describe("validateConfig", () => {
  describe("valid configurations", () => {
    it("should validate a complete valid configuration", () => {
      const validConfig = {
        sources: {
          main_db: {
            kind: "postgres",
            connection_string: "postgresql://user:pass@localhost:5432/db",
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
                description: "Maximum number of users to return",
                required: false,
                default: 10,
              },
            ],
            statement: "SELECT * FROM users LIMIT :limit",
          },
        },
      };

      const result = validateConfig(validConfig);
      expect(result).toEqual(validConfig);
    });

    it("should validate configuration with multiple sources and tools", () => {
      const validConfig = {
        sources: {
          users_db: {
            kind: "postgres",
            connection_string: "postgresql://user:pass@localhost:5432/users",
          },
          orders_db: {
            kind: "postgres",
            connection_string: "postgresql://user:pass@localhost:5432/orders",
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
            description: "Get orders for user",
            parameters: [
              {
                name: "user_id",
                type: "string",
                description: "User ID",
              },
            ],
            statement: "SELECT * FROM orders WHERE user_id = $1",
          },
        },
      };

      const result = validateConfig(validConfig);
      expect(result).toEqual(validConfig);
    });

    it("should validate configuration with all parameter types", () => {
      const validConfig = {
        sources: {
          test_db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test_query: {
            kind: "postgres-sql",
            source: "test_db",
            description: "Test query with all parameter types",
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

      const result = validateConfig(validConfig);
      expect(result).toEqual(validConfig);
    });

    it("should validate source with individual connection parameters", () => {
      const validConfig = {
        sources: {
          my_pg_source: {
            kind: "postgres",
            host: "127.0.0.1",
            port: 5432,
            database: "toolbox_db",
            user: "toolbox_user",
            password: "my-password",
          },
        },
        tools: {
          get_data: {
            kind: "postgres-sql",
            source: "my_pg_source",
            description: "Get data from database",
            parameters: [
              {
                name: "id",
                type: "number",
                description: "Record ID",
                required: true,
              },
            ],
            statement: "SELECT * FROM records WHERE id = :id",
          },
        },
      };

      const result = validateConfig(validConfig);
      expect(result).toEqual(validConfig);
    });

    it("should validate mixed source configuration formats", () => {
      const validConfig = {
        sources: {
          connection_string_db: {
            kind: "postgres",
            connection_string: "postgresql://user:pass@localhost:5432/db1",
          },
          parameter_db: {
            kind: "postgres",
            host: "localhost",
            port: 5433,
            database: "db2",
            user: "user",
            password: "pass",
          },
        },
        tools: {
          tool1: {
            kind: "postgres-sql",
            source: "connection_string_db",
            description: "Tool using connection string source",
            parameters: [],
            statement: "SELECT 1",
          },
          tool2: {
            kind: "postgres-sql",
            source: "parameter_db",
            description: "Tool using parameter source",
            parameters: [],
            statement: "SELECT 2",
          },
        },
      };

      const result = validateConfig(validConfig);
      expect(result).toEqual(validConfig);
    });
  });

  describe("invalid configurations", () => {
    it("should reject null or undefined config", () => {
      expect(() => validateConfig(null)).toThrow("❌ YAML Configuration Validation Failed");
      expect(() => validateConfig(undefined)).toThrow(
        "❌ YAML Configuration Validation Failed"
      );
    });

    it("should reject config without sources", () => {
      const invalidConfig = {
        tools: {
          test: {
            kind: "postgres-sql",
            source: "db",
            description: "Test",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        "❌ YAML Configuration Validation Failed"
      );
    });

    it("should reject config without tools", () => {
      const invalidConfig = {
        sources: {
          db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        "❌ YAML Configuration Validation Failed"
      );
    });

    it("should reject source with invalid kind", () => {
      const invalidConfig = {
        sources: {
          db: {
            kind: "mysql", // Invalid kind
            connection_string: "mysql://localhost/test",
          },
        },
        tools: {
          test: {
            kind: "postgres-sql",
            source: "db",
            description: "Test",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        "❌ YAML Configuration Validation Failed"
      );
    });

    it("should reject source without connection_string or individual parameters", () => {
      const invalidConfig = {
        sources: {
          db: {
            kind: "postgres",
            // Missing both connection_string and individual parameters
          },
        },
        tools: {
          test: {
            kind: "postgres-sql",
            source: "db",
            description: "Test",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        "❌ YAML Configuration Validation Failed"
      );
    });

    it("should reject source with incomplete individual parameters", () => {
      const invalidConfig = {
        sources: {
          db: {
            kind: "postgres",
            host: "localhost",
            port: 5432,
            database: "test",
            // Missing user and password
          },
        },
        tools: {
          test: {
            kind: "postgres-sql",
            source: "db",
            description: "Test",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        "❌ YAML Configuration Validation Failed"
      );
    });

    it("should reject source with invalid port number", () => {
      const invalidConfig = {
        sources: {
          db: {
            kind: "postgres",
            host: "localhost",
            port: 99999, // Invalid port (too high)
            database: "test",
            user: "user",
            password: "pass",
          },
        },
        tools: {
          test: {
            kind: "postgres-sql",
            source: "db",
            description: "Test",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        "❌ YAML Configuration Validation Failed"
      );
    });

    it("should reject source with empty host", () => {
      const invalidConfig = {
        sources: {
          db: {
            kind: "postgres",
            host: "", // Empty host
            port: 5432,
            database: "test",
            user: "user",
            password: "pass",
          },
        },
        tools: {
          test: {
            kind: "postgres-sql",
            source: "db",
            description: "Test",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        "❌ YAML Configuration Validation Failed"
      );
    });

    it("should reject source mixing connection_string and individual parameters", () => {
      const invalidConfig = {
        sources: {
          db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
            host: "localhost", // Should not mix formats
            port: 5432,
            database: "test",
            user: "user",
            password: "pass",
          },
        },
        tools: {
          test: {
            kind: "postgres-sql",
            source: "db",
            description: "Test",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        "❌ YAML Configuration Validation Failed"
      );
    });

    it("should reject tool with invalid kind", () => {
      const invalidConfig = {
        sources: {
          db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test: {
            kind: "mysql-sql", // Invalid kind
            source: "db",
            description: "Test",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        "❌ YAML Configuration Validation Failed"
      );
    });

    it("should reject tool referencing non-existent source", () => {
      const invalidConfig = {
        sources: {
          db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test: {
            kind: "postgres-sql",
            source: "nonexistent_db", // Source doesn't exist
            description: "Test",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow();
    });

    it("should reject parameter with invalid type", () => {
      const invalidConfig = {
        sources: {
          db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test: {
            kind: "postgres-sql",
            source: "db",
            description: "Test",
            parameters: [
              {
                name: "param",
                type: "invalid_type", // Invalid parameter type
                description: "Test param",
              },
            ],
            statement: "SELECT 1",
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        "❌ YAML Configuration Validation Failed"
      );
    });

    it("should reject parameter without required fields", () => {
      const invalidConfig = {
        sources: {
          db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test: {
            kind: "postgres-sql",
            source: "db",
            description: "Test",
            parameters: [
              {
                name: "param",
                type: "string",
                // Missing description
              },
            ],
            statement: "SELECT 1",
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        "❌ YAML Configuration Validation Failed"
      );
    });

    it("should reject tool without statement", () => {
      const invalidConfig = {
        sources: {
          db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test: {
            kind: "postgres-sql",
            source: "db",
            description: "Test",
            parameters: [],
            // Missing statement
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        "❌ YAML Configuration Validation Failed"
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty sources and tools objects", () => {
      const config = {
        sources: {},
        tools: {},
      };

      const result = validateConfig(config);
      expect(result).toEqual(config);
    });

    it("should handle tool with empty parameters array", () => {
      const config = {
        sources: {
          db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test: {
            kind: "postgres-sql",
            source: "db",
            description: "Test",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      const result = validateConfig(config);
      expect(result).toEqual(config);
    });

    it("should inherit kind from source when not specified in tool", () => {
      const config = {
        sources: {
          db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test_tool: {
            // No kind specified - should inherit from source
            source: "db",
            description: "Test tool that inherits kind",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      const result = validateConfig(config);
      
      // The result should have the inherited kind
      expect(result.tools.test_tool.kind).toBe("postgres");
      expect(result.sources.db.kind).toBe("postgres");
    });

    it("should inherit postgres-sql kind from source", () => {
      const config = {
        sources: {
          db: {
            kind: "postgres-sql",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test_tool: {
            // No kind specified - should inherit postgres-sql
            source: "db",
            description: "Test tool that inherits postgres-sql kind",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      const result = validateConfig(config);
      
      // The result should have the inherited kind
      expect(result.tools.test_tool.kind).toBe("postgres-sql");
    });

    it("should allow explicit kind that's compatible with source", () => {
      const config = {
        sources: {
          db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test_tool: {
            kind: "postgres-sql", // Explicit kind, should be compatible
            source: "db",
            description: "Test tool with explicit compatible kind",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      const result = validateConfig(config);
      
      // The explicit kind should be preserved
      expect(result.tools.test_tool.kind).toBe("postgres-sql");
      expect(result.sources.db.kind).toBe("postgres");
    });
  });

  describe("default value validation", () => {
    it("should validate parameters with default values", () => {
      const config = {
        sources: {
          db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test_defaults: {
            kind: "postgres-sql",
            source: "db",
            description: "Test with default values",
            parameters: [
              {
                name: "str_param",
                type: "string",
                description: "String with default",
                required: false,
                default: "default_value",
              },
              {
                name: "num_param",
                type: "number",
                description: "Number with default",
                required: false,
                default: 100,
              },
              {
                name: "bool_param",
                type: "boolean",
                description: "Boolean with default",
                required: false,
                default: true,
              },
            ],
            statement:
              "SELECT * FROM test WHERE str = :str_param AND num = :num_param AND flag = :bool_param",
          },
        },
      };

      const result = validateConfig(config);
      expect(result).toEqual(config);
    });

    it("should reject parameter with required: false but no default", () => {
      const invalidConfig = {
        sources: {
          db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test: {
            kind: "postgres-sql",
            source: "db",
            description: "Test",
            parameters: [
              {
                name: "param",
                type: "string",
                description: "Parameter without default",
                required: false,
                // Missing default value
              },
            ],
            statement: "SELECT * FROM test WHERE col = :param",
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        "Parameters with required: false must have a default value"
      );
    });

    it("should reject parameter with mismatched default value type", () => {
      const invalidConfig = {
        sources: {
          db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test: {
            kind: "postgres-sql",
            source: "db",
            description: "Test",
            parameters: [
              {
                name: "num_param",
                type: "number",
                description: "Number parameter",
                required: false,
                default: "not_a_number", // Wrong type
              },
            ],
            statement: "SELECT * FROM test WHERE num = :num_param",
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        "❌ YAML Configuration Validation Failed"
      );
    });

    it("should allow required parameters without default values", () => {
      const config = {
        sources: {
          db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test: {
            kind: "postgres-sql",
            source: "db",
            description: "Test",
            parameters: [
              {
                name: "required_param",
                type: "string",
                description: "Required parameter",
                required: true,
                // No default needed for required parameters
              },
            ],
            statement: "SELECT * FROM test WHERE col = :required_param",
          },
        },
      };

      const result = validateConfig(config);
      expect(result).toEqual(config);
    });

    it("should format validation errors in a developer-friendly way", () => {
      const invalidConfig = {
        sources: {
          db: {
            kind: "invalid-kind", // Invalid kind
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          broken_tool: {
            kind: "mysql", // Invalid kind
            source: "nonexistent_source", // Non-existent source
            // Missing description
            parameters: [
              {
                name: "param1",
                type: "invalid_type", // Invalid type
                // Missing description
              },
            ],
            // Missing statement
          },
        },
      };

      try {
        validateConfig(invalidConfig);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        const errorMessage = (error as Error).message;
        
        // Check that the error message has the nice formatting
        expect(errorMessage).toContain("❌ YAML Configuration Validation Failed");
        expect(errorMessage).toContain("The following errors were found:");
        expect(errorMessage).toContain("Please fix these issues and try again.");
        
        // Check that errors are numbered
        expect(errorMessage).toMatch(/\s+1\./);
        
        // Check that paths are formatted nicely
        expect(errorMessage).toContain("(at sources.db)");
        expect(errorMessage).toContain("(at tools.broken_tool");
      }
    });
  });
});

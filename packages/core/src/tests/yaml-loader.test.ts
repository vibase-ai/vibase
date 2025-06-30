import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadConfigFromYaml,
  loadConfigFromYamlString,
} from "../yaml-loader.js";

// Mock fs
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

// Mock js-yaml
vi.mock("js-yaml", () => ({
  load: vi.fn(),
}));

// Mock validate-config
vi.mock("../validate-config.js", () => ({
  validateConfig: vi.fn(),
}));

describe("yaml-loader", () => {
  let mockReadFileSync: any;
  let mockYamlLoad: any;
  let mockValidateConfig: any;

  beforeEach(async () => {
    const fs = await import("fs");
    const yaml = await import("js-yaml");
    const validateConfig = await import("../validate-config.js");

    mockReadFileSync = vi.mocked(fs.readFileSync);
    mockYamlLoad = vi.mocked(yaml.load);
    mockValidateConfig = vi.mocked(validateConfig.validateConfig);

    vi.clearAllMocks();
  });

  describe("loadConfigFromYamlString", () => {
    it("should load and validate valid YAML string", () => {
      const yamlContent = `
sources:
  db:
    kind: postgres
    connection_string: postgresql://localhost/test
tools:
  test_tool:
    kind: postgres-sql
    source: db
    description: Test tool
    parameters: []
    statement: SELECT 1
`;

      const parsedConfig = {
        sources: {
          db: {
            kind: "postgres",
            connection_string: "postgresql://localhost/test",
          },
        },
        tools: {
          test_tool: {
            kind: "postgres-sql",
            source: "db",
            description: "Test tool",
            parameters: [],
            statement: "SELECT 1",
          },
        },
      };

      const validatedConfig = { ...parsedConfig, validated: true };

      mockYamlLoad.mockReturnValue(parsedConfig);
      mockValidateConfig.mockReturnValue(validatedConfig);

      const result = loadConfigFromYamlString(yamlContent);

      expect(mockYamlLoad).toHaveBeenCalledWith(yamlContent);
      expect(mockValidateConfig).toHaveBeenCalledWith(parsedConfig);
      expect(result).toBe(validatedConfig);
    });

    it("should handle YAML parsing errors", () => {
      const invalidYaml = "invalid: yaml: content:";
      const yamlError = new Error("Invalid YAML syntax");
      yamlError.name = "YAMLException";

      mockYamlLoad.mockImplementation(() => {
        throw yamlError;
      });

      expect(() => loadConfigFromYamlString(invalidYaml)).toThrow(
        "Invalid YAML syntax: Invalid YAML syntax"
      );
    });

    it("should handle validation errors", () => {
      const yamlContent = "sources: {}\ntools: {}";
      const parsedConfig = { sources: {}, tools: {} };
      const validationError = new Error("Invalid configuration");

      mockYamlLoad.mockReturnValue(parsedConfig);
      mockValidateConfig.mockImplementation(() => {
        throw validationError;
      });

      expect(() => loadConfigFromYamlString(yamlContent)).toThrow(
        "Invalid configuration"
      );
    });

    it("should handle empty YAML content", () => {
      const yamlContent = "";
      const parsedConfig = null;

      mockYamlLoad.mockReturnValue(parsedConfig);
      mockValidateConfig.mockImplementation(() => {
        throw new Error("Invalid config: null");
      });

      expect(() => loadConfigFromYamlString(yamlContent)).toThrow(
        "Invalid config: null"
      );
    });

    it("should propagate non-YAML errors", () => {
      const yamlContent = "valid: yaml";
      const otherError = new Error("Some other error");
      otherError.name = "SomeOtherError";

      mockYamlLoad.mockImplementation(() => {
        throw otherError;
      });

      expect(() => loadConfigFromYamlString(yamlContent)).toThrow(
        "Some other error"
      );
    });
  });

  describe("loadConfigFromYaml", () => {
    it("should load and validate YAML from file", () => {
      const configPath = "/path/to/config.yaml";
      const yamlContent = "sources: {}\ntools: {}";
      const parsedConfig = { sources: {}, tools: {} };
      const validatedConfig = { ...parsedConfig, validated: true };

      mockReadFileSync.mockReturnValue(yamlContent);
      mockYamlLoad.mockReturnValue(parsedConfig);
      mockValidateConfig.mockReturnValue(validatedConfig);

      const result = loadConfigFromYaml(configPath);

      expect(mockReadFileSync).toHaveBeenCalledWith(configPath, "utf8");
      expect(mockYamlLoad).toHaveBeenCalledWith(yamlContent);
      expect(mockValidateConfig).toHaveBeenCalledWith(parsedConfig);
      expect(result).toBe(validatedConfig);
    });

    it("should handle file not found error", () => {
      const configPath = "/nonexistent/config.yaml";
      const fileError = new Error("File not found") as Error & { code: string };
      fileError.code = "ENOENT";

      mockReadFileSync.mockImplementation(() => {
        throw fileError;
      });

      expect(() => loadConfigFromYaml(configPath)).toThrow(
        `YAML configuration file not found: ${configPath}`
      );
    });

    it("should handle file read errors", () => {
      const configPath = "/path/to/config.yaml";
      const fileError = new Error("Permission denied") as Error & {
        code: string;
      };
      fileError.code = "EACCES";

      mockReadFileSync.mockImplementation(() => {
        throw fileError;
      });

      expect(() => loadConfigFromYaml(configPath)).toThrow(
        "Failed to read YAML configuration file: Permission denied"
      );
    });

    it("should handle YAML parsing errors in file content", () => {
      const configPath = "/path/to/config.yaml";
      const invalidYamlContent = "invalid: yaml: content:";
      const yamlError = new Error("Invalid YAML syntax");
      yamlError.name = "YAMLException";

      mockReadFileSync.mockReturnValue(invalidYamlContent);
      mockYamlLoad.mockImplementation(() => {
        throw yamlError;
      });

      expect(() => loadConfigFromYaml(configPath)).toThrow(
        "Invalid YAML syntax: Invalid YAML syntax"
      );
    });

    it("should handle validation errors in file content", () => {
      const configPath = "/path/to/config.yaml";
      const yamlContent = "sources: {}\ntools: {}";
      const parsedConfig = { sources: {}, tools: {} };
      const validationError = new Error("Invalid configuration");

      mockReadFileSync.mockReturnValue(yamlContent);
      mockYamlLoad.mockReturnValue(parsedConfig);
      mockValidateConfig.mockImplementation(() => {
        throw validationError;
      });

      expect(() => loadConfigFromYaml(configPath)).toThrow(
        "Invalid configuration"
      );
    });

    it("should handle different file paths", () => {
      const configPaths = [
        "./config.yaml",
        "../config.yaml",
        "/absolute/path/config.yaml",
        "config.yml",
        "nested/path/config.yaml",
      ];

      const yamlContent = "sources: {}\ntools: {}";
      const parsedConfig = { sources: {}, tools: {} };
      const validatedConfig = { ...parsedConfig, validated: true };

      mockReadFileSync.mockReturnValue(yamlContent);
      mockYamlLoad.mockReturnValue(parsedConfig);
      mockValidateConfig.mockReturnValue(validatedConfig);

      configPaths.forEach((path) => {
        const result = loadConfigFromYaml(path);
        expect(mockReadFileSync).toHaveBeenCalledWith(path, "utf8");
        expect(result).toBe(validatedConfig);
      });

      expect(mockReadFileSync).toHaveBeenCalledTimes(configPaths.length);
    });
  });

  describe("integration scenarios", () => {
    it("should handle complex YAML structure", () => {
      const complexYaml = `
sources:
  primary_db:
    kind: postgres
    connection_string: postgresql://user:pass@localhost:5432/primary
  secondary_db:
    kind: postgres
    connection_string: postgresql://user:pass@localhost:5432/secondary

tools:
  get_users:
    kind: postgres-sql
    source: primary_db
    description: Get all users with pagination
    parameters:
      - name: limit
        type: number
        description: Maximum results
        required: false
        default: 100
      - name: offset
        type: number
        description: Results offset
        required: false
        default: 0
    statement: SELECT * FROM users LIMIT :limit OFFSET :offset
  
  get_orders:
    kind: postgres-sql
    source: secondary_db
    description: Get orders by user ID
    parameters:
      - name: user_id
        type: string
        description: User identifier
        required: true
    statement: SELECT * FROM orders WHERE user_id = :user_id
`;

      const expectedParsed = {
        sources: {
          primary_db: {
            kind: "postgres",
            connection_string: "postgresql://user:pass@localhost:5432/primary",
          },
          secondary_db: {
            kind: "postgres",
            connection_string:
              "postgresql://user:pass@localhost:5432/secondary",
          },
        },
        tools: {
          get_users: {
            kind: "postgres-sql",
            source: "primary_db",
            description: "Get all users with pagination",
            parameters: [
              {
                name: "limit",
                type: "number",
                description: "Maximum results",
                required: false,
                default: 100,
              },
              {
                name: "offset",
                type: "number",
                description: "Results offset",
                required: false,
                default: 0,
              },
            ],
            statement: "SELECT * FROM users LIMIT :limit OFFSET :offset",
          },
          get_orders: {
            kind: "postgres-sql",
            source: "secondary_db",
            description: "Get orders by user ID",
            parameters: [
              {
                name: "user_id",
                type: "string",
                description: "User identifier",
                required: true,
              },
            ],
            statement: "SELECT * FROM orders WHERE user_id = :user_id",
          },
        },
      };

      const validatedConfig = { ...expectedParsed, validated: true };

      mockYamlLoad.mockReturnValue(expectedParsed);
      mockValidateConfig.mockReturnValue(validatedConfig);

      const result = loadConfigFromYamlString(complexYaml);

      expect(mockYamlLoad).toHaveBeenCalledWith(complexYaml);
      expect(mockValidateConfig).toHaveBeenCalledWith(expectedParsed);
      expect(result).toBe(validatedConfig);
    });
  });
});

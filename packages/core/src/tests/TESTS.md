# TESTS.md

This document describes every test case in the `packages/core/src/tests` directory, including their goals, coverage, necessity, and E2E suitability.

---

## connection-manager.test.ts

**Purpose:**
Tests the `ConnectionManager` class, which manages PostgreSQL connection pools.

### Test Cases

#### getPool
- **should create a new pool for a new source**
  - **Goal:** Ensure a new pool is created for a new source name/connection string.
  - **Covers:** `ConnectionManager.getPool`
  - **Calls actual code:** Yes (with mocked Pool)
  - **Necessity:** 8
  - **E2E?** No, best as a unit test.

- **should reuse existing pool for the same source**
  - **Goal:** Ensure the same pool is reused for repeated calls with the same source.
  - **Covers:** `ConnectionManager.getPool`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should create different pools for different sources**
  - **Goal:** Ensure different sources get different pools.
  - **Covers:** `ConnectionManager.getPool`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

#### closeAll
- **should close all pools**
  - **Goal:** Ensure all pools are closed when requested.
  - **Covers:** `ConnectionManager.closeAll`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should handle empty pool map**
  - **Goal:** Ensure no error is thrown if there are no pools to close.
  - **Covers:** `ConnectionManager.closeAll`
  - **Calls actual code:** Yes
  - **Necessity:** 7
  - **E2E?** No

---

## execute-query.test.ts

**Purpose:**
Tests the `executeQuery` function, which executes SQL queries with parameter handling, error handling, and connection management.

### Test Cases

#### named parameters
- **should execute query with named parameters**
  - **Goal:** Ensure named parameters are substituted and executed correctly.
  - **Covers:** `executeQuery` (named param logic)
  - **Calls actual code:** Yes (with mocks)
  - **Necessity:** 9
  - **E2E?** Partially, but unit test is essential.

- **should handle multiple named parameters**
  - **Goal:** Ensure multiple named parameters are handled.
  - **Covers:** `executeQuery`
  - **Calls actual code:** Yes
  - **Necessity:** 9
  - **E2E?** Partially

- **should handle duplicate named parameters**
  - **Goal:** Ensure duplicate named parameters are handled efficiently.
  - **Covers:** `executeQuery`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

#### positional parameters
- **should execute query with positional parameters**
  - **Goal:** Ensure positional parameters are substituted and executed.
  - **Covers:** `executeQuery` (positional param logic)
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** Partially

- **should handle multiple positional parameters**
  - **Goal:** Ensure multiple positional parameters are handled.
  - **Covers:** `executeQuery`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

#### SQL injection protection
- **should protect against SQL injection in named parameters**
  - **Goal:** Ensure named parameters are safely parameterized.
  - **Covers:** `executeQuery` (SQL injection safety)
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** Yes, but unit test is critical.

- **should protect against SQL injection in positional parameters**
  - **Goal:** Ensure positional parameters are safely parameterized.
  - **Covers:** `executeQuery`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** Yes, but unit test is critical.

- **should handle special characters safely**
  - **Goal:** Ensure special characters in parameters are handled safely.
  - **Covers:** `executeQuery`
  - **Calls actual code:** Yes
  - **Necessity:** 9
  - **E2E?** No

#### error handling
- **should handle database query errors**
  - **Goal:** Ensure DB errors are caught and reported.
  - **Covers:** `executeQuery` (error handling)
  - **Calls actual code:** Yes
  - **Necessity:** 9
  - **E2E?** Yes, but unit test is important for error message structure.

- **should handle connection errors**
  - **Goal:** Ensure connection errors are caught and reported.
  - **Covers:** `executeQuery`
  - **Calls actual code:** Yes
  - **Necessity:** 9
  - **E2E?** Yes

- **should handle pg-sql2 compilation errors**
  - **Goal:** Ensure SQL compilation errors are caught and reported.
  - **Covers:** `executeQuery`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should handle empty query results**
  - **Goal:** Ensure empty results are handled gracefully.
  - **Covers:** `executeQuery`
  - **Calls actual code:** Yes
  - **Necessity:** 7
  - **E2E?** No

- **should handle queries with no parameters**
  - **Goal:** Ensure queries with no parameters are handled.
  - **Covers:** `executeQuery`
  - **Calls actual code:** Yes
  - **Necessity:** 7
  - **E2E?** No

- **should handle undefined compiled values**
  - **Goal:** Ensure undefined compiled values do not cause errors.
  - **Covers:** `executeQuery`
  - **Calls actual code:** Yes
  - **Necessity:** 6
  - **E2E?** No

#### connection string building
- **should handle connection string source format**
  - **Goal:** Ensure connection string format is supported.
  - **Covers:** `executeQuery` (connection string logic)
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** Yes

- **should handle individual parameters source format**
  - **Goal:** Ensure individual connection parameters are supported.
  - **Covers:** `executeQuery`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** Yes

- **should handle parameters with special characters in password**
  - **Goal:** Ensure special characters in credentials are handled.
  - **Covers:** `executeQuery`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** Yes

---

## validate-config.test.ts

**Purpose:**
Tests the `validateConfig` function, which validates the structure and correctness of configuration files.

### Test Cases

#### valid configurations
- **should validate a complete valid configuration**
  - **Goal:** Accept a fully valid config.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should validate configuration with multiple sources and tools**
  - **Goal:** Accept config with multiple sources/tools.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should validate configuration with all parameter types**
  - **Goal:** Accept all supported parameter types.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should validate source with individual connection parameters**
  - **Goal:** Accept source with individual connection params.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should validate mixed source configuration formats**
  - **Goal:** Accept both connection string and param formats.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

#### invalid configurations
- **should reject null or undefined config**
  - **Goal:** Reject null/undefined config.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should reject config without sources**
  - **Goal:** Reject config missing sources.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should reject config without tools**
  - **Goal:** Reject config missing tools.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should reject source with invalid kind**
  - **Goal:** Reject source with unsupported kind.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should reject source without connection_string or individual parameters**
  - **Goal:** Reject source missing connection info.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should reject source with incomplete individual parameters**
  - **Goal:** Reject source missing required params.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should reject source with invalid port number**
  - **Goal:** Reject source with invalid port.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should reject source with empty host**
  - **Goal:** Reject source with empty host.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should reject source mixing connection_string and individual parameters**
  - **Goal:** Reject source mixing formats.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should reject tool with invalid kind**
  - **Goal:** Reject tool with unsupported kind.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should reject tool referencing non-existent source**
  - **Goal:** Reject tool with missing source.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should reject parameter with invalid type**
  - **Goal:** Reject parameter with unsupported type.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should reject parameter without required fields**
  - **Goal:** Reject parameter missing required fields.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should reject tool without statement**
  - **Goal:** Reject tool missing SQL statement.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should reject parameter with required: false but no default**
  - **Goal:** Reject optional parameter without default.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

- **should reject parameter with mismatched default value type**
  - **Goal:** Reject parameter with wrong default type.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

#### edge cases
- **should handle empty sources and tools objects**
  - **Goal:** Accept empty config objects.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should handle tool with empty parameters array**
  - **Goal:** Accept tool with no parameters.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should allow required parameters without default values**
  - **Goal:** Accept required params without defaults.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

#### default value validation
- **should validate parameters with default values**
  - **Goal:** Accept parameters with valid defaults.
  - **Covers:** `validateConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 9
  - **E2E?** No

---

## yaml-loader.test.ts

**Purpose:**
Tests the YAML loader utilities for loading and validating configuration from YAML files/strings.

### Test Cases

#### loadConfigFromYamlString
- **should load and validate valid YAML string**
  - **Goal:** Parse and validate a correct YAML string.
  - **Covers:** `loadConfigFromYamlString`
  - **Calls actual code:** Yes (with mocks)
  - **Necessity:** 8
  - **E2E?** No

- **should handle YAML parsing errors**
  - **Goal:** Throw on YAML syntax errors.
  - **Covers:** `loadConfigFromYamlString`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should handle validation errors**
  - **Goal:** Throw on validation errors after parsing.
  - **Covers:** `loadConfigFromYamlString`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should handle empty YAML content**
  - **Goal:** Throw on empty YAML.
  - **Covers:** `loadConfigFromYamlString`
  - **Calls actual code:** Yes
  - **Necessity:** 7
  - **E2E?** No

- **should propagate non-YAML errors**
  - **Goal:** Propagate unexpected errors.
  - **Covers:** `loadConfigFromYamlString`
  - **Calls actual code:** Yes
  - **Necessity:** 7
  - **E2E?** No

#### loadConfigFromYaml
- **should load and validate YAML from file**
  - **Goal:** Read, parse, and validate YAML from a file.
  - **Covers:** `loadConfigFromYaml`
  - **Calls actual code:** Yes (with mocks)
  - **Necessity:** 8
  - **E2E?** No

- **should handle file not found error**
  - **Goal:** Throw if file is missing.
  - **Covers:** `loadConfigFromYaml`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should handle file read errors**
  - **Goal:** Throw on file read errors.
  - **Covers:** `loadConfigFromYaml`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should handle YAML parsing errors in file content**
  - **Goal:** Throw on YAML syntax errors in file.
  - **Covers:** `loadConfigFromYaml`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should handle validation errors in file content**
  - **Goal:** Throw on validation errors after file parse.
  - **Covers:** `loadConfigFromYaml`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should handle different file paths**
  - **Goal:** Support various file path formats.
  - **Covers:** `loadConfigFromYaml`
  - **Calls actual code:** Yes
  - **Necessity:** 7
  - **E2E?** No

#### integration scenarios
- **should handle complex YAML structure**
  - **Goal:** Parse and validate a complex YAML config.
  - **Covers:** `loadConfigFromYamlString`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

---

## mcp-server.test.ts

**Purpose:**
Tests the MCP server creation, tool registration, tool execution, cleanup, and integration scenarios.

### Test Cases

#### server creation
- **should create MCP server with default options**
  - **Goal:** Create server with default options.
  - **Covers:** `createMcpServerFromConfig`
  - **Calls actual code:** Yes (with mocks)
  - **Necessity:** 9
  - **E2E?** No

- **should create MCP server with custom options**
  - **Goal:** Create server with custom options.
  - **Covers:** `createMcpServerFromConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should handle empty configuration**
  - **Goal:** Handle empty config gracefully.
  - **Covers:** `createMcpServerFromConfig`
  - **Calls actual code:** Yes
  - **Necessity:** 7
  - **E2E?** No

#### tool registration
- **should register a single tool**
  - **Goal:** Register one tool.
  - **Covers:** `createMcpServerFromConfig` tool registration
  - **Calls actual code:** Yes
  - **Necessity:** 9
  - **E2E?** No

- **should register multiple tools**
  - **Goal:** Register multiple tools.
  - **Covers:** `createMcpServerFromConfig` tool registration
  - **Calls actual code:** Yes
  - **Necessity:** 9
  - **E2E?** No

- **should register tools with different parameter types**
  - **Goal:** Register tools with all param types.
  - **Covers:** `createMcpServerFromConfig` tool registration
  - **Calls actual code:** Yes
  - **Necessity:** 9
  - **E2E?** No

- **should throw error for tool with nonexistent source**
  - **Goal:** Error if tool references missing source.
  - **Covers:** `createMcpServerFromConfig` tool registration
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

#### tool execution
- **should execute tool handler correctly**
  - **Goal:** Tool handler calls executeQuery and returns result.
  - **Covers:** Tool handler logic
  - **Calls actual code:** Yes
  - **Necessity:** 9
  - **E2E?** Yes, but unit test is important for handler logic.

- **should validate arguments before execution**
  - **Goal:** Handler validates required arguments.
  - **Covers:** Tool handler logic
  - **Calls actual code:** Yes
  - **Necessity:** 9
  - **E2E?** Yes

- **should handle tool execution errors**
  - **Goal:** Handler returns error result on failure.
  - **Covers:** Tool handler logic
  - **Calls actual code:** Yes
  - **Necessity:** 9
  - **E2E?** Yes

#### tool execution with type coercion and defaults
- **should coerce string number args to numbers and pass to executeQuery**
  - **Goal:** Handler coerces string args to correct types.
  - **Covers:** Tool handler logic
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should coerce default string number/boolean to correct type**
  - **Goal:** Handler coerces default values to correct types.
  - **Covers:** Tool handler logic
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

#### cleanup
- **should provide cleanup function that closes connections**
  - **Goal:** Cleanup closes all connections.
  - **Covers:** Cleanup logic
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should handle cleanup errors gracefully**
  - **Goal:** Cleanup errors are handled.
  - **Covers:** Cleanup logic
  - **Calls actual code:** Yes
  - **Necessity:** 7
  - **E2E?** No

#### integration scenarios
- **should handle complex configuration with multiple sources and tools**
  - **Goal:** Register and handle multiple sources/tools.
  - **Covers:** Full integration
  - **Calls actual code:** Yes
  - **Necessity:** 9
  - **E2E?** Yes

#### addToolsToMcpServer
- **should add tools to existing MCP server**
  - **Goal:** Add tools to an existing server instance.
  - **Covers:** `addToolsToMcpServer`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should add multiple tools to existing server**
  - **Goal:** Add multiple tools to server.
  - **Covers:** `addToolsToMcpServer`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should handle tools with default values**
  - **Goal:** Add tools with default parameter values.
  - **Covers:** `addToolsToMcpServer`
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should throw error for nonexistent source**
  - **Goal:** Error if tool references missing source.
  - **Covers:** `addToolsToMcpServer`
  - **Calls actual code:** Yes
  - **Necessity:** 10
  - **E2E?** No

#### cleanup functionality
- **should provide cleanup function that closes connections**
  - **Goal:** Cleanup closes all connections.
  - **Covers:** Cleanup logic
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should handle cleanup errors gracefully**
  - **Goal:** Cleanup errors are handled.
  - **Covers:** Cleanup logic
  - **Calls actual code:** Yes
  - **Necessity:** 7
  - **E2E?** No

#### compatibility with createMcpServerFromConfig
- **should provide the same cleanup functionality**
  - **Goal:** Both APIs provide cleanup.
  - **Covers:** Cleanup logic
  - **Calls actual code:** Yes
  - **Necessity:** 8
  - **E2E?** No

- **should handle the same error scenarios**
  - **Goal:** Both APIs throw on missing source.
  - **Covers:** Error handling
  - **Calls actual code:** Yes
  - **Necessity:** 9
  - **E2E?** No 
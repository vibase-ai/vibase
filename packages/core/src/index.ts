/**
 * @vibase/core
 *
 * Core Vibase functionality including YAML-configured MCP server
 */

export { loadConfigFromYaml, loadConfigFromYamlString } from "./yaml-loader.js";

// Export YAML MCP server functionality
export {
  createMcpServerFromConfig,
  addToolsToMcpServer,
} from "./mcp-server.js";

// Export types
export type {
  ToolboxConfig,
  PostgresSource,
  PostgresSqlTool,
} from "./mcp-server.js";

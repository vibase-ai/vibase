/**
 * @vibase/core
 *
 * Core Vibase functionality including YAML-configured MCP server
 */

export { loadConfigFromYaml, loadConfigFromYamlString } from "./yaml-loader.js";

// Export YAML MCP server functionality
export {
  addToolsToMcpServer, createMcpServerFromConfig
} from "./mcp-server.js";

// Export plugin functionality
export { PluginRegistry } from "./plugins.js";

// Export types
export type {
  PostgresSource,
  PostgresSqlTool, ToolboxConfig
} from "./validate-config.js";

export type {
  BeforeQueryCallback,
  BeforeQueryContext,
  BeforeQueryResult,
  Plugin,
  PluginHook,
  Plugins
} from "./plugins.js";


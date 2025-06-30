#!/usr/bin/env node

import { program } from "commander";
import { loadConfigFromYaml, createMcpServerFromConfig } from "./index.js";
import * as path from "path";
import * as fs from "fs";
import { startHttpServer } from "./http-server.js";
import { startStdioServer } from "./stdio.js";

async function main() {
  program
    .name("vibase-core")
    .description(`Run an MCP server from a YAML configuration

Modes:
  --stdio   Run STDIO transport
  --http    Run streamable HTTP transport

Options:
  -c, --config <path>   Path to YAML configuration file (default: tools.yaml)
  --http [port]         Run in HTTP mode on the given port (default: 8080)
  --stdio               Run in STDIO mode (default)
  --env-file <path>     Load environment variables from a file (KEY=VALUE per line)

Examples:
  $ vibase tools.yaml
  $ vibase --stdio
  $ vibase --http 8080
  $ vibase --env-file .env --http 8080
  $ vibase -c examples/simple-cli/tools.yaml --http

Note: Only one mode (--stdio or --http) can be used at a time.`)
    .argument("[config]", "path to YAML configuration file", "tools.yaml")
    .option("-c, --config <path>", "path to YAML configuration file")
    .option("--stdio", "run in STDIO mode (default)", true)
    .option("--http [port]", "run in HTTP mode on the given port (default: 8080)")
    .option("--env-file <path>", "load environment variables from a file (KEY=VALUE per line)")
    .parse(process.argv);

  const options = program.opts();
  const args = program.args;

  // Load env file if specified
  if (options.envFile) {
    const envPath = path.resolve(process.cwd(), options.envFile);
    if (!fs.existsSync(envPath)) {
      console.error(`Env file not found at ${envPath}`);
      process.exit(1);
    }
    const envContent = fs.readFileSync(envPath, "utf8");
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (key) process.env[key] = value;
    }
  }

  // Use --config option if provided, otherwise use positional argument
  const configPath = path.resolve(
    process.cwd(),
    options.config || args[0] || "tools.yaml"
  );

  if (!fs.existsSync(configPath)) {
    console.error(`Configuration file not found at ${configPath}`);
    console.error(`Please provide a valid path to a YAML configuration file.`);
    process.exit(1);
  }

  try {
    console.error(`Loading configuration from ${configPath}...`);
    const config = loadConfigFromYaml(configPath);

    const toolCount = Object.keys(config.tools).length;
    console.error(`Creating MCP server with ${toolCount} SQL tools...`);
    const { server, cleanup } = createMcpServerFromConfig(config);

    if (options.http) {
      // HTTP mode
      const port = typeof options.http === "string" ? parseInt(options.http, 10) : 8080;
      startHttpServer(server, cleanup, port);
      return;
    }

    // STDIO mode
    await startStdioServer(server, cleanup);
    return;
  } catch (error) {
    console.error("Failed to start MCP server:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unexpected error:");
  console.error(error);
  process.exit(1);
});

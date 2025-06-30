import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export async function startStdioServer(server: any, cleanup: () => Promise<void>) {
  console.error("Starting MCP server in STDIO mode...");
  console.error("Server is ready to accept connections.");

  // Create STDIO transport
  const transport = new StdioServerTransport();

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.error("\nShutting down gracefully...");
    await cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    console.error("\nReceived SIGTERM, shutting down gracefully...");
    await cleanup();
    process.exit(0);
  });

  // Connect server to transport and start
  await server.connect(transport);
  console.error("MCP server is running and ready to accept connections");
} 
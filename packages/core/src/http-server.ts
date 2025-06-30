import * as http from "http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export function startHttpServer(server: any, cleanup: () => Promise<void>, port: number = 8080) {
  // Create the MCP HTTP transport (stateless, JSON response mode for simplicity)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });

  // Connect the MCP server to the transport ONCE
  server.connect(transport);

  // Create the HTTP server and delegate all requests to the transport
  const httpServer = http.createServer((req, res) => {
    transport.handleRequest(req, res);
  });

  httpServer.listen(port, () => {
    console.error(`MCP server is running in HTTP mode on port ${port}`);
  });

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.error("\nShutting down gracefully...");
    await cleanup();
    httpServer.close(() => process.exit(0));
  });
  process.on("SIGTERM", async () => {
    console.error("\nReceived SIGTERM, shutting down gracefully...");
    await cleanup();
    httpServer.close(() => process.exit(0));
  });
  return httpServer;
} 
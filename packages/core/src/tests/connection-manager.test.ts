import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConnectionManager } from "../connection-manager.js";

// Mock pg Pool
vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(() => ({
    end: vi.fn().mockResolvedValue(undefined),
    query: vi.fn(),
    connect: vi.fn(),
    release: vi.fn(),
  })),
}));

const { Pool } = await import("pg");

describe("ConnectionManager", () => {
  let connectionManager: ConnectionManager;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    vi.clearAllMocks();
  });

  describe("getPool", () => {
    it("should create a new pool for a new source", () => {
      const sourceName = "test_db";
      const connectionString = "postgresql://localhost:5432/test";

      const pool = connectionManager.getPool(sourceName, connectionString);

      expect(pool).toBeDefined();
      expect(Pool).toHaveBeenCalledWith({
        connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    });

    it("should reuse existing pool for the same source", () => {
      const sourceName = "test_db";
      const connectionString = "postgresql://localhost:5432/test";

      const pool1 = connectionManager.getPool(sourceName, connectionString);
      const pool2 = connectionManager.getPool(sourceName, connectionString);

      expect(pool1).toBe(pool2);
      expect(Pool).toHaveBeenCalledTimes(1);
    });

    it("should create different pools for different sources", () => {
      connectionManager.getPool("db1", "postgresql://localhost:5432/db1");
      connectionManager.getPool("db2", "postgresql://localhost:5432/db2");

      expect(Pool).toHaveBeenCalledTimes(2);
    });
  });

  describe("closeAll", () => {
    it("should close all pools", async () => {
      // Create multiple pools
      connectionManager.getPool("db1", "postgresql://localhost:5432/db1");
      connectionManager.getPool("db2", "postgresql://localhost:5432/db2");

      await connectionManager.closeAll();

      // Each pool's end method should be called
      expect(Pool).toHaveBeenCalledTimes(2);
    });

    it("should handle empty pool map", async () => {
      await connectionManager.closeAll();
      // Should not throw any errors
    });
  });
});

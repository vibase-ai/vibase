import type { MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    PluginRegistry,
    type BeforeQueryCallback,
    type BeforeQueryContext,
    type BeforeQueryResult,
    type Plugin,
} from "../plugins.js";
import type { PostgresSqlTool } from "../validate-config.js";

// Helper to create test BeforeQueryContext
const createTestContext = (overrides: Partial<BeforeQueryContext> = {}): BeforeQueryContext => ({
  toolName: "test_tool",
  toolConfig: {
    kind: "postgres-sql",
    source: "test_db",
    description: "Test tool",
    parameters: [],
    statement: "SELECT 1",
  } as PostgresSqlTool,
  pool: {} as Pool,
  parsedArgs: { param1: "value1" },
  extra: {} as MessageExtraInfo,
  query: "SELECT 1",
  ...overrides,
});

// Helper to create test plugins
const createTestPlugin = (name: string, beforeQueryCallback?: BeforeQueryCallback): Plugin => ({
  name,
  callbacks: beforeQueryCallback ? { beforeQuery: beforeQueryCallback } : {}
});

describe("PluginRegistry", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe("constructor", () => {
    it("should create empty registry", () => {
      expect(registry).toBeInstanceOf(PluginRegistry);
    });
  });

  describe("register (new plugin API)", () => {
    it("should register a plugin with beforeQuery callback", () => {
      const callback: BeforeQueryCallback = vi.fn().mockResolvedValue({});
      const plugin = createTestPlugin("test-plugin", callback);
      
      expect(() => {
        registry.register(plugin);
      }).not.toThrow();
    });

    it("should register multiple plugins", () => {
      const callback1: BeforeQueryCallback = vi.fn().mockResolvedValue({});
      const callback2: BeforeQueryCallback = vi.fn().mockResolvedValue({});
      const plugin1 = createTestPlugin("plugin1", callback1);
      const plugin2 = createTestPlugin("plugin2", callback2);
      
      registry.register(plugin1);
      registry.register(plugin2);
      
      expect(registry.getRegisteredPlugins()).toHaveLength(2);
      expect(registry.getPlugin("plugin1")).toEqual(plugin1);
      expect(registry.getPlugin("plugin2")).toEqual(plugin2);
    });

    it("should register plugin with multiple callbacks", () => {
      const beforeQueryCallback: BeforeQueryCallback = vi.fn().mockResolvedValue({});
      const plugin: Plugin = {
        name: "multi-hook-plugin",
        callbacks: {
          beforeQuery: beforeQueryCallback,
          // Future hooks would go here
        }
      };
      
      expect(() => {
        registry.register(plugin);
      }).not.toThrow();
    });

    it("should register plugin with empty callbacks", () => {
      const plugin: Plugin = {
        name: "empty-plugin",
        callbacks: {}
      };
      
      expect(() => {
        registry.register(plugin);
      }).not.toThrow();
    });

    it("should override plugin with same name", () => {
      const callback1: BeforeQueryCallback = vi.fn().mockResolvedValue({});
      const callback2: BeforeQueryCallback = vi.fn().mockResolvedValue({});
      const plugin1 = createTestPlugin("test-plugin", callback1);
      const plugin2 = createTestPlugin("test-plugin", callback2);
      
      registry.register(plugin1);
      registry.register(plugin2);
      
      expect(registry.getRegisteredPlugins()).toHaveLength(1);
      expect(registry.getPlugin("test-plugin")).toEqual(plugin2);
    });
  });

  describe("registerHook (legacy API)", () => {
    it("should register a beforeQuery callback using legacy method", () => {
      const callback: BeforeQueryCallback = vi.fn().mockResolvedValue({});
      
      expect(() => {
        registry.registerHook("beforeQuery", callback);
      }).not.toThrow();
    });

    it("should register callback with plugin name using legacy method", () => {
      const callback: BeforeQueryCallback = vi.fn().mockResolvedValue({});
      
      expect(() => {
        registry.registerHook("beforeQuery", callback, "legacy-plugin");
      }).not.toThrow();
    });
  });

  describe("getRegisteredPlugins", () => {
    it("should return empty array initially", () => {
      expect(registry.getRegisteredPlugins()).toEqual([]);
    });

    it("should return all registered plugins", () => {
      const plugin1 = createTestPlugin("plugin1");
      const plugin2 = createTestPlugin("plugin2");
      
      registry.register(plugin1);
      registry.register(plugin2);
      
      const plugins = registry.getRegisteredPlugins();
      expect(plugins).toHaveLength(2);
      expect(plugins).toContain(plugin1);
      expect(plugins).toContain(plugin2);
    });
  });

  describe("getPlugin", () => {
    it("should return undefined for non-existent plugin", () => {
      expect(registry.getPlugin("non-existent")).toBeUndefined();
    });

    it("should return registered plugin", () => {
      const plugin = createTestPlugin("test-plugin");
      registry.register(plugin);
      
      expect(registry.getPlugin("test-plugin")).toEqual(plugin);
    });
  });

  describe("executeHook", () => {
    describe("beforeQuery hook", () => {
      it("should execute single beforeQuery callback from plugin", async () => {
        const expectedResult: BeforeQueryResult = {
          pgSettings: new Map([["role", "test_user"]])
        };
        const callback: BeforeQueryCallback = vi.fn().mockResolvedValue(expectedResult);
        const plugin = createTestPlugin("test-plugin", callback);
        const context = createTestContext();

        registry.register(plugin);
        const result = await registry.executeHook("beforeQuery", context);

        expect(callback).toHaveBeenCalledWith(context);
        expect(result).toEqual(expectedResult);
      });

      it("should execute multiple plugins and merge results", async () => {
        const callback1: BeforeQueryCallback = vi.fn().mockResolvedValue({
          pgSettings: new Map([["role", "user1"], ["search_path", "public"]])
        });
        const callback2: BeforeQueryCallback = vi.fn().mockResolvedValue({
          pgSettings: new Map([["role", "user2"], ["timezone", "UTC"]])
        });
        const plugin1 = createTestPlugin("plugin1", callback1);
        const plugin2 = createTestPlugin("plugin2", callback2);
        const context = createTestContext();

        registry.register(plugin1);
        registry.register(plugin2);
        const result = await registry.executeHook("beforeQuery", context);

        expect(callback1).toHaveBeenCalledWith(context);
        expect(callback2).toHaveBeenCalledWith(context);
        
        // Check merged results - last plugin wins for conflicts
        expect(result.pgSettings?.get("role")).toBe("user2"); // user2 wins (last)
        expect(result.pgSettings?.get("search_path")).toBe("public"); // from callback1
        expect(result.pgSettings?.get("timezone")).toBe("UTC"); // from callback2
        expect(result.pgSettings?.size).toBe(3);
      });

      it("should handle plugins with no pgSettings", async () => {
        const callback1: BeforeQueryCallback = vi.fn().mockResolvedValue({});
        const callback2: BeforeQueryCallback = vi.fn().mockResolvedValue({
          pgSettings: new Map([["role", "test_user"]])
        });
        const plugin1 = createTestPlugin("plugin1", callback1);
        const plugin2 = createTestPlugin("plugin2", callback2);
        const context = createTestContext();

        registry.register(plugin1);
        registry.register(plugin2);
        const result = await registry.executeHook("beforeQuery", context);

        expect(result.pgSettings?.get("role")).toBe("test_user");
        expect(result.pgSettings?.size).toBe(1);
      });

      it("should handle empty pgSettings maps", async () => {
        const callback: BeforeQueryCallback = vi.fn().mockResolvedValue({
          pgSettings: new Map()
        });
        const plugin = createTestPlugin("test-plugin", callback);
        const context = createTestContext();

        registry.register(plugin);
        const result = await registry.executeHook("beforeQuery", context);

        expect(result.pgSettings).toEqual(new Map());
      });

      it("should execute plugins in registration order", async () => {
        const executionOrder: number[] = [];
        const callback1: BeforeQueryCallback = vi.fn().mockImplementation(async () => {
          executionOrder.push(1);
          return {};
        });
        const callback2: BeforeQueryCallback = vi.fn().mockImplementation(async () => {
          executionOrder.push(2);
          return {};
        });
        const callback3: BeforeQueryCallback = vi.fn().mockImplementation(async () => {
          executionOrder.push(3);
          return {};
        });
        const plugin1 = createTestPlugin("plugin1", callback1);
        const plugin2 = createTestPlugin("plugin2", callback2);
        const plugin3 = createTestPlugin("plugin3", callback3);
        const context = createTestContext();

        registry.register(plugin1);
        registry.register(plugin2);
        registry.register(plugin3);
        await registry.executeHook("beforeQuery", context);

        expect(executionOrder).toEqual([1, 2, 3]);
      });

      it("should handle async callbacks", async () => {
        const callback: BeforeQueryCallback = vi.fn().mockImplementation(async (context) => {
          // Simulate async work
          await new Promise(resolve => setTimeout(resolve, 10));
          return {
            pgSettings: new Map([["role", `async_${context.toolName}`]])
          };
        });
        const plugin = createTestPlugin("async-plugin", callback);
        const context = createTestContext({ toolName: "async_tool" });

        registry.register(plugin);
        const result = await registry.executeHook("beforeQuery", context);

        expect(result.pgSettings?.get("role")).toBe("async_async_tool");
      });

      it("should propagate errors from callbacks with plugin name", async () => {
        const error = new Error("Plugin callback failed");
        const callback: BeforeQueryCallback = vi.fn().mockRejectedValue(error);
        const plugin = createTestPlugin("failing-plugin", callback);
        const context = createTestContext();

        registry.register(plugin);

        await expect(registry.executeHook("beforeQuery", context)).rejects.toThrow("Plugin callback failed");
      });

      it("should stop execution on first callback error", async () => {
        const callback1: BeforeQueryCallback = vi.fn().mockRejectedValue(new Error("First callback failed"));
        const callback2: BeforeQueryCallback = vi.fn().mockResolvedValue({});
        const plugin1 = createTestPlugin("plugin1", callback1);
        const plugin2 = createTestPlugin("plugin2", callback2);
        const context = createTestContext();

        registry.register(plugin1);
        registry.register(plugin2);

        await expect(registry.executeHook("beforeQuery", context)).rejects.toThrow("First callback failed");
        expect(callback1).toHaveBeenCalled();
        expect(callback2).not.toHaveBeenCalled();
      });

      it("should work with mixed plugin registration and legacy registerHook", async () => {
        const pluginCallback: BeforeQueryCallback = vi.fn().mockResolvedValue({
          pgSettings: new Map([["role", "plugin_user"]])
        });
        const legacyCallback: BeforeQueryCallback = vi.fn().mockResolvedValue({
          pgSettings: new Map([["search_path", "legacy_schema"]])
        });
        const plugin = createTestPlugin("test-plugin", pluginCallback);
        const context = createTestContext();

        registry.register(plugin);
        registry.registerHook("beforeQuery", legacyCallback, "legacy-plugin");
        const result = await registry.executeHook("beforeQuery", context);

        expect(pluginCallback).toHaveBeenCalledWith(context);
        expect(legacyCallback).toHaveBeenCalledWith(context);
        expect(result.pgSettings?.get("role")).toBe("plugin_user");
        expect(result.pgSettings?.get("search_path")).toBe("legacy_schema");
      });
    });

    it("should throw error for unknown hook", async () => {
      // @ts-expect-error Testing invalid hook
      await expect(registry.executeHook("unknownHook", {})).rejects.toThrow("Unknown hook: unknownHook");
    });

    it("should handle empty callback list", async () => {
      const context = createTestContext();
      const result = await registry.executeHook("beforeQuery", context);

      expect(result).toEqual({
        pgSettings: new Map()
      });
    });
  });

  describe("executeHook API consistency", () => {
    it("should work with executeHook('beforeQuery', context) syntax", async () => {
      const expectedResult: BeforeQueryResult = {
        pgSettings: new Map([["role", "test_user"]])
      };
      const callback: BeforeQueryCallback = vi.fn().mockResolvedValue(expectedResult);
      const plugin = createTestPlugin("test-plugin", callback);
      const context = createTestContext();

      registry.register(plugin);
      const result = await registry.executeHook("beforeQuery", context);

      expect(callback).toHaveBeenCalledWith(context);
      expect(result).toEqual(expectedResult);
    });
  });

  describe("complex scenarios", () => {
    it("should handle complex pgSettings merging", async () => {
      const callback1: BeforeQueryCallback = vi.fn().mockResolvedValue({
        pgSettings: new Map([
          ["role", "initial_role"],
          ["search_path", "schema1,public"],
          ["timezone", "America/New_York"]
        ])
      });
      const callback2: BeforeQueryCallback = vi.fn().mockResolvedValue({
        pgSettings: new Map([
          ["role", "override_role"], // This should win
          ["work_mem", "256MB"],
        ])
      });
      const callback3: BeforeQueryCallback = vi.fn().mockResolvedValue({
        pgSettings: new Map([
          ["timezone", "UTC"], // This should win
          ["log_statement", "all"]
        ])
      });
      const context = createTestContext();

      registry.register(createTestPlugin("plugin1", callback1));
      registry.register(createTestPlugin("plugin2", callback2));
      registry.register(createTestPlugin("plugin3", callback3));
      const result = await registry.executeHook("beforeQuery", context);

      expect(result.pgSettings?.get("role")).toBe("override_role");
      expect(result.pgSettings?.get("search_path")).toBe("schema1,public");
      expect(result.pgSettings?.get("timezone")).toBe("UTC");
      expect(result.pgSettings?.get("work_mem")).toBe("256MB");
      expect(result.pgSettings?.get("log_statement")).toBe("all");
      expect(result.pgSettings?.size).toBe(5);
    });

    it("should handle mixed sync and async callbacks", async () => {
      const syncCallback: BeforeQueryCallback = vi.fn().mockReturnValue({
        pgSettings: new Map([["sync_setting", "sync_value"]])
      });
      const asyncCallback: BeforeQueryCallback = vi.fn().mockResolvedValue({
        pgSettings: new Map([["async_setting", "async_value"]])
      });
      const context = createTestContext();

      registry.register(createTestPlugin("plugin1", syncCallback));
      registry.register(createTestPlugin("plugin2", asyncCallback));
      const result = await registry.executeHook("beforeQuery", context);

      expect(result.pgSettings?.get("sync_setting")).toBe("sync_value");
      expect(result.pgSettings?.get("async_setting")).toBe("async_value");
    });

    it("should pass complete context to callbacks", async () => {
      const callback: BeforeQueryCallback = vi.fn().mockResolvedValue({});
      const context = createTestContext({
        toolName: "complex_tool",
        toolConfig: {
          kind: "postgres-sql",
          source: "main_db",
          description: "Complex test tool",
          parameters: [
            { name: "param1", type: "string", description: "Test param" }
          ],
          statement: "SELECT * FROM users WHERE name = :param1"
        } as PostgresSqlTool,
        parsedArgs: { param1: "test_user", param2: 42 },
        query: "SELECT * FROM users WHERE name = $1"
      });

      registry.register(createTestPlugin("test-plugin", callback));
      await registry.executeHook("beforeQuery", context);

      expect(callback).toHaveBeenCalledWith(context);
      const mockCallback = vi.mocked(callback);
      const callArgs = mockCallback.mock.calls[0][0];
      expect(callArgs.toolName).toBe("complex_tool");
      expect(callArgs.toolConfig.source).toBe("main_db");
      expect(callArgs.parsedArgs.param1).toBe("test_user");
      expect(callArgs.parsedArgs.param2).toBe(42);
      expect(callArgs.query).toBe("SELECT * FROM users WHERE name = $1");
    });
  });

  describe("performance", () => {
    it("should handle many callbacks efficiently", async () => {
      const numCallbacks = 100;
      const callbacks: BeforeQueryCallback[] = [];
      
      // Register many callbacks
      for (let i = 0; i < numCallbacks; i++) {
        const callback: BeforeQueryCallback = vi.fn().mockResolvedValue({
          pgSettings: new Map([[`setting_${i}`, `value_${i}`]])
        });
        callbacks.push(callback);
        registry.register(createTestPlugin(`plugin${i}`, callback));
      }

      const context = createTestContext();
      const startTime = Date.now();
      const result = await registry.executeHook("beforeQuery", context);
      const endTime = Date.now();

      // All callbacks should have been called
      callbacks.forEach(callback => {
        expect(callback).toHaveBeenCalledWith(context);
      });

      // All settings should be present
      expect(result.pgSettings?.size).toBe(numCallbacks);
      for (let i = 0; i < numCallbacks; i++) {
        expect(result.pgSettings?.get(`setting_${i}`)).toBe(`value_${i}`);
      }

      // Performance check - should complete in reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
}); 
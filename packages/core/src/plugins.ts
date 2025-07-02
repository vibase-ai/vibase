import { MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js";
import type { Pool } from "pg";
import type { PostgresSqlTool } from "./validate-config.js";

// Hook types - extensible union
export type PluginHook = 'beforeQuery';

// Hook-specific context types
export interface BeforeQueryContext {
  toolName: string;
  toolConfig: PostgresSqlTool;
  pool: Pool;
  parsedArgs: Record<string, any>;
  extra: MessageExtraInfo; // MessageExtraInfo from MCP SDK
  query: string;
}

// Hook-specific result types
export interface BeforeQueryResult {
  pgSettings?: Map<string, string>;
}

// Hook-specific callback types
export type BeforeQueryCallback = (context: BeforeQueryContext) => BeforeQueryResult | Promise<BeforeQueryResult>;

// Type mappings for hooks (extensible design)
export interface HookCallbacks {
  beforeQuery: BeforeQueryCallback;
}

export interface HookContexts {
  beforeQuery: BeforeQueryContext;
}

export interface HookResults {
  beforeQuery: BeforeQueryResult;
}

// Plugin interface with structured callbacks
export interface Plugin {
  name: string;
  callbacks: Partial<HookCallbacks>;
}

// Plugin registry with type-safe hook management
export class PluginRegistry {
  private callbacksByHook = new Map<PluginHook, Array<{ pluginName: string; callback: HookCallbacks[PluginHook] }>>();
  private registeredPlugins = new Map<string, Plugin>();

  register(plugin: Plugin): void {
    // Store the plugin for reference
    this.registeredPlugins.set(plugin.name, plugin);

    // Register each callback by hook
    for (const [hookName, callback] of Object.entries(plugin.callbacks)) {
      const hook = hookName as PluginHook;
      if (!this.callbacksByHook.has(hook)) {
        this.callbacksByHook.set(hook, []);
      }
      this.callbacksByHook.get(hook)!.push({
        pluginName: plugin.name,
        callback: callback as HookCallbacks[PluginHook]
      });
    }
  }

  // Legacy method for backward compatibility (deprecated)
  registerHook<T extends PluginHook>(hook: T, callback: HookCallbacks[T], pluginName?: string): void {
    if (!this.callbacksByHook.has(hook)) {
      this.callbacksByHook.set(hook, []);
    }
    this.callbacksByHook.get(hook)!.push({
      pluginName: pluginName || 'anonymous',
      callback
    });
  }

  async executeHook<T extends PluginHook>(hook: T, context: HookContexts[T]): Promise<HookResults[T]> {
    const callbacks = this.callbacksByHook.get(hook) || [];
    
    if (hook === 'beforeQuery') {
      return this.executeBeforeQueryHook(context as BeforeQueryContext, callbacks as Array<{ pluginName: string; callback: BeforeQueryCallback }>) as HookResults[T];
    }
    
    // Future hooks would be handled here
    throw new Error(`Unknown hook: ${hook}`);
  }

  private async executeBeforeQueryHook(context: BeforeQueryContext, callbacks: Array<{ pluginName: string; callback: BeforeQueryCallback }>): Promise<BeforeQueryResult> {
    const mergedResult: BeforeQueryResult = {
      pgSettings: new Map<string, string>()
    };

    // Execute all callbacks and merge their results
    for (const { pluginName, callback } of callbacks) {
      try {
        const result = await callback(context);
        
        // Merge pgSettings (last plugin wins for conflicts)
        if (result.pgSettings) {
          for (const [key, value] of result.pgSettings.entries()) {
            mergedResult.pgSettings!.set(key, value);
          }
        }
      } catch (error) {
        console.error(`Plugin '${pluginName}' failed during beforeQuery hook:`, error);
        throw error;
      }
    }

    return mergedResult;
  }

  // Utility methods
  getRegisteredPlugins(): Plugin[] {
    return Array.from(this.registeredPlugins.values());
  }

  getPlugin(name: string): Plugin | undefined {
    return this.registeredPlugins.get(name);
  }
}

// Plugin interface for dependency injection
export interface Plugins {
  register(plugin: Plugin): void;
  registerHook<T extends PluginHook>(hook: T, callback: HookCallbacks[T], pluginName?: string): void; // Legacy support
  executeHook<T extends PluginHook>(hook: T, context: HookContexts[T]): Promise<HookResults[T]>;
} 
import * as yaml from "js-yaml";
import { readFileSync } from "fs";
import Handlebars from "handlebars";
import { validateConfig, type ToolboxConfig } from "./validate-config.js";

/**
 * Load and validate configuration from a YAML file
 */
export function loadConfigFromYaml(configPath: string): ToolboxConfig {
  try {
    const yamlContent = readFileSync(configPath, "utf8");
    return loadConfigFromYamlString(yamlContent);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      throw new Error(`YAML configuration file not found: ${configPath}`);
    }
    throw new Error(`Failed to read YAML configuration file: ${error.message}`);
  }
}

/**
 * Process template variables in YAML content using Handlebars
 * Supports environment variables and provides helpful defaults
 */
function processTemplate(content: string): string {
  // Create template context with environment variables and helpers
  const context = {
    env: process.env,
    ...process.env, // Allow direct access to env vars without 'env.' prefix
  };

  // Register helper for default values
  Handlebars.registerHelper(
    "default",
    function (value: any, defaultValue: any) {
      return value != null && value !== "" ? value : defaultValue;
    }
  );

  // Register helper for environment variables with defaults
  Handlebars.registerHelper(
    "envDefault",
    function (varName: string, defaultValue: any) {
      const envValue = process.env[varName];
      return envValue != null && envValue !== "" ? envValue : defaultValue;
    }
  );

  try {
    const template = Handlebars.compile(content);
    return template(context);
  } catch (error: any) {
    throw new Error(`Template processing failed: ${error.message}`);
  }
}

/**
 * Load and validate configuration from a YAML string
 */
export function loadConfigFromYamlString(yamlContent: string): ToolboxConfig {
  try {
    // Process template variables using Handlebars before parsing YAML
    const processedContent = processTemplate(yamlContent);
    const config = yaml.load(processedContent);
    return validateConfig(config);
  } catch (error: any) {
    if (error.name === "YAMLException") {
      throw new Error(`Invalid YAML syntax: ${error.message}`);
    }
    throw error;
  }
}

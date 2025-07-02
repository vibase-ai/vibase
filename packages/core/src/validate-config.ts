import { z } from "zod";

// Configuration types
export interface PostgresSourceConnectionString {
  kind: "postgres" | "postgres-sql";
  connection_string: string;
}

export interface PostgresSourceParameters {
  kind: "postgres" | "postgres-sql";
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export type PostgresSource =
  | PostgresSourceConnectionString
  | PostgresSourceParameters;

export interface PostgresSqlTool {
  kind?: "postgres" | "postgres-sql";
  source: string;
  description: string;
  parameters: Array<{
    name: string;
    type: "string" | "number" | "boolean";
    description: string;
    required?: boolean;
    default?: string | number | boolean;
  }>;
  statement: string;
}

export interface ToolboxConfig {
  sources: Record<string, PostgresSource>;
  tools: Record<string, PostgresSqlTool>;
}

// Zod schemas for validation
const PostgresSourceConnectionStringSchema = z
  .object({
    kind: z.enum(["postgres", "postgres-sql"]),
    connection_string: z.string().min(1),
  })
  .strict();

const PostgresSourceParametersSchema = z
  .object({
    kind: z.enum(["postgres", "postgres-sql"]),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    database: z.string().min(1),
    user: z.string().min(1),
    password: z.string().min(1),
  })
  .strict();

const PostgresSourceSchema = z.union([
  PostgresSourceConnectionStringSchema,
  PostgresSourceParametersSchema,
]);

const ParameterSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(["string", "number", "boolean"]),
    description: z.string().min(1),
    required: z.boolean().optional(),
    default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  })
  .refine(
    (param) => {
      // If required is explicitly false, then default must be provided
      if (param.required === false && param.default === undefined) {
        return false;
      }
      return true;
    },
    {
      message: "Parameters with required: false must have a default value",
    }
  )
  .refine(
    (param) => {
      // Validate that default value type matches parameter type
      if (param.default !== undefined) {
        const defaultType = typeof param.default;
        if (param.type === "string" && defaultType !== "string") return false;
        if (param.type === "number" && defaultType !== "number") return false;
        if (param.type === "boolean" && defaultType !== "boolean") return false;
      }
      return true;
    },
    {
      message: "Default value type must match parameter type",
    }
  );

const PostgresSqlToolSchema = z.object({
  kind: z.enum(["postgres", "postgres-sql"]).optional(),
  source: z.string().min(1),
  description: z.string().min(1),
  parameters: z.array(ParameterSchema),
  statement: z.string().min(1),
});

const YamlConfigSchema = z
  .object({
    sources: z.record(z.string(), PostgresSourceSchema),
    tools: z.record(z.string(), PostgresSqlToolSchema),
  })
  .refine(
    (config) => {
      // Validate that all tool sources exist in sources
      for (const [toolName, tool] of Object.entries(config.tools)) {
        if (!config.sources[tool.source]) {
          throw new Error(
            `Source '${tool.source}' not found for tool '${toolName}'`
          );
        }
      }
      return true;
    },
    {
      message: "All tool sources must exist in sources configuration",
    }
  )
  .refine(
    (config) => {
      // If tool kind is specified, validate it's compatible with source kind
      for (const [toolName, tool] of Object.entries(config.tools)) {
        if (tool.kind) {
          const source = config.sources[tool.source];
          if (!source) {
            // This should already be caught by the previous refine, but just in case
            throw new Error(`Source '${tool.source}' not found for tool '${toolName}'`);
          }
          const sourceKind = source.kind;
          // Both postgres and postgres-sql are considered compatible
          const compatibleKinds = ["postgres", "postgres-sql"];
          if (!compatibleKinds.includes(tool.kind) || !compatibleKinds.includes(sourceKind)) {
            throw new Error(
              `Tool '${toolName}' kind '${tool.kind}' is incompatible with source '${tool.source}' kind '${sourceKind}'`
            );
          }
        }
      }
      return true;
    },
    {
      message: "Tool kinds must be compatible with their source kinds",
    }
  )
  .transform((config) => {
    // Inherit kind from source if not specified
    const transformedConfig = { ...config };
    for (const [toolName, tool] of Object.entries(transformedConfig.tools)) {
      if (!tool.kind) {
        const source = config.sources[tool.source];
        if (source) {
          tool.kind = source.kind;
        }
      }
    }
    return transformedConfig;
  });

// Validate YAML configuration
export function validateConfig(config: any): ToolboxConfig {
  try {
    return YamlConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err, index) => {
        const path = err.path.length > 0 ? err.path.join(".") : "root";
        const location = path !== "root" ? ` (at ${path})` : "";
        return `  ${index + 1}. ${err.message}${location}`;
      });
      
      const formattedError = [
        "❌ YAML Configuration Validation Failed",
        "",
        "The following errors were found:",
        ...errorMessages,
        "",
        "Please fix these issues and try again."
      ].join("\n");
      
      throw new Error(formattedError);
    }
    throw error;
  }
}

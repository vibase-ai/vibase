import { z } from "zod";

// Configuration types
export interface PostgresSourceConnectionString {
  kind: "postgres";
  connection_string: string;
}

export interface PostgresSourceParameters {
  kind: "postgres";
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
  kind: "postgres-sql";
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
    kind: z.literal("postgres"),
    connection_string: z.string().min(1),
  })
  .strict();

const PostgresSourceParametersSchema = z
  .object({
    kind: z.literal("postgres"),
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
  kind: z.literal("postgres-sql"),
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
  );

// Validate YAML configuration
export function validateConfig(config: any): ToolboxConfig {
  try {
    return YamlConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => {
        const path = err.path.length > 0 ? `at ${err.path.join(".")}` : "";
        return `${err.message} ${path}`.trim();
      });
      throw new Error(
        `Invalid YAML configuration: ${errorMessages.join(", ")}`
      );
    }
    throw error;
  }
}

import type { CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js";
import sql, { value } from "pg-sql2";
import type { ConnectionManager } from "./connection-manager.js";
import type { PostgresSource, PostgresSqlTool } from "./validate-config.js";

// Helper function to build connection string from source configuration
function buildConnectionString(source: PostgresSource): string {
  if ("connection_string" in source) {
    return source.connection_string;
  } else {
    // Build connection string from individual parameters
    return `postgresql://${source.user}:${source.password}@${source.host}:${source.port}/${source.database}`;
  }
}

// Helper function to build safe SQL queries using 3-step approach
function buildSafeQuery(
  statement: string,
  parameters: Record<string, any>
): { text: string; values: any[] } {
  let sqlStatement = statement;
  let paramValues: any[] = [];
  
  // Step 1: Replace named parameters with positional parameters
  if (statement.includes(":")) {
    const paramMap = new Map<string, number>();
    const paramMatches = Array.from(statement.matchAll(/:(\w+)/g));
    
    for (const match of paramMatches) {
      const paramName = match[1];
      if (!paramName || !(paramName in parameters)) {
        throw new Error(`Parameter :${paramName} not provided`);
      }
      
      // Assign position if we haven't seen this parameter before
      if (!paramMap.has(paramName)) {
        paramValues.push(parameters[paramName]);
        paramMap.set(paramName, paramValues.length);
      }
    }
    
    // Replace all named parameters with positional ones
    for (const [paramName, position] of paramMap.entries()) {
      const regex = new RegExp(`:${paramName}\\b`, 'g');
      sqlStatement = sqlStatement.replace(regex, `$${position}`);
    }
  } else if (statement.includes("$")) {
    // Already has positional parameters
    paramValues = Object.values(parameters);
  } else {
    // No parameters
    return { text: statement, values: [] };
  }
  
  // Now we have sqlStatement with $1, $2, etc. and paramValues array
  // Let's use pg-sql2 to safely build the query
  try {
    // Split the statement by placeholders and build fragments
    const fragments: any[] = [];
    let currentPos = 0;
    
    for (let i = 1; i <= paramValues.length; i++) {
      const placeholder = `$${i}`;
      const placeholderIndex = sqlStatement.indexOf(placeholder, currentPos);
      
      if (placeholderIndex !== -1) {
        // Add text before placeholder (if any)
        if (placeholderIndex > currentPos) {
          const textBefore = sqlStatement.substring(currentPos, placeholderIndex);
          fragments.push(textBefore);
        }
        
        // Add the safe value
        fragments.push(value(paramValues[i - 1]));
        
        currentPos = placeholderIndex + placeholder.length;
      }
    }
    
    // Add remaining text (if any)
    if (currentPos < sqlStatement.length) {
      fragments.push(sqlStatement.substring(currentPos));
    }
    
    // Use sql.join to combine all fragments
    const query = sql.join(fragments, '');
    const compiled = sql.compile(query);
    return { text: compiled.text, values: compiled.values || [] };
    
  } catch (error) {
    // Fallback: if pg-sql2 fails, use simple parameterized query
    console.warn('pg-sql2 compilation failed, falling back to simple parameterized query:', error);
    return { text: sqlStatement, values: paramValues };
  }
}

/**
 * Execute a SQL query with the given parameters using pg-sql2 for SQL injection protection
 */
export async function executeQuery(
  toolName: string,
  toolConfig: PostgresSqlTool,
  sourceName: string,
  sourceConfig: PostgresSource,
  connectionManager: ConnectionManager,
  parsedArgs: Record<string, any>
): Promise<CallToolResult> {
  try {
    // Build connection string from source configuration
    const connectionString = buildConnectionString(sourceConfig);

    // Get database connection
    const pool = connectionManager.getPool(sourceName, connectionString);

    // Build safe SQL query using pg-sql2
    const { text, values } = buildSafeQuery(toolConfig.statement, parsedArgs);

    // Execute the safe query
    const queryResult = await pool.query(text, values);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(queryResult.rows, null, 2),
        } as TextContent,
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error executing tool '${toolName}': ${error.message}`,
        } as TextContent,
      ],
      isError: true,
    };
  }
}


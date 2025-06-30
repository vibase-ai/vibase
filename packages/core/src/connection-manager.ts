import { Pool } from "pg";

// Connection pool manager
export class ConnectionManager {
  private pools: Map<string, Pool> = new Map();

  getPool(sourceName: string, connectionString: string): Pool {
    if (!this.pools.has(sourceName)) {
      const pool = new Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      this.pools.set(sourceName, pool);
    }
    return this.pools.get(sourceName)!;
  }

  async closeAll(): Promise<void> {
    const promises = Array.from(this.pools.values()).map((pool) => pool.end());
    await Promise.all(promises);
    this.pools.clear();
  }
}

import { readFileSync } from "fs";
import { resolve } from "path";

export interface DbConfig {
  name: string;
  data_source_id: string;
  agent: "productivity" | "journaling" | "strategic";
  properties: Record<string, string>;
}

export interface LifeOSConfig {
  apiVersion: string;
  rateLimit: {
    requestsPerSecond: number;
    cacheTtlSeconds: number;
  };
  databases: Record<string, DbConfig>;
}

export function loadConfig(): LifeOSConfig {
  const configPath = resolve(process.cwd(), "lifeos.config.json");
  const raw = readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as LifeOSConfig;
}

export function getDbConfig(config: LifeOSConfig, key: string): DbConfig {
  const db = config.databases[key];
  if (!db) {
    throw new Error(`Unknown database: ${key}. Available: ${Object.keys(config.databases).join(", ")}`);
  }
  return db;
}

export function getDbsByAgent(config: LifeOSConfig, agent: string): Record<string, DbConfig> {
  const result: Record<string, DbConfig> = {};
  for (const [key, db] of Object.entries(config.databases)) {
    if (db.agent === agent) {
      result[key] = db;
    }
  }
  return result;
}

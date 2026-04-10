import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // Config lives at project root (one level up from dist/)
  const configPath = resolve(__dirname, "..", "lifeos.config.json");
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
  for (const [key, db] of Object.entries(config.databases) as [string, DbConfig][]) {
    if (db.agent === agent) {
      result[key] = db;
    }
  }
  return result;
}

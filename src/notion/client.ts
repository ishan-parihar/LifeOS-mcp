import { LifeOSConfig } from "../config.js";
import { Cache } from "./cache.js";
import { NotionQueryResponse, NotionDataSource, NotionErrorResponse } from "./types.js";

const BASE_URL = "https://api.notion.com";

export class NotionClient {
  private cache: Cache;
  private lastRequestTime = 0;
  private readonly minIntervalMs: number;

  constructor(private config: LifeOSConfig, private token: string) {
    this.cache = new Cache(config.rateLimit.cacheTtlSeconds * 1000);
    this.minIntervalMs = 1000 / config.rateLimit.requestsPerSecond;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((r) => setTimeout(r, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    await this.rateLimit();
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Notion-Version": this.config.apiVersion,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const err = (await res.json()) as NotionErrorResponse;
      throw new Error(`Notion API error ${res.status}: ${err.code} - ${err.message}`);
    }

    return res.json() as Promise<T>;
  }

  private cacheKey(path: string, body?: unknown): string {
    return `${path}:${JSON.stringify(body || "")}`;
  }

  async queryDataSource(
    dataSourceId: string,
    body: Record<string, unknown> = {}
  ): Promise<NotionQueryResponse> {
    const cacheKey = this.cacheKey(`/v1/data_sources/${dataSourceId}/query`, body);
    const cached = this.cache.get<NotionQueryResponse>(cacheKey);
    if (cached) return cached;

    const result = await this.fetch<NotionQueryResponse>(
      `/v1/data_sources/${dataSourceId}/query`,
      {
        method: "POST",
        body: JSON.stringify({ page_size: 100, ...body }),
      }
    );

    this.cache.set(cacheKey, result);
    return result;
  }

  async getDataSource(dataSourceId: string): Promise<NotionDataSource> {
    const cacheKey = this.cacheKey(`/v1/data_sources/${dataSourceId}`);
    const cached = this.cache.get<NotionDataSource>(cacheKey);
    if (cached) return cached;

    const result = await this.fetch<NotionDataSource>(
      `/v1/data_sources/${dataSourceId}`
    );

    this.cache.set(cacheKey, result);
    return result;
  }

  invalidateCache(): void {
    this.cache.clear();
  }
}

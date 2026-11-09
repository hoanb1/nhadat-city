import Redis from 'ioredis';
import crc32 from 'crc-32';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const NAMESPACE = process.env.CACHE_NAMESPACE || 'nsp';

class CacheManager {
  private static instance: CacheManager;
  private redis: Redis | null = null;
  private enableCache: boolean = true;

  private constructor() {
    this.enableCache = process.env.ENABLE_CACHE !== 'false';
    
    if (this.enableCache) {
      try {
        this.redis = new Redis(REDIS_URL, {
          maxRetriesPerRequest: 3,
          retryStrategy(times) {
            return Math.min(times * 50, 2000);
          }
        });
        
        this.redis.on('error', (err) => {
          console.error('Redis connection error:', err);
        });
      } catch (err) {
        console.error('Failed to initialize Redis:', err);
        this.enableCache = false;
      }
    }
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private createCacheKey(keyString: string): string {
    const readableKey = keyString
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .slice(0, 30);
    const hash = crc32.str(keyString).toString(16).replace(/-/g, '_');
    const key = `${NAMESPACE}_${readableKey}_${hash}`;
    return key.replace(/_+/g, '_');
  }

  async getCache<T>(keyString: string): Promise<T | null> {
    if (!this.enableCache || !this.redis) return null;
    
    try {
      const cacheKey = this.createCacheKey(keyString);
      const result = await this.redis.get(cacheKey);
      if (result) {
        return JSON.parse(result) as T;
      }
      return null;
    } catch (err) {
      console.error(`Error fetching cache for key ${keyString}:`, err);
      return null;
    }
  }

  async setCache(keyString: string, value: any, ttlSeconds = 3600): Promise<void> {
    if (!this.enableCache || !this.redis) return;
    
    try {
      const cacheKey = this.createCacheKey(keyString);
      await this.redis.setex(cacheKey, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      console.error(`Error setting cache for key ${keyString}:`, err);
    }
  }

  async deleteCache(keyString: string): Promise<void> {
    if (!this.enableCache || !this.redis) return;
    
    try {
      const cacheKey = this.createCacheKey(keyString);
      await this.redis.del(cacheKey);
    } catch (err) {
      console.error(`Error deleting cache for key ${keyString}:`, err);
    }
  }

  async getBufferCache(keyString: string): Promise<Buffer | null> {
    if (!this.enableCache || !this.redis) return null;
    
    try {
      const cacheKey = this.createCacheKey(keyString);
      const result = await this.redis.getBuffer(cacheKey);
      return result || null;
    } catch (err) {
      console.error(`Error fetching buffer cache for key ${keyString}:`, err);
      return null;
    }
  }

  async setBufferCache(keyString: string, buffer: Buffer, ttlSeconds = 31536000): Promise<void> {
    if (!this.enableCache || !this.redis) return;
    
    try {
      const cacheKey = this.createCacheKey(keyString);
      await this.redis.setex(cacheKey, ttlSeconds, buffer);
    } catch (err) {
      console.error(`Error setting buffer cache for key ${keyString}:`, err);
    }
  }
  async flushCache(): Promise<void> {
    if (!this.enableCache || !this.redis) return;
    try {
      await this.redis.flushall();
    } catch (err) {
      console.error('Error flushing cache:', err);
    }
  }

  async getCacheStatus(): Promise<{ connected: boolean; keys?: number }> {
    if (!this.enableCache || !this.redis) return { connected: false };
    try {
      const keys = await this.redis.dbsize();
      return { connected: true, keys };
    } catch (err) {
      return { connected: false };
    }
  }
}

export const cacheManager = CacheManager.getInstance();

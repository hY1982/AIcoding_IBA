/**
 * Lightweight in-memory Redis mock for integration tests.
 * Implements just enough of the ioredis interface for auth tests.
 */
export class RedisMock {
  private store = new Map<string, { value: string; expiry?: number }>();
  private sets = new Map<string, Set<string>>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiry && entry.expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ...args: (string | number)[]): Promise<void> {
    let ttlSeconds: number | undefined;
    for (let i = 0; i < args.length; i++) {
      const arg = String(args[i]).toUpperCase();
      if ((arg === 'EX' || arg === 'PX') && i + 1 < args.length) {
        const ttl = Number(args[i + 1]);
        ttlSeconds = arg === 'EX' ? ttl * 1000 : ttl;
      }
    }
    this.store.set(key, {
      value,
      expiry: ttlSeconds ? Date.now() + ttlSeconds : undefined,
    });
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    this.store.set(key, { value, expiry: Date.now() + seconds * 1000 });
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) {
      this.store.delete(key);
    }
  }

  async getdel(key: string): Promise<string | null> {
    const value = await this.get(key);
    this.store.delete(key);
    return value;
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.sets.get(key);
    return set ? Array.from(set) : [];
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    let set = this.sets.get(key);
    if (!set) {
      set = new Set();
      this.sets.set(key, set);
    }
    for (const member of members) {
      set.add(member);
    }
  }

  async flushdb(): Promise<void> {
    this.store.clear();
    this.sets.clear();
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<void> {
    // no-op
  }

  on(): void {
    // no-op event handler
  }
}

import CacheConfiguration from '../types/configuration/CacheConfiguration';
import Logging from '../utils/Logging';
import NodeCache from 'node-cache';

export class Cache {

  private cache: NodeCache;
  private debug: boolean;

  public constructor(cacheConfiguration: CacheConfiguration) {
    this.cache = new NodeCache({ stdTTL: cacheConfiguration.ttlSeconds, checkperiod: cacheConfiguration.ttlSeconds * 0.2, useClones: false });
    this.debug = cacheConfiguration.debug;
  }

  public get(key: string, tenant: string, getDataFromStorageFn) {
    const cacheKey = this.buildKey(key, tenant);
    const value = this.cache.get(cacheKey);
    if (value) {
      this.debug && Logging.logConsoleDebug(`Cache key: ${cacheKey} found in cache`);
      return Promise.resolve(value);
    }
    this.debug && Logging.logConsoleDebug(`Cache key: creating key ${cacheKey} in cache`);
    // Not in cache: retrieve data from storage + Add in cache
    return getDataFromStorageFn().then((result) => {
      try {
        this.cache.set(cacheKey, result);
      } catch (error) {
        // Will return an errir if cache is full
        Logging.logConsoleError(`Cache Error: ${error}`);
      }
      return result;

    });
  }

  public delete(key: string, tenant: string) {
    this.cache.del(this.buildKey(key, tenant));
  }

  public deleteStartWith(startStr = '', tenant: string) {
    if (!startStr && !tenant) {
      return;
    }
    const keys = this.cache.keys();
    for (const key of keys) {
      if (key.indexOf(startStr) === 0) {
        this.delete(key, tenant);
      }
    }
  }

  public flush() {
    this.cache.flushAll();
  }

  private buildKey(key: string, tenant: string) {
    return `${tenant}_${key}`;
  }
}

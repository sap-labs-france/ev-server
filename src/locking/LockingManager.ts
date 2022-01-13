import Lock, { LockEntity, LockType } from '../types/Locking';

import BackendError from '../exception/BackendError';
import Constants from '../utils/Constants';
import LockingStorage from '../storage/mongodb/LockingStorage';
import Logging from '../utils/Logging';
import { ServerAction } from '../types/Server';
import Utils from '../utils/Utils';

const MODULE_NAME = 'LockingManager';

export default class LockingManager {
  public static createExclusiveLock(tenantID: string, entity: LockEntity, key: string, lockValiditySecs = 600): Lock {
    return this.createLock(tenantID, entity, key, LockType.EXCLUSIVE, lockValiditySecs);
  }

  public static async acquire(lock: Lock, timeoutSecs = 0, retry = true): Promise<boolean> {
    try {
      await Logging.logDebug({
        tenantID: lock.tenantID,
        module: MODULE_NAME, method: 'acquire',
        action: ServerAction.LOCKING,
        message: `Try to acquire the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}'`,
        detailedMessages: { lock, timeoutSecs, retry }
      });
      Utils.isDevelopmentEnv() && Logging.logConsoleInfo(`Try to acquire the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID '${lock.tenantID}'`);
      switch (lock.type) {
        case LockType.EXCLUSIVE:
          await LockingManager.acquireExclusiveLock(lock, timeoutSecs);
          break;
        default:
          throw new BackendError({
            action: ServerAction.LOCKING,
            module: MODULE_NAME, method: 'acquire',
            message: `Cannot acquire a lock entity '${lock.entity}' ('${lock.key}') with an unknown type '${lock.type as string}'`,
            detailedMessages: { lock, timeoutSecs, retry }
          });
      }
      await Logging.logDebug({
        tenantID: lock.tenantID,
        module: MODULE_NAME, method: 'acquire',
        action: ServerAction.LOCKING,
        message: `Acquired successfully the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}'`,
        detailedMessages: { lock, timeoutSecs, retry }
      });
      Utils.isDevelopmentEnv() && Logging.logConsoleInfo(`Acquired successfully the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID '${lock.tenantID}'`);
      return true;
    } catch (error) {
      // Check if specific lock for the asset has an expiration date
      if (retry && await LockingManager.checkAndReleaseExpiredLock(lock)) {
        return LockingManager.acquire(lock, timeoutSecs, false);
      }
      await Logging.logWarning({
        tenantID: lock.tenantID,
        module: MODULE_NAME, method: 'acquire',
        action: ServerAction.LOCKING,
        message: `Cannot acquire the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID ${lock.tenantID}`,
        detailedMessages: { lock, timeoutSecs, retry, error: error.stack }
      });
      Utils.isDevelopmentEnv() && Logging.logConsoleError(`Cannot acquire the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID '${lock.tenantID}'`);
      return false;
    }
  }

  public static async release(lock: Lock): Promise<boolean> {
    // Delete
    const result = await LockingStorage.deleteLock(lock.id);
    if (!result) {
      await Logging.logWarning({
        tenantID: lock.tenantID,
        module: MODULE_NAME, method: 'release',
        action: ServerAction.LOCKING,
        message: `Lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' does not exist and cannot be released`,
        detailedMessages: { lock, stack: new Error().stack }
      });
      return false;
    }
    await Logging.logDebug({
      tenantID: lock.tenantID,
      module: MODULE_NAME, method: 'release',
      action: ServerAction.LOCKING,
      message: `Released successfully the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' after ${Math.round(Date.now() - lock.timestamp.getTime()) / 1000} secs`,
      detailedMessages: { lock }
    });
    Utils.isDevelopmentEnv() && Logging.logConsoleDebug(`Released the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID '${lock.tenantID}' after ${Math.round(Date.now() - lock.timestamp.getTime()) / 1000} secs`);
    return true;
  }

  private static createLock(tenantID: string, entity: LockEntity, key: string, type: LockType = LockType.EXCLUSIVE, lockValiditySecs?: number): Lock {
    if (!tenantID) {
      throw new BackendError({
        action: ServerAction.LOCKING,
        module: MODULE_NAME, method: 'createLock',
        message: 'Tenant must be provided',
        detailedMessages: { tenantID, entity, key, type }
      });
    }
    if (!entity) {
      throw new BackendError({
        action: ServerAction.LOCKING,
        module: MODULE_NAME, method: 'createLock',
        message: 'Entity must be provided',
        detailedMessages: { tenantID, entity, key, type }
      });
    }
    if (!key) {
      throw new BackendError({
        action: ServerAction.LOCKING,
        module: MODULE_NAME, method: 'createLock',
        message: 'Key must be provided',
        detailedMessages: { tenantID, entity, key, type }
      });
    }
    // Build lock
    const lock: Lock = {
      id: Utils.hash(`${tenantID}~${entity}~${key.toLowerCase()}~${type}`),
      tenantID,
      entity: entity,
      key: key.toLowerCase(),
      type: type,
      timestamp: new Date(),
      hostname: Utils.getHostName()
    };
    // Set expiration date
    if (lockValiditySecs > 0) {
      lock.expirationDate = new Date(lock.timestamp.getTime() + (lockValiditySecs * 1000));
    }
    // Return the built lock
    return lock;
  }

  private static async acquireExclusiveLock(lock: Lock, timeoutSecs: number): Promise<void> {
    if (timeoutSecs > 0) {
      const timeoutDateMs = Date.now() + (timeoutSecs * 1000);
      do {
        try {
          await LockingStorage.insertLock(lock);
          return;
        } catch {
          // Wait before trying to get the next lock
          Utils.isDevelopmentEnv() && Logging.logConsoleWarning(`>> Lock failed, Wait for ${Constants.LOCK_WAIT_MILLIS}ms, lock '${lock.tenantID}~${lock.entity}~${lock.key}`);
          await Utils.sleep(Constants.LOCK_WAIT_MILLIS);
        }
      } while (Date.now() < timeoutDateMs);
      throw Error(`Lock acquisition timeout ${timeoutSecs} secs reached`);
    } else {
      await LockingStorage.insertLock(lock);
    }
  }

  private static async checkAndReleaseExpiredLock(lock: Lock): Promise<boolean> {
    // Check if lock is existing with same ID:
    const lockInDB = await LockingStorage.getLock(lock.id);
    // Check if log is existing and expired
    if (lockInDB?.expirationDate && lockInDB.expirationDate.getTime() < new Date().getTime()) {
      try {
        // Remove the lock
        await LockingManager.release(lockInDB);
        await Logging.logWarning({
          tenantID: lock.tenantID,
          module: MODULE_NAME, method: 'acquire',
          action: ServerAction.LOCKING,
          message: `The lock '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID ${lock.tenantID} has expired and was released successfully`,
          detailedMessages: { lock }
        });
        Utils.isDevelopmentEnv() && Logging.logConsoleWarning(`The lock '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID ${lock.tenantID} has expired and was released successfully`);
        return true;
      } catch (error) {
        await Logging.logError({
          tenantID: lock.tenantID,
          module: MODULE_NAME, method: 'acquire',
          action: ServerAction.LOCKING,
          message: `The lock '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID ${lock.tenantID} has expired and cannot be released`,
          detailedMessages: { lock, error: error.stack }
        });
        Utils.isDevelopmentEnv() && Logging.logConsoleError(`The lock '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID ${lock.tenantID} has expired and cannot be released`);
      }
    }
    return false;
  }
}

import cfenv from 'cfenv';
import os from 'os';
import global from '../../types/GlobalType';
import Lock from '../../types/Lock';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import { ObjectID } from 'mongodb';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'LockingStorage';

export default class LockingStorage {
  public static async getLocks(): Promise<Lock[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getLocks');
    const aggregation = [];
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Read DB
    const locksMDB = await global.database.getCollection<Lock>(Constants.DEFAULT_TENANT, 'locks')
      .aggregate(aggregation)
      .toArray();
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getLocks', uniqueTimerID);
    // Ok
    return locksMDB;
  }

  public static async getLockStatus(lockToTest: Lock, lockOnMultipleHosts = true): Promise<boolean> {
    //  Check
    const locks = await LockingStorage.getLocks();
    const lockFound: Lock = locks.find((lock: Lock): boolean => {
      if (lockOnMultipleHosts) {
        // Same keyHash
        return (lockToTest.keyHash === lock.keyHash);
      }
      // Same keyHash and hostname
      return ((lockToTest.keyHash === lock.keyHash) &&
          (lockToTest.hostname === lock.hostname));
    });
    if (lockFound) {
      return true;
    }
    return false;
  }

  public static async cleanLocks(hostname = Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname()): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'cleanLocks');
    // Delete
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
      .deleteMany({ hostname: hostname });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'cleanLocks', uniqueTimerID);
  }

  public static async saveRunLock(runLockToSave: Lock): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveRunLock');
    // Transfer
    const runLockMDB = {
      _id: runLockToSave.id ? Utils.convertToObjectID(runLockToSave.id) : new ObjectID(),
      keyHash: runLockToSave.keyHash,
      name: runLockToSave.name,
      type: runLockToSave.type,
      timestamp: Utils.convertToDate(runLockToSave.timestamp),
      hostname: runLockToSave.hostname
    };
    // Create
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
      .insertOne(runLockMDB);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveRunLock', uniqueTimerID, { runLock: runLockToSave });
  }

  public static async deleteRunLock(keyHash: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'deleteRunLock');
    // Delete
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
      .findOneAndDelete({ 'keyHash': keyHash });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'deleteRunLock', uniqueTimerID, { keyHash });
  }
}

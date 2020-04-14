import cfenv from 'cfenv';
import os from 'os';
import global from '../../types/GlobalType';
import Lock from '../../types/Lock';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import DatabaseUtils from './DatabaseUtils';

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
        // Same name and type
        return ((lockToTest.name === lock.name) &&
          (lockToTest.type === lock.type));
      }
      // Same name, hostname and type
      return ((lockToTest.name === lock.name) &&
          (lockToTest.type === lock.type)) &&
          (lockToTest.hostname === lock.hostname);

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

  // pragma static async getRunLocks() {
  //   // Debug
  //   const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getRunLocks');
  //   // Read DB
  //   const runLocksMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
  //     .find({ type: 'runLock' })
  //     .toArray();
  //   const runLocks = [];
  //   // Check
  //   if (runLocksMDB && runLocksMDB.length > 0) {
  //     for (const runLockMDB of runLocksMDB) {
  //       const runLock = {};
  //       // Set values
  //       Database.updateRunLock(runLockMDB, runLock, false);
  //       // Add
  //       runLocks.push(runLock);
  //     }
  //   }
  //   // Debug
  //   Logging.traceEnd(MODULE_NAME, 'getRunLocks', uniqueTimerID);
  //   // Ok
  //   return runLocks;
  // }

  public static async saveRunLock(runLockToSave: Lock): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveRunLock');
    // Transfer
    const runLockMDB = {
      _id: runLockToSave.id ? runLockToSave.id : `${runLockToSave.name}~${runLockToSave.type}`,
      name: runLockToSave.name,
      type: runLockToSave.type,
      timestamp: Utils.convertToDate(runLockToSave.timestamp),
      hostname: Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname()
    };
    // Create
    const result = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
      .insertOne(runLockMDB);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveRunningMigration', uniqueTimerID, { runLock: runLockToSave });
    return runLockMDB._id;
  }

  public static async deleteRunLock(id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'deleteRunLock');
    // Delete
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
      .findOneAndDelete({ '_id': id });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'deleteRunLock', uniqueTimerID, { id });
  }
}

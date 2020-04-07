import cfenv from 'cfenv';
import os from 'os';
import global from '../../types/GlobalType';
import Lock from '../../types/Lock';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import Logging from '../../utils/Logging';
import DatabaseUtils from './DatabaseUtils';

export default class LockingStorage {
  public static async getLocks(): Promise<Lock[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart('LockingStorage', 'getLocks');
    const aggregation = [];
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Read DB
    const locksMDB = await global.database.getCollection<Lock>(Constants.DEFAULT_TENANT, 'locks')
      .aggregate(aggregation)
      .toArray();
    // Debug
    Logging.traceEnd('LockingStorage', 'getLocks', uniqueTimerID);
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
    const uniqueTimerID = Logging.traceStart('LockingStorage', 'cleanLocks');
    // Delete
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
      .deleteMany({ hostname: hostname });
    // Debug
    Logging.traceEnd('LockingStorage', 'cleanLocks', uniqueTimerID);
  }

  // pragma static async getRunLocks() {
  //   // Debug
  //   const uniqueTimerID = Logging.traceStart('LockingStorage', 'getRunLocks');
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
  //   Logging.traceEnd('LockingStorage', 'getRunLocks', uniqueTimerID);
  //   // Ok
  //   return runLocks;
  // }

  public static async saveRunLock(runLockToSave): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('LockingStorage', 'saveRunLock');
    // Transfer
    const runLock: Lock = { _id: '', name: '', type: '', timestamp: null, hostname: '' };
    Database.updateRunLock(runLockToSave, runLock, false);
    // Set the ID
    runLock._id = runLock.name + '~' + runLock.type;
    // Create
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
      .insertOne(runLock);
    // Debug
    Logging.traceEnd('LockingStorage', 'saveRunningMigration', uniqueTimerID, { runLock: runLock });
  }

  public static async deleteRunLock(runLockToDelete): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('LockingStorage', 'deleteRunLock');
    // Transfer
    const runLock: Lock = { _id: '', name: '', type: '', timestamp: null, hostname: '' };
    Database.updateRunLock(runLockToDelete, runLock, false);
    // Set the ID
    runLock._id = runLock.name + '~' + runLock.type;
    // Delete
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
      .deleteOne(runLock);
    // Debug
    Logging.traceEnd('LockingStorage', 'deleteRunLock', uniqueTimerID, { runLock: runLock });
  }
}

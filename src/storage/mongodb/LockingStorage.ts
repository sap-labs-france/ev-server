import cfenv from 'cfenv';
import os from 'os';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import TSGlobal from '../../types/GlobalType';
import Lock from '../../types/Lock';
import Logging from '../../utils/Logging';

declare const global: TSGlobal;

export default class LockingStorage {
  public static async getLocks(): Promise<any[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart('LockingStorage', 'getLocks');
    // Read DB
    const locksMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
      .find({})
      .toArray();
    const locks = [];
    // Check
    if (locksMDB && locksMDB.length > 0) {
      for (const lockMDB of locksMDB) {
        const lock = {};
        // Set values
        Database.updateLock(lockMDB, lock, false);
        // Add
        locks.push(lock);
      }
    }
    // Debug
    Logging.traceEnd('LockingStorage', 'getLocks', uniqueTimerID);
    // Ok
    return locks;
  }

  public static async getLockStatus(lockToTest, lockOnMultipleHosts = true): Promise<boolean> {
    //  Check
    const locks = await LockingStorage.getLocks();
    const lockStatus = locks.find((lock): boolean => {
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
    return lockStatus;
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

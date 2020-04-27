import global from '../../types/GlobalType';
import Lock from '../../types/Lock';
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
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'tenantID');
    // Read DB
    const locksMDB = await global.database.getCollection<Lock>(Constants.DEFAULT_TENANT, 'locks')
      .aggregate(aggregation)
      .toArray();
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getLocks', uniqueTimerID);
    // Ok
    return locksMDB;
  }

  public static async insertLock(lockToSave: Lock): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveLock');
    // Transfer
    const lockMDB = {
      _id: lockToSave.id,
      tenantID: lockToSave.tenantID !== Constants.DEFAULT_TENANT ? Utils.convertToObjectID(lockToSave.tenantID) : null,
      name: lockToSave.name,
      type: lockToSave.type,
      timestamp: Utils.convertToDate(lockToSave.timestamp),
      hostname: lockToSave.hostname
    };
    // Create
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
      .insertOne(lockMDB);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveLock', uniqueTimerID, { lock: lockToSave });
  }

  public static async deleteLock(lockToDelete: Lock): Promise<number> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'deleteLock');
    // Delete
    const result = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
      .findOneAndDelete({ '_id': lockToDelete.id });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'deleteLock', uniqueTimerID, { lock: lockToDelete });
    return result.ok;
  }
}

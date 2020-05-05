import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import { Migration } from '../../types/Migration';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'MigrationStorage';

export default class MigrationStorage {
  static async getMigrations(): Promise<Migration[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getMigrations');
    const aggregation = [];
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Read DB
    const migrationsMDB = await global.database.getCollection<Migration>(Constants.DEFAULT_TENANT, 'migrations')
      .aggregate(aggregation)
      .toArray();
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getMigrations', uniqueTimerID);
    return migrationsMDB;
  }

  static async saveMigration(migrationToSave: Migration) {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveMigration');
    // Transfer
    const migrationMDB = {
      // FIXME: add an MongoDB ObjectID field. All records in the DB must have one.
      _id: `${migrationToSave.name}~${migrationToSave.version}`,
      timestamp: Utils.convertToDate(migrationToSave.timestamp),
      name: migrationToSave.name,
      version: migrationToSave.version,
      durationSecs: Utils.convertToFloat(migrationToSave.durationSecs)
    };
    // Create
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'migrations')
      .insertOne(migrationMDB);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveMigration', uniqueTimerID);
  }
}

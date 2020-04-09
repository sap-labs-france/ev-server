import global from '../../types/GlobalType';
import { Migration } from '../../types/Migration';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import DatabaseUtils from './DatabaseUtils';

export default class MigrationStorage {
  static async getMigrations(): Promise<Migration[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart('MigrationStorage', 'getMigrations');
    const aggregation = [];
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Read DB
    const migrationsMDB = await global.database.getCollection<Migration>(Constants.DEFAULT_TENANT, 'migrations')
      .aggregate(aggregation)
      .toArray();
    // Debug
    Logging.traceEnd('MigrationStorage', 'getMigrations', uniqueTimerID);
    return migrationsMDB;
  }

  static async saveMigration(migrationToSave: Migration) {
    // Debug
    const uniqueTimerID = Logging.traceStart('MigrationStorage', 'saveMigration');
    // Transfer
    const migrationMDB = {
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
    Logging.traceEnd('MigrationStorage', 'saveMigration', uniqueTimerID);
  }
}

import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import { Migration } from '../../types/Migration';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'MigrationStorage';

export default class MigrationStorage {
  public static async getMigrations(): Promise<Migration[]> {
    const startTime = Logging.traceDatabaseRequestStart();
    const aggregation = [];
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Read DB
    const migrationsMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'migrations')
      .aggregate<any>(aggregation)
      .toArray() as Migration[];
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getMigrations', startTime, aggregation, migrationsMDB);
    return migrationsMDB;
  }

  public static async saveMigration(migrationToSave: Migration): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Transfer
    const migrationMDB = {
      // FIXME: Use a hash like in other collections
      _id: `${migrationToSave.name}~${migrationToSave.version}`,
      timestamp: Utils.convertToDate(migrationToSave.timestamp),
      name: migrationToSave.name,
      version: migrationToSave.version,
      durationSecs: Utils.convertToFloat(migrationToSave.durationSecs)
    };
    // Create
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'migrations')
      .insertOne(migrationMDB);
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'saveMigration', startTime, migrationMDB);
  }
}

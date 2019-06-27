import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import TSGlobal from '../../types/GlobalType';
import Logging from '../../utils/Logging';

declare const global: TSGlobal;

export default class MigrationStorage {
  static async getMigrations() {
    // Debug
    const uniqueTimerID = Logging.traceStart('MigrationStorage', 'getMigrations');
    // Read DB
    const migrationsMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'migrations')
      .find({})
      .toArray();
    const migrations = [];
    // Check
    if (migrationsMDB && migrationsMDB.length > 0) {
      for (const migrationMDB of migrationsMDB) {
        const migration: any = {};
        // Set values
        Database.updateMigration(migrationMDB, migration, false);
        // Add
        migrations.push(migration);
      }
    }
    // Debug
    Logging.traceEnd('MigrationStorage', 'getMigrations', uniqueTimerID);
    // Ok
    return migrations;
  }

  static async saveMigration(migrationToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('MigrationStorage', 'saveMigration');

    // Transfer
    const migration: any = {};
    Database.updateMigration(migrationToSave, migration, false);
    // Set the ID
    migration._id = migration.name + '~' + migration.version;
    // Create
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'migrations')
      .insertOne(migration);
    // Debug
    Logging.traceEnd('MigrationStorage', 'saveMigration', uniqueTimerID, { migration });
  }
}

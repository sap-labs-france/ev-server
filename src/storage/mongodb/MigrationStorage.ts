import Database from '../../utils/Database';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import TSGlobal from '../../types/GlobalType';
import Configuration from '../../utils/Configuration';
import cfenv from 'cfenv';
import os from 'os';

declare var global: TSGlobal;

export default class MigrationStorage {
  static async getMigrations() {
    // Debug
    const uniqueTimerID = Logging.traceStart('MigrationStorage', 'getMigrations');
    // Read DB
    const migrationsMDB = await global.database.getCollection(Constants.DEFAULT_TENANT, 'migrations')
      .find({})
      .toArray();
    const migrations = [];
    // Check
    if (migrationsMDB && migrationsMDB.length > 0) {
      for (const migrationMDB of migrationsMDB) {
        const migration: any = {};
        // Set values
        Database.updateMigration(migrationMDB, migration);
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
    migration._id = migration.name + "~" + migration.version;
    // Create
    await global.database.getCollection(Constants.DEFAULT_TENANT, 'migrations')
      .insertOne(migration);
    // Debug
    Logging.traceEnd('MigrationStorage', 'saveMigration', uniqueTimerID, { migration });
  }

  static async getRunningMigrations() {
    // Debug
    const uniqueTimerID = Logging.traceStart('MigrationStorage', 'getRunningMigrations');
    // Read DB
    const runningMigrationsMDB = await global.database.getCollection(Constants.DEFAULT_TENANT, 'runningmigrations')
      .find({})
      .toArray();
    const runningMigrations = [];
    // Check
    if (runningMigrationsMDB && runningMigrationsMDB.length > 0) {
      for (const runningMigrationMDB of runningMigrationsMDB) {
        const runningMigration = {};
        // Set values
        Database.updateRunningMigration(runningMigrationMDB, runningMigration);
        // Add
        runningMigrations.push(runningMigration);
      }
    }
    // Debug
    Logging.traceEnd('MigrationStorage', 'getMigrations', uniqueTimerID);
    // Ok
    return runningMigrations;
  }

  static async saveRunningMigration(migrationToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('MigrationStorage', 'saveRunningMigration');
    // Transfer
    const migration: any = {};
    Database.updateRunningMigration(migrationToSave, migration, false);
    // Set the ID
    migration._id = migration.name + "~" + migration.version;
    // Create
    await global.database.getCollection(Constants.DEFAULT_TENANT, 'runningmigrations')
      .insertOne(migration);
    // Debug
    Logging.traceEnd('MigrationStorage', 'saveRunningMigration', uniqueTimerID, { migration });
  }

  static async deleteRunningMigration(migrationToDelete) {
    // Debug
    const uniqueTimerID = Logging.traceStart('MigrationStorage', 'deleteRunningMigration');
    // Transfer
    const migration: any = {};
    Database.updateRunningMigration(migrationToDelete, migration, false);
    // Set the ID
    migration._id = migration.name + "~" + migration.version;
    // Delete
    await global.database.getCollection(Constants.DEFAULT_TENANT, 'runningmigrations')
      .deleteOne(migration);
    // Debug
    Logging.traceEnd('MigrationStorage', 'deleteRunningMigration', uniqueTimerID, { migration });
  }

  static async cleanRunningMigrations(hostname = Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname()) {
    // Debug
    const uniqueTimerID = Logging.traceStart('MigrationStorage', 'cleanRunningMigrations');
    // Delete
    await global.database.getCollection(Constants.DEFAULT_TENANT, 'runningmigrations')
      .deleteMany({ hostname: hostname });
    // Debug
    Logging.traceEnd('MigrationStorage', 'cleanRunningMigrations', uniqueTimerID);
  }
}



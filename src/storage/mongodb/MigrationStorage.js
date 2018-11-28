const uuid = require('uuid/v4');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const Constants = require('../../utils/Constants');
const Logging = require('../../utils/Logging');

class MigrationStorage {
  static async getMigrations() {
    // Debug
    const uniqueTimerID = uuid();
    Logging.traceStart('MigrationStorage', 'getMigrations', uniqueTimerID);
    // Read DB
    const migrationsMDB = await global.database.getCollection(Constants.DEFAULT_TENANT, 'migrations')
      .find({})
      .toArray();
    const migrations = [];
    // Check
    if (migrationsMDB && migrationsMDB.length > 0) {
      for (const migrationMDB of migrationsMDB) {
        const migration = {};
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
    const uniqueTimerID = uuid();
    Logging.traceStart('MigrationStorage', 'saveMigration', uniqueTimerID);
    // Ensure Date
    migrationToSave.timestamp = Utils.convertToDate(migrationToSave.timestamp);
    // Transfer
    const migration = {};
    Database.updateMigration(migrationToSave, migration, false);
    // Set the ID
    migration._id = migrationToSave.name + "~" + migrationToSave.version;
    // Create
    await global.database.getCollection(Constants.DEFAULT_TENANT, 'migrations')
      .insertOne(migration);
    // Debug
    Logging.traceEnd('MigrationStorage', 'saveMigration', uniqueTimerID);
  }
}

module.exports = MigrationStorage;

const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const Constants = require('../../utils/Constants');

class MigrationStorage {
  static async getMigrations(){
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
    // Ok
    return migrations;
  }

  static async saveMigration(migrationToSave){
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
  }
}

module.exports = MigrationStorage;

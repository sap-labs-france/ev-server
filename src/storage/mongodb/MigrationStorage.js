const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');

class MigrationStorage {
	static async getMigrations() {
		// Read DB
		let migrationsMDB = await global.db.collection('migrations')
			.find({})
			.toArray();
		let migrations = [];
		// Check
		if (migrationsMDB && migrationsMDB.length > 0) {
			// Create
			migrationsMDB.forEach((migrationMDB) => {
				let migration = {};
				// Set values
				Database.updateMigration(migrationMDB, migration);
				// Add
				migrations.push(migration);
			});
		}
		// Ok
		return migrations;
	}

	static async saveMigration(migrationToSave) {
		// Ensure Date
		migrationToSave.timestamp = Utils.convertToDate(migrationToSave.timestamp);
		// Transfer
		let migration = {};
		Database.updateMigration(migrationToSave, migration, false);
		// Set the ID
		migration._id = migrationToSave.name + "~" + migrationToSave.version;
		// Create
		await global.db.collection('migrations')
			.insertOne(migration);
	}
}

module.exports = MigrationStorage;

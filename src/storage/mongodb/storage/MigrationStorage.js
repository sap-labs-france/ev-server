const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const crypto = require('crypto');

let _db;

class MigrationStorage {
	static setDatabase(db) {
		_db = db;
	}

	static async handleGetMigrations() {
		// Read DB
		let migrationsMDB = await _db.collection('migrations')
			.find({})
			.toArray();
		let migrations = [];
		// Create
		migrationsMDB.forEach((migrationMDB) => {
			let migration = {};
			// Set values
			Database.updateMigration(migrationMDB, migration);
			// Add
			migrations.push(migration);
		});
		// Ok
		return migrations;
	}

	static async handleSaveMigration(migrationToSave) {
		// Set the ID
		migrationToSave.id = migrationToSave.name + "~" + migrationToSave.version;
		// Ensure Date
		migrationToSave.timestamp = Utils.convertToDate(migrationToSave.timestamp);
		// Transfer
		let migration = {};
		Database.updateMigration(migrationToSave, migration, false);
		// Create
		await _db.collection('migrations')
			.insertOne(migration);
	}
}

module.exports = MigrationStorage;

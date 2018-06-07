const Database = require('../../utils/Database');
const ChargingStation = require('../../model/ChargingStation');
const moment = require('moment');

class DummyTask {
	migrate(config={}) {
		return new Promise((fulfill, reject) => {
			// Start time
			let startTaskTime = moment();

			// Execute the migration ------------------------------------------
			// -----------------------------------------------------------------

			// End time
			let totalTaskTimeSecs = moment.duration(moment().diff(startTaskTime)).asSeconds();

			// Ok
			fulfill({ "totalTaskTimeSecs": totalTaskTimeSecs });
		});
	}

	getVersion() {
		return "1";
	}

	getName() {
		return "DummyTask";
	}
}
module.exports=DummyTask;

const MigrationTask = require('../MigrationTask');

class MigrateStartStopTransactionTask extends MigrationTask {
  constructor() {
    super();
  }

  migrate() {
    // Return
    return new Promise((fulfill, reject) => {
      fulfill("Ok");
    });
  }

  getName() {
    return "StartStopTransaction";
  }

  getVersion() {
    return "1.0.0";
  }
}
module.exports=MigrateStartStopTransactionTask;

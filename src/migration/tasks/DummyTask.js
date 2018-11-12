const MigrationTask = require('../MigrationTask');

class DummyTask extends MigrationTask {
  migrate() {
  }

  getVersion() {
    return "1";
  }

  getName() {
    return "DummyTask";
  }
}
module.exports=DummyTask;

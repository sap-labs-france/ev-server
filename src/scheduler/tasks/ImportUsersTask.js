const Utils = require('../../utils/Utils');
const Logging = require('../../utils/Logging');

class ImportUsersTask {
    static run() {
      Logging.logInfo({
        userFullName: "System", source: "Central Server", module: "ImportUsersTask",
        method: "run", action: "ImportUsers",
        message: `The task 'importUsers' is being run` });

      try {
        // Import users
        Utils.importUsers();
      } catch (err) {
        // Log
        Logging.logError({
          userFullName: "System", source: "Central Server", module: "ImportUsersTask",
          method: "run", message: `Cannot import users: ${err.toString()}`,
          detailedMessages: err.stack });
      }
    }
}

module.exports=ImportUsersTask;

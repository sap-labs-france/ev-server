const Utils = require('../../../utils/Utils');

require('source-map-support').install();

class OCPPValidation {

  static validateHeartbeat(heartbeat) {
  }

  static validateStatusNotification(statusNotification) {
    // Check non mandatory timestamp
    if (!statusNotification.timestamp) {
      statusNotification.timestamp = new Date().toISOString();
    }
    // Always integer
    statusNotification.connectorId = Utils.convertToInt(statusNotification.connectorId);
  }
}

module.exports = OCPPValidation;

/* eslint-disable no-unused-vars */

class OCPPService {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
  }
  
  executeAuthorize(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeStartTransaction(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeStopTransaction(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeHeartbeat(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeMeterValues(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeBootNotification(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeStatusNotification(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeFirmwareStatusNotification(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeDiagnosticsStatusNotification(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeDataTransfer(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }
}

module.exports = OCPPService;
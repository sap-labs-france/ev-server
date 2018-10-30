const soap = require('strong-soap').soap;
const config = require('../../config');

class OCPPService {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
  }
  
  executeAuthorize(tenantID, chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeStartTransaction(tenantID, chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeStopTransaction(tenantID, chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeHeartbeat(tenantID, chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeMeterValues(tenantID, chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeBootNotification(tenantID, chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeStatusNotification(tenantID, chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeFirmwareStatusNotification(tenantID, chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeDiagnosticsStatusNotification(tenantID, chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  executeDataTransfer(tenantID, chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }
}

module.exports = OCPPService;
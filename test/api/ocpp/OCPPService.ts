/* eslint-disable no-unused-vars */

export default class OCPPService {
  public serverUrl: string;
  public constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }
  
  public executeAuthorize(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  public executeStartTransaction(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  public executeStopTransaction(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  public executeHeartbeat(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  public executeMeterValues(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  public executeBootNotification(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  public executeStatusNotification(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  public executeFirmwareStatusNotification(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  public executeDiagnosticsStatusNotification(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }

  public executeDataTransfer(chargeBoxIdentity, data) {
    throw new Error("Method not implemented!");
  }
}

// module.exports = OCPPService;
const uuid = require('uuid/v4');
const ChargingStationClient = require('../ChargingStationClient');

class JsonChargingStationClient16 extends ChargingStationClient {
  constructor(wsConnection) {
    super();
    this._wsConnection = wsConnection;
  }

  getChargeBoxId() {
    return this._wsConnection.getChargeBoxId();
  }

  startTransaction(params) {
    const { tagID, connectorID, chargingProfile = {} } = params;
    const payload = {
      connectorId: connectorID,
      idTag: tagID
    };
    if (chargingProfile !== null && Object.getOwnPropertyNames(chargingProfile).length > 0) {
      payload.chargingProfile = chargingProfile;
    }
    return this._wsConnection.sendMessage(uuid(), payload, 2, "RemoteStartTransaction");
  }

  reset(params) {
    const { type } = params;
    return this._wsConnection.sendMessage(uuid(), {
      type: type
    }, 2, "Reset");
  }

  clearCache() {
    return this._wsConnection.sendMessage(uuid(), {}, 2, "ClearCache");
  }

  getConfiguration(params) {
    const { keys } = params;
    return this._wsConnection.sendMessage(uuid(), ((keys === null) ? {} : {
      key: keys
    }), 2, "GetConfiguration");
  }

  changeConfiguration(params) {
    const { key, value } = params;
    return this._wsConnection.sendMessage(uuid(), {
      key: key,
      value: value
    }, 2, "ChangeConfiguration");
  }

  remoteStopTransaction(params) {
    const { transactionId } = params;
    return this._wsConnection.sendMessage(uuid(), {
      transactionId: transactionId
    }, 2, "RemoteStopTransaction");
  }

  unlockConnector(params) {
    const { connectorId } = params;
    return this._wsConnection.sendMessage(uuid(), {
      connectorId: connectorId
    }, 2, "UnlockConnector");
  }

  setChargingProfile(params) {
    return this._wsConnection.sendMessage(uuid(), params, 2, "SetChargingProfile");
  }

  getCompositeSchedule(params) {
    return this._wsConnection.sendMessage(uuid(), params, 2, "GetCompositeSchedule");
  }

  genericOCPPCommand(commandName, params) {
    return this._wsConnection.sendMessage(uuid(), params, 2, commandName);
  }

}

module.exports = JsonChargingStationClient16;

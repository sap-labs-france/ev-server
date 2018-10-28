const uuid = require('uuid/v4');
const ChargingStationClient = require('../ChargingStationClient');

const MODULE_NAME = "RemoteJsonChargingStationClient";

class RemoteJsonChargingStationClient {
  // constructor(chargingStation) {
  //   super();
  //   this._chargingStation = chargingStation;
  // }

  // async initialize() {
  //   // Create WS
  //   this.wsConnection = new WebSocket(chargingStation.getChargingStationURL(), {
  //     protocol: 'rest'
  //   });

  // }

  // getChargeBoxId() {
  //   return this._wsConnection.getChargeBoxId();
  // }

  // startTransaction(idTag, connectorId, chargingProfile = {}) {
  //   const payload = {
  //     connectorId: connectorId,
  //     idTag: idTag
  //   };
  //   if (chargingProfile !== null && Object.getOwnPropertyNames(chargingProfile).length > 0) {
  //     payload.chargingProfile = chargingProfile;
  //   }
  //   return this._wsConnection.sendMessage(uuid(), payload, 2, "RemoteStartTransaction");
  // }

  // reset(type) {
  //   return this._wsConnection.sendMessage(uuid(), {
  //     type: type
  //   }, 2, "Reset");
  // }

  // clearCache() {
  //   return this._wsConnection.sendMessage(uuid(), {}, 2, "ClearCache");
  // }

  // getConfiguration(keys) {
  //   return this._wsConnection.sendMessage(uuid(), ((keys === null) ? {} : {
  //     key: keys
  //   }), 2, "GetConfiguration");
  // }

  // changeConfiguration(key, value) {
  //   return this._wsConnection.sendMessage(uuid(), {
  //     key: key,
  //     value: value
  //   }, 2, "ChangeConfiguration");
  // }

  // stopTransaction(transactionId) {
  //   return this._wsConnection.sendMessage(uuid(), {
  //     transactionId: transactionId
  //   }, 2, "RemoteStopTransaction");
  // }

  // unlockConnector(connectorId) {
  //   return this._wsConnection.sendMessage(uuid(), {
  //     connectorId: connectorId
  //   }, 2, "UnlockConnector");
  // }
}

module.exports = RemoteJsonChargingStationClient;
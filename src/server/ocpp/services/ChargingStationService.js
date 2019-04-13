const ChargingStation = require('../../../entity/ChargingStation');
const BackendError = require('../../../exception/BackendError');
require('source-map-support').install();

/**
 * Interface of all services available in OCCP all versions
 * 
 * @class ChargingStationService 
 */
class ChargingStationService {
  // Common constructor for Central System Service
  constructor(centralSystemConfig, chargingStationConfig) {
    // Keep params
    this._centralSystemConfig = centralSystemConfig;
    this._chargingStationConfig = chargingStationConfig;
  }

  async _checkAndGetChargingStation(chargeBoxIdentity, tenantID) {
    // Get the charging station
    const chargingStation = await ChargingStation.getChargingStation(tenantID, chargeBoxIdentity);
    // Found?
    if (!chargingStation) {
      // Error
      throw new BackendError(chargeBoxIdentity, `Charging Station does not exist`,
        "ChargingStationService", "_checkAndGetChargingStation");
    }
    // Found?
    if (chargingStation.isDeleted()) {
      // Error
      throw new BackendError(chargeBoxIdentity, `Charging Station is deleted`,
        "ChargingStationService", "_checkAndGetChargingStation");
    }
    return chargingStation;
  }

  async handleBootNotification(payload) {
    // Error
    throw new BackendError(payload.chargeBoxIdentity, `Method not Implemented`,
      "ChargingStationService", "handleBootNotification", "BootNotification");
  }

  async handleHeartbeat(payload) {
    // Error
    throw new BackendError(payload.chargeBoxIdentity, `Method not Implemented`,
      "ChargingStationService", "handleHeartbeat", "Heartbeat");
  }

  async handleStatusNotification(payload) {
    // Error
    throw new BackendError(payload.chargeBoxIdentity, `Method not Implemented`,
      "ChargingStationService", "handleStatusNotification", "StatusNotification");
  }

  async handleMeterValues(payload) {
    // Error
    throw new BackendError(payload.chargeBoxIdentity, `Method not Implemented`,
      "ChargingStationService", "handleMeterValues", "MeterValues");
  }

  async handleAuthorize(payload) {
    // Error
    throw new BackendError(payload.chargeBoxIdentity, `Method not Implemented`,
      "ChargingStationService", "handleAuthorize", "Authorize");
  }

  async handleDiagnosticsStatusNotification(payload) {
    // Error
    throw new BackendError(payload.chargeBoxIdentity, `Method not Implemented`,
      "ChargingStationService", "handleDiagnosticsStatusNotification", "DiagnosticsStatusNotification");
  }

  async handleFirmwareStatusNotification(payload) {
    // Error
    throw new BackendError(payload.chargeBoxIdentity, `Method not Implemented`,
      "ChargingStationService", "handleFirmwareStatusNotification", "FirmwareStatusNotification");
  }

  async handleStartTransaction(payload) {
    // Error
    throw new BackendError(payload.chargeBoxIdentity, `Method not Implemented`,
      "ChargingStationService", "handleStartTransaction", "StartTransaction");
  }

  async handleDataTransfer(payload) {
    // Error
    throw new BackendError(payload.chargeBoxIdentity, `Method not Implemented`,
      "ChargingStationService", "handleDataTransfer", "DataTransfer");
  }

  async handleStopTransaction(payload) {
    // Error
    throw new BackendError(payload.chargeBoxIdentity, `Method not Implemented`,
      "ChargingStationService", "handleStopTransaction", "StopTransaction");
  }
}

module.exports = ChargingStationService;
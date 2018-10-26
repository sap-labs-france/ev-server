const ChargingStation = require('../../../model/ChargingStation');
const AppError = require('../../../exception/AppError');
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

  /**
   * Get the Charging Station object from ID
   *
   * @param {*} chargeBoxIdentity Charging Station ID 
   * @param {*} [tenant=null] Tenant
   * @returns a Charging Station object
   * @memberof ChargingStationService
   */
  async checkAndGetChargingStation(chargeBoxIdentity, tenant = null) {
    // Get the charging station
    const chargingStation = ((tenant !== null && tenant.lenght > 0) ?
      await ChargingStation.getChargingStation(tenant, chargeBoxIdentity) :
      await ChargingStation.getChargingStation(chargeBoxIdentity));
    // Found?
    if (!chargingStation) {
      throw new AppError(
        chargeBoxIdentity,
        `Charging Station does not exist`, 550,
        'CentralSystemServer', 'checkAndGetChargingStation');
    }
    // Found?
    if (chargingStation.isDeleted()) {
      throw new AppError(
        chargeBoxIdentity,
        `Charging Station is deleted`, 550,
        'CentralSystemServer', 'checkAndGetChargingStation');
    }
    return chargingStation;
  }

  async handleBootNotification(payload) {
    throw new Error("Method not Implemented");
  }

  async handleHeartbeat(payload) {
    throw new Error("Method not Implemented");
  }

  async handleStatusNotification(payload) {
    throw new Error("Method not Implemented");
  }

  async handleMeterValues(payload) {
    throw new Error("Method not Implemented");
  }

  async handleAuthorize(payload) {
    throw new Error("Method not Implemented");
  }

  async handleDiagnosticsStatusNotification(payload) {
    throw new Error("Method not Implemented");
  }

  async handleFirmwareStatusNotification(payload) {
    throw new Error("Method not Implemented");
  }

  async handleStartTransaction(payload) {
    throw new Error("Method not Implemented");
  }

  async handleDataTransfer(payload) {
    throw new Error("Method not Implemented");
  }

  async handleStopTransaction(payload) {
    throw new Error("Method not Implemented");
  }
}

module.exports = ChargingStationService;
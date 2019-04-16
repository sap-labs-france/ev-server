const BackendError = require('../../../exception/BackendError');
const Constants = require('../../../utils/Constants');

require('source-map-support').install();

class OCPPUtils {
  static lockAllConnectors(chargingStation) {
    chargingStation.getConnectors().forEach(async (connector) => {
      // Check
      if (connector.status === Constants.CONN_STATUS_AVAILABLE) {
        // Check OCPP Version
        if (chargingStation.getOcppVersion() === Constants.OCPP_VERSION_15) {
          // Set OCPP 1.5 Occupied
          connector.status = Constants.CONN_STATUS_OCCUPIED;
        } else {
          // Set OCPP 1.6 Unavailable
          connector.status = Constants.CONN_STATUS_UNAVAILABLE;
        }
      }
    });
  }

  static isSocMeterValue(meterValue) {
    return meterValue.attribute
      && (meterValue.attribute.context === 'Sample.Periodic'
        || meterValue.attribute.context === 'Transaction.Begin'
        || meterValue.attribute.context === 'Transaction.End')
      && meterValue.attribute.measurand === 'SoC';
  }

  static isConsumptionMeterValue(meterValue) {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === 'Energy.Active.Import.Register'
        && (meterValue.attribute.context === "Sample.Periodic" || meterValue.attribute.context === "Sample.Clock"));
  }

  static async checkAndGetChargingStation(chargeBoxIdentity, tenantID) {
    const ChargingStation = require('../../../entity/ChargingStation');
    // Get the charging station
    const chargingStation = await ChargingStation.getChargingStation(tenantID, chargeBoxIdentity);
    // Found?
    if (!chargingStation) {
      // Error
      throw new BackendError(chargeBoxIdentity, `Charging Station does not exist`,
        "OCPPUtils", "_checkAndGetChargingStation");
    }
    // Found?
    if (chargingStation.isDeleted()) {
      // Error
      throw new BackendError(chargeBoxIdentity, `Charging Station is deleted`,
        "OCPPUtils", "_checkAndGetChargingStation");
    }
    return chargingStation;
  }

  static async updateConnectorsPower(chargingStation) {
    let voltageRerefence = 0;
    let current = 0;
    let nbPhase = 0;
    let power = 0;
    let totalPower = 0;

    // Only for Schneider
    if (chargingStation.getChargePointVendor() === 'Schneider Electric') {
      // Get the configuration
      const configuration = await chargingStation.getConfiguration();
      // Config Provided?
      if (configuration && configuration.configuration) {
        // Search for params
        for (let i = 0; i < configuration.configuration.length; i++) {
          // Check
          switch (configuration.configuration[i].key) {
            // Voltage
            case 'voltagererefence':
              // Get the meter interval
              voltageRerefence = parseInt(configuration.configuration[i].value);
              break;

            // Current
            case 'currentpb1':
              // Get the meter interval
              current = parseInt(configuration.configuration[i].value);
              break;

            // Nb Phase
            case 'nbphase':
              // Get the meter interval
              nbPhase = parseInt(configuration.configuration[i].value);
              break;
          }
        }
        // Override?
        if (chargingStation.getNumberOfConnectedPhase()) {
          // Yes
          nbPhase = chargingStation.getNumberOfConnectedPhase();
        }
        // Compute it
        if (voltageRerefence && current && nbPhase) {
          // One Phase?
          if (nbPhase == 1) {
            power = Math.floor(230 * current);
          } else {
            power = Math.floor(400 * current * Math.sqrt(nbPhase));
          }
        }
      }
      // Set Power
      for (const connector of chargingStation.getConnectors()) {
        if (connector) {
          connector.power = power;
          totalPower += power;
        }
      }
      // Set total power
      if (totalPower && !chargingStation.getMaximumPower()) {
        // Set
        chargingStation.setMaximumPower(totalPower);
      }
    }
  }
}

module.exports = OCPPUtils;

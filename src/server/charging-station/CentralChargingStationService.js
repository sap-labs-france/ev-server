const ChargingStation = require('../../model/ChargingStation');
const AppError = require('../../exception/AppError');
const Logging = require('../../utils/Logging');
require('source-map-support').install();

let _centralSystemConfig;
let _chargingStationConfig;

/**
 * Implements basic functionnalities for OCPP 1.5 in regards to incoming request from Charge Box
 * @class CentralChargingStationService
 */
class CentralChargingStationService {
  // Common constructor for Central System Service
  constructor(centralSystemConfig, chargingStationConfig) {
    // Keep params
    _centralSystemConfig = centralSystemConfig;
    _chargingStationConfig = chargingStationConfig;
  }

  get chargingStationConfig() {
    return _chargingStationConfig;
  }


  /**
   * Get the Charging Station object from ID
   *
   * @param {*} chargeBoxIdentity Charging Station ID 
   * @param {*} [tenant=null] Tenant
   * @returns a Charging Station object
   * @memberof CentralChargingStationService
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

  /**
   * On bootNotification from charge box
   * It should create a charging station if it does not exist
   * Otherwise it will update existing stations with bmessage information
   * @param {*} content
   * @returns status, current time and heartbeatInterval in second
   * @memberof CentralChargingStationService
   */
  async handleBootNotification(content) {
    try {
      // Set the endpoint
      content.endpoint = content.From.Address;
      // Set the ChargeBox ID
      content.id = content.chargeBoxIdentity;
      // Set the default Heart Beat
      content.lastReboot = new Date();
      content.lastHeartBeat = content.lastReboot;
      content.timestamp = content.lastReboot;

      // Get the charging station
      let chargingStation = (content.hasOwnProperty('tenant') ?
        await ChargingStation.getChargingStation(content.chargeBoxIdentity, content.tenant) :
        await ChargingStation.getChargingStation(content.chargeBoxIdentity));
      if (!chargingStation) {
        // Save Charging Station
        chargingStation = new ChargingStation(content);
        // Set the URL = enpoint
        chargingStation.setChargingStationURL(chargingStation.getEndPoint());
        // Update timestamp
        chargingStation.setCreatedOn(new Date());
        chargingStation.setLastHeartBeat(new Date());
      } else {
        // Set the URL = enpoint
        if (!chargingStation.getChargingStationURL()) {
          chargingStation.setChargingStationURL(chargingStation.getEndPoint())
        }
        // Update data
        chargingStation.setChargePointVendor(content.chargePointVendor);
        chargingStation.setChargePointModel(content.chargePointModel);
        chargingStation.setChargePointSerialNumber(content.chargePointSerialNumber);
        chargingStation.setChargeBoxSerialNumber(content.chargeBoxSerialNumber);
        chargingStation.setFirmwareVersion(content.firmwareVersion);
        chargingStation.setOcppVersion(content.ocppVersion);
        chargingStation.setLastHeartBeat(new Date());
        // Back again
        chargingStation.setDeleted(false);
      }
      // Save Charging Station
      const updatedChargingStation = await chargingStation.save();
      // Save the Boot Notification
      await updatedChargingStation.handleBootNotification(content);
      // Return the result
      return {
        'bootNotificationResponse': {
          'status': 'Accepted',
          'currentTime': new Date().toISOString(),
          'heartbeatInterval': _chargingStationConfig.heartbeatIntervalSecs
        }
      };
    } catch (error) {
      // Set the source
      error.source = content.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('BootNotification', error);
      // Reject
      return {
        'bootNotificationResponse': {
          'status': 'Rejected',
          'currentTime': new Date().toISOString(),
          'heartbeatInterval': _chargingStationConfig.heartbeatIntervalSecs
        }
      };
    }
  }

  async handleHeartbeat(content) {
    try {
      // Get the charging station
      const chargingStation = (content.hasOwnProperty('tenant') ?
        await ChargingStation.getChargingStation(content.chargeBoxIdentity, content.tenant) :
        await ChargingStation.getChargingStation(content.chargeBoxIdentity));
      // Save
      await chargingStation.handleHeartBeat();
      // Return			
      return {
        'heartbeatResponse': {
          'currentTime': chargingStation.getLastHeartBeat().toISOString()
        }
      };
    } catch (error) {
      // Set the source
      error.source = content.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('HeartBeat', error);
      // Send the response
      return {
        'heartbeatResponse': {
          'currentTime': new Date().toISOString()
        }
      };
    }
  }

  async handleStatusNotification(content) {
    try {
      // Get the charging station
      const chargingStation = (content.hasOwnProperty('tenant') ?
        await ChargingStation.getChargingStation(content.chargeBoxIdentity, content.tenant) :
        await ChargingStation.getChargingStation(content.chargeBoxIdentity));
      // Handle
      await chargingStation.handleStatusNotification(content);
      // Respond
      return {
        'statusNotificationResponse': {}
      };
    } catch (error) {
      // Set the source
      error.source = content.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('StatusNotification', error);
      // Return
      return {
        'statusNotificationResponse': {}
      };
    }
  }

  async handleMeterValues(content) {
    try {
      // Get the charging station
      const chargingStation = (content.hasOwnProperty('tenant') ?
        await ChargingStation.getChargingStation(content.chargeBoxIdentity, content.tenant) :
        await ChargingStation.getChargingStation(content.chargeBoxIdentity));
      // Save
      await chargingStation.handleMeterValues(content);
      // Return
      return {
        'meterValuesResponse': {}
      };
    } catch (error) {
      // Set the source
      error.source = content.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('MeterValues', error);
      // Response
      return {
        'meterValuesResponse': {}
      };
    }
  }

  async handleAuthorize(content) {
    try {
      // Get the charging station
      const chargingStation = (content.hasOwnProperty('tenant') ?
        await ChargingStation.getChargingStation(content.chargeBoxIdentity, content.tenant) :
        await ChargingStation.getChargingStation(content.chargeBoxIdentity));
      // Handle
      await chargingStation.handleAuthorize(content);
      // Return
      return {
        'authorizeResponse': {
          'idTagInfo': {
            'status': 'Accepted'
          }
        }
      };
    } catch (error) {
      // Set the source
      error.source = content.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('Authorize', error);
      return {
        'authorizeResponse': {
          'idTagInfo': {
            'status': 'Invalid'
          }
        }
      };
    }
  }

  async handleDiagnosticsStatusNotification(content) {
    try {
      // Get the charging station
      const chargingStation = (content.hasOwnProperty('tenant') ?
        await ChargingStation.getChargingStation(content.chargeBoxIdentity, content.tenant) :
        await ChargingStation.getChargingStation(content.chargeBoxIdentity));
      // Save
      await chargingStation.handleDiagnosticsStatusNotification(content);
      // Return
      return {
        'diagnosticsStatusNotificationResponse': {}
      };
    } catch (error) {
      // Set the source
      error.source = content.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('DiagnosticsStatusNotification', error);
      return {
        'diagnosticsStatusNotificationResponse': {}
      };
    }
  }

  async handleFirmwareStatusNotification(content) {
    try {
      // Get the charging station
      const chargingStation = (content.hasOwnProperty('tenant') ?
        await ChargingStation.getChargingStation(content.chargeBoxIdentity, content.tenant) :
        await ChargingStation.getChargingStation(content.chargeBoxIdentity));
      // Save
      await chargingStation.handleFirmwareStatusNotification(content);
      // Return
      return {
        'firmwareStatusNotificationResponse': {}
      };
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage('FirmwareStatusNotification', error);
      return {
        'firmwareStatusNotificationResponse': {}
      };
    }
  }

  async handleStartTransaction(content) {
    try {
      // Get the charging station
      const chargingStation = (content.hasOwnProperty('tenant') ?
        await ChargingStation.getChargingStation(content.chargeBoxIdentity, content.tenant) :
        await ChargingStation.getChargingStation(content.chargeBoxIdentity));
      // Save
      const transaction = await chargingStation.handleStartTransaction(content);
      // Return
      return {
        'startTransactionResponse': {
          'transactionId': transaction.id,
          'idTagInfo': {
            'status': 'Accepted'
          }
        }
      };
    } catch (error) {
      // Set the source
      error.source = content.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('StartTransaction', error);
      return {
        'startTransactionResponse': {
          'transactionId': 0,
          'idTagInfo': {
            'status': 'Invalid'
          }
        }
      };
    }
  }

  async handleDataTransfer(content) {
    try {
      // Get the charging station
      const chargingStation = (content.hasOwnProperty('tenant') ?
        await ChargingStation.getChargingStation(content.chargeBoxIdentity, content.tenant) :
        await ChargingStation.getChargingStation(content.chargeBoxIdentity));
      // Save
      await chargingStation.handleDataTransfer(content);
      // Return
      return {
        'dataTransferResponse': {
          'status': 'Accepted'
        }
      };
    } catch (error) {
      // Set the source
      error.source = content.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('DataTransfer', error);
      return {
        'dataTransferResponse': {
          'status': 'Rejected'
        }
      };
    }
  }

  async handleStopTransaction(content) {
    try {
      // Get the charging station
      const chargingStation = (content.hasOwnProperty('tenant') ?
        await ChargingStation.getChargingStation(content.chargeBoxIdentity, content.tenant) :
        await ChargingStation.getChargingStation(content.chargeBoxIdentity));
      // Handle
      await chargingStation.handleStopTransaction(content);
      // Success
      return {
        'stopTransactionResponse': {
          'idTagInfo': {
            'status': 'Accepted'
          }
        }
      };
    } catch (error) {
      // Set the source
      error.source = content.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('StopTransaction', error);
      // Error
      return {
        'stopTransactionResponse': {
          'idTagInfo': {
            'status': 'Invalid'
          }
        }
      };
    }
  }
}

module.exports = CentralChargingStationService;
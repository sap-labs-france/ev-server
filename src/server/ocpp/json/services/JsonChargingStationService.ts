import Constants from '../../../../utils/Constants';
import TSGlobal from '../../../../types/GlobalType';
import Logging from '../../../../utils/Logging';

declare const global: TSGlobal;

const MODULE_NAME = 'JsonChargingStationService';
export default class JsonChargingStationService {
  public chargingStationService: any;
  private chargingStationConfig: any;

  constructor(chargingStationConfig) {
    this.chargingStationConfig = chargingStationConfig;
    // Get the OCPP service
    this.chargingStationService = global.centralSystemJson.getChargingStationService(Constants.OCPP_VERSION_16);
  }

  async _handle(command, headers, payload) {
    try {
      // Handle
      return await this.chargingStationService['handle' + command](headers, payload);
    } catch (error) {
      Logging.logException(error, command, headers.chargeBoxIdentity, MODULE_NAME, command, headers.tenantID);
      throw error;
    }
  }

  async handleBootNotification(headers, payload) {
    // Forward
    const result = await this._handle('BootNotification', headers, payload);
    // Return the response
    return {
      'currentTime': result.currentTime,
      'status': result.status,
      'interval': result.heartbeatInterval
    };
  }

  async handleHeartbeat(headers, payload) {
    // Forward
    const result = await this._handle('Heartbeat', headers, payload);
    // Return the response
    return {
      'currentTime': result.currentTime
    };
  }

  async handleStatusNotification(headers, payload) {
    // Forward
    await this._handle('StatusNotification', headers, payload);
    // Return the response
    return {};
  }

  async handleMeterValues(headers, payload) {
    // Forward
    await this._handle('MeterValues', headers, payload);
    // Return the response
    return {};
  }

  async handleAuthorize(headers, payload) {
    // Forward
    const result = await this._handle('Authorize', headers, payload);
    // Return the response
    return {
      'idTagInfo': {
        'status': result.status
      }
    };
  }

  async handleDiagnosticsStatusNotification(headers, payload) {
    // Forward
    await this._handle('DiagnosticsStatusNotification', headers, payload);
    // Return the response
    return {};
  }

  async handleFirmwareStatusNotification(headers, payload) {
    // Forward
    await this._handle('FirmwareStatusNotification', headers, payload);
    // Return the response
    return {};
  }

  async handleStartTransaction(headers, payload) {
    // Forward
    const result = await this._handle('StartTransaction', headers, payload);
    // Return the response
    return {
      'transactionId': result.transactionId,
      'idTagInfo': {
        'status': result.status
      }
    };
  }

  async handleDataTransfer(headers, payload) {
    // Forward
    const result = await this._handle('DataTransfer', headers, payload);
    // Return the response
    return {
      'status': result.status
    };
  }

  async handleStopTransaction(headers, payload) {
    // Forward
    const result = await this._handle('StopTransaction', headers, payload);
    // Return the response
    return {
      'idTagInfo': {
        'status': result.status
      }
    };
  }
}


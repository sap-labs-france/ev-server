import ChargingStationConfiguration from '../../../../types/configuration/ChargingStationConfiguration';
import global from '../../../../types/GlobalType';
import { OCPPVersion } from '../../../../types/ocpp/OCPPServer';
import Logging from '../../../../utils/Logging';
import OCPPService from '../../services/OCPPService';

const MODULE_NAME = 'JsonChargingStationService';
export default class JsonChargingStationService {
  public chargingStationService: OCPPService;
  private chargingStationConfig: ChargingStationConfiguration;

  constructor(chargingStationConfig: ChargingStationConfiguration) {
    this.chargingStationConfig = chargingStationConfig;
    // Get the OCPP service
    this.chargingStationService = global.centralSystemJson.getChargingStationService(OCPPVersion.VERSION_16);
  }

  public async _handle(command, headers, payload) {
    try {
      // Handle
      return await this.chargingStationService['handle' + command](headers, payload);
    } catch (error) {
      Logging.logException(error, command, headers.chargeBoxIdentity, MODULE_NAME, command, headers.tenantID);
      throw error;
    }
  }

  public async handleBootNotification(headers, payload) {
    // Forward
    const result = await this._handle('BootNotification', headers, payload);
    // Return the response
    return {
      'currentTime': result.currentTime,
      'status': result.status,
      'interval': result.heartbeatInterval
    };
  }

  public async handleHeartbeat(headers, payload) {
    // Forward
    const result = await this._handle('Heartbeat', headers, payload);
    // Return the response
    return {
      'currentTime': result.currentTime
    };
  }

  public async handleStatusNotification(headers, payload) {
    // Forward
    await this._handle('StatusNotification', headers, payload);
    // Return the response
    return {};
  }

  public async handleMeterValues(headers, payload) {
    // Forward
    await this._handle('MeterValues', headers, payload);
    // Return the response
    return {};
  }

  public async handleAuthorize(headers, payload) {
    // Forward
    const result = await this._handle('Authorize', headers, payload);
    // Return the response
    return {
      'idTagInfo': {
        'status': result.status
      }
    };
  }

  public async handleDiagnosticsStatusNotification(headers, payload) {
    // Forward
    await this._handle('DiagnosticsStatusNotification', headers, payload);
    // Return the response
    return {};
  }

  public async handleFirmwareStatusNotification(headers, payload) {
    // Forward
    await this._handle('FirmwareStatusNotification', headers, payload);
    // Return the response
    return {};
  }

  public async handleStartTransaction(headers, payload) {
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

  public async handleDataTransfer(headers, payload) {
    // Forward
    const result = await this._handle('DataTransfer', headers, payload);
    // Return the response
    return {
      'status': result.status
    };
  }

  public async handleStopTransaction(headers, payload) {
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


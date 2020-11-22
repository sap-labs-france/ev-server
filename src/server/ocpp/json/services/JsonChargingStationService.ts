import ChargingStationConfiguration from '../../../../types/configuration/ChargingStationConfiguration';
import Logging from '../../../../utils/Logging';
import OCPPService from '../../services/OCPPService';
import { OCPPVersion } from '../../../../types/ocpp/OCPPServer';
import global from '../../../../types/GlobalType';

const MODULE_NAME = 'JsonChargingStationService';

export default class JsonChargingStationService {
  public chargingStationService: OCPPService;
  private chargingStationConfig: ChargingStationConfiguration;

  constructor(chargingStationConfig: ChargingStationConfiguration) {
    this.chargingStationConfig = chargingStationConfig;
    // Get the OCPP service
    this.chargingStationService = global.centralSystemJsonServer.getChargingStationService(OCPPVersion.VERSION_16);
  }

  public async handleBootNotification(headers, payload): Promise<any> {
    // Forward
    const result = await this.handle('BootNotification', headers, payload);
    // Return the response
    return {
      currentTime: result.currentTime,
      status: result.status,
      interval: result.heartbeatInterval
    };
  }

  public async handleHeartbeat(headers, payload): Promise<any> {
    // Forward
    const result = await this.handle('Heartbeat', headers, payload);
    // Return the response
    return {
      currentTime: result.currentTime
    };
  }

  public async handleStatusNotification(headers, payload): Promise<any> {
    // Forward
    await this.handle('StatusNotification', headers, payload);
    // Return the response
    return {};
  }

  public async handleMeterValues(headers, payload): Promise<any> {
    // Forward
    await this.handle('MeterValues', headers, payload);
    // Return the response
    return {};
  }

  public async handleAuthorize(headers, payload): Promise<any> {
    // Forward
    const result = await this.handle('Authorize', headers, payload);
    // Return the response
    return {
      idTagInfo: {
        status: result.status
      }
    };
  }

  public async handleDiagnosticsStatusNotification(headers, payload): Promise<any> {
    // Forward
    await this.handle('DiagnosticsStatusNotification', headers, payload);
    // Return the response
    return {};
  }

  public async handleFirmwareStatusNotification(headers, payload): Promise<any> {
    // Forward
    await this.handle('FirmwareStatusNotification', headers, payload);
    // Return the response
    return {};
  }

  public async handleStartTransaction(headers, payload): Promise<any> {
    // Forward
    const result = await this.handle('StartTransaction', headers, payload);
    // Return the response
    return {
      transactionId: result.transactionId,
      idTagInfo: {
        status: result.status
      }
    };
  }

  public async handleDataTransfer(headers, payload): Promise<any> {
    // Forward
    const result = await this.handle('DataTransfer', headers, payload);
    // Return the response
    return {
      status: result.status
    };
  }

  public async handleStopTransaction(headers, payload): Promise<any> {
    // Forward
    const result = await this.handle('StopTransaction', headers, payload);
    // Return the response
    return {
      idTagInfo: {
        status: result.status
      }
    };
  }

  private async handle(command, headers, payload) {
    try {
      // Handle
      return await this.chargingStationService['handle' + command](headers, payload);
    } catch (error) {
      Logging.logException(error, command, headers.chargeBoxIdentity, MODULE_NAME, command, headers.tenantID);
      throw error;
    }
  }
}


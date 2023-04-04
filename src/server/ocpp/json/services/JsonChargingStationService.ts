import { OCPPAuthorizeRequest, OCPPAuthorizeResponse, OCPPBootNotificationRequest, OCPPBootNotificationResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPDiagnosticsStatusNotificationRequest, OCPPDiagnosticsStatusNotificationResponse, OCPPFirmwareStatusNotificationRequest, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatRequest, OCPPHeartbeatResponse, OCPPMeterValuesRequest, OCPPMeterValuesResponse, OCPPStartTransactionRequest, OCPPStartTransactionResponse, OCPPStatusNotificationRequest, OCPPStatusNotificationResponse, OCPPStopTransactionRequest, OCPPStopTransactionResponse, OCPPVersion } from '../../../../types/ocpp/OCPPServer';

import { Command } from '../../../../types/ChargingStation';
import Logging from '../../../../utils/Logging';
import { OCPPHeader } from '../../../../types/ocpp/OCPPHeader';
import OCPPService from '../../services/OCPPService';
import OCPPUtils from '../../utils/OCPPUtils';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import Utils from '../../../../utils/Utils';
import global from '../../../../types/GlobalType';

const MODULE_NAME = 'JsonChargingStationService';

export default class JsonChargingStationService {
  private chargingStationService: OCPPService;
  private limiters = [];

  public constructor() {
    // Get the OCPP service
    this.chargingStationService = global.centralSystemJsonServer.getChargingStationService(OCPPVersion.VERSION_16);
    const rateLimitersMap = Utils.getRateLimiters();
    const startStopTransactionLimiter = rateLimitersMap.get('StartStopTransaction');
    if (startStopTransactionLimiter) {
      this.limiters.push(startStopTransactionLimiter);
    }
    const startStopTransactionDDosLimiter = rateLimitersMap.get('StartStopTransactionDDOS');
    if (startStopTransactionDDosLimiter) {
      this.limiters.push(startStopTransactionDDosLimiter);
    }
  }

  public async handleBootNotification(headers: OCPPHeader, payload: OCPPBootNotificationRequest): Promise<OCPPBootNotificationResponse> {
    const result = await this.handle(Command.BOOT_NOTIFICATION, headers, payload);
    return {
      currentTime: result.currentTime,
      status: result.status,
      interval: result.interval
    };
  }

  public async handleHeartbeat(headers: OCPPHeader, payload: OCPPHeartbeatRequest): Promise<OCPPHeartbeatResponse> {
    const result = await this.handle(Command.HEARTBEAT, headers, payload);
    return {
      currentTime: result.currentTime
    };
  }

  public async handleStatusNotification(headers: OCPPHeader, payload: OCPPStatusNotificationRequest): Promise<OCPPStatusNotificationResponse> {
    await this.handle(Command.STATUS_NOTIFICATION, headers, payload);
    return {};
  }

  public async handleMeterValues(headers: OCPPHeader, payload: OCPPMeterValuesRequest): Promise<OCPPMeterValuesResponse> {
    await this.handle(Command.METER_VALUES, headers, payload);
    return {};
  }

  public async handleAuthorize(headers: OCPPHeader, payload: OCPPAuthorizeRequest): Promise<OCPPAuthorizeResponse> {
    const result: OCPPAuthorizeResponse = await this.handle(Command.AUTHORIZE, headers, payload);
    return {
      idTagInfo: {
        status: result.idTagInfo.status
      }
    };
  }

  public async handleDiagnosticsStatusNotification(headers: OCPPHeader, payload: OCPPDiagnosticsStatusNotificationRequest): Promise<OCPPDiagnosticsStatusNotificationResponse> {
    await this.handle(Command.DIAGNOSTICS_STATUS_NOTIFICATION, headers, payload);
    return {};
  }

  public async handleFirmwareStatusNotification(headers: OCPPHeader, payload: OCPPFirmwareStatusNotificationRequest): Promise<OCPPFirmwareStatusNotificationResponse> {
    await this.handle(Command.FIRMWARE_STATUS_NOTIFICATION, headers, payload);
    return {};
  }


  public async handleStartTransaction(headers: OCPPHeader, payload: OCPPStartTransactionRequest): Promise<OCPPStartTransactionResponse> {
    const { chargingStation, tenant } = headers;
    const key = { connector: payload.connectorId, tenant: tenant.subdomain, chargingStation: chargingStation.id } ;
    const keyString = `${key.connector}:${key.tenant}:${key.chargingStation}`;
    await this.checkRateLimiters(keyString);
    const result: OCPPStartTransactionResponse = await this.handle(Command.START_TRANSACTION, headers, payload);
    return {
      transactionId: result.transactionId,
      idTagInfo: {
        status: result.idTagInfo.status
      }
    };
  }

  public async handleDataTransfer(headers: OCPPHeader, payload: OCPPDataTransferRequest): Promise<OCPPDataTransferResponse> {
    const result: OCPPDataTransferResponse = await this.handle(Command.DATA_TRANSFER, headers, payload);
    return {
      status: result.status
    };
  }

  public async handleStopTransaction(headers: OCPPHeader, payload: OCPPStopTransactionRequest): Promise<OCPPStopTransactionResponse> {
    const { chargingStation, tenant } = headers;
    const key = { tenant: tenant.subdomain, chargingStation: chargingStation.id } ;
    const keyString = `${key.tenant}:${key.chargingStation}`;
    await this.checkRateLimiters(keyString);
    const result: OCPPStopTransactionResponse = await this.handle(Command.STOP_TRANSACTION, headers, payload);
    return {
      idTagInfo: {
        status: result.idTagInfo.status
      }
    };
  }

  private async handle(command: Command, headers: OCPPHeader, payload): Promise<any> {
    try {
      return this.chargingStationService[`handle${command}`](headers, payload) as Promise<any>;
    } catch (error) {
      Logging.logException(error, OCPPUtils.buildServerActionFromOcppCommand(command), MODULE_NAME, command, headers.tenantID);
      throw error;
    }
  }

  private async checkRateLimiters(key: string) {
    for (let i = 0; i < this.limiters.length; i++) {
      const limiter = this.limiters[i] as RateLimiterMemory;
      const points = limiter.points;
      const duration = limiter.duration;
      try {
        await this.limiters[i].consume(key);
      } catch (error) {
        throw new Error(`Rate limit exceeded: points : ${points} durations:${duration}`);
      }
    }
  }
}

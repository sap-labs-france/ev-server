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
  private limitersStartStopTransaction = new Array<RateLimiterMemory>();
  private limitersBootNotifs = new Array<RateLimiterMemory>();


  public constructor() {
    // Get the OCPP service
    this.chargingStationService = global.centralSystemJsonServer.getChargingStationService(OCPPVersion.VERSION_16);
    const rateLimitersMap = Utils.getRateLimiters();
    const startStopTransactionLimiterPerMin = rateLimitersMap.get('StartStopTransactionPerMin');
    if (startStopTransactionLimiterPerMin) {
      this.limitersStartStopTransaction.push(startStopTransactionLimiterPerMin);
    }
    const startStopTransactionLimiterPerHour = rateLimitersMap.get('StartStopTransactionPerHour');
    if (startStopTransactionLimiterPerHour) {
      this.limitersStartStopTransaction.push(startStopTransactionLimiterPerHour);
    }
    const bootNotifRateLimiterPerHour = rateLimitersMap.get('BootNotifPerHour');
    if (bootNotifRateLimiterPerHour) {
      this.limitersBootNotifs.push(bootNotifRateLimiterPerHour);
    }
    const bootNotifRateLimiterPerDay = rateLimitersMap.get('BootNotifPerDay');
    if (bootNotifRateLimiterPerDay) {
      this.limitersBootNotifs.push(bootNotifRateLimiterPerDay);
    }
  }

  public async handleBootNotification(headers: OCPPHeader, payload: OCPPBootNotificationRequest): Promise<OCPPBootNotificationResponse> {
    const { chargeBoxIdentity, tenant } = headers;
    const key = { tenant: tenant.subdomain, chargingStation: chargeBoxIdentity} ;
    const keyString = `${key.tenant}:${key.chargingStation}`;
    await this.checkRateLimiters(this.limitersBootNotifs, keyString);
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
    await this.checkRateLimiters(this.limitersStartStopTransaction, keyString);
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
    await this.checkRateLimiters(this.limitersStartStopTransaction, keyString);
    const result: OCPPStopTransactionResponse = await this.handle(Command.STOP_TRANSACTION, headers, payload);
    return {
      idTagInfo: {
        status: result.idTagInfo.status
      }
    };
  }

  private async handle(command: Command, headers: OCPPHeader, payload) {
    try {
      return this.chargingStationService[`handle${command}`](headers, payload);
    } catch (error) {
      await Logging.logException(error, OCPPUtils.buildServerActionFromOcppCommand(command), MODULE_NAME, command, headers.tenantID);
      throw error;
    }
  }

  private async checkRateLimiters(limiters: Array<RateLimiterMemory>, key: string) {
    for (let i = 0; i< limiters.length; i++) {
      const limiter = limiters[i];
      const points = limiter.points;
      const duration = limiter.duration;
      try {
        await this.limitersStartStopTransaction[i].consume(key);
      } catch (error) {
        throw new Error(`Rate limit exceeded: points : ${points} durations:${duration}`);
      }
    }
  }
}

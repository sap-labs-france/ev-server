import { OCPPAuthorizeRequest, OCPPAuthorizeResponse, OCPPBootNotificationRequest, OCPPBootNotificationResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPDiagnosticsStatusNotificationRequest, OCPPDiagnosticsStatusNotificationResponse, OCPPFirmwareStatusNotificationRequest, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatRequest, OCPPHeartbeatResponse, OCPPMeterValuesRequest, OCPPMeterValuesResponse, OCPPStartTransactionRequest, OCPPStartTransactionResponse, OCPPStatusNotificationRequest, OCPPStatusNotificationResponse, OCPPStopTransactionRequest, OCPPStopTransactionResponse, OCPPVersion } from '../../../../types/ocpp/OCPPServer';

import { Command } from '../../../../types/ChargingStation';
import { ServerAction } from '../../../../types/Server';
import Tenant from '../../../../types/Tenant';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import { OCPPHeader } from '../../../../types/ocpp/OCPPHeader';
import OCPPService from '../../services/OCPPService';
import OCPPUtils from '../../utils/OCPPUtils';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import Utils from '../../../../utils/Utils';
import global from '../../../../types/GlobalType';

const MODULE_NAME = 'JsonChargingStationService';
export default class JsonChargingStationService {
  private chargingStationService: OCPPService;
  private limitersStartStopTransaction = new Array<RateLimiterMemoryWithName>();
  private limitersBootNotifs = new Array<RateLimiterMemoryWithName>();

  public constructor() {
    // Get the OCPP service
    this.chargingStationService = global.centralSystemJsonServer.getChargingStationService(OCPPVersion.VERSION_16);
    const rateLimitersMap = Utils.getRateLimiters();
    let name : string;
    name = 'StartStopTransactionPerMin';
    const startStopTransactionLimiterPerMin = rateLimitersMap.get(name);
    if (startStopTransactionLimiterPerMin) {
      this.limitersStartStopTransaction.push({ name:name, limiter:startStopTransactionLimiterPerMin });
    }
    name = 'StartStopTransactionPerHour';
    const startStopTransactionLimiterPerHour = rateLimitersMap.get(name);
    if (startStopTransactionLimiterPerHour) {
      this.limitersStartStopTransaction.push({ name:name, limiter:startStopTransactionLimiterPerHour });
    }
    name = 'BootNotifPerHour';
    const bootNotifRateLimiterPerHour = rateLimitersMap.get(name);
    if (bootNotifRateLimiterPerHour) {
      this.limitersBootNotifs.push({ name:name, limiter: bootNotifRateLimiterPerHour });
    }
    name = 'BootNotifPerDay';
    const bootNotifRateLimiterPerDay = rateLimitersMap.get(name);
    if (bootNotifRateLimiterPerDay) {
      this.limitersBootNotifs.push({ name: name, limiter: bootNotifRateLimiterPerDay });
    }
  }

  public async handleBootNotification(headers: OCPPHeader, payload: OCPPBootNotificationRequest): Promise<OCPPBootNotificationResponse> {
    const { chargeBoxIdentity, tenant } = headers;
    const key = { tenant: tenant.subdomain, chargingStation: chargeBoxIdentity } ;
    const keyString = `${key.tenant}:${key.chargingStation}`;
    await this.checkRateLimiters(tenant, this.limitersBootNotifs, keyString);
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
    await this.checkRateLimiters(tenant, this.limitersStartStopTransaction, keyString);
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
    await this.checkRateLimiters(tenant,this.limitersStartStopTransaction, keyString);
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

  private async checkRateLimiters(tenant:Tenant,limiters: Array<RateLimiterMemoryWithName>, key: string) {
    for (let i = 0; i < limiters.length; i++) {
      const limiter = limiters[i].limiter;
      const limiterName = limiters[i].name;
      const points : number = limiter.points;
      let pointsPlusOne = points ;
      pointsPlusOne++;
      const duration = limiter.duration;
      try {
        await limiter.consume(key);
      } catch (error) {
        const rateLimiterRes = error as RateLimiterRes;
        if (rateLimiterRes.consumedPoints === pointsPlusOne) {
          await Logging.logError({
            tenantID: tenant.id,
            action: ServerAction.RATE_LIMITER,
            module: MODULE_NAME, method: 'checkRateLimiters',
            message: `RateLimiter ${limiterName} reached first time in windows`,
            detailedMessages : `key:${key} RateLimiterPoints:${points} RateLimiterDurations:${duration}`
          });
        }
        throw new Error(`RateLimiter:${limiterName} Rate limit exceeded: points:${points} durations:${duration}`);
      }
    }
  }
}

export interface RateLimiterMemoryWithName
{
  name : string;
  limiter : RateLimiterMemory
}

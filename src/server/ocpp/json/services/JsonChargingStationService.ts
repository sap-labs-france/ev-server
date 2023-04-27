import { OCPPAuthorizeRequest, OCPPAuthorizeResponse, OCPPBootNotificationRequest, OCPPBootNotificationResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPDiagnosticsStatusNotificationRequest, OCPPDiagnosticsStatusNotificationResponse, OCPPFirmwareStatusNotificationRequest, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatRequest, OCPPHeartbeatResponse, OCPPMeterValuesRequest, OCPPMeterValuesResponse, OCPPStartTransactionRequest, OCPPStartTransactionResponse, OCPPStatusNotificationRequest, OCPPStatusNotificationResponse, OCPPStopTransactionRequest, OCPPStopTransactionResponse, OCPPVersion } from '../../../../types/ocpp/OCPPServer';

import { Command } from '../../../../types/ChargingStation';
import Logging from '../../../../utils/Logging';
import { OCPPHeader } from '../../../../types/ocpp/OCPPHeader';
import OCPPService from '../../services/OCPPService';
import OCPPUtils from '../../utils/OCPPUtils';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { ServerAction } from '../../../../types/Server';
import Tenant from '../../../../types/Tenant';
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
      this.limitersStartStopTransaction.push({ name, limiter: startStopTransactionLimiterPerMin });
    }
    name = 'StartStopTransactionPerHour';
    const startStopTransactionLimiterPerHour = rateLimitersMap.get(name);
    if (startStopTransactionLimiterPerHour) {
      this.limitersStartStopTransaction.push({ name, limiter: startStopTransactionLimiterPerHour });
    }
    name = 'BootNotifPerHour';
    const bootNotifRateLimiterPerHour = rateLimitersMap.get(name);
    if (bootNotifRateLimiterPerHour) {
      this.limitersBootNotifs.push({ name, limiter: bootNotifRateLimiterPerHour });
    }
    name = 'BootNotifPerDay';
    const bootNotifRateLimiterPerDay = rateLimitersMap.get(name);
    if (bootNotifRateLimiterPerDay) {
      this.limitersBootNotifs.push({ name, limiter: bootNotifRateLimiterPerDay });
    }
  }

  public async handleBootNotification(headers: OCPPHeader, payload: OCPPBootNotificationRequest): Promise<OCPPBootNotificationResponse> {
    const { chargeBoxIdentity, connectionContext } = headers;
    const keyString = `${connectionContext.tenant.subdomain}:${chargeBoxIdentity}`;
    await this.checkRateLimiters(connectionContext.tenant, chargeBoxIdentity, this.limitersBootNotifs, keyString);
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
    const { connectionContext } = headers;
    const { chargingStation, tenant } = connectionContext;
    const key = { connector: payload.connectorId, tenant: tenant.subdomain, chargingStation: chargingStation.id } ;
    const keyString = `${key.connector}:${key.tenant}:${key.chargingStation}`;
    await this.checkRateLimiters(tenant, chargingStation.id, this.limitersStartStopTransaction, keyString);
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
    const { connectionContext } = headers;
    const { chargingStation, tenant } = connectionContext;
    const key = { tenant: tenant.subdomain, chargingStation: chargingStation.id } ;
    const keyString = `${key.tenant}:${key.chargingStation}`;
    await this.checkRateLimiters(tenant, chargingStation.id, this.limitersStartStopTransaction, keyString);
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
      Logging.logException(error as Error, OCPPUtils.buildServerActionFromOcppCommand(command), MODULE_NAME, command, headers.rawConnectionData?.tenantID);
      throw error;
    }
  }

  private async checkRateLimiters(tenant:Tenant, chargingStationId: string, limiters: Array<RateLimiterMemoryWithName>, key: string) {
    for (const rateLimiter of limiters) {
      const limiterName = rateLimiter.name;
      const limiter = rateLimiter.limiter;
      const points = limiter.points;
      const duration = limiter.duration;
      try {
        await limiter.consume(key);
      } catch (rateLimiterRes) {
        if (rateLimiterRes.consumedPoints === (points + 1)) {
          // Only log the first time we reach the limit in the current limiter window
          await Logging.logError({
            tenantID: tenant.id,
            chargingStationID:chargingStationId,
            action: ServerAction.RATE_LIMITER,
            module: MODULE_NAME, method: 'checkRateLimiters',
            message: `RateLimiter ${limiterName} reached for the key: ${key}`,
            detailedMessages : {
              rateLimiterPoints: points,
              rateLimiterDurations: duration
            }
          });
        }
        throw new Error(`RateLimiter: ${limiterName} - Rate limit exceeded - key: ${key} - points: ${points} - durations: ${duration}`);
      }
    }
  }
}

export interface RateLimiterMemoryWithName
{
  name : string;
  limiter : RateLimiterMemory
}

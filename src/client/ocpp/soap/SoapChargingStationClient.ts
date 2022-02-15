import ChargingStation, { Command } from '../../../types/ChargingStation';
import { OCPPCancelReservationRequest, OCPPCancelReservationResponse, OCPPChangeAvailabilityRequest, OCPPChangeAvailabilityResponse, OCPPChangeConfigurationRequest, OCPPChangeConfigurationResponse, OCPPClearCacheResponse, OCPPClearChargingProfileRequest, OCPPClearChargingProfileResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPGetCompositeScheduleRequest, OCPPGetCompositeScheduleResponse, OCPPGetConfigurationRequest, OCPPGetConfigurationResponse, OCPPGetDiagnosticsRequest, OCPPGetDiagnosticsResponse, OCPPRemoteStartTransactionRequest, OCPPRemoteStartTransactionResponse, OCPPRemoteStopTransactionRequest, OCPPRemoteStopTransactionResponse, OCPPReserveNowRequest, OCPPReserveNowResponse, OCPPResetRequest, OCPPResetResponse, OCPPSetChargingProfileRequest, OCPPSetChargingProfileResponse, OCPPUnlockConnectorRequest, OCPPUnlockConnectorResponse, OCPPUpdateFirmwareRequest } from '../../../types/ocpp/OCPPClient';

import ChargingStationClient from '../ChargingStationClient';
import Configuration from '../../../utils/Configuration';
import Logging from '../../../utils/Logging';
import { OCPPVersion } from '../../../types/ocpp/OCPPServer';
import { ServerAction } from '../../../types/Server';
import Tenant from '../../../types/Tenant';
import global from '../../../types/GlobalType';
import { soap } from 'strong-soap';

const MODULE_NAME = 'SoapChargingStationClient';

export default class SoapChargingStationClient extends ChargingStationClient {
  private chargingStation: ChargingStation;
  private tenant: Tenant;
  private client: any;
  private readonly wsdlEndpointConfig = Configuration.getWSDLEndpointConfig();

  private constructor(tenant: Tenant, chargingStation: ChargingStation) {
    super();
    // Keep the Charging Station
    this.chargingStation = chargingStation;
    this.tenant = tenant;
  }

  public static async getChargingStationClient(tenant: Tenant, chargingStation: ChargingStation): Promise<SoapChargingStationClient> {
    const scsc = new SoapChargingStationClient(tenant, chargingStation);
    return new Promise((fulfill, reject) => {
      let chargingStationWdsl = null;
      // Read the WSDL client files
      switch (scsc.chargingStation.ocppVersion) {
        case OCPPVersion.VERSION_15:
          chargingStationWdsl = `${global.appRoot}/assets/server/ocpp/wsdl/OCPPChargePointService15.wsdl`;
          break;
        case OCPPVersion.VERSION_16:
          chargingStationWdsl = `${global.appRoot}/assets/server/ocpp/wsdl/OCPPChargePointService16.wsdl`;
          break;
        default:
          // Log
          void Logging.logError({
            tenantID: scsc.tenant.id,
            action: ServerAction.CHARGING_STATION_CLIENT_INITIALIZATION,
            siteID: scsc.chargingStation.siteID,
            siteAreaID: scsc.chargingStation.siteAreaID,
            companyID: scsc.chargingStation.companyID,
            chargingStationID: scsc.chargingStation.id,
            module: MODULE_NAME, method: 'getChargingStationClient',
            message: `OCPP version ${scsc.chargingStation.ocppVersion} not supported`
          });
          reject(`OCPP version ${scsc.chargingStation.ocppVersion} not supported`);
      }
      // Client options
      const options: any = {};
      // Create SOAP client
      soap.createClient(chargingStationWdsl, options, async (error, client) => {
        if (error) {
          await Logging.logError({
            tenantID: scsc.tenant.id,
            action: ServerAction.CHARGING_STATION_CLIENT_INITIALIZATION,
            siteID: scsc.chargingStation.siteID,
            siteAreaID: scsc.chargingStation.siteAreaID,
            companyID: scsc.chargingStation.companyID,
            chargingStationID: scsc.chargingStation.id,
            module: MODULE_NAME, method: 'getChargingStationClient',
            message: `Error when creating SOAP client: ${error.message as string}`,
            detailedMessages: { error: error.stack }
          });
          reject(`Error when creating SOAP client for charging station with ID ${scsc.chargingStation.id}: ${error.message as string}`);
        } else {
          // Keep
          scsc.client = client;
          // Set endpoint
          scsc.client.setEndpoint(scsc.chargingStation.chargingStationURL);
          fulfill(scsc);
        }
      });
    });
  }

  public async remoteStopTransaction(params: OCPPRemoteStopTransactionRequest): Promise<OCPPRemoteStopTransactionResponse> {
    // Init SOAP Headers with the action
    this.initSoapHeaders(Command.REMOTE_STOP_TRANSACTION);
    // Trace
    const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, this.tenant,
      this.chargingStation.id, ServerAction.CHARGING_STATION_REMOTE_STOP_TRANSACTION,
      [params, { headers: this.client.getSoapHeaders() }], '<<', {
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
      }
    );
    // Execute
    const { error, result, envelope } = await this.client.RemoteStopTransaction({
      'remoteStopTransactionRequest': params
    });
    if (error) {
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.CHARGING_STATION_REMOTE_STOP_TRANSACTION,
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
        chargingStationID: this.chargingStation.id,
        module: MODULE_NAME, method: 'remoteStopTransaction',
        message: `Error when trying to stop the transaction ID ${params.transactionId}: ${error.message as string}`,
        detailedMessages: { 'error': error.stack, result, envelope }
      });
      throw error;
    }
    // Trace
    await Logging.traceOcppMessageResponse(MODULE_NAME, this.tenant, this.chargingStation.id,
      ServerAction.CHARGING_STATION_REMOTE_STOP_TRANSACTION,
      [params, { headers: this.client.getSoapHeaders() }], [{ result }, { envelope }], '>>', {
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
      }, performanceTracingData);
    return result;
  }

  public async remoteStartTransaction(params: OCPPRemoteStartTransactionRequest): Promise<OCPPRemoteStartTransactionResponse> {
    // Init SOAP Headers with the action
    this.initSoapHeaders(Command.REMOTE_START_TRANSACTION);
    // Trace
    const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, this.tenant, this.chargingStation.id, ServerAction.CHARGING_STATION_REMOTE_START_TRANSACTION,
      [params, { headers: this.client.getSoapHeaders() }], '<<', {
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
      }
    );
    // Execute
    const { error, result, envelope } = await this.client.RemoteStartTransaction(params);
    if (error) {
      // Log
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.CHARGING_STATION_REMOTE_START_TRANSACTION,
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
        chargingStationID: this.chargingStation.id,
        module: MODULE_NAME, method: 'remoteStartTransaction',
        message: `Error when trying to start a transaction: ${error.message as string}`,
        detailedMessages: { 'error': error.stack , result, envelope },
      });
      throw error;
    }
    // Trace
    await Logging.traceOcppMessageResponse(MODULE_NAME, this.tenant, this.chargingStation.id, ServerAction.CHARGING_STATION_REMOTE_START_TRANSACTION,
      [params, { headers: this.client.getSoapHeaders() }], [{ result }, { envelope }], '>>', {
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
      }, performanceTracingData);
    return result;
  }

  public async unlockConnector(params: OCPPUnlockConnectorRequest): Promise<OCPPUnlockConnectorResponse> {
    // Init SOAP Headers with the action
    this.initSoapHeaders(Command.UNLOCK_CONNECTOR);
    // Trace
    const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, this.tenant, this.chargingStation.id, ServerAction.CHARGING_STATION_UNLOCK_CONNECTOR,
      [params, { headers: this.client.getSoapHeaders() }], '<<', {
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
      }
    );
    // Execute
    const { error, result, envelope } = await this.client.UnlockConnector({
      'unlockConnectorRequest': params
    });
    if (error) {
      // Log
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.CHARGING_STATION_UNLOCK_CONNECTOR,
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
        chargingStationID: this.chargingStation.id,
        module: MODULE_NAME, method: 'unlockConnector',
        message: `Error when trying to unlock the connector '${params.connectorId}': ${error.message as string}`,
        detailedMessages: { 'error': error.stack , result, envelope }
      });
      throw error;
    }
    // Trace
    await Logging.traceOcppMessageResponse(MODULE_NAME, this.tenant, this.chargingStation.id, ServerAction.CHARGING_STATION_UNLOCK_CONNECTOR,
      [params, { headers: this.client.getSoapHeaders() }], [{ result }, { envelope }], '>>', {
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
      }, performanceTracingData);
    return result;
  }

  public async reset(params: OCPPResetRequest): Promise<OCPPResetResponse> {
    // Init SOAP Headers with the action
    this.initSoapHeaders(Command.RESET);
    // Trace
    const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, this.tenant, this.chargingStation.id, ServerAction.CHARGING_STATION_RESET,
      [params, { headers: this.client.getSoapHeaders() }], '<<', {
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
      }
    );
    // Execute
    const { error, result, envelope } = await this.client.Reset({
      'resetRequest': params
    });
    if (error) {
      // Log
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.CHARGING_STATION_RESET,
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
        chargingStationID: this.chargingStation.id,
        module: MODULE_NAME, method: 'reset',
        message: `Error when trying to reboot: ${error.message as string}`,
        detailedMessages: { 'error': error.stack , result, envelope }
      });
      return error;
    }
    // Trace
    await Logging.traceOcppMessageResponse(MODULE_NAME, this.tenant, this.chargingStation.id, ServerAction.CHARGING_STATION_RESET,
      [params, { headers: this.client.getSoapHeaders() }], [{ result }, { envelope }], '>>', {
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
      }, performanceTracingData);
    return result;
  }

  public async clearCache(): Promise<OCPPClearCacheResponse> {
    // Init SOAP Headers with the action
    this.initSoapHeaders(Command.CLEAR_CACHE);
    // Trace
    const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, this.tenant, this.chargingStation.id, ServerAction.CHARGING_STATION_CLEAR_CACHE,
      [{ headers: this.client.getSoapHeaders() }], '<<', {
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
      }
    );
    // Execute
    const { error, result, envelope } = await this.client.ClearCache({ clearCacheRequest: {} });
    if (error) {
      // Log
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.CHARGING_STATION_CLEAR_CACHE,
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
        chargingStationID: this.chargingStation.id,
        module: MODULE_NAME, method: 'clearCache',
        message: `Error when trying to clear the cache: ${error.message as string}`,
        detailedMessages: { 'error': error.stack , result, envelope }
      });
      throw error;
    }
    // Trace
    await Logging.traceOcppMessageResponse(MODULE_NAME, this.tenant, this.chargingStation.id, ServerAction.CHARGING_STATION_CLEAR_CACHE,
      [{}, { headers: this.client.getSoapHeaders() }], [{ result }, { envelope }], '>>', {
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
      }, performanceTracingData);
    return result;
  }

  public async getConfiguration(params: OCPPGetConfigurationRequest): Promise<OCPPGetConfigurationResponse> {
    // Init SOAP Headers with the action
    this.initSoapHeaders(Command.GET_CONFIGURATION);
    // Trace
    const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, this.tenant, this.chargingStation.id, ServerAction.CHARGING_STATION_GET_CONFIGURATION,
      [params, { headers: this.client.getSoapHeaders() }], '<<', {
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
      }
    );
    // Set request
    const request: { getConfigurationRequest: OCPPGetConfigurationRequest } = {
      'getConfigurationRequest': {}
    };
    // Key provided?
    if (params.key) {
      // Set the keys
      request.getConfigurationRequest.key = params.key;
    }
    // Execute
    const { error, result, envelope } = await this.client.GetConfiguration(request);
    if (error) {
      // Log
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.CHARGING_STATION_GET_CONFIGURATION,
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
        chargingStationID: this.chargingStation.id,
        module: MODULE_NAME, method: 'getConfiguration',
        message: `Error when trying to get the configuration: ${error.message as string}`,
        detailedMessages: { 'error': error.stack , result, envelope }
      });
      throw error;
    }
    // Trace
    await Logging.traceOcppMessageResponse(MODULE_NAME, this.tenant, this.chargingStation.id, ServerAction.CHARGING_STATION_GET_CONFIGURATION,
      [params, { headers: this.client.getSoapHeaders() }], [{ result }, { envelope }], '>>', {
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
      }, performanceTracingData);
    return result;
  }

  public async changeConfiguration(params: OCPPChangeConfigurationRequest): Promise<OCPPChangeConfigurationResponse> {
    const { key, value } = params;
    // Init SOAP Headers with the action
    this.initSoapHeaders(Command.CHANGE_CONFIGURATION);
    // Trace
    const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, this.tenant, this.chargingStation.id, ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
      [params, { headers: this.client.getSoapHeaders() }], '<<', {
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
      }
    );
    // Execute
    const { error, result, envelope } = await this.client.ChangeConfiguration({
      'changeConfigurationRequest': {
        'key': key,
        'value': value
      }
    });
    if (error) {
      // Log
      await Logging.logError({
        tenantID: this.tenant.id,
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
        chargingStationID: this.chargingStation.id,
        module: MODULE_NAME, method: 'changeConfiguration',
        action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
        message: `Error when trying to change the configuration parameter '${key}' with value '${value}': ${error.message as string}`,
        detailedMessages: { 'error': error.stack , result, envelope }
      });
      throw error;
    }
    // Trace
    await Logging.traceOcppMessageResponse(MODULE_NAME, this.tenant, this.chargingStation.id, ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
      [params, { headers: this.client.getSoapHeaders() }], [{ result }, { envelope }], '>>', {
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
      }, performanceTracingData);
    return result;
  }

  public getChargingStation(): ChargingStation {
    return this.chargingStation;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async setChargingProfile(params: OCPPSetChargingProfileRequest): Promise<OCPPSetChargingProfileResponse> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async getCompositeSchedule(params: OCPPGetCompositeScheduleRequest): Promise<OCPPGetCompositeScheduleResponse> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async clearChargingProfile(params: OCPPClearChargingProfileRequest): Promise<OCPPClearChargingProfileResponse> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async changeAvailability(params: OCPPChangeAvailabilityRequest): Promise<OCPPChangeAvailabilityResponse> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async getDiagnostics(params: OCPPGetDiagnosticsRequest): Promise<OCPPGetDiagnosticsResponse> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async updateFirmware(params: OCPPUpdateFirmwareRequest): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  // eslint-disable-next-line @typescript-eslint/require-await
  public async dataTransfer(params: OCPPDataTransferRequest): Promise<OCPPDataTransferResponse> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async reserveNow(params: OCPPReserveNowRequest): Promise<OCPPReserveNowResponse> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async cancelReservation(params: OCPPCancelReservationRequest): Promise<OCPPCancelReservationResponse> {
    throw new Error('Method not implemented.');
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  private getWSDLEndpointBaseSecureUrl() {
    return this.wsdlEndpointConfig?.baseSecureUrl;
  }

  private initSoapHeaders(command: Command) {
    // Clear the SOAP Headers`
    this.client.clearSoapHeaders();
    // Add them
    this.client.addSoapHeader(`<h:chargeBoxIdentity xmlns:h="urn://Ocpp/Cp/2012/06/">${this.chargingStation.id}</h:chargeBoxIdentity>`);
    this.client.addSoapHeader('<a:MessageID xmlns:a="http://www.w3.org/2005/08/addressing">urn:uuid:589e13ae-1787-49f8-ab8b-4567327b23c6</a:MessageID>');
    this.client.addSoapHeader('<a:ReplyTo xmlns:a="http://www.w3.org/2005/08/addressing"><a:Address>http://www.w3.org/2005/08/addressing/anonymous</a:Address></a:ReplyTo>');
    this.client.addSoapHeader(`<a:To xmlns:a="http://www.w3.org/2005/08/addressing">${this.chargingStation.chargingStationURL}</a:To>`);
    this.client.addSoapHeader(`<a:Action xmlns:a="http://www.w3.org/2005/08/addressing">/${command}</a:Action>`);
    this.client.addSoapHeader(`<a:From xmlns:a="http://www.w3.org/2005/08/addressing"><a:Address>${this.getWSDLEndpointBaseSecureUrl()}</a:Address></a:From>`);
  }
}

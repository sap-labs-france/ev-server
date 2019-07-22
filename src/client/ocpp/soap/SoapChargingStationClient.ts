import { soap } from 'strong-soap';
import ChargingStationClient from '../ChargingStationClient';
import Configuration from '../../../utils/Configuration';
import global from '../../../types/GlobalType';
import Logging from '../../../utils/Logging';
import ChargingStation from '../../../types/ChargingStation';

// Default Module name
const _moduleName = 'SoapChargingStationClient';
// Get the config
const _wsdlEndpointConfig = Configuration.getWSDLEndpointConfig();
export default class SoapChargingStationClient extends ChargingStationClient {
  public transactionId: number;
  public error: any;
  public result: any;
  public envelope: any;
  public tagID: string;
  public connectorID: any;
  public connectorId: any;
  public type: any;
  public keys: any;
  public key: any;
  public value: any;
  private chargingStation: ChargingStation;
  private tenantID: string;
  private client: any;

  private constructor(chargingStation: ChargingStation) {
    super();
    // Keep the charger
    this.chargingStation = chargingStation;
  }

  static async build(chargingStation: ChargingStation): Promise<SoapChargingStationClient> {
    const scsc = new SoapChargingStationClient(chargingStation);
    return await new Promise((fulfill, reject) => {
      let chargingStationWdsl = null;
      // Read the WSDL client files
      switch (scsc.chargingStation.ocppVersion) {
        // OCPP V1.2
        case '1.2':
          chargingStationWdsl = `${global.appRoot}/assets/server/ocpp/OCPPChargePointService12.wsdl`;
          break;
        case '1.5':
          chargingStationWdsl = `${global.appRoot}/assets/server/ocpp/OCPPChargePointService15.wsdl`;
          break;
        case '1.6':
          chargingStationWdsl = `${global.appRoot}/assets/server/ocpp/OCPPChargePointService16.wsdl`;
          break;
        default:
          // Log
          Logging.logError({
            tenantID: scsc.tenantID,
            module: 'SoapChargingStationClient', method: 'constructor',
            message: `OCPP version ${scsc.chargingStation.ocppVersion} not supported`
          });
          reject(`OCPP version ${scsc.chargingStation.ocppVersion} not supported`);
      }
      // Client options
      const options: any = {};
      // Create client
      soap.createClient(chargingStationWdsl, options, (error, client) => {
        if (error) {
          // Log
          Logging.logError({
            tenantID: scsc.tenantID,
            source: scsc.chargingStation.id,
            module: 'SoapChargingStationClient', method: 'constructor',
            message: `Error when creating SOAP client: ${error.toString()}`,
            detailedMessages: error.stack
          });
          reject(`Error when creating SOAP client for charging station with ID ${scsc.chargingStation.id}: ${error.message}`);
        } else {
          // Keep
          scsc.client = client;
          // Set endpoint
          scsc.client.setEndpoint(scsc.chargingStation.chargingStationURL);
          // Ok
          fulfill(scsc);
        }
      });
    });
  }

  initSoapHeaders(action) {
    // Clear the SOAP Headers`
    this.client.clearSoapHeaders();
    // Add them
    this.client.addSoapHeader(`<h:chargeBoxIdentity xmlns:h="urn://Ocpp/Cp/2012/06/">${this.chargingStation.id}</h:chargeBoxIdentity>`);
    this.client.addSoapHeader('<a:MessageID xmlns:a="http://www.w3.org/2005/08/addressing">urn:uuid:589e13ae-1787-49f8-ab8b-4567327b23c6</a:MessageID>');
    this.client.addSoapHeader('<a:ReplyTo xmlns:a="http://www.w3.org/2005/08/addressing"><a:Address>http://www.w3.org/2005/08/addressing/anonymous</a:Address></a:ReplyTo>');
    this.client.addSoapHeader(`<a:To xmlns:a="http://www.w3.org/2005/08/addressing">${this.chargingStation.chargingStationURL}</a:To>`);
    this.client.addSoapHeader(`<a:Action xmlns:a="http://www.w3.org/2005/08/addressing">/${action}</a:Action>`);
    this.client.addSoapHeader(`<a:From xmlns:a="http://www.w3.org/2005/08/addressing"><a:Address>${_wsdlEndpointConfig.baseUrl}</a:Address></a:From>`);
  }

  async remoteStopTransaction(params) {
    const { transactionId } = params;
    // Init SOAP Headers with the action
    this.initSoapHeaders('RemoteStopTransaction');
    // Log
    Logging.logSendAction(_moduleName, this.tenantID, this.chargingStation.id, 'RemoteStopTransaction', [transactionId, { headers: this.client.getSoapHeaders() }]);
    // Execute
    const { error, result, envelope } = await this.client.RemoteStopTransaction({
      'remoteStopTransactionRequest': {
        'transactionId': transactionId
      }
    });
    if (error) {
      // Log
      Logging.logError({
        tenantID: this.tenantID,
        source: this.chargingStation.id, module: 'SoapChargingStationClient', method: 'remoteStopTransaction',
        message: `Error when trying to stop the transaction ID ${transactionId}: ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result },
          { envelope }
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(_moduleName, this.tenantID, this.chargingStation.id, 'RemoteStopTransaction', [
      { result },
      { envelope }
    ]);
    return result;
  }

  async remoteStartTransaction(params) {
    const { tagID, connectorID } = params;
    // Init SOAP Headers with the action
    this.initSoapHeaders('RemoteStartTransaction');
    // Log
    Logging.logSendAction(_moduleName, this.tenantID, this.chargingStation.id, 'RemoteStartTransaction', [{
      'idTag': tagID,
      'connectorId': connectorID
    }, { headers: this.client.getSoapHeaders() }]
    );
    // Execute
    const { error, result, envelope } = await this.client.RemoteStartTransaction({
      'remoteStartTransactionRequest': {
        'idTag': tagID,
        'connectorId': connectorID
      }
    });
    if (error) {
      // Log
      Logging.logError({
        tenantID: this.tenantID,
        source: this.chargingStation.id, module: 'SoapChargingStationClient', method: 'remoteStartTransaction',
        message: `Error when trying to start a transaction: ${error.toString()}`, action: 'RemoteStartTransaction',
        detailedMessages: [
          { 'stack': error.stack },
          { result },
          { envelope }
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(_moduleName, this.tenantID,
      this.chargingStation.id, 'RemoteStartTransaction', [
        { result },
        { envelope }
      ]);
    return result;
  }

  async unlockConnector(params) {
    const { connectorId } = params;
    // Init SOAP Headers with the action
    this.initSoapHeaders('UnlockConnector');
    // Log
    Logging.logSendAction(_moduleName, this.tenantID, this.chargingStation.id, 'UnlockConnector', [connectorId, { headers: this.client.getSoapHeaders() }]);
    // Execute
    const { error, result, envelope } = await this.client.UnlockConnector({
      'unlockConnectorRequest': {
        'connectorId': connectorId
      }
    });
    if (error) {
      // Log
      Logging.logError({
        tenantID: this.tenantID,
        source: this.chargingStation.id, module: 'SoapChargingStationClient', method: 'unlockConnector',
        message: `Error when trying to unlock the connector '${connectorId}': ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result },
          { envelope }
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(_moduleName, this.tenantID, this.chargingStation.id, 'UnlockConnector', [
      { result },
      { envelope }
    ]);
    return result;
  }

  async reset(params) {
    const { type } = params;
    // Init SOAP Headers with the action
    this.initSoapHeaders('Reset');
    // Log
    Logging.logSendAction(_moduleName, this.tenantID, this.chargingStation.id, 'Reset', [type, { headers: this.client.getSoapHeaders() }]);
    // Execute
    const { error, result, envelope } = await this.client.Reset({
      'resetRequest': {
        'type': type
      }
    });
    if (error) {
      // Log
      Logging.logError({
        tenantID: this.tenantID,
        source: this.chargingStation.id, module: 'SoapChargingStationClient', method: 'reset',
        message: `Error when trying to reboot: ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result },
          { envelope }
        ]
      });
      return error;
    }
    // Log
    Logging.logReturnedAction(_moduleName, this.tenantID, this.chargingStation.id, 'Reset', [
      { result },
      { envelope }
    ]);
    return result;
  }

  async clearCache() {
    // Init SOAP Headers with the action
    this.initSoapHeaders('ClearCache');
    // Log
    Logging.logSendAction(_moduleName, this.tenantID, this.chargingStation.id, 'ClearCache', { headers: this.client.getSoapHeaders() });
    // Execute
    const { error, result, envelope } = await this.client.ClearCache({ clearCacheRequest: {} });
    if (error) {
      // Log
      Logging.logError({
        tenantID: this.tenantID,
        source: this.chargingStation.id, module: 'SoapChargingStationClient', method: 'clearCache',
        message: `Error when trying to clear the cache: ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result },
          { envelope }
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(_moduleName, this.tenantID, this.chargingStation.id, 'ClearCache', [
      { result },
      { envelope }
    ]);
    return result;
  }

  async getConfiguration(params) {
    const { keys } = params;
    // Init SOAP Headers with the action
    this.initSoapHeaders('GetConfiguration');
    // Log
    Logging.logSendAction(_moduleName, this.tenantID, this.chargingStation.id, 'GetConfiguration', [keys, { headers: this.client.getSoapHeaders() }]);
    // Set request
    const request: any = {
      'getConfigurationRequest': {}
    };
    // Key provided?
    if (keys) {
      // Set the keys
      request.getConfigurationRequest.key = keys;
    }
    // Execute
    const { error, result, envelope } = await this.client.GetConfiguration(request);
    if (error) {
      // Log
      Logging.logError({
        tenantID: this.tenantID,
        source: this.chargingStation.id, module: 'SoapChargingStationClient', method: 'getConfiguration',
        message: `Error when trying to get the configuration: ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result },
          { envelope }
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(_moduleName, this.tenantID, this.chargingStation.id, 'GetConfiguration', [
      { result },
      { envelope }
    ]);
    return result;
  }

  async changeConfiguration(params) {
    const { key, value } = params;
    // Init SOAP Headers with the action
    this.initSoapHeaders('ChangeConfiguration');
    // Log
    Logging.logSendAction(_moduleName, this.tenantID, this.chargingStation.id, 'ChangeConfiguration', [{
      'key': key,
      'value': value
    }, { headers: this.client.getSoapHeaders() }]);
    // Execute
    const { error, result, envelope } = await this.client.ChangeConfiguration({
      'changeConfigurationRequest': {
        'key': key,
        'value': value
      }
    });
    if (error) {
      // Log
      Logging.logError({
        tenantID: this.tenantID,
        source: this.chargingStation.id, module: 'SoapChargingStationClient', method: 'changeConfiguration',
        message: `Error when trying to change the configuration parameter '${key}' with value '${value}': ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result },
          { envelope }
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(_moduleName, this.tenantID, this.chargingStation.id, 'ChangeConfiguration', [
      { result },
      { envelope }
    ]);
    return result;
  }

  getChargingStation() {
    return this.chargingStation;
  }
}
